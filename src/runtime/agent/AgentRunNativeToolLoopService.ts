import type { ChatMessage, ToolDefinition } from '../../providers/ILlmProvider.js';
import type { LlmRunOptions, LlmRuntimeResult } from '../../services/llm/LlmRuntimeService.js';
import type { UniversalAgentEvent, UniversalAgentRun, UniversalAgentRequest } from './UniversalAgentRuntimeTypes.js';
import type { UniversalAgentLlmRuntime } from './AgentRunLlmRuntimeExecutor.js';
import type { UniversalAgentToolRuntime } from './AgentRunEchoHandsExecutor.js';
import type { CreateZavorthMutationPlanInput } from '../../services/ZavorthMutationPlaneService.js';
import { ZavorthMutationPlaneService } from '../../services/ZavorthMutationPlaneService.js';
import type { ZavorthMutationPlan } from '../../contracts/ZavorthMutationPlaneContract.js';
import { wrapToolOutputForLlm } from '../../security/ToolOutputTrust.js';
import { containsUntrustedContentMarker, withUntrustedInputMetadata } from '../../security/UntrustedContent.js';
import {
  isSafeObservationTool,
  mapToolCallToEffectDecision,
  ToolEffectRegistry,
  type ToolEffectMapping,
} from '../../tools/governance/index.js';
import { buildEffectRehearsalEnvelope } from '../rehearsal/index.js';
import type { AgentRunLlmRequestBuilder } from './AgentRunLlmRequestBuilder.js';

export type NativeToolLoopStats = {
  requested: number;
  executed: number;
  denied: number;
  failed: number;
  rounds: number;
  safeObservations: number;
  effectBoundaryDenied: number;
  sideEffectsDeferred: number;
};

export type NativeToolLoopResult = {
  result: LlmRuntimeResult;
  evidenceTexts: string[];
  toolReceiptCount: number;
  stats: NativeToolLoopStats;
  events: Array<Omit<UniversalAgentEvent, 'runId' | 'createdAt' | 'id'> & Partial<Pick<UniversalAgentEvent, 'id' | 'createdAt'>>>;
};

type Runtime = {
  llmRuntime: UniversalAgentLlmRuntime | null;
  toolRuntime: UniversalAgentToolRuntime | null;
  requestBuilder: AgentRunLlmRequestBuilder;
  mutationPlaneService?: Pick<ZavorthMutationPlaneService, 'createPlan'> | null;
};

const MAX_NATIVE_TOOL_ROUNDS = 5;
const MAX_NATIVE_TOOL_CALLS_PER_ROUND = 8;
const ALWAYS_SAFE_NATIVE_TOOLS = new Set([
  'read_file',
  'list_directory',
  'workspace.read',
  'workspace.list',
  'get_datetime',
]);
const TOOL_EFFECT_REGISTRY = new ToolEffectRegistry();

export class AgentRunNativeToolLoopService {
  private readonly llmRuntime: UniversalAgentLlmRuntime | null;
  private readonly toolRuntime: UniversalAgentToolRuntime | null;
  private readonly requestBuilder: AgentRunLlmRequestBuilder;
  private readonly mutationPlane: Pick<ZavorthMutationPlaneService, 'createPlan'> | null;

  constructor(runtime: Runtime) {
    this.llmRuntime = runtime.llmRuntime;
    this.toolRuntime = runtime.toolRuntime;
    this.requestBuilder = runtime.requestBuilder;
    this.mutationPlane = runtime.mutationPlaneService === null
      ? null
      : runtime.mutationPlaneService || new ZavorthMutationPlaneService();
  }

  public maxRounds(): number {
    return MAX_NATIVE_TOOL_ROUNDS;
  }

