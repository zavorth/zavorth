import type { ChatMessage, ToolCall } from '../../providers/ILlmProvider.js';
import type { LlmRuntimeResult } from '../../services/llm/LlmRuntimeService.js';
import type { UniversalAgentRequest, UniversalAgentRun } from './UniversalAgentRuntimeTypes.js';
import type { NativeToolLoopResult } from './AgentRunNativeToolLoopService.js';
import type { CreateZavorthMutationPlanInput } from '../../services/ZavorthMutationPlaneService.js';
import type { ZavorthMutationPlan } from '../../contracts/ZavorthMutationPlaneContract.js';
import type { PrepareZavorthSpeculativeAutonomyInput } from '../../autonomy/ZavorthSpeculativeAutonomyService.js';
import type { ToolEffectMapping } from '../../tools/governance/index.js';
import { wrapToolOutputForLlm } from '../../security/ToolOutputTrust.js';
import { ProviderNativeCapabilityMatrixService } from '../../services/llm/ProviderNativeCapabilityMatrixService.js';
import { clampText, normalizeText } from './AgentRunNativeToolLoopUtils.js';

const COMPACT_TOOL_CATALOG_NAME = 'zavorth_tool_catalog';
const TOOL_PLANNER_NAME = 'zavorth_tool_plan';
const PROVIDER_NATIVE_CAPABILITY_MATRIX = new ProviderNativeCapabilityMatrixService();

export function resolveToolAliases(toolName: string): string[] {
  const normalized = normalizeText(toolName).toLowerCase();
  const aliases: Record<string, string[]> = {
    read_file: ['read_file', 'read', 'workspace.read'],
    'workspace.read': ['workspace.read', 'read_file', 'read'],
    list_directory: ['list_directory', 'ls', 'workspace.list'],
    'workspace.list': ['workspace.list', 'list_directory', 'ls'],
    web_search: ['web_search', 'web.search', 'network_fetch'],
    'web.search': ['web.search', 'web_search', 'network_fetch'],
    get_datetime: ['get_datetime', 'datetime', 'time.now'],
    write_file: ['write_file', 'write', 'workspace.write', 'filesystem.write'],
    create_file: ['create_file', 'write_file', 'workspace.write', 'filesystem.write'],
    remote_shell: ['remote_shell', 'shell.exec', 'bash.exec'],
    run_sandbox_code: ['run_sandbox_code', 'sandbox.execute'],
    zavorth_action: ['zavorth_action', 'action.lookup', 'action.preview', 'action.apply'],
    [COMPACT_TOOL_CATALOG_NAME]: [COMPACT_TOOL_CATALOG_NAME, 'tool.catalog', 'tools.search', 'tool.search'],
    [TOOL_PLANNER_NAME]: [TOOL_PLANNER_NAME, 'tool.plan', 'agent.plan', 'subagent.plan'],
  };
  return Array.from(new Set([
    normalized,
    normalized.replace(/_/g, '.'),
    ...(aliases[normalized] || []),
  ].filter(Boolean)));
}

export function buildProviderNativeFallbackToolCalls(input: {
  result: LlmRuntimeResult;
  run: UniversalAgentRun;
  request?: UniversalAgentRequest;
  knownToolNames: Set<string>;
}): ToolCall[] {
  if (!input.knownToolNames.has('web_search')) {
    return [];
  }
  const assessments = PROVIDER_NATIVE_CAPABILITY_MATRIX.assessFallback({
    providerName: input.result.providerName,
    modelName: input.result.modelName,
    metadata: input.result.metadata,
    content: input.result.response.content,
  });
  const searchFallback = assessments.find((assessment) =>
    assessment.capability === 'native_search'
    && assessment.fallbackRecommended
    && assessment.fallbackToolName === 'web_search');
  if (!searchFallback) {
    return [];
  }
  const query = normalizeText(input.request?.text || input.run.input || input.run.title || input.run.summary);
  if (!query) {
    return [];
  }
  return [{
    id: `provider_native_fallback_${Date.now().toString(36)}`,
    name: 'web_search',
    arguments: {
      query,
      mode: 'verify',
      providerNativeFallback: {
        version: 'provider-native-fallback/1',
        fromProvider: input.result.providerName,
        fromModel: input.result.modelName,
        providerToolName: searchFallback.providerToolName,
        reason: searchFallback.reason,
        requiredEvidence: 'citations',
      },
    },
  }];
}

