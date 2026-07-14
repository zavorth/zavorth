import {
  ZAVORTH_SUBAGENT_AUTO_INVOCATION_CONTRACT_VERSION,
  type ZavorthSubagentAutoInvocationDecision,
  type ZavorthSubagentAutoInvocationRoleTelemetry,
  type ZavorthSubagentAutoInvocationSelectionSource,
  type ZavorthSubagentAutoInvocationTelemetry,
} from '../contracts/runtime/ZavorthSubagentAutoInvocationContract.js';
import type { ZavorthSubagentRuntimeMode } from '../contracts/runtime/ZavorthSubagentRuntimeContract.js';

export type ZavorthSubagentAutoInvocationInput = {
  text: string;
  channel?: string | null;
  mode?: string | null;
  taskKind?: string | null;
  taskSubtype?: string | null;
  hasInlineData?: boolean | null;
  allowImplicit?: boolean | null;
};

export class ZavorthSubagentAutoInvocationPolicyService {
  public decide(input: ZavorthSubagentAutoInvocationInput): ZavorthSubagentAutoInvocationDecision {
    const text = normalize(input.text);
    const plain = stripAccents(text.toLowerCase());
    const mode = normalize(input.mode, 'default').toLowerCase();
    const explicit = collectExplicitSubagentTriggers(plain);
    const implicit = collectImplicitComplexityTriggers(plain, input);
    const risks = collectRiskSignals(plain);
    const explicitSubagentRequest = explicit.length > 0;
    const implicitComplexityMatch = implicit.length > 0;
    const directModeBlocked = mode === 'direct' && !explicitSubagentRequest;
    const allowImplicit = input.allowImplicit !== false;
    const roleIds = inferAutoRoles(plain, explicitSubagentRequest, implicit);
    const confidence = computeConfidence({
      text: plain,
      explicitCount: explicit.length,
      implicitCount: implicit.length,
      roleCount: roleIds.length,
      taskKind: input.taskKind,
      taskSubtype: input.taskSubtype,
    });
    const requiresApproval = risks.length > 0 && explicitSubagentRequest;
    const shouldInvoke = !directModeBlocked
      && (explicitSubagentRequest || (allowImplicit && implicitComplexityMatch && confidence >= 0.75))
      && (!risks.length || explicitSubagentRequest);
    const action = requiresApproval
      ? 'require_approval'
      : shouldInvoke
        ? 'invoke_live_subagents'
        : 'skip';
    const selectedMode = inferMode(plain, roleIds);
    const reason = buildReason({
      action,
      directModeBlocked,
      explicitSubagentRequest,
      implicitComplexityMatch,
      requiresApproval,
      confidence,
    });
    const telemetry = buildTelemetry({
      action,
      channel: normalize(input.channel, 'conversation'),
      confidence,
      explicitSubagentRequest,
      implicitComplexityMatch,
      live: shouldInvoke && !requiresApproval,
      mode: selectedMode,
      reason,
      requiresApproval,
      riskSignals: risks,
      roleIds,
      shouldInvoke,
      triggers: [...explicit, ...implicit],
    });

    return {
      contractVersion: ZAVORTH_SUBAGENT_AUTO_INVOCATION_CONTRACT_VERSION,
      action,
      shouldInvoke,
      requiresApproval,
      explicitSubagentRequest,
      implicitComplexityMatch,
      live: shouldInvoke && !requiresApproval,
      mode: selectedMode,
      roleIds,
      maxLiveWorkers: Math.max(1, Math.min(4, roleIds.length || 1)),
      confidence,
      reason,
      triggers: [...explicit, ...implicit],
      riskSignals: risks,
      telemetry,
      safety: {
        readOnlyOnly: true,
        workspaceMutationRequiresApproval: true,
        commandExecutionRequiresApproval: true,
        sensitiveNetworkRequiresApproval: true,
        externalSideEffectsRequireApproval: true,
        directModeRequiresExplicitSubagents: true,
      },
    };
  }
}