  public resolveNativeTools(run: UniversalAgentRun, request: UniversalAgentRequest): ToolDefinition[] {
    if (!this.toolRuntime?.getToolDefinitions) return [];
    if (this.toolRuntime.isAvailable && !this.toolRuntime.isAvailable()) return [];

    const definitions = this.toolRuntime.getToolDefinitions();
    const policyContext = this.requestBuilder.buildToolPolicyContext(run, request);
    const approved = new Set((policyContext.approvedToolIds || []).map((tool) => tool.toLowerCase()));
    const requested = new Set((request.requestedTools || []).map((tool) => tool.toLowerCase()));
    const exposed = policyContext.exposedTools || [];

    return definitions.filter((tool) => {
      if (this.toolRuntime?.hasTool && !this.toolRuntime.hasTool(tool.name)) return false;
      const aliases = this.resolveToolAliases(tool.name);
      if (aliases.some((alias) => ALWAYS_SAFE_NATIVE_TOOLS.has(alias) || isSafeObservationTool(alias, TOOL_EFFECT_REGISTRY))) {
        return true;
      }
      if (aliases.includes('web_search')) {
        return aliases.some((alias) => requested.has(alias))
          || exposed.some((entry) => aliases.includes(entry.id.toLowerCase()));
      }
      if (aliases.some((alias) => approved.has(alias))) return true;
      return exposed.some((entry) => {
        const id = entry.id.toLowerCase();
        return aliases.includes(id) && entry.requiresApproval !== true && entry.risk === 'safe';
      });
    }).slice(0, 12);
  }

  public async run(input: {
    messages: ChatMessage[];
    initialResult: LlmRuntimeResult;
    tools: ToolDefinition[];
    options: LlmRunOptions;
    run: UniversalAgentRun;
  }): Promise<NativeToolLoopResult> {
    const stats: NativeToolLoopStats = {
      requested: 0,
      executed: 0,
      denied: 0,
      failed: 0,
      rounds: 0,
      safeObservations: 0,
      effectBoundaryDenied: 0,
      sideEffectsDeferred: 0,
    };
    const evidenceTexts: string[] = [];
    const events: NativeToolLoopResult['events'] = [];
    let result = input.initialResult;

    if (!this.llmRuntime || !this.toolRuntime || input.tools.length === 0) {
      return { result, evidenceTexts, toolReceiptCount: 0, stats, events };
    }

    const knownToolNames = new Set(input.tools.map((tool) => tool.name));
    for (let round = 0; round < MAX_NATIVE_TOOL_ROUNDS; round += 1) {
      const toolCalls = result.response.toolCalls || [];
      if (toolCalls.length === 0) break;
      stats.rounds += 1;
      input.messages.push({
        role: 'assistant',
        content: result.response.content || '',
        toolCalls,
      });

      const toolMessages: ChatMessage[] = [];
      for (const toolCall of toolCalls.slice(0, MAX_NATIVE_TOOL_CALLS_PER_ROUND)) {
        stats.requested += 1;
        if (!knownToolNames.has(toolCall.name)) {
          stats.denied += 1;
          const denied = `Tool ${toolCall.name} nao esta exposta para este run.`;
          toolMessages.push(this.buildToolMessage(toolCall.name, toolCall.id, denied));
          events.push(this.buildToolEvent(input.run, toolCall.name, denied, 'failed', {
            reason: 'tool-not-exposed',
            toolCallId: toolCall.id,
          }));
          continue;
        }

        const influencedByUntrustedContent = containsUntrustedContentMarker(input.messages)
          || containsUntrustedContentMarker(toolCall.arguments);
        const sourceTrust = influencedByUntrustedContent ? 'untrusted-content' : 'trusted-user';
        const effectMapping = mapToolCallToEffectDecision({
          toolCall,
          registry: TOOL_EFFECT_REGISTRY,
          sourceTrust,
          policyContext: {
            surface: 'agent-native-tool-loop',
            workspace: input.run.workspace || null,
            sandboxAvailable: true,
          },
        });
        const safeObservation = effectMapping.decision.action === 'allow'
          && effectMapping.analysis.readOnly
          && isSafeObservationTool(toolCall.name, TOOL_EFFECT_REGISTRY);
        if (safeObservation) {
          stats.safeObservations += 1;
        } else if (effectMapping.decision.action === 'deny') {
          stats.denied += 1;
          stats.effectBoundaryDenied += 1;
          const denied = `Tool ${toolCall.name} bloqueada pela effect boundary: ${effectMapping.decision.reasons.join(' ')}`;
          toolMessages.push(this.buildToolMessage(toolCall.name, toolCall.id, denied));
          events.push(this.buildToolEvent(input.run, toolCall.name, denied, 'failed', {
            reason: 'effect-boundary-deny',
            toolCallId: toolCall.id,
            sourceTrust,
            effectBoundary: this.buildToolEffectBoundaryMetadata(effectMapping),
          }));
          continue;
        } else {
          stats.denied += 1;
          stats.sideEffectsDeferred += 1;
          const rehearsalEnvelope = buildEffectRehearsalEnvelope({
            id: `${input.run.id}:${toolCall.id}:effect-boundary`,
            mapping: effectMapping,
          });
          const mutationPlan = this.createMutationPlanForDeferredEffect({
            run: input.run,
            toolName: toolCall.name,
            mapping: effectMapping,
            rehearsalEnvelope,
          });
          const deferred = this.buildDeferredToolEffectMessage(toolCall.name, effectMapping);
          toolMessages.push(this.buildToolMessage(toolCall.name, toolCall.id, deferred));
          events.push(this.buildToolEvent(input.run, toolCall.name, deferred, 'failed', {
            reason: 'effect-boundary-deferred',
            toolCallId: toolCall.id,
            sourceTrust,
            effectBoundary: this.buildToolEffectBoundaryMetadata(effectMapping),
            effectRehearsal: rehearsalEnvelope,
            ...(mutationPlan ? { mutationPlan: this.buildMutationPlanMetadata(mutationPlan) } : {}),
          }));
          continue;
        }

        const toolArgs = influencedByUntrustedContent
          ? withUntrustedInputMetadata(toolCall.arguments, 'agent-run-llm-native-loop-contained-untrusted-evidence')
          : toolCall.arguments;
        try {
          const toolResult = await this.toolRuntime.executeTool(toolCall.name, toolArgs);
          stats.executed += 1;
          evidenceTexts.push(`${toolCall.name}:\n${clampText(toolResult, 6000)}`);
          toolMessages.push(this.buildToolMessage(toolCall.name, toolCall.id, toolResult));
          events.push(this.buildToolEvent(input.run, toolCall.name, toolResult, 'done', {
            toolCallId: toolCall.id,
            sourceTrust,
            effectBoundary: this.buildToolEffectBoundaryMetadata(effectMapping),
          }));
        } catch (error: unknown) {
          stats.failed += 1;
          const message = `Tool ${toolCall.name} failed: ${error instanceof Error ? error.message : String(error)}`;
          evidenceTexts.push(`${toolCall.name}:\n${message}`);
          toolMessages.push(this.buildToolMessage(toolCall.name, toolCall.id, message));
          events.push(this.buildToolEvent(input.run, toolCall.name, message, 'failed', {
            toolCallId: toolCall.id,
            sourceTrust,
            effectBoundary: this.buildToolEffectBoundaryMetadata(effectMapping),
          }));
        }
      }

      if (toolMessages.length === 0) break;
      input.messages.push(...toolMessages);
      result = await this.llmRuntime.chatDetailed(input.messages, input.tools, input.options);
    }

    return { result, evidenceTexts, toolReceiptCount: stats.executed, stats, events };
  }

