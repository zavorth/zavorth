import type {
  ZavorthControlRunObservatoryQuery,
  ZavorthControlRunObservatoryRun,
  ZavorthControlRunObservatorySnapshot,
} from '../contracts/index';

type AnyRecord = Record<string, any>;

function record(value: unknown): AnyRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {};
}

function array<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

export function formatZavorthControlBudgetLabel(budget: AnyRecord | null | undefined): string {
  const source = record(budget);
  if (source.estimatedCostUnits !== undefined && source.maxEstimatedCostUnits !== undefined) {
    return `${source.estimatedCostUnits}/${source.maxEstimatedCostUnits} unidades`;
  }
  if (source.tokensUsed !== undefined && source.tokenBudget !== undefined) {
    return `${source.tokensUsed}/${source.tokenBudget} tokens`;
  }
  return clean(source.status) || 'unknown';
}

export function formatZavorthControlBudgetDetail(budget: AnyRecord | null | undefined): string {
  const source = record(budget);
  const parts = [
    clean(source.summary),
    source.source ? `fonte ${source.source}` : '',
    source.status ? `status ${source.status}` : '',
  ].filter(Boolean);
  return parts.join('; ') || formatZavorthControlBudgetLabel(source);
}

export function formatZavorthControlModelRouteLabel(profile: AnyRecord | null | undefined): string {
  const source = record(profile);
  return clean(source.routeId) || clean(source.providerLabel) || clean(source.provider) || 'rota';
}

export function formatZavorthControlModelRouteDetail(profile: AnyRecord | null | undefined): string {
  const source = record(profile);
  const provider = clean(source.providerLabel || source.provider);
  const model = clean(source.modelLabel || source.model);
  const parts = [
    provider || model ? `${provider}/${model}` : '',
    source.selectionSource ? `fonte ${source.selectionSource}` : '',
    array(source.fallbackOrder).length ? `fallback ${array(source.fallbackOrder).join(' -> ')}` : '',
    source.readiness ? `readiness ${source.readiness}` : '',
  ].filter(Boolean);
  return parts.join('; ');
}

export function normalizeZavorthControlRunStatus(status: unknown): string {
  return clean(status).toLowerCase().replace(/[\s-]+/g, '_');
}

export function formatZavorthControlRunObservatoryQuery(observatory: Pick<ZavorthControlRunObservatorySnapshot, 'query'>): string {
  const query = record(observatory.query);
  const parts = [
    query.traceId ? `trace ${query.traceId}` : '',
    query.runId ? `run ${query.runId}` : '',
    query.sessionId ? `session ${query.sessionId}` : '',
    query.status ? `status ${Array.isArray(query.status) ? query.status.join(',') : query.status}` : '',
  ].filter(Boolean);
  return parts.join('; ') || 'sem filtro';
}

export function formatZavorthControlRunStatusIndex(observatory: Pick<ZavorthControlRunObservatorySnapshot, 'indexes'>): string {
  return array(observatory.indexes?.statuses)
    .map((entry) => `${entry.status}:${entry.count}`)
    .join(' | ');
}

export function formatZavorthControlRunIdentity(run: Partial<ZavorthControlRunObservatoryRun>): string {
  return clean(run.traceId) || clean(run.requestId) || clean(run.id) || 'run';
}

export function formatZavorthControlRunMatchedBy(matchedBy: unknown): string {
  const values = array<string>(matchedBy);
  if (values.includes('recent')) return 'recente';
  return values.map((value) => value === 'traceId' ? 'trace' : value).join(' + ');
}

export function zavorthControlRunObservatoryHasQuery(query: Partial<ZavorthControlRunObservatoryQuery>): boolean {
  return Object.values(query).some((value) => Array.isArray(value) ? value.length > 0 : clean(value));
}

export function normalizeZavorthControlRunObservatoryQuery(
  query: Partial<ZavorthControlRunObservatoryQuery> & Record<string, unknown>,
): ZavorthControlRunObservatoryQuery {
  const output: ZavorthControlRunObservatoryQuery = {};
  for (const key of ['runId', 'traceId', 'sessionId'] as const) {
    const value = clean(query[key]);
    if (value) output[key] = value;
  }
  if (query.status !== undefined) {
    const statuses = (Array.isArray(query.status) ? query.status : String(query.status).split(','))
      .map((status) => normalizeZavorthControlRunStatus(status))
      .filter(Boolean);
    if (statuses.length === 1) output.status = statuses[0];
    if (statuses.length > 1) output.status = statuses;
  }
  const limit = Number(query.limit);
  if (Number.isFinite(limit) && limit > 0) output.limit = Math.floor(limit);
  return output;
}

export function filterZavorthControlRunObservatory(
  observatory: ZavorthControlRunObservatorySnapshot,
  rawQuery: Partial<ZavorthControlRunObservatoryQuery> & Record<string, unknown>,
): ZavorthControlRunObservatorySnapshot {
  const query = normalizeZavorthControlRunObservatoryQuery(rawQuery);
  const statuses = new Set(array<string>(Array.isArray(query.status) ? query.status : query.status ? [query.status] : []));
  const matched = observatory.runs
    .map((run) => {
      const matchedBy: string[] = [];
      if (query.runId && run.id === query.runId) matchedBy.push('runId');
      if (query.traceId && run.traceId === query.traceId) matchedBy.push('traceId');
      if (query.sessionId && run.sessionId === query.sessionId) matchedBy.push('sessionId');
      if (statuses.size && statuses.has(normalizeZavorthControlRunStatus(run.status))) matchedBy.push('status');
      const hasFilters = zavorthControlRunObservatoryHasQuery(query);
      return !hasFilters || matchedBy.length > 0 ? { ...run, matchedBy: hasFilters ? matchedBy : ['recent'] } : null;
    })
    .filter(Boolean) as ZavorthControlRunObservatoryRun[];
  const limited = query.limit ? matched.slice(0, query.limit) : matched;
  return {
    ...observatory,
    query,
    matchedRuns: matched.length,
    runs: limited,
  };
}

export function buildZavorthControlRunObservabilityRows(viewModel: AnyRecord): Array<{ id: string; label: string; value: string; detail?: string }> {
  const modelProfile = record(viewModel.modelProfile || viewModel.agentRun?.modelProfile);
  const budget = record(viewModel.budget);
  const agentRun = record(viewModel.agentRun);
  return [
    {
      id: 'route',
      label: 'Model route',
      value: formatZavorthControlModelRouteLabel(modelProfile),
      detail: formatZavorthControlModelRouteDetail(modelProfile),
    },
    {
      id: 'budget',
      label: 'Budget',
      value: formatZavorthControlBudgetLabel(budget),
      detail: formatZavorthControlBudgetDetail(budget),
    },
    {
      id: 'trace',
      label: 'Trace',
      value: formatZavorthControlRunIdentity(agentRun),
    },
  ];
}