function buildTelemetry(input: {
  action: string;
  channel: string;
  confidence: number;
  explicitSubagentRequest: boolean;
  implicitComplexityMatch: boolean;
  live: boolean;
  mode: ZavorthSubagentRuntimeMode;
  reason: string;
  requiresApproval: boolean;
  riskSignals: string[];
  roleIds: string[];
  shouldInvoke: boolean;
  triggers: string[];
}): ZavorthSubagentAutoInvocationTelemetry {
  const selectedBy = resolveSelectionSource(input);
  const roleTelemetry = input.roleIds.map((roleId) => buildRoleTelemetry(roleId, input.triggers));
  const status = input.requiresApproval
    ? 'approval-required'
    : input.shouldInvoke
      ? 'auto-selected'
      : 'skipped';
  const publicRationale = buildPublicRationale({
    selectedBy,
    reason: input.reason,
    triggers: input.triggers,
    riskSignals: input.riskSignals,
    roleTelemetry,
  });
  const badges = [
    input.live ? 'live-workers' : 'dry-or-blocked',
    selectedBy,
    `confidence:${input.confidence}`,
    ...input.roleIds.slice(0, 4).map((roleId) => `role:${roleId}`),
  ];
  const nextSafeAction = input.requiresApproval
    ? 'Pedir aprovacao antes de acionar subagentes com escrita, comando, rede sensivel ou efeito externo.'
    : input.shouldInvoke
      ? 'Acompanhar workers, receipts e sintese final antes de responder.'
      : 'Responder diretamente; subagentes nao foram selecionados para este turno.';

  return {
    decisionId: `subagent-auto:${stableId([
      input.action,
      input.channel,
      input.mode,
      String(input.confidence),
      input.triggers.join(','),
      input.roleIds.join(','),
      input.riskSignals.join(','),
    ].join('|'))}`,
    generatedAt: null,
    source: 'ZavorthSubagentAutoInvocationPolicyService',
    action: input.action as ZavorthSubagentAutoInvocationTelemetry['action'],
    selectedBy,
    channel: input.channel || 'conversation',
    mode: input.mode,
    shouldInvoke: input.shouldInvoke,
    live: input.live,
    requiresApproval: input.requiresApproval,
    confidence: input.confidence,
    roleIds: input.roleIds,
    roles: roleTelemetry,
    triggers: uniqueStrings(input.triggers),
    riskSignals: uniqueStrings(input.riskSignals),
    publicRationale,
    operatorSummary: `${status}: ${input.roleIds.join(', ') || 'sem roles'}; ${publicRationale}`,
    zavorthControl: {
      title: input.shouldInvoke ? 'Subagentes escolhidos automaticamente' : 'Subagentes nao escolhidos',
      status,
      badges: uniqueStrings(badges),
      nextSafeAction,
    },
    cli: {
      headline: input.shouldInvoke
        ? 'Auto subagents: selecionados'
        : input.requiresApproval
          ? 'Auto subagents: aguardando aprovacao'
          : 'Auto subagents: ignorados',
      lines: [
        `selectedBy=${selectedBy}`,
        `confidence=${input.confidence}`,
        `mode=${input.mode}`,
        `roles=${input.roleIds.join(', ') || 'n/d'}`,
        `triggers=${input.triggers.join(', ') || 'n/d'}`,
        `risks=${input.riskSignals.join(', ') || 'none'}`,
        `why=${publicRationale}`,
      ],
    },
    safety: {
      noRawChainOfThought: true,
      noSecretValuesSerialized: true,
      readOnlyOnly: true,
      workspaceMutationRequiresApproval: true,
      commandExecutionRequiresApproval: true,
      sensitiveNetworkRequiresApproval: true,
      externalSideEffectsRequireApproval: true,
    },
  };
}

function resolveSelectionSource(input: {
  explicitSubagentRequest: boolean;
  implicitComplexityMatch: boolean;
  shouldInvoke: boolean;
}): ZavorthSubagentAutoInvocationSelectionSource {
  if (input.explicitSubagentRequest) return 'explicit-user-request';
  if (input.shouldInvoke && input.implicitComplexityMatch) return 'implicit-complexity';
  return 'none';
}

function buildRoleTelemetry(
  roleId: string,
  triggers: string[],
): ZavorthSubagentAutoInvocationRoleTelemetry {
  const normalized = normalize(roleId, 'planner');
  const labels: Record<string, string> = {
    planner: 'Planner',
    researcher: 'Researcher',
    auditor: 'Auditor',
    qa: 'QA verifier',
    coder: 'Coder',
  };
  const reasons: Record<string, string> = {
    planner: 'coordena a decomposicao e a sintese final',
    researcher: 'coleta contexto e evidencia antes da sintese',
    auditor: 'procura riscos, falhas e inconsistencias',
    qa: 'valida achados e confere criterios de pronto',
    coder: 'prepara leitura tecnica de codigo sem mutar workspace automaticamente',
  };
  return {
    roleId: normalized,
    label: labels[normalized] || normalized,
    whySelected: `${reasons[normalized] || 'papel selecionado pela politica de subagentes'}; sinais=${triggers.join(', ') || 'n/d'}`,
  };
}