  private resolveToolAliases(toolName: string): string[] {
    const normalized = normalizeText(toolName).toLowerCase();
    const aliases: Record<string, string[]> = {
      read_file: ['read_file', 'read', 'workspace.read'],
      list_directory: ['list_directory', 'ls', 'workspace.list'],
      web_search: ['web_search', 'web.search', 'network_fetch'],
      get_datetime: ['get_datetime', 'datetime', 'time.now'],
      write_file: ['write_file', 'write', 'workspace.write', 'filesystem.write'],
      create_file: ['create_file', 'write_file', 'workspace.write', 'filesystem.write'],
      remote_shell: ['remote_shell', 'shell.exec', 'bash.exec'],
      run_sandbox_code: ['run_sandbox_code', 'sandbox.execute'],
    };
    return Array.from(new Set([
      normalized,
      normalized.replace(/_/g, '.'),
      ...(aliases[normalized] || []),
    ].filter(Boolean)));
  }

  private buildToolMessage(toolName: string, toolCallId: string, content: unknown): ChatMessage {
    return {
      role: 'tool',
      toolCallId,
      toolName,
      content: wrapToolOutputForLlm(toolName, clampText(content, 6000), {
        source: 'agent_run_llm_native_tool_result',
        tool_call_id: toolCallId,
      }),
    };
  }

