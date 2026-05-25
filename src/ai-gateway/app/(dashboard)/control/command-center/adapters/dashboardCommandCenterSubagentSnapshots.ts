import type { DashboardSubagentAutoInvocationSnapshot } from "../contracts";
import {
  asArray,
  asNumber,
  asRecord,
  asText,
  type DashboardCommandCenterAdapterInput,
  type LooseRecord,
} from "./dashboardCommandCenterAdapterShared";

export function buildSubagentAutoInvocation(
  input: DashboardCommandCenterAdapterInput,
): DashboardSubagentAutoInvocationSnapshot | null {
  const raw = asRecord(input.subagentAutoInvocation) || asRecord(input.runtime?.subagentAutoInvocation);
  if (!raw) {
    return null;
  }
  const safety = asRecord(raw.safety) || {};
  const dashboard = asRecord(raw.dashboard) || {};
  const runtime = asRecord(raw.subagentRuntime)
    || asRecord(raw.runtime)
    || asRecord(input.runtime?.subagentRuntime);
  const operational = buildOperationalProjection(input, raw, runtime);
  return {
    contractVersion: asText(raw.contractVersion, "subagent-auto-invocation/v1"),
    generatedAt: asText(raw.generatedAt, "agora"),
    status: normalizeSubagentAutoStatus(raw.status),
    selectedBy: asText(raw.selectedBy, "unknown"),
    action: asText(raw.action, "unknown"),
    mode: asText(raw.mode, "unknown"),
    channel: asText(raw.channel, "unknown"),
    confidence: asNumber(raw.confidence) ?? 0,
    live: raw.live === true,
    badges: asTextArray(raw.badges ?? dashboard.badges),
    roles: asArray<LooseRecord>(raw.roles).slice(0, 8).map((role, index) => ({
      roleId: asText(role.roleId, `role-${index + 1}`),
      label: asText(role.label, role.roleId || `Role ${index + 1}`),
      whySelected: safeText(role.whySelected, "Selecionado pela politica de subagentes."),
    })),
    triggers: asTextArray(raw.triggers),
    riskSignals: asTextArray(raw.riskSignals),
    publicRationale: safeText(raw.publicRationale, "Decisao automatica de subagentes registrada."),
    nextSafeAction: safeText(raw.nextSafeAction ?? dashboard.nextSafeAction, "Acompanhar workers, receipts e sintese final."),
    safety: {
      noRawChainOfThought: safety.noRawChainOfThought !== false,
      noSecretValuesSerialized: safety.noSecretValuesSerialized !== false,
      readOnlyOnly: safety.readOnlyOnly !== false,
      approvalsRequiredForMutation: safety.approvalsRequiredForMutation !== false,
    },
    operational,
    actions: buildSubagentActions(raw, operational),
    timeline: buildSubagentTimeline(input, raw, runtime),
    receipts: buildSubagentReceipts(raw, runtime),
    surface: {
      commandCenterPath: asText(raw.commandCenterPath ?? raw.surface?.commandCenterPath, "/control?sector=agents"),
      cliCommand: asText(raw.cliCommand ?? raw.surface?.cliCommand, "npm run zavorth:subagents -- status"),
      channelCommand: asText(raw.channelCommand ?? raw.surface?.channelCommand, "/agents status"),
      reviewHint: safeText(raw.reviewHint ?? raw.surface?.reviewHint, "Revise roles, motivo, policy e receipts antes de permitir mutacao."),
    },
  };
}

function asTextArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => asText(entry)).filter(Boolean) : [];
}

function normalizeSubagentAutoStatus(value: unknown): DashboardSubagentAutoInvocationSnapshot["status"] {
  const raw = asText(value).toLowerCase();
  if (raw === "auto-selected" || raw === "approval-required" || raw === "skipped") {
    return raw;
  }
  return "unknown";
}