function buildPublicRationale(input: {
  selectedBy: ZavorthSubagentAutoInvocationSelectionSource;
  reason: string;
  triggers: string[];
  riskSignals: string[];
  roleTelemetry: ZavorthSubagentAutoInvocationRoleTelemetry[];
}): string {
  const source = input.selectedBy === 'explicit-user-request'
    ? 'pedido explicito do usuario'
    : input.selectedBy === 'implicit-complexity'
      ? 'complexidade alta e leitura segura'
      : 'sem roteamento automatico';
  const roles = input.roleTelemetry.map((role) => role.roleId).join(', ') || 'nenhum role';
  const risks = input.riskSignals.length > 0
    ? ` riscos detectados: ${input.riskSignals.join(', ')}`
    : ' sem sinais de escrita, comando ou efeito externo';
  return `${input.reason} Fonte: ${source}. Roles: ${roles}. Gatilhos: ${input.triggers.join(', ') || 'n/d'};${risks}.`;
}

/** Free-text keywords never auto-start subagents. LLM + tools own multi-agent choice. */
function collectExplicitSubagentTriggers(_plain: string): string[] {
  return [];
}

function collectImplicitComplexityTriggers(
  _plain: string,
  input: Pick<ZavorthSubagentAutoInvocationInput, 'taskKind' | 'taskSubtype'>,
): string[] {
  const triggers: string[] = [];
  const taskKind = normalize(input.taskKind).toLowerCase();
  const taskSubtype = normalize(input.taskSubtype).toLowerCase();
  if (['security', 'audit', 'ops'].includes(taskKind)) triggers.push(`task-kind:${taskKind}`);
  if (['comparison', 'audit', 'verification', 'qa'].includes(taskSubtype)) triggers.push(`task-subtype:${taskSubtype}`);
  return Array.from(new Set(triggers));
}

function collectRiskSignals(_plain: string): string[] {
  return [];
}

function inferAutoRoles(
  _plain: string,
  _explicitSubagentRequest: boolean,
  _implicit: string[],
): string[] {
  return ['planner'];
}

function inferMode(_plain: string, roleIds: string[]): ZavorthSubagentRuntimeMode {
  if (roleIds.length > 1) return 'oneshot';
  return 'oneshot';
}

function computeConfidence(input: {
  text: string;
  explicitCount: number;
  implicitCount: number;
  roleCount: number;
  taskKind?: string | null;
  taskSubtype?: string | null;
}): number {
  let score = 0.36;
  score += Math.min(0.38, input.explicitCount * 0.2);
  score += Math.min(0.38, input.implicitCount * 0.13);
  score += Math.min(0.14, Math.max(0, input.roleCount - 1) * 0.07);
  if (input.text.length > 220) score += 0.08;
  if (input.taskKind || input.taskSubtype) score += 0.05;
  return Math.min(0.98, Number(score.toFixed(2)));
}

function buildReason(input: {
  action: string;
  directModeBlocked: boolean;
  explicitSubagentRequest: boolean;
  implicitComplexityMatch: boolean;
  requiresApproval: boolean;
  confidence: number;
}): string {
  if (input.directModeBlocked) return 'Direct mode skips implicit subagent auto-routing.';
  if (input.requiresApproval) return 'Explicit subagent request contains a risk signal and must pass approval first.';
  if (input.action === 'invoke_live_subagents' && input.explicitSubagentRequest) {
    return 'Explicit subagent request is read-only enough to run live workers without a --live flag.';
  }
  if (input.action === 'invoke_live_subagents' && input.implicitComplexityMatch) {
    return `Complex read-only request reached auto-live confidence ${input.confidence}.`;
  }
  return 'No explicit subagent intent or high-confidence complex read-only trigger was detected.';
}

function collect(plain: string, rules: Array<[string, RegExp]>): string[] {
  return rules.filter(([, pattern]) => pattern.test(plain)).map(([id]) => id);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function stableId(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function normalize(value: unknown, fallback = ''): string {
  const text = String(value || '').trim();
  return text || fallback;
}

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