  private buildToolEvent(
    run: UniversalAgentRun,
    toolName: string,
    detail: unknown,
    status: 'done' | 'failed',
    metadata: Record<string, unknown>,
  ): NativeToolLoopResult['events'][number] {
    return {
      kind: 'tool',
      title: toolName,
      detail: clampText(detail, 1200),
      status,
      metadata: {
        source: 'AgentRunNativeToolLoopService',
        runId: run.id,
        toolId: toolName,
        governedBy: 'ToolRuntimeService',
        ...metadata,
      },
    };
  }

  private buildToolEffectBoundaryMetadata(mapping: ToolEffectMapping): Record<string, unknown> {
    return {
      version: 'effect-boundary-tool-call/1',
      action: mapping.decision.action,
      allowed: mapping.decision.allowed,
      rule: mapping.decision.rule,
      risk: mapping.decision.risk,
      readOnly: mapping.analysis.readOnly,
      hasRealSideEffect: mapping.analysis.hasRealSideEffect,
      safeObservation: mapping.decision.action === 'allow' && mapping.analysis.readOnly,
      effectSummary: mapping.analysis.summary,
      reasons: mapping.decision.reasons,
    };
  }

  private buildDeferredToolEffectMessage(toolName: string, mapping: ToolEffectMapping): string {
    const action = mapping.decision.action;
    if (action === 'sandbox_only') {
      return `Tool ${toolName} nao foi executada diretamente. A effect boundary classificou a chamada como side effect governado e exige ensaio em sandbox antes de commit. Resumo: ${mapping.analysis.summary}`;
    }
    if (action === 'require_user_confirmation') {
      return `Tool ${toolName} nao foi executada diretamente. A effect boundary exige confirmacao do usuario antes desse efeito. Resumo: ${mapping.analysis.summary}`;
    }
    if (action === 'require_admin_policy') {
      return `Tool ${toolName} nao foi executada diretamente. A effect boundary exige policy administrativa antes desse efeito. Resumo: ${mapping.analysis.summary}`;
    }
    return `Tool ${toolName} nao foi executada diretamente. A effect boundary permite execucao direta somente para observacoes seguras reconhecidas. Decisao: ${action}. Resumo: ${mapping.analysis.summary}`;
  }

