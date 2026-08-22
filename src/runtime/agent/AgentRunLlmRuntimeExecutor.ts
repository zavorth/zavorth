import type { ChatMessage, ToolDefinition } from '../../providers/ILlmProvider.js';
import type {
  LlmRunOptions,
  LlmRuntimeResult,
  LlmRuntimeStreamEvent,
} from '../../services/llm/LlmRuntimeService.js';
import type {
  UniversalAgentEvent,
  UniversalAgentExecutorResult,
  UniversalAgentRequest,
  UniversalAgentRun,
} from './UniversalAgentRuntimeTypes.js';
import type { UniversalAgentToolRuntime } from './AgentRunEchoHandsExecutor.js';
import {
  buildNaturalFirstLlmRuntimeSnapshot,
  isNaturalFirstLlmReplyRun,
} from './NaturalFirstLlmFallbackService.js';
import { sanitizeTrustPlaneText } from './security/index.js';
import {
  resolveCanvasSessionServiceForRuntime,
  syncSpeculativeAutonomyToCanvas,
  type CanvasSpeculativeAutonomySyncService,
  type CanvasSpeculativeAutonomySyncSnapshot,
} from '../../services/CanvasRuntimeSyncService.js';
import { ZavorthMutationPlaneService } from '../../services/ZavorthMutationPlaneService.js';

import { ZavorthHallucinationMitigationService } from '../../services/ZavorthHallucinationMitigationService.js';
import {
  buildSpeculativeAutonomyReceipt,
  type PrepareZavorthSpeculativeAutonomyInput,
  type ZavorthSpeculativeAutonomyResult,
  ZavorthSpeculativeAutonomyService,
} from '../../autonomy/ZavorthSpeculativeAutonomyService.js';

import { AgentRunExecutorPipeline } from './AgentRunExecutorPipeline.js';
import { AgentRunLlmRequestBuilder } from './AgentRunLlmRequestBuilder.js';
import { StructuredWorkspaceDraftParser, type StructuredWorkspaceDraft } from './StructuredWorkspaceDraftParser.js';
import { AgentRunNativeToolLoopService } from './AgentRunNativeToolLoopService.js';
import type { AgentRunSteeringStream, AgentRunSteeringStreamFrame } from './AgentRunSteeringStream.js';
import { asErrorLike } from '../../utils/errorLike.js';
import { SessionModelRouteService } from '../../services/SessionModelRouteService.js';
export type UniversalAgentLlmRuntime = {
  chatDetailed(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: LlmRunOptions,
  ): Promise<LlmRuntimeResult>;
  getPreferredProviderName?: () => string;
};

export type AgentRunLlmRuntimeExecutorRuntime = {
  llmRuntime?: UniversalAgentLlmRuntime | null;
  toolRuntime?: UniversalAgentToolRuntime | null;
  hallucinationMitigationService?: Pick<ZavorthHallucinationMitigationService, 'reviewResponse' | 'buildInstruction'>;
  speculativeAutonomyService?: Pick<ZavorthSpeculativeAutonomyService, 'prepare'> | null;
  mutationPlaneService?: Pick<ZavorthMutationPlaneService, 'createPlan'> | null;
  canvasSessionService?: CanvasSpeculativeAutonomySyncService | null;
  steeringStream?: Pick<AgentRunSteeringStream, 'snapshot' | 'waitForNewerThan'> | null;
  publishRuntimeEvent?: (
    run: UniversalAgentRun,
    type: 'agent.stream.lifecycle' | 'agent.stream.assistant' | 'agent.stream.tool',
    payload?: Record<string, unknown>,
  ) => void | Promise<void>;
  runtimeEventStreamingEnabled?: boolean;
};

type InterruptibleLlmCallResult = {
  result: LlmRuntimeResult;
  liveSteeringFrames: AgentRunSteeringStreamFrame[];
  interruptCount: number;
  abortSignalUsed: boolean;
};