function buildOperationalProjection(
  input: DashboardCommandCenterAdapterInput,
  raw: LooseRecord,
  runtime: LooseRecord | null,
): DashboardSubagentAutoInvocationSnapshot["operational"] {
  const summary = asRecord(runtime?.summary) || asRecord(raw.summary) || {};
  const run = asRecord(input.agentRun) || {};
  const selectedSessionId = asText(
    raw.selectedSessionId
      ?? runtime?.selectedSessionId
      ?? raw.sessionId
      ?? run.sessionId
      ?? input.effectiveSessionId
      ?? input.activeSessionId,
  );
  const selectedRunId = asText(raw.selectedRunId ?? runtime?.selectedRunId ?? raw.runId ?? run.id);
  return {
    runId: asNullableText(raw.runId ?? run.id),
    traceId: asNullableText(raw.traceId ?? run.traceId),
    requestId: asNullableText(raw.requestId ?? run.requestId),
    sessionId: asNullableText(raw.sessionId ?? run.sessionId ?? input.effectiveSessionId ?? input.activeSessionId),
    selectedSessionId: selectedSessionId || null,
    selectedRunId: selectedRunId || null,
    runtimeStatus: asText(runtime?.status ?? raw.runtimeStatus ?? raw.status, "unknown"),
    activeSessions: asNumber(summary.activeSessions) ?? asNumber(raw.activeSessions) ?? 0,
    liveRuns: asNumber(summary.liveRuns) ?? asNumber(raw.liveRuns) ?? (raw.live === true ? 1 : 0),
    workerResults: asNumber(summary.workerResults) ?? asNumber(raw.workerResults) ?? asArray(raw.roles).length,
    failedWorkerResults: asNumber(summary.failedWorkerResults) ?? asNumber(raw.failedWorkerResults) ?? 0,
    approvalRequiredRuns: asNumber(summary.approvalRequiredRuns) ?? asNumber(raw.approvalRequiredRuns) ?? 0,
    deniedRuns: asNumber(summary.deniedRuns) ?? asNumber(raw.deniedRuns) ?? 0,
    lastUpdatedAt: asText(runtime?.generatedAt ?? raw.updatedAt ?? raw.generatedAt ?? run.updatedAt, "agora"),
  };
}

function buildSubagentActions(
  raw: LooseRecord,
  operational: DashboardSubagentAutoInvocationSnapshot["operational"],
): DashboardSubagentAutoInvocationSnapshot["actions"] {
  const selected = operational.selectedSessionId || "latest";
  const requestedActions = asArray<LooseRecord>(raw.actions);
  if (requestedActions.length > 0) {
    return requestedActions.slice(0, 8).map((entry, index) => ({
      id: asText(entry.id, `subagent-action-${index + 1}`),
      label: safeText(entry.label, "Acao de agente"),
      command: asText(entry.command, "/agents status"),
      style: normalizeActionStyle(entry.style),
      requiresApproval: entry.requiresApproval === true,
      reason: safeText(entry.reason, "Acao projetada pelo runtime de subagentes."),
    }));
  }
  return [
    action("agents-status", "Ver status", "/agents status", "primary", false, "Mostra sessoes, runs, workers e policy."),
    action("agents-read", "Ler ultimo", `/agents read ${selected}`, "secondary", false, "Abre o contexto operacional da sessao selecionada."),
    action("agents-summarize", "Resumir", `/agents summarize ${selected}`, "secondary", false, "Gera sintese rastreavel do trabalho dos subagentes."),
    action("agents-cancel", "Cancelar", `/agents cancel ${selected}`, "danger", true, "Interrompe a sessao selecionada; exige cuidado operacional."),
  ];
}