  private createMutationPlanForDeferredEffect(input: {
    run: UniversalAgentRun;
    toolName: string;
    mapping: ToolEffectMapping;
    rehearsalEnvelope: ReturnType<typeof buildEffectRehearsalEnvelope>;
  }): ZavorthMutationPlan | null {
    if (!this.mutationPlane || !input.mapping.analysis.hasRealSideEffect) return null;

    const args = input.mapping.actionIntent.args || {};
    const workspaceWrites = this.extractWorkspaceWritesFromToolArgs(args);
    const commands = this.extractCommandsFromToolArgs(args);
    const effect = input.mapping.analysis.effect;
    const hasProcessEffect = effect.processSpawn.length > 0
      || effect.deletes.some((resource) => resource.kind === 'process')
      || commands.length > 0;
    const rollbackSteps = input.rehearsalEnvelope.rehearsal.rollbackPlan.steps
      .map((step) => step.summary)
      .filter(Boolean);
    const payload: Record<string, unknown> = {
      source: 'effect-boundary',
      toolName: input.toolName,
      actionIntent: input.mapping.actionIntent,
      effectBoundary: this.buildToolEffectBoundaryMetadata(input.mapping),
      effectRehearsal: input.rehearsalEnvelope,
      workspaceWrites,
      commands,
      affectedResources: {
        reads: effect.reads,
        writes: effect.writes,
        deletes: effect.deletes,
        networkEgress: effect.networkEgress,
        processSpawn: effect.processSpawn,
        persistence: effect.persistence,
        humanVisibleSend: effect.humanVisibleSend,
      },
    };
    const planInput: CreateZavorthMutationPlanInput = {
      domain: this.resolveMutationDomain(input.mapping),
      actionId: `effect-boundary:${input.run.id}:${input.mapping.toolCallId}`,
      title: `Effect Boundary: ${input.toolName}`,
      summary: `Side effect deferred by Effect Boundary for ${input.toolName}. Review sandbox/rehearsal before applying.`,
      requestedBy: input.run.userId,
      sourceSurface: `agent-run:${input.run.channel}`,
      riskLevel: input.mapping.decision.risk === 'danger' ? 'high' : 'medium',
      approvalRequired: true,
      approvalReason: 'Effect Boundary deferred this side effect until sandbox/rehearsal approval.',
      resourceImpact: {
        diskMb: Math.max(1, workspaceWrites.length),
        processCount: hasProcessEffect ? 1 : 0,
        externalExposure: effect.humanVisibleSend.length > 0
          ? 'public'
          : effect.networkEgress.length > 0
            ? 'network'
            : hasProcessEffect
              ? 'local'
              : 'none',
        recurring: false,
        notes: ['Created from deferred LLM native tool side effect.', `Effect policy rule: ${input.mapping.decision.rule}`],
      },
      readinessGates: [{
        id: `${input.rehearsalEnvelope.id}:readiness`,
        status: input.mapping.decision.action === 'require_admin_policy'
          ? 'blocked'
          : input.rehearsalEnvelope.rehearsal.status === 'prepared'
            ? 'warning'
            : 'blocked',
        canProceed: input.mapping.decision.action !== 'require_admin_policy'
          && input.rehearsalEnvelope.rehearsal.status === 'prepared',
        scope: 'effect-boundary-rehearsal',
        reasons: input.mapping.decision.reasons,
        warnings: ['Mutation plan requires sandbox/rehearsal validation before apply.'],
        blockers: input.rehearsalEnvelope.rehearsal.blockers,
        checkedAt: new Date().toISOString(),
        nextActions: ['Review mutation plan', 'Run sandbox validation', 'Approve only after preview matches intent'],
      }],
      validationPlan: ['Run sandbox validation before applying this mutation plan.'],
      rollbackPlan: rollbackSteps.length > 0 ? rollbackSteps : ['Review rollback evidence before commit.'],
      payload,
    };

    return this.mutationPlane.createPlan(planInput);
  }

  private resolveMutationDomain(mapping: ToolEffectMapping): CreateZavorthMutationPlanInput['domain'] {
    const effect = mapping.analysis.effect;
    if (effect.processSpawn.length > 0 || effect.deletes.some((resource) => resource.kind === 'process') || effect.networkEgress.length > 0) {
      return 'sandbox';
    }
    if (effect.secretAccess.length > 0) return 'capability';
    return 'selfmod';
  }

  private extractWorkspaceWritesFromToolArgs(args: Record<string, unknown>): Array<{ path: string; content: string }> {
    const pathValue = normalizeText(args.path || args.filePath || args.target_file || args.target || args.workspacePath);
    const contentValue = typeof args.content === 'string'
      ? args.content
      : typeof args.code_content === 'string'
        ? args.code_content
        : typeof args.text === 'string'
          ? args.text
          : '';
    return pathValue ? [{ path: pathValue, content: contentValue }] : [];
  }

  private extractCommandsFromToolArgs(args: Record<string, unknown>): string[] {
    return [args.command, args.cmd, args.script, args.shell]
      .flatMap((candidate) => Array.isArray(candidate) ? candidate : [candidate])
      .map((candidate) => normalizeText(candidate))
      .filter(Boolean);
  }

  private buildMutationPlanMetadata(plan: ZavorthMutationPlan): Record<string, unknown> {
    return {
      id: plan.id,
      status: plan.status,
      domain: plan.domain,
      actionId: plan.actionId,
      approvalRequired: plan.approval.required,
      approvalStatus: plan.approval.status,
      riskLevel: plan.riskLevel,
      payloadHash: plan.payloadHash,
    };
  }
}

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function clampText(value: unknown, maxChars = 4000): string {
  const text = String(value ?? '').trim();
  const limit = Math.max(120, maxChars);
  return text.length <= limit ? text : `${text.slice(0, limit - 20).trim()}\n[truncated]`;
}