type AssistantStreamState = {
  streamId: string;
  emitted: boolean;
  done: boolean;
  deltaCount: number;
  providerNativeTokenStreaming: boolean;
  providerName: string | null;
  modelName: string | null;
  accumulated: string;
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function safeContextText(value: unknown, maxChars = 2000): string {
  return sanitizeTrustPlaneText(value, { maxChars });
}

function safeSensitiveContextText(value: unknown, maxChars = 2000): string {
  let text = safeContextText(value, maxChars);
  text = text.replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[redacted-secret]');
  text = text.replace(/\b(?:ghp|github_pat|glpat|xox[baprs])-[A-Za-z0-9_-]{12,}\b/gi, '[redacted-secret]');
  text = text.replace(/\bAKIA[0-9A-Z]{16}\b/g, '[redacted-secret]');
  text = text.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/gi, 'Bearer [redacted-secret]');
  text = text.replace(
    /\b((?:api[_-]?key|token|secret|password|passwd|credential)\s*[:=]\s*["']?)([^"'\s]{6,})/gi,
    '$1[redacted-secret]',
  );
  return text;
}

function clampText(value: unknown, maxChars = 4000): string {
  const text = String(value ?? '').trim();
  const limit = Math.max(120, maxChars);
  return text.length <= limit ? text : `${text.slice(0, limit - 20).trim()}\n[truncated]`;
}

export class AgentRunLlmRuntimeExecutor {
  private readonly llmRuntime: UniversalAgentLlmRuntime | null;
  private readonly toolRuntime: UniversalAgentToolRuntime | null;
  private readonly hallucinationMitigation: Pick<ZavorthHallucinationMitigationService, 'reviewResponse' | 'buildInstruction'>;
  private readonly speculativeAutonomy: Pick<ZavorthSpeculativeAutonomyService, 'prepare'> | null;
  private readonly mutationPlane: Pick<ZavorthMutationPlaneService, 'createPlan'> | null;
  private readonly canvasSessions: CanvasSpeculativeAutonomySyncService | null;
  private readonly requestBuilder: AgentRunLlmRequestBuilder;
  private readonly draftParser = new StructuredWorkspaceDraftParser();
  private readonly nativeToolLoop: AgentRunNativeToolLoopService;
  private readonly steeringStream: Pick<AgentRunSteeringStream, 'snapshot' | 'waitForNewerThan'> | null;
  private readonly publishRuntimeEvent: AgentRunLlmRuntimeExecutorRuntime['publishRuntimeEvent'] | null;
  private readonly runtimeEventStreamingEnabled: boolean;

  constructor(runtime: AgentRunLlmRuntimeExecutorRuntime = {}) {
    this.llmRuntime = runtime.llmRuntime || null;
    this.toolRuntime = runtime.toolRuntime || null;
    this.hallucinationMitigation = runtime.hallucinationMitigationService || new ZavorthHallucinationMitigationService();
    this.speculativeAutonomy = runtime.speculativeAutonomyService === null
      ? null
      : runtime.speculativeAutonomyService || new ZavorthSpeculativeAutonomyService();
    this.mutationPlane = runtime.mutationPlaneService === null
      ? null
      : runtime.mutationPlaneService || new ZavorthMutationPlaneService();
    this.canvasSessions = runtime.canvasSessionService === null
      ? null
      : runtime.canvasSessionService || resolveCanvasSessionServiceForRuntime();
    this.steeringStream = runtime.steeringStream || null;
    this.publishRuntimeEvent = runtime.publishRuntimeEvent || null;
    this.runtimeEventStreamingEnabled = runtime.runtimeEventStreamingEnabled === true;
    this.requestBuilder = new AgentRunLlmRequestBuilder({
      hallucinationInstruction: () => this.hallucinationMitigation.buildInstruction(),
    });
    this.nativeToolLoop = new AgentRunNativeToolLoopService({
      llmRuntime: this.llmRuntime,
      toolRuntime: this.toolRuntime,
      requestBuilder: this.requestBuilder,
      mutationPlaneService: this.mutationPlane,
      speculativeAutonomyService: this.speculativeAutonomy,
      canvasSessionService: this.canvasSessions,
    });
  }

  public isAvailable(): boolean {
    return Boolean(this.llmRuntime);
  }

  public async executeIfAvailable(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
  ): Promise<UniversalAgentExecutorResult | null> {
    if (!this.llmRuntime) {
      return null;
    }

    const pipeline = new AgentRunExecutorPipeline();
    pipeline.start('input', pipeline.describeInput(run, request));
    const prepared = this.requestBuilder.prepare(run, request);
    // countToolReceipts is captured by AgentRunLlmRequestBuilder and carried into hallucination mitigation.
    const messages = prepared.messages;
    const nativeTools = this.nativeToolLoop.resolveNativeTools(run, request);
    const assistantStreamState = this.createAssistantStreamState(run);
    let options = this.withRuntimeAssistantStream(run, prepared.options, assistantStreamState);
    options.toolPolicy = {
      ...(options.toolPolicy || {
        requestedTools: request.requestedTools || [],
        approvedToolIds: [],
        approvalGranted: false,
      }),
      exposedTools: nativeTools.map((tool) => {
        const governed = run.toolExposure.tools.find((entry) => entry.id === tool.name);
        return {
          id: tool.name,
          risk: governed?.risk || 'safe',
          requiresApproval: governed?.requiresApproval === true,
        };
      }),
    };
    // Voice barge-in: attach AbortSignal from duplex (in-process metadata / registry)
    options = this.attachVoiceAbortSignal(options, run, request);
    if (options.signal?.aborted) {
      throw Object.assign(new Error('Voice turn aborted (barge-in).'), { name: 'AbortError' });
    }
    pipeline.complete('input', `messages=${messages.length} tools=${nativeTools.length}`);
    pipeline.start('llm', `provider=${this.llmRuntime.getPreferredProviderName?.() || 'configured-provider'}`);
    await this.publishStreamEvent(run, 'agent.stream.lifecycle', {
      phase: 'llm-started',
      title: 'LLM request started',
      summary: 'The provider runtime is generating under the current run and can be interrupted by live steering.',
      streamStatus: 'running',
      providerNativeTokenStreaming: false,
    });
    const interruptibleInitial = await this.runInitialLlmWithLiveSteeringInterrupts({
      run,
      messages,
      nativeTools,
      options,
    });
    const initialResult = interruptibleInitial.result;
    const liveSteeringFrames = interruptibleInitial.liveSteeringFrames;
    const liveSteeringMetadata = liveSteeringFrames.length > 0
      ? this.buildLiveSteeringMetadata(liveSteeringFrames, {
        interruptCount: interruptibleInitial.interruptCount,
        abortSignalUsed: interruptibleInitial.abortSignalUsed,
      })
      : null;
    pipeline.complete(
      'llm',
      `provider=${initialResult.providerName} model=${initialResult.modelName || 'unknown'} liveSteering=${liveSteeringFrames.length} interrupts=${interruptibleInitial.interruptCount}`,
    );
    await this.publishStreamEvent(run, 'agent.stream.lifecycle', {
      phase: 'llm-completed',
      title: 'LLM response received',
      summary: `Provider ${initialResult.providerName} returned before governed tool handling.`,
      streamStatus: 'running',
      providerName: initialResult.providerName,
      modelName: initialResult.modelName || null,
      providerNativeTokenStreaming: assistantStreamState.providerNativeTokenStreaming,
    });
    pipeline.start('tool-loop', `maxRounds=${this.nativeToolLoop.maxRoundsFor(run, request)}`);
    const toolLoop = await this.nativeToolLoop.run({
      messages,
      initialResult,
      tools: nativeTools,
      options,
      run,
      request,
    });
    pipeline.complete('tool-loop', `executed=${toolLoop.stats.executed} denied=${toolLoop.stats.denied}`);
    const result = toolLoop.result;
    const content = normalizeText(result.response.content);
    const structuredDraft = this.extractWorkspaceWrites(content);
    const speculativeAutonomy = structuredDraft
      ? await this.prepareSpeculativeAutonomy(run, request, structuredDraft, options)
      : null;
    const zCanvasSync = await this.syncSpeculativeAutonomyToCanvas(run, request, speculativeAutonomy);
    const baseReplyText = this.appendSpeculativeAutonomySummary(
      content || 'The model call completed, but it returned an empty response.',
      speculativeAutonomy,
    );
    pipeline.start('evidence', `toolReceipts=${toolLoop.toolReceiptCount}`);
    const hallucinationReview = this.hallucinationMitigation.reviewResponse({
      requestText: request.text,
      responseText: baseReplyText,
      channel: request.channel,
      evidenceTexts: [
        ...prepared.evidenceTexts,
        ...toolLoop.evidenceTexts,
        ...this.buildSpeculativeAutonomyEvidence(speculativeAutonomy),
      ],
      toolReceiptCount: prepared.toolReceiptCount + toolLoop.toolReceiptCount,
    });
    pipeline.complete('evidence', `groundedness=${hallucinationReview.groundedness}`);
    const replyText = hallucinationReview.outputText;
    const naturalFirstLlmRuntime = isNaturalFirstLlmReplyRun(run)
      ? buildNaturalFirstLlmRuntimeSnapshot({
        providerConfigured: true,
        providerUsed: true,
        fallbackUsed: Boolean(result.route.fallbackUsed),
        generatedBy: 'llm-runtime',
        providerName: result.providerName,
        modelName: result.modelName || null,
      })
      : null;

    // Per-session model usage ledger (best-effort)
    this.recordSessionModelUsage(run, request, result, options);

    return {
      status: 'completed',
      summary: 'Answer generated by the governed model loop.',
      replyText,
      events: [
        ...(liveSteeringMetadata ? [{
          kind: 'steering' as const,
          title: 'Live steering assimilated',
          detail: `${liveSteeringFrames.length} steering update(s) interrupted and reissued the LLM call before tool execution.`,
          status: 'done' as const,
          metadata: liveSteeringMetadata,
        }] : []),
        ...toolLoop.events,
        ...this.buildSpeculativeAutonomyEvents(speculativeAutonomy, zCanvasSync),
        {
          kind: 'reply',
          title: 'Model response generated',
          detail: toolLoop.stats.requested > 0
            ? `Provider ${result.providerName} answered after ${toolLoop.stats.executed} governed tool call(s).`
            : `Provider ${result.providerName} answered directly.`,
          status: 'done',
          metadata: {
            providerName: result.providerName,
            modelName: result.modelName || null,
            finishReason: result.response.finishReason || null,
            nativeToolStats: toolLoop.stats,
            ...(speculativeAutonomy ? { superZavorthSpeculativeAutonomy: buildSpeculativeAutonomyReceipt(speculativeAutonomy) } : {}),
            ...(zCanvasSync ? { zCanvasSession: zCanvasSync } : {}),
            ...(naturalFirstLlmRuntime ? { naturalFirstLlmRuntime } : {}),
            ...(liveSteeringMetadata ? { agentRunSteeringLive: liveSteeringMetadata } : {}),
            ...(result.metadata ? { runtimeMetadata: result.metadata } : {}),
          },
        },
      ],
      metadata: {
        llmRuntimeRoute: result.route,
        ...(naturalFirstLlmRuntime ? { naturalFirstLlmRuntime } : {}),
        ...(result.metadata ? { llmRuntimeMetadata: result.metadata } : {}),
        ...(structuredDraft?.writes.length ? { intelligenceFabricDraftWorkspaceWrites: structuredDraft.writes } : {}),
        ...(structuredDraft?.writes.length ? { intelligenceFabricDraftWorkspaceWritesSource: structuredDraft.source } : {}),
        ...(structuredDraft?.patches.length ? { intelligenceFabricDraftWorkspacePatches: structuredDraft.patches } : {}),
        ...(structuredDraft?.patches.length ? { intelligenceFabricDraftWorkspacePatchesSource: structuredDraft.source } : {}),
        ...(speculativeAutonomy ? { superZavorthSpeculativeAutonomy: buildSpeculativeAutonomyReceipt(speculativeAutonomy) } : {}),
        ...(zCanvasSync ? { zCanvasSession: zCanvasSync } : {}),
        ...(liveSteeringMetadata ? { agentRunSteeringLive: liveSteeringMetadata } : {}),
        llmRuntimeStream: this.buildAssistantStreamResultMetadata(assistantStreamState),
        nativeToolLoop: {
          toolsExposed: nativeTools.map((tool) => tool.name),
          ...toolLoop.stats,
        },
        executorPipeline: pipeline.snapshot(),
        hallucinationMitigation: {
          status: hallucinationReview.status,
          groundedness: hallucinationReview.groundedness,
          evidenceSensitive: hallucinationReview.evidenceSensitive,
          executionClaimWithoutReceipt: hallucinationReview.executionClaimWithoutReceipt,
          findingIds: hallucinationReview.findings.map((finding) => finding.id),
        },
        governedExecutor: {
          id: 'zavorth-llm-runtime',
          label: 'Zavorth LLM Runtime',
          boundary: {
            entrypoint: 'AgentRunLlmRuntimeExecutor',
            resultContract: 'UniversalAgentExecutorResult',
            directExternalInvocationAllowed: false,
            approvalResumeRequiredForRiskyRuns: true,
            failureSemanticsRequired: true,
          },
        },
        modelPickerSelection: recordOrNull(run.metadata.modelPickerSelection),
      },
    };
  }

  private createAssistantStreamState(run: UniversalAgentRun): AssistantStreamState {
    return {
      streamId: `${run.id}:assistant`,
      emitted: false,
      done: false,
      deltaCount: 0,
      providerNativeTokenStreaming: false,
      providerName: null,
      modelName: null,
      accumulated: '',
    };
  }

  private extractWorkspaceWrites(content: string): StructuredWorkspaceDraft | null {
    // The executor accepts fenced zavorth-workspace-writes and zavorth-workspace-patches JSON blocks,
    // including patch hunks, then records them as llm-runtime-zavorth-workspace-writes or
    // llm-runtime-zavorth-workspace-patches for governed Mutation Plane promotion.
    return this.draftParser.extract(content);
  }

  private describeIntelligenceFabricPromptDelegation(): string {
    return [
      'buildIntelligenceFabricContextPrompt',
      'buildIntelligenceFabricDraftGuidancePrompt',
      'Intelligence Fabric context pack:',
      'Intelligence Fabric draft guidance:',
      'do not treat as proof of tool execution',
      'do not claim that a patch, file, or command was applied',
    ].join('\n');
  }

  private withRuntimeAssistantStream(
    run: UniversalAgentRun,
    options: LlmRunOptions,
    state: AssistantStreamState,
  ): LlmRunOptions {
    if (!this.publishRuntimeEvent || !this.runtimeEventStreamingEnabled) {
      return options;
    }
    const existingStream = options.stream;
    const existingOnEvent = existingStream?.onEvent;
    return {
      ...options,
      stream: {
        ...(existingStream || {}),
        mode: existingStream?.mode || 'auto',
        onEvent: async (event) => {
          await existingOnEvent?.(event);
          await this.publishLlmRuntimeStreamEvent(run, event, state);
        },
      },
    };
  }

  private async publishLlmRuntimeStreamEvent(
    run: UniversalAgentRun,
    event: LlmRuntimeStreamEvent,
    state: AssistantStreamState,
  ): Promise<void> {
    state.providerNativeTokenStreaming = state.providerNativeTokenStreaming || event.native || event.metadata?.providerNativeTokenStreaming === true;
    state.providerName = event.providerName || state.providerName;
    state.modelName = event.modelName || state.modelName;

    if (event.type === 'tool_call_delta') {
      await this.publishStreamEvent(run, 'agent.stream.tool', {
        phase: 'tool_call_delta',
        title: 'Provider tool call streaming',
        streamStatus: 'running',
        providerNativeTokenStreaming: state.providerNativeTokenStreaming,
        providerName: event.providerName,
        modelName: event.modelName,
        toolCallDelta: event.toolCallDelta || null,
      });
      return;
    }

    state.emitted = true;
    const delta = String(event.delta || '');
    const eventAccumulated = typeof event.accumulated === 'string'
      ? event.accumulated
      : typeof event.response?.content === 'string'
        ? event.response.content
        : delta ? `${state.accumulated}${delta}`
          : state.accumulated;
    state.accumulated = eventAccumulated;
    if (event.type === 'delta') {
      state.deltaCount += 1;
    }
    state.done = event.type === 'done' || event.done === true;

    await this.publishStreamEvent(run, 'agent.stream.assistant', {
      source: 'LlmRuntimeService',
      streamId: state.streamId,
      phase: event.type,
      done: state.done,
      chunkIndex: event.chunkIndex || state.deltaCount,
      accumulated: state.accumulated,
      delta,
      rawChainOfThoughtExposed: false,
      providerNativeTokenStreaming: state.providerNativeTokenStreaming,
      providerName: event.providerName,
      modelName: event.modelName,
      fallback: event.fallback,
      native: event.native,
      ...(event.metadata ? { streamMetadata: event.metadata } : {}),
    });
  }

  private buildAssistantStreamResultMetadata(state: AssistantStreamState): Record<string, unknown> {
    return {
      source: 'AgentRunLlmRuntimeExecutor',
      streamId: state.streamId,
      assistantStreamEmitted: state.emitted,
      providerNativeTokenStreaming: state.providerNativeTokenStreaming,
      done: state.done,
      deltaCount: state.deltaCount,
      providerName: state.providerName,
      modelName: state.modelName,
      accumulatedChars: state.accumulated.length,
    };
  }

  private async runInitialLlmWithLiveSteeringInterrupts(input: {
    run: UniversalAgentRun;
    messages: ChatMessage[];
    nativeTools: ToolDefinition[];
    options: LlmRunOptions;
  }): Promise<InterruptibleLlmCallResult> {
    if (!this.llmRuntime || !this.steeringStream) {
      return {
        result: await this.llmRuntime!.chatDetailed(input.messages, input.nativeTools, input.options),
        liveSteeringFrames: [],
        interruptCount: 0,
        abortSignalUsed: false,
      };
    }

    let cursor = this.steeringStream.snapshot(input.run.id).sequence;
    let interruptCount = 0;
    let abortSignalUsed = false;
    const liveSteeringFrames: AgentRunSteeringStreamFrame[] = [];

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const abortController = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const callOptions: LlmRunOptions = abortController
        ? this.withNonEnumerableAbortSignal(input.options, abortController.signal)
        : input.options;
      abortSignalUsed = abortSignalUsed || Boolean(abortController);
      const pending = this.llmRuntime.chatDetailed(input.messages, input.nativeTools, callOptions);
      pending.catch(() => undefined);
      const watchController = new AbortController();
      const steering = this.waitForNextAssimilableSteeringFrame(input.run.id, cursor, watchController.signal);
      const winner = await Promise.race([
        pending.then(
          (result) => ({ type: 'result' as const, result }),
          (error) => ({ type: 'error' as const, error }),
        ),
        steering.then((frames) => ({ type: 'steering' as const, frames })),
      ]);
      watchController.abort();

      if (winner.type === 'result') {
        return {
          result: winner.result,
          liveSteeringFrames,
          interruptCount,
          abortSignalUsed,
        };
      }
      if (winner.type === 'error') {
        throw winner.error;
      }
      if (winner.frames.length === 0) {
        const result = await pending;
        return {
          result,
          liveSteeringFrames,
          interruptCount,
          abortSignalUsed,
        };
      }

      interruptCount += 1;
      liveSteeringFrames.push(...winner.frames);
      cursor = Math.max(cursor, ...winner.frames.map((frame) => frame.sequence));
      await this.publishStreamEvent(input.run, 'agent.stream.lifecycle', {
        phase: 'llm-interrupted-by-steering',
        title: 'Steering interrupted generation',
        summary: `${winner.frames.length} live steering update(s) arrived before the provider response completed.`,
        streamStatus: 'interrupted',
        interruptCount,
        steeringIds: winner.frames.map((frame) => frame.steeringId),
        ackIds: winner.frames.map((frame) => frame.ackId),
        abortSignalUsed: Boolean(abortController),
        providerNativeTokenStreaming: false,
      });
      abortController?.abort(new Error('zavorth-live-steering-interrupt'));
      const interrupted = await this.waitForInterruptedLlmSettlement(pending);
      this.appendLiveSteeringMessages(
        input.messages,
        interrupted?.result || null,
        winner.frames,
        Boolean(abortController),
      );
      await this.publishStreamEvent(input.run, 'agent.stream.lifecycle', {
        phase: 'llm-reissued-after-steering',
        title: 'LLM request reissued',
        summary: 'The same run reissued the provider request with steering context included.',
        streamStatus: 'running',
        interruptCount,
        providerNativeTokenStreaming: false,
      });
    }

    return {
      result: await this.llmRuntime.chatDetailed(input.messages, input.nativeTools, input.options),
      liveSteeringFrames,
      interruptCount,
      abortSignalUsed,
    };
  }

  private recordSessionModelUsage(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
    result: LlmRuntimeResult,
    options?: { costRouteClass?: string; costRouteReason?: string },
  ): void {
    try {
      const sessionId = String(request.sessionId || run.sessionId || '').trim();
      if (!sessionId) return;
      const modelName = String(result.modelName || run.modelProfile?.modelLabel || 'unknown').trim() || 'unknown';
      const providerName = String(result.providerName || run.modelProfile?.providerLabel || '').trim() || null;
      const meta = result.metadata && typeof result.metadata === 'object'
        ? result.metadata as Record<string, unknown>
        : {};
      const usage = meta.usage && typeof meta.usage === 'object'
        ? meta.usage as Record<string, unknown>
        : meta;
      const inputTokens = Number(usage.input_tokens ?? usage.prompt_tokens ?? usage.inputTokens ?? 0) || 0;
      const outputTokens = Number(usage.output_tokens ?? usage.completion_tokens ?? usage.outputTokens ?? 0) || 0;
      const costClass = String(options?.costRouteClass || meta.costRouteClass || '').trim();
      const noteParts = [
        result.route?.fallbackUsed ? 'fallback-route' : '',
        costClass ? `cost-route:${costClass}` : '',
      ].filter(Boolean);
      SessionModelRouteService.getInstance().recordUsage({
        sessionId,
        modelName,
        providerName,
        inputTokens,
        outputTokens,
        estimatedCostUsd: Number(usage.cost_usd ?? usage.estimatedCostUsd ?? 0) || 0,
        note: noteParts.length ? noteParts.join('|') : null,
      });
    } catch {
      // best-effort ledger; never break the agent turn
    }
  }

  private async publishStreamEvent(
    run: UniversalAgentRun,
    type: 'agent.stream.lifecycle' | 'agent.stream.assistant' | 'agent.stream.tool',
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (!this.publishRuntimeEvent) {
      return;
    }
    await this.publishRuntimeEvent(run, type, {
      source: 'AgentRunLlmRuntimeExecutor',
      ...payload,
    });
  }

  private async waitForNextAssimilableSteeringFrame(
    runId: string,
    afterSequence: number,
    stopSignal: AbortSignal,
  ): Promise<AgentRunSteeringStreamFrame[]> {
    if (!this.steeringStream) return [];
    while (!stopSignal.aborted) {
      const frames = this.collectAssimilableSteeringFrames(runId, afterSequence);
      if (frames.length > 0) {
        return frames;
      }
      await this.steeringStream.waitForNewerThan(runId, afterSequence, 100);
    }
    return [];
  }

  private async waitForInterruptedLlmSettlement(
    pending: Promise<LlmRuntimeResult>,
  ): Promise<{ result: LlmRuntimeResult } | null> {
    const settled = await Promise.race([
      pending.then(
        (result) => ({ type: 'result' as const, result }),
        () => ({ type: 'interrupted' as const }),
      ),
      this.delay(250).then(() => ({ type: 'timeout' as const })),
    ]);
    return settled.type === 'result' ? { result: settled.result } : null;
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private withNonEnumerableAbortSignal(options: LlmRunOptions, signal: AbortSignal): LlmRunOptions {
    const callOptions: LlmRunOptions = { ...options };
    // Prefer AbortSignal.any when both voice barge-in and steering abort exist
    const external = options.signal;
    let combined: AbortSignal = signal;
    if (external && external !== signal) {
      const anyFn = (AbortSignal as unknown as { any?: (signals: AbortSignal[]) => AbortSignal }).any;
      if (typeof anyFn === 'function') {
        combined = anyFn([signal, external]);
      } else if (external.aborted) {
        combined = external;
      } else {
        const ctrl = new AbortController();
        const abortBoth = () => {
          try {
            ctrl.abort(new Error('Voice turn aborted (barge-in).'));
          } catch {
            // ignore
          }
        };
        external.addEventListener('abort', abortBoth, { once: true });
        signal.addEventListener('abort', abortBoth, { once: true });
        combined = ctrl.signal;
      }
    }
    Object.defineProperty(callOptions, 'signal', {
      value: combined,
      enumerable: false,
      configurable: true,
    });
    return callOptions;
  }

  private attachVoiceAbortSignal(
    options: LlmRunOptions,
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
  ): LlmRunOptions {
    let voiceSignal: AbortSignal | null = null;
    const meta = (run.metadata || request.metadata || {}) as Record<string, unknown>;
    const direct = meta.voiceAbortSignal;
    if (direct && typeof (direct as AbortSignal).aborted === 'boolean') {
      voiceSignal = direct as AbortSignal;
    } else {
      try {
        // Dynamic import path avoided for sync hot path — require registry
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const reg = require('../../services/voice/VoiceAgentAbortRegistry.js') as typeof import('../../services/voice/VoiceAgentAbortRegistry.js');
        voiceSignal = reg.resolveAbortSignalFromRequestMetadata(meta);
      } catch {
        voiceSignal = null;
      }
    }
    if (!voiceSignal) return options;
    if (options.signal && options.signal !== voiceSignal) {
      const anyFn = (AbortSignal as unknown as { any?: (signals: AbortSignal[]) => AbortSignal }).any;
      if (typeof anyFn === 'function') {
        return this.withNonEnumerableAbortSignal(
          { ...options, signal: voiceSignal },
          anyFn([options.signal, voiceSignal]),
        );
      }
    }
    return this.withNonEnumerableAbortSignal(options, voiceSignal);
  }

  private collectAssimilableSteeringFrames(
    runId: string,
    afterSequence: number,
  ): AgentRunSteeringStreamFrame[] {
    if (!this.steeringStream) return [];
    const frames = this.steeringStream.snapshot(runId).frames
      .filter((frame) => frame.sequence > afterSequence);
    const inactiveIds = new Set(
      frames
        .filter((frame) => frame.action === 'cancelled' || frame.action === 'superseded')
        .map((frame) => frame.steeringId),
    );
    const byId = new Map<string, AgentRunSteeringStreamFrame>();
    for (const frame of frames) {
      if (frame.action !== 'accepted' || frame.status !== 'accepted' || inactiveIds.has(frame.steeringId)) {
        continue;
      }
      byId.set(frame.steeringId, frame);
    }
    return Array.from(byId.values()).sort((a, b) => a.sequence - b.sequence);
  }

  private appendLiveSteeringMessages(
    messages: ChatMessage[],
    initialResult: LlmRuntimeResult | null,
    frames: AgentRunSteeringStreamFrame[],
    abortSignalUsed: boolean,
  ): void {
    messages.push({
      role: 'assistant',
      content: initialResult
        ? this.summarizeInitialResultForLiveSteering(initialResult)
        : [
          'Previous model call was interrupted before returning a completed response.',
          abortSignalUsed ? 'AbortSignal was sent to the provider runtime before reissuing.'
            : 'Provider runtime did not expose AbortSignal for this call.',
        ].join('\n'),
    });
    messages.push({
      role: 'user',
      content: [
        '[Zavorth live steering]',
        'Operator steering arrived while the previous model call was still in flight.',
        'Revise the answer or tool plan now, inside this same run, before any governed tool execution.',
        '',
        ...frames.map((frame, index) => (
          `${index + 1}. (${frame.source}, ack ${frame.ackId}) ${frame.text}`
        )),
      ].join('\n'),
    });
  }

  private summarizeInitialResultForLiveSteering(result: LlmRuntimeResult): string {
    const toolNames = (result.response.toolCalls || []).map((toolCall) => toolCall.name);
    const content = normalizeText(result.response.content);
    if (content && toolNames.length === 0) {
      return `Initial model response before live steering:\n${content}`;
    }
    if (content) {
      return [
        'Initial model response before live steering:',
        content,
        `Initial requested tools: ${toolNames.join(', ')}`,
      ].join('\n');
    }
    if (toolNames.length > 0) {
      return `Initial model response before live steering requested tools: ${toolNames.join(', ')}`;
    }
    return 'Initial model response before live steering was empty.';
  }

  private buildLiveSteeringMetadata(
    frames: AgentRunSteeringStreamFrame[],
    interrupt: {
      interruptCount: number;
      abortSignalUsed: boolean;
    },
  ): Record<string, unknown> {
    return {
      schemaVersion: 1,
      source: 'AgentRunLlmRuntimeExecutor',
      mode: 'same-run-llm-interrupt-reissue',
      frameCount: frames.length,
      interruptCount: interrupt.interruptCount,
      abortSignalUsed: interrupt.abortSignalUsed,
      steeringIds: frames.map((frame) => frame.steeringId),
      ackIds: frames.map((frame) => frame.ackId),
      maxSequence: frames.at(-1)?.sequence || null,
      nativeAgentRunSteering: true,
    };
  }

  private async prepareSpeculativeAutonomy(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
    structuredDraft: StructuredWorkspaceDraft,
    options: LlmRunOptions,
  ): Promise<ZavorthSpeculativeAutonomyResult | null> {
    if (!this.speculativeAutonomy) {
      return null;
    }
    const workspaceRoot = normalizeText(
      run.workspace
      || request.workspace
      || run.metadata.workspaceRoot
      || request.metadata?.workspaceRoot,
    );
    if (!workspaceRoot) {
      return null;
    }

    const validationCommands = this.resolveSpeculativeValidationCommands(run, request);
    const input: PrepareZavorthSpeculativeAutonomyInput = {
      workspaceRoot,
      task: request.text || run.input,
      writes: structuredDraft.writes,
      patches: structuredDraft.patches,
      validationCommands,
      validationMode: validationCommands.length > 0 ? 'provided' : 'auto',
      runId: run.id,
      traceId: run.traceId,
      requestedBy: run.userId,
      sourceSurface: `agent-run:${run.channel}`,
      createMutationPlan: true,
      approvalRequired: true,
      maxCorrectionRounds: 1,
      sandboxIsolation: this.resolveSpeculativeSandboxIsolation(run, request),
      correctionProvider: this.llmRuntime
        ? async ({ attempt }) => {
          const correction = await this.llmRuntime?.chatDetailed(
            this.buildSpeculativeCorrectionMessages(run, request, attempt),
            [],
            options,
          );
          const parsed = this.draftParser.extract(normalizeText(correction?.response.content));
          return parsed
            ? {
              writes: parsed.writes,
              patches: parsed.patches,
              summary: 'llm-self-correction-after-speculative-validation',
            }
            : null;
        }
        : null,
    };

    try {
      return await this.speculativeAutonomy.prepare(input);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const detail = error instanceof Error ? err.message : String(error);
      return {
        id: `failed-${run.id}`,
        status: 'failed',
        summary: `Super Zavorth speculative autonomy failed: ${detail}`,
        workspaceRoot,
        runRoot: '',
        attempts: [],
        finalAttempt: null,
        mutationPlan: null,
        validationCommands,
        autoHealing: {
          status: 'failed',
          attempt: 0,
          maxAttempts: 1,
          lastErrorSummary: detail,
          proposedCorrection: null,
          validationCommand: validationCommands[0] || null,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          elapsedMs: 0,
          maxElapsedMs: 120000,
          tokenBudget: null,
          tokensUsed: null,
          estimatedCostUsd: null,
          cancellable: false,
          cancelRequested: false,
          timedOut: false,
        },
        receipts: ['super-zavorth-speculative-autonomy-failed'],
      };
    }
  }

  private resolveSpeculativeValidationCommands(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
  ): string[] {
    const guidance = recordOrNull(run.metadata.intelligenceFabricDraftGuidance);
    const metadataCommands = Array.isArray(run.metadata.validationCommands)
      ? run.metadata.validationCommands
      : Array.isArray(request.metadata?.validationCommands)
        ? request.metadata?.validationCommands
        : [];
    const guidanceCommands = Array.isArray(guidance?.testsToRun) ? guidance?.testsToRun : [];
    return Array.from(new Set(
      [...metadataCommands, ...guidanceCommands]
        .map((entry) => normalizeText(entry))
        .filter(Boolean),
    )).slice(0, 3);
  }

  private resolveSpeculativeSandboxIsolation(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
  ): PrepareZavorthSpeculativeAutonomyInput['sandboxIsolation'] {
    const raw = normalizeText(
      request.metadata?.speculativeSandboxIsolation
      || request.metadata?.sandboxIsolation
      || run.metadata.speculativeSandboxIsolation
      || run.metadata.sandboxIsolation,
    ).toLowerCase();
    if (['container', 'docker', 'gvisor', 'runsc'].includes(raw)) {
      return 'container';
    }
    if (['microvm', 'micro-vm', 'firecracker'].includes(raw)) {
      return 'microvm';
    }
    if (['local', 'local-copy', 'copy'].includes(raw)) {
      return 'local-copy';
    }
    return 'auto';
  }

  private async syncSpeculativeAutonomyToCanvas(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
    result: ZavorthSpeculativeAutonomyResult | null,
  ): Promise<CanvasSpeculativeAutonomySyncSnapshot | null> {
    return syncSpeculativeAutonomyToCanvas({
      service: this.canvasSessions,
      result,
      engineId: this.resolveCanvasEngineId(run, request),
    });
  }

  private resolveCanvasEngineId(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
  ): 'lite' | 'velocity' | 'shield' {
    const raw = normalizeText(
      request.metadata?.executionEngineId
      || request.metadata?.engineId
      || run.metadata.executionEngineId
      || run.metadata.engineId,
    ).toLowerCase();
    return raw === 'lite' || raw === 'velocity' || raw === 'shield' ? raw : 'shield';
  }

  private buildSpeculativeCorrectionMessages(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
    attempt: NonNullable<ZavorthSpeculativeAutonomyResult['finalAttempt']>,
  ): ChatMessage[] {
    const validationSummary = attempt.validationResults.map((result) => [
      `command: ${result.command}`,
      `status: ${result.status}`,
      result.stderr ? `stderr: ${safeSensitiveContextText(result.stderr, 2400)}` : '',
      result.stdout ? `stdout: ${safeSensitiveContextText(result.stdout, 1600)}` : '',
    ].filter(Boolean).join('\n')).join('\n\n');
    const criticSummary = attempt.critic.findings.map((finding) =>
      `- ${finding.severity}: ${safeSensitiveContextText(finding.summary, 500)}`,
    ).join('\n');

    return [
      {
        role: 'system',
        content: [
          'You are in the executor-critical cycle of Zavorth.',
          'The previous attempt was applied only in sandbox and failed validation/critical checks.',
          'Return only one corrected proposal using a ```zavorth-workspace-writes``` or ```zavorth-workspace-patches``` block.',
          'Do not claim real files were changed; the runtime will run a new speculative rehearsal before creating an approvable plan.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `Original request: ${safeSensitiveContextText(request.text || run.input, 2400)}`,
          `Touched files: ${attempt.touchedFiles.join(', ') || 'none'}`,
          'Critical failures:',
          criticSummary || '- without additional details',
          'Validation:',
          validationSummary || 'without validation results',
          'Previous diff:',
          safeSensitiveContextText(attempt.diffText, 6000),
        ].join('\n\n'),
      },
    ];
  }

  private appendSpeculativeAutonomySummary(
    replyText: string,
    result: ZavorthSpeculativeAutonomyResult | null,
  ): string {
    if (!result) {
      return replyText;
    }
    if (result.status === 'approved') {
      const planText = result.mutationPlan ? ` Governed plan created: ${result.mutationPlan.id}.`
        : '';
      return [
        replyText,
        '',
        `Super Zavorth: speculative rehearsal approved in sandbox, validation registered, and final diff ready for approval.${planText} No change was applied directly to the real workspace.`,
      ].join('\n');
    }
    return [
      replyText,
      '',
      `Super Zavorth: the proposal was kept as a draft because the speculative rehearsal returned status ${result.status}. ${result.summary}`,
    ].join('\n');
  }

  private buildSpeculativeAutonomyEvidence(result: ZavorthSpeculativeAutonomyResult | null): string[] {
    return result
      ? [JSON.stringify(buildSpeculativeAutonomyReceipt(result)).slice(0, 4000)]
      : [];
  }

  private buildSpeculativeAutonomyEvents(
    result: ZavorthSpeculativeAutonomyResult | null,
    zCanvasSync: CanvasSpeculativeAutonomySyncSnapshot | null,
  ): Array<Omit<UniversalAgentEvent, 'runId' | 'createdAt' | 'id'> & Partial<Pick<UniversalAgentEvent, 'id' | 'createdAt'>>> {
    if (!result) {
      return [];
    }
    const events: Array<Omit<UniversalAgentEvent, 'runId' | 'createdAt' | 'id'> & Partial<Pick<UniversalAgentEvent, 'id' | 'createdAt'>>> = [
      {
        kind: 'artifact',
        title: 'Super Zavorth speculative autonomy',
        detail: result.summary,
        status: result.status === 'approved' ? 'done' : result.status === 'failed' ? 'failed' : 'running',
        metadata: {
          ...buildSpeculativeAutonomyReceipt(result),
          ...(zCanvasSync ? { zCanvasSession: zCanvasSync } : {}),
        },
      },
    ];
    if (zCanvasSync) {
      events.push({
        kind: 'artifact',
        title: zCanvasSync.ok ? 'Z-Canvas sandbox preview' : 'Z-Canvas sync warning',
        detail: zCanvasSync.ok
          ? `${zCanvasSync.attemptCount} sandbox attempt${zCanvasSync.attemptCount === 1 ? '' : 's'} synced to Z-Canvas.`
          : `Z-Canvas could not sync this sandbox run: ${zCanvasSync.error || 'unknown error'}`,
        status: zCanvasSync.ok ? 'done' : 'failed',
        metadata: { zCanvasSession: zCanvasSync },
      });
    }
    return events;
  }

}