function buildSubagentTimeline(
  input: DashboardCommandCenterAdapterInput,
  raw: LooseRecord,
  runtime: LooseRecord | null,
): DashboardSubagentAutoInvocationSnapshot["timeline"] {
  const runtimeTimeline = asArray<LooseRecord>(runtime?.timeline);
  const rawTimeline = asArray<LooseRecord>(raw.timeline);
  const inputEvents = asArray<LooseRecord>(input.agentEvents)
    .filter((entry) => /subagent|agente|agent/i.test(asText(entry.title ?? entry.kind ?? entry.detail)));
  const rows = firstNonEmpty(rawTimeline, runtimeTimeline, inputEvents);
  if (rows.length === 0) {
    return [{
      id: "subagent-decision",
      title: "Decisao de subagentes",
      detail: safeText(raw.publicRationale, "Decisao registrada; aguardando eventos de runtime."),
      status: normalizeTimelineStatus(raw.status),
      createdAt: asText(raw.generatedAt, "agora"),
    }];
  }
  return rows.slice(-8).map((entry, index) => ({
    id: asText(entry.id, `subagent-timeline-${index + 1}`),
    title: safeText(entry.title ?? entry.kind, "Evento de subagente"),
    detail: safeText(entry.detail ?? entry.summary, "Evento operacional registrado."),
    status: normalizeTimelineStatus(entry.status),
    createdAt: asText(entry.createdAt ?? entry.generatedAt ?? entry.updatedAt, "agora"),
  }));
}

function buildSubagentReceipts(
  raw: LooseRecord,
  runtime: LooseRecord | null,
): DashboardSubagentAutoInvocationSnapshot["receipts"] {
  const receipts = firstNonEmpty(
    asArray<LooseRecord>(raw.receipts),
    asArray<LooseRecord>(runtime?.receipts),
  );
  if (receipts.length === 0) {
    return [{
      id: asText(raw.decisionId, "subagent-auto-decision"),
      kind: "decision",
      status: normalizeSubagentAutoStatus(raw.status),
      reason: safeText(raw.publicRationale, "Decisao automatica registrada sem receipt adicional."),
    }];
  }
  return receipts.slice(0, 8).map((receipt, index) => ({
    id: asText(receipt.id, `subagent-receipt-${index + 1}`),
    kind: asText(receipt.kind ?? receipt.type, "receipt"),
    status: asText(receipt.status ?? receipt.decision, "unknown"),
    reason: safeText(receipt.reason ?? receipt.detail ?? receipt.summary, "Receipt operacional de subagente."),
  }));
}

function action(
  id: string,
  label: string,
  command: string,
  style: DashboardSubagentAutoInvocationSnapshot["actions"][number]["style"],
  requiresApproval: boolean,
  reason: string,
): DashboardSubagentAutoInvocationSnapshot["actions"][number] {
  return { id, label, command, style, requiresApproval, reason };
}

function asNullableText(value: unknown): string | null {
  const text = asText(value);
  return text || null;
}

function firstNonEmpty<T>(...lists: T[][]): T[] {
  return lists.find((list) => list.length > 0) || [];
}

function normalizeActionStyle(value: unknown): DashboardSubagentAutoInvocationSnapshot["actions"][number]["style"] {
  const raw = asText(value).toLowerCase();
  if (raw === "primary" || raw === "secondary" || raw === "success" || raw === "danger") {
    return raw;
  }
  return "secondary";
}

function normalizeTimelineStatus(value: unknown): DashboardSubagentAutoInvocationSnapshot["timeline"][number]["status"] {
  const raw = asText(value).toLowerCase();
  if (raw === "pending" || raw === "running" || raw === "done" || raw === "failed") {
    return raw;
  }
  if (raw === "auto-selected" || raw === "completed" || raw === "ready") {
    return "done";
  }
  if (raw === "approval-required") {
    return "pending";
  }
  if (raw === "blocked" || raw === "denied") {
    return "failed";
  }
  return "unknown";
}

function safeText(value: unknown, fallback = ""): string {
  const text = asText(value, fallback).replace(/\s+/g, " ").trim();
  const redacted = text
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, "[redacted-secret]")
    .replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, "[redacted-secret]")
    .replace(/\bghp_[0-9A-Za-z_]{20,}\b/g, "[redacted-secret]");
  return redacted.length > 420 ? `${redacted.slice(0, 417)}...` : redacted;
}
