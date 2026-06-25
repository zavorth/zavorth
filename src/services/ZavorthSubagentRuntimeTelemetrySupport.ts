import type {
  ZavorthSubagentRuntimeSnapshot,
} from '../contracts/runtime/ZavorthSubagentRuntimeContract.js';
import type { ZavorthSubagentAutoInvocationTelemetry } from '../contracts/runtime/ZavorthSubagentAutoInvocationContract.js';

export function buildAutoInvocationDashboardProjection(
  latest: ZavorthSubagentAutoInvocationTelemetry | null,
): ZavorthSubagentRuntimeSnapshot['autoInvocationTelemetry']['dashboardProjection'] {
  if (!latest) {
    return {
      available: false,
      title: 'Sem decisao automatica de subagentes',
      summary: 'Nenhuma decisao automatica foi registrada neste snapshot.',
      selectedBy: 'none',
      roles: [],
      triggers: [],
      riskSignals: [],
      nextSafeAction: 'Executar /agents ou uma tarefa complexa para gerar telemetria de subagentes.',
    };
  }
  return {
    available: true,
    title: latest.dashboard.title,
    summary: latest.operatorSummary,
    selectedBy: latest.selectedBy,
    roles: latest.roleIds,
    triggers: latest.triggers,
    riskSignals: latest.riskSignals,
    nextSafeAction: latest.dashboard.nextSafeAction,
  };
}

export function normalizeAutoInvocation(
  telemetry: ZavorthSubagentAutoInvocationTelemetry | null | undefined,
  generatedAt: string,
): ZavorthSubagentAutoInvocationTelemetry | null {
  if (!telemetry || typeof telemetry !== 'object') {
    return null;
  }
  return {
    ...telemetry,
    generatedAt: telemetry.generatedAt || generatedAt,
    roleIds: uniqueStrings(telemetry.roleIds || []),
    triggers: uniqueStrings(telemetry.triggers || []),
    riskSignals: uniqueStrings(telemetry.riskSignals || []),
    roles: Array.isArray(telemetry.roles) ? telemetry.roles.map((role) => ({
      roleId: normalizeText(role.roleId, 'planner'),
      label: normalizeText(role.label, role.roleId || 'planner'),
      whySelected: firstLine(normalizeText(role.whySelected, 'Selecionado pela politica de subagentes.'), 280),
    })) : [],
    publicRationale: firstLine(telemetry.publicRationale, 640),
    operatorSummary: firstLine(telemetry.operatorSummary, 640),
    dashboard: {
      ...telemetry.dashboard,
      title: firstLine(telemetry.dashboard?.title || 'Subagentes', 160),
      badges: uniqueStrings(telemetry.dashboard?.badges || []).slice(0, 12),
      nextSafeAction: firstLine(telemetry.dashboard?.nextSafeAction || 'Revisar decisao antes de agir.', 240),
    },
    cli: {
      headline: firstLine(telemetry.cli?.headline || 'Auto subagents', 160),
      lines: uniqueStrings(telemetry.cli?.lines || []).map((line) => firstLine(line, 280)).slice(0, 12),
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

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value || '').trim();
  return text || fallback;
}

function firstLine(value: string, maxLength = 240): string {
  const text = normalizeText(value).replace(/\s+/g, ' ');
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