export function buildToolMessage(toolName: string, toolCallId: string, content: unknown): ChatMessage {
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

export function buildToolEvent(
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

export function buildToolEffectBoundaryMetadata(mapping: ToolEffectMapping): Record<string, unknown> {
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

export function buildDeferredToolEffectMessage(toolName: string, mapping: ToolEffectMapping): string {
  const action = mapping.decision.action;
  if (action === 'sandbox_only') {
    return `Tool ${toolName} was not executed directly. The effect boundary classified the call as a governed side effect and requires sandbox rehearsal before commit. Summary: ${mapping.analysis.summary}`;
  }
  if (action === 'require_user_confirmation') {
    return `Tool ${toolName} was not executed directly. The effect boundary requires user confirmation before this effect. Summary: ${mapping.analysis.summary}`;
  }
  if (action === 'require_admin_policy') {
    return `Tool ${toolName} was not executed directly. The effect boundary requires administrative policy before this effect. Summary: ${mapping.analysis.summary}`;
  }
  return `Tool ${toolName} was not executed directly. The effect boundary allows direct execution only for recognized safe observations. Decision: ${action}. Summary: ${mapping.analysis.summary}`;
}

export function resolveMutationDomain(mapping: ToolEffectMapping): CreateZavorthMutationPlanInput['domain'] {
  const effect = mapping.analysis.effect;
  if (effect.processSpawn.length > 0 || effect.deletes.some((resource) => resource.kind === 'process') || effect.networkEgress.length > 0) {
    return 'sandbox';
  }
  if (effect.secretAccess.length > 0) return 'capability';
  return 'selfmod';
}

export function resolveSpeculativeSandboxIsolation(run: UniversalAgentRun): PrepareZavorthSpeculativeAutonomyInput['sandboxIsolation'] {
  const raw = normalizeText(
    run.metadata.speculativeSandboxIsolation
    || run.metadata.sandboxIsolation
    || run.metadata.executionSandbox
    || process.env.ZAVORTH_SPECULATIVE_SANDBOX_ISOLATION,
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

export function resolveTerminalBackend(run: UniversalAgentRun): 'local' | 'docker' | 'ssh' | 'wsl' | 'vercel-sandbox' | 'modal' | 'daytona' {
  const raw = normalizeText(
    run.metadata.terminalBackend
    || run.metadata.executionBackend
    || process.env.ZAVORTH_DEFAULT_MUTATION_BACKEND,
  ).toLowerCase();
  if (raw === 'ssh') return 'ssh';
  if (raw === 'wsl') return 'wsl';
  if (raw === 'vercel' || raw === 'vercel-sandbox') return 'vercel-sandbox';
  if (raw === 'modal') return 'modal';
  if (raw === 'daytona') return 'daytona';
  if (raw === 'local') return 'local';
  return 'docker';
}

export function extractWorkspaceWritesFromToolArgs(args: Record<string, unknown>): Array<{ path: string; content: string }> {
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

export function extractCommandsFromToolArgs(args: Record<string, unknown>): string[] {
  return [args.command, args.cmd, args.script, args.shell]
    .flatMap((candidate) => Array.isArray(candidate) ? candidate : [candidate])
    .map((candidate) => normalizeText(candidate))
    .filter(Boolean);
}

export function buildMutationPlanMetadata(plan: ZavorthMutationPlan): Record<string, unknown> {
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

export function enrichNativeToolArgs(input: {
  toolName: string;
  args: Record<string, unknown>;
  providerName: string;
  modelName: string | null;
  continuity?: {
    continuityId: string;
    runId: string;
    toolCallId: string;
    sourceSurface: string;
  };
}): Record<string, unknown> {
  const existingMetadata = input.args.metadata && typeof input.args.metadata === 'object' && !Array.isArray(input.args.metadata)
    ? input.args.metadata as Record<string, unknown>
    : {};
  const withContinuity = input.continuity
    ? {
        ...input.args,
        metadata: {
          ...existingMetadata,
          continuityId: input.continuity.continuityId,
          runId: input.continuity.runId,
          toolCallId: input.continuity.toolCallId,
          sourceSurface: input.continuity.sourceSurface,
        },
      }
    : input.args;

  if (normalizeText(input.toolName).toLowerCase() !== 'web_search') {
    return withContinuity;
  }
  const providerHints = withContinuity.providerHints && typeof withContinuity.providerHints === 'object' && !Array.isArray(withContinuity.providerHints)
    ? withContinuity.providerHints as Record<string, unknown>
    : {};
  const providerId = normalizeText(
    providerHints.providerId
    || providerHints.preferredProvider
    || withContinuity.provider
    || withContinuity.providerId
    || input.providerName,
  );
  return {
    ...withContinuity,
    providerHints: {
      ...providerHints,
      ...(providerId ? { providerId } : {}),
      ...(input.modelName ? { modelName: input.modelName } : {}),
      source: 'agent-native-tool-loop',
    },
  };
}
