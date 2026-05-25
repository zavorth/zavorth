import type { ChatMessage, ToolDefinition } from '../../providers/ILlmProvider.js';
import type {
  LlmRunOptions,
  LlmRuntimeResult,
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
import { ZavorthHallucinationMitigationService } from '../../services/ZavorthHallucinationMitigationService.js';
import {
  buildSpeculativeAutonomyReceipt,
  type PrepareZavorthSpeculativeAutonomyInput,
  type ZavorthSpeculativeAutonomyResult,
  ZavorthSpeculativeAutonomyService,
} from '../../services/ZavorthSpeculativeAutonomyService.js';
import { ZavorthMutationPlaneService } from '../../services/ZavorthMutationPlaneService.js';
import { AgentRunExecutorPipeline } from './AgentRunExecutorPipeline.js';
import { AgentRunLlmRequestBuilder } from './AgentRunLlmRequestBuilder.js';
import { StructuredWorkspaceDraftParser, type StructuredWorkspaceDraft } from './StructuredWorkspaceDraftParser.js';
import { AgentRunNativeToolLoopService } from './AgentRunNativeToolLoopService.js';

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
  private readonly requestBuilder: AgentRunLlmRequestBuilder;
  private readonly draftParser = new StructuredWorkspaceDraftParser();
  private readonly nativeToolLoop: AgentRunNativeToolLoopService;

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
    this.requestBuilder = new AgentRunLlmRequestBuilder({
      hallucinationInstruction: () => this.hallucinationMitigation.buildInstruction(),
    });
    this.nativeToolLoop = new AgentRunNativeToolLoopService({
      llmRuntime: this.llmRuntime,
      toolRuntime: this.toolRuntime,
      requestBuilder: this.requestBuilder,
      mutationPlaneService: this.mutationPlane,
      speculativeAutonomyService: this.speculativeAutonomy,
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
    const messages = prepared.messages;
    const nativeTools = this.nativeToolLoop.resolveNativeTools(run, request);
    const options = prepared.options;
    pipeline.complete('input', `messages=${messages.length} tools=${nativeTools.length}`);
    pipeline.start('llm', `provider=${this.llmRuntime.getPreferredProviderName?.() || 'configured-provider'}`);
    const initialResult = await this.llmRuntime.chatDetailed(messages, nativeTools, options);
    pipeline.complete('llm', `provider=${initialResult.providerName} model=${initialResult.modelName || 'unknown'}`);
    pipeline.start('tool-loop', `maxRounds=${this.nativeToolLoop.maxRounds()}`);
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
    const structuredDraft = this.draftParser.extract(content);
    const speculativeAutonomy = structuredDraft
      ? await this.prepareSpeculativeAutonomy(run, request, structuredDraft, options)
      : null;
    const baseReplyText = this.appendSpeculativeAutonomySummary(
      content || 'O provider runtime concluiu a chamada, mas retornou uma resposta vazia.',
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

    return {
      status: 'completed',
      summary: 'Resposta gerada pelo provider runtime governado.',
      replyText,
      events: [
        ...toolLoop.events,
        ...this.buildSpeculativeAutonomyEvents(speculativeAutonomy),
        {
          kind: 'reply',
          title: 'Resposta gerada pelo provider runtime',
          detail: toolLoop.stats.requested > 0
            ? `Provider ${result.providerName} respondeu apos ${toolLoop.stats.executed} tool call(s) governada(s).`
            : `Provider ${result.providerName} respondeu via runtime LLM.`,
          status: 'done',
          metadata: {
            providerName: result.providerName,
            modelName: result.modelName || null,
            finishReason: result.response.finishReason || null,
            nativeToolStats: toolLoop.stats,
            ...(speculativeAutonomy ? { superZavorthSpeculativeAutonomy: buildSpeculativeAutonomyReceipt(speculativeAutonomy) } : {}),
            ...(naturalFirstLlmRuntime ? { naturalFirstLlmRuntime } : {}),
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
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return {
        id: `failed-${run.id}`,
        status: 'failed',
        summary: `Super Zavorth speculative autonomy falhou: ${detail}`,
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
          'Voce esta no ciclo executor-critico do Super Zavorth.',
          'A tentativa anterior foi aplicada somente em sandbox e falhou na validacao/critica.',
          'Retorne apenas uma proposta corrigida usando um bloco ```zavorth-workspace-writes``` ou ```zavorth-workspace-patches```.',
          'Nao afirme que arquivos reais foram alterados; o runtime fara novo ensaio especulativo antes de criar plano aprovavel.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `Pedido original: ${safeSensitiveContextText(request.text || run.input, 2400)}`,
          `Arquivos tocados: ${attempt.touchedFiles.join(', ') || 'nenhum'}`,
          'Falhas do critico:',
          criticSummary || '- sem detalhes adicionais',
          'Validacao:',
          validationSummary || 'sem resultados de validacao',
          'Diff anterior:',
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
      const planText = result.mutationPlan
        ? ` Plano governado criado: ${result.mutationPlan.id}.`
        : '';
      return [
        replyText,
        '',
        `Super Zavorth: ensaio especulativo aprovado em sandbox, validacao registrada e diff final pronto para aprovacao.${planText} Nenhuma alteracao foi aplicada diretamente ao workspace real.`,
      ].join('\n');
    }
    return [
      replyText,
      '',
      `Super Zavorth: a proposta ficou retida como rascunho porque o ensaio especulativo retornou status ${result.status}. ${result.summary}`,
    ].join('\n');
  }

  private buildSpeculativeAutonomyEvidence(result: ZavorthSpeculativeAutonomyResult | null): string[] {
    return result
      ? [JSON.stringify(buildSpeculativeAutonomyReceipt(result)).slice(0, 4000)]
      : [];
  }

  private buildSpeculativeAutonomyEvents(
    result: ZavorthSpeculativeAutonomyResult | null,
  ): Array<Omit<UniversalAgentEvent, 'runId' | 'createdAt' | 'id'> & Partial<Pick<UniversalAgentEvent, 'id' | 'createdAt'>>> {
    if (!result) {
      return [];
    }
    return [
      {
        kind: 'artifact',
        title: 'Super Zavorth speculative autonomy',
        detail: result.summary,
        status: result.status === 'approved' ? 'done' : result.status === 'failed' ? 'failed' : 'running',
        metadata: buildSpeculativeAutonomyReceipt(result),
      },
    ];
  }

}
