import type {
  DashboardAgentRunStatus,
  DashboardBudgetSnapshot,
  DashboardCommandCenterViewModel,
  DashboardModelProfile,
  DashboardRunObservatoryQuery,
  DashboardRunObservatoryRun,
  DashboardRunObservatorySnapshot,
} from "../contracts";

const DASHBOARD_AGENT_RUN_STATUSES: readonly DashboardAgentRunStatus[] = [
  "idle",
  "queued",
  "thinking",
  "running",
  "waiting_approval",
  "completed",
  "failed",
  "cancelled",
];

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeLimit(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function normalizeStatusList(value: unknown): DashboardAgentRunStatus[] {
  const values = Array.isArray(value) ? value : [value];
  const statuses = values
    .flatMap((entry) => normalizeText(entry).split(","))
    .map((entry) => normalizeCommandCenterRunStatus(entry))
    .filter((entry): entry is DashboardAgentRunStatus => Boolean(entry));
  return Array.from(new Set(statuses));
}

function queryStatuses(
  query: DashboardRunObservatoryQuery | null | undefined,
): DashboardAgentRunStatus[] {
  return normalizeStatusList(query?.status);
}

function runMatchesQuery(
  run: DashboardRunObservatoryRun,
  query: DashboardRunObservatoryQuery,
): DashboardRunObservatoryRun | null {
  const runId = normalizeText(query.runId);
  const traceId = normalizeText(query.traceId);
  const sessionId = normalizeText(query.sessionId);
  const statuses = queryStatuses(query);
  const hasFilter = Boolean(runId || traceId || sessionId || statuses.length > 0);
  const matchedBy = new Set<DashboardRunObservatoryRun["matchedBy"][number]>();

  if (!hasFilter) {
    return run;
  }
  if (runId && run.id === runId) {
    matchedBy.add("runId");
  }
  if (traceId && run.traceId === traceId) {
    matchedBy.add("traceId");
  }
  if (sessionId && run.sessionId === sessionId) {
    matchedBy.add("sessionId");
  }
  if (statuses.length > 0 && statuses.includes(run.status)) {
    matchedBy.add("status");
  }

  return matchedBy.size > 0
    ? {
        ...run,
        matchedBy: Array.from(matchedBy),
      }
    : null;
}

export function normalizeCommandCenterRunStatus(value: unknown): DashboardAgentRunStatus | null {
  const raw = normalizeText(value).toLowerCase().replace(/[\s-]+/g, "_");
  if (!raw) {
    return null;
  }
  if ((DASHBOARD_AGENT_RUN_STATUSES as readonly string[]).includes(raw)) {
    return raw as DashboardAgentRunStatus;
  }
  if (raw.includes("approval") || raw.includes("aguard")) {
    return "waiting_approval";
  }
  if (raw.includes("cancel")) {
    return "cancelled";
  }
  if (raw.includes("fail") || raw.includes("error") || raw.includes("falh")) {
    return "failed";
  }
  if (raw.includes("queue") || raw.includes("pending") || raw.includes("fila")) {
    return "queued";
  }
  if (raw.includes("think") || raw.includes("reason") || raw.includes("pens")) {
    return "thinking";
  }
  if (raw.includes("run") || raw.includes("progress") || raw.includes("rod")) {
    return "running";
  }
  if (raw.includes("complete") || raw.includes("done") || raw.includes("success") || raw.includes("concl")) {
    return "completed";
  }
  if (raw === "idle" || raw.includes("ocioso")) {
    return "idle";
  }
  return null;
}

export function normalizeCommandCenterRunObservatoryQuery(
  input: DashboardRunObservatoryQuery | Record<string, any> | null | undefined,
): DashboardRunObservatoryQuery {
  const record = input && typeof input === "object" ? input as Record<string, any> : {};
  const runId = normalizeText(record.runId);
  const traceId = normalizeText(record.traceId);
  const sessionId = normalizeText(record.sessionId);
  const statuses = normalizeStatusList(record.status ?? record.runStatus);
  const limit = normalizeLimit(record.limit);
  const query: DashboardRunObservatoryQuery = {};

  if (runId) {
    query.runId = runId;
  }
  if (traceId) {
    query.traceId = traceId;
  }
  if (sessionId) {
    query.sessionId = sessionId;
  }
  if (statuses.length === 1) {
    query.status = statuses[0];
  } else if (statuses.length > 1) {
    query.status = statuses;
  }
  if (limit !== null) {
    query.limit = limit;
  }
  return query;
}

export function commandCenterRunObservatoryHasQuery(
  query: DashboardRunObservatoryQuery | null | undefined,
): boolean {
  const normalized = normalizeCommandCenterRunObservatoryQuery(query);
  return Boolean(
    normalized.runId
      || normalized.traceId
      || normalized.sessionId
      || queryStatuses(normalized).length > 0
      || normalized.limit,
  );
}

export function filterCommandCenterRunObservatory(
  observatory: DashboardRunObservatorySnapshot,
  query: DashboardRunObservatoryQuery | Record<string, any> | null | undefined,
): DashboardRunObservatorySnapshot {
  const normalizedQuery = normalizeCommandCenterRunObservatoryQuery(query);
  if (!commandCenterRunObservatoryHasQuery(normalizedQuery)) {
    return observatory;
  }

  const limit = normalizeLimit(normalizedQuery.limit) || observatory.runs.length || 50;
  const runs = observatory.runs
    .map((run) => runMatchesQuery(run, normalizedQuery))
    .filter((entry): entry is DashboardRunObservatoryRun => Boolean(entry))
    .slice(0, limit);

  return {
    ...observatory,
    query: normalizedQuery,
    matchedRuns: runs.length,
    runs,
  };
}

export function formatCommandCenterBudgetLabel(budget: DashboardBudgetSnapshot): string {
  if (budget.estimatedCostUnits !== undefined && budget.maxEstimatedCostUnits !== undefined) {
    return `${formatNumber(budget.estimatedCostUnits)}/${formatNumber(budget.maxEstimatedCostUnits)} unidades`;
  }
  if (budget.estimatedCostUnits !== undefined) {
    return `${formatNumber(budget.estimatedCostUnits)} unidades`;
  }
  if (budget.tokensUsed !== undefined && budget.tokenBudget !== undefined) {
    return `${budget.tokensUsed}/${budget.tokenBudget} tokens`;
  }
  return budget.status;
}

export function formatCommandCenterBudgetDetail(budget: DashboardBudgetSnapshot): string {
  const parts = [
    budget.summary,
    budget.source ? `fonte ${budget.source}` : "",
    budget.reason ? `motivo ${budget.reason}` : "",
  ].filter(Boolean);
  return parts.join("; ");
}

export function formatCommandCenterModelRouteLabel(profile: DashboardModelProfile): string {
  return profile.routeId || profile.routingPolicy;
}

export function formatCommandCenterModelRouteDetail(profile: DashboardModelProfile): string {
  const parts = [
    `${profile.providerLabel}/${profile.modelLabel}`,
    profile.selectionSource ? `fonte ${profile.selectionSource}` : "",
    profile.readiness ? `readiness ${profile.readiness}` : "",
    profile.fallbackOrder?.length ? `fallback ${profile.fallbackOrder.join(" -> ")}` : "",
  ].filter(Boolean);
  return parts.join("; ");
}

export function formatCommandCenterRunIdentity(run: DashboardRunObservatoryRun): string {
  return run.traceId || run.sessionId || run.id;
}

export function formatCommandCenterRunMatchedBy(
  matchedBy: DashboardRunObservatoryRun["matchedBy"],
): string {
  if (matchedBy.length === 0 || matchedBy.includes("recent")) {
    return "recente";
  }
  return matchedBy.map((entry) => {
    if (entry === "runId") {
      return "run";
    }
    if (entry === "traceId") {
      return "trace";
    }
    if (entry === "sessionId") {
      return "sessao";
    }
    return "status";
  }).join(" + ");
}

export function formatCommandCenterRunObservatoryQuery(
  observatory: DashboardRunObservatorySnapshot,
): string {
  const query = observatory.query;
  const parts = [
    query.runId ? `run ${query.runId}` : "",
    query.traceId ? `trace ${query.traceId}` : "",
    query.sessionId ? `sessao ${query.sessionId}` : "",
    query.status
      ? `status ${Array.isArray(query.status) ? query.status.join(", ") : query.status}`
      : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join("; ") : "runs recentes";
}

export function formatCommandCenterRunStatusIndex(
  observatory: DashboardRunObservatorySnapshot,
): string {
  if (observatory.indexes.statuses.length === 0) {
    return "sem status indexado";
  }
  return observatory.indexes.statuses
    .map((entry) => `${entry.status}:${entry.count}`)
    .join(" | ");
}

export function buildCommandCenterRunObservabilityRows(
  viewModel: DashboardCommandCenterViewModel,
): Array<{ id: string; label: string; value: string; detail?: string }> {
  const run = viewModel.agentRun;
  const rows: Array<{ id: string; label: string; value: string; detail?: string }> = [
    {
      id: "route",
      label: "Rota",
      value: formatCommandCenterModelRouteLabel(viewModel.modelProfile),
      detail: formatCommandCenterModelRouteDetail(viewModel.modelProfile),
    },
    {
      id: "budget",
      label: "Budget",
      value: formatCommandCenterBudgetLabel(viewModel.budget),
      detail: formatCommandCenterBudgetDetail(viewModel.budget),
    },
  ];

  if (run?.traceId) {
    rows.push({
      id: "trace",
      label: "Trace",
      value: run.traceId,
      detail: run.requestId ? `request ${run.requestId}` : undefined,
    });
  } else if (run?.requestId) {
    rows.push({
      id: "request",
      label: "Request",
      value: run.requestId,
    });
  }

  if (viewModel.replay.status !== "none") {
    rows.push({
      id: "replay",
      label: "Replay",
      value: viewModel.replay.status,
      detail: `${viewModel.replay.eventCount} eventos, ${viewModel.replay.artifactCount} artifacts`,
    });
  }

  return rows;
}
