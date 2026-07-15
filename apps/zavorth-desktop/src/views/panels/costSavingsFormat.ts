/**
 * Pure formatters / normalizers for the Cost Savings dashboard surface.
 */

export type CostSavingsTotals = {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  estimatedSavingsUsd: number;
  backgroundRouteCalls: number;
};

export type CostSavingsModelRow = {
  modelKey: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
};

export type CostSavingsSnapshot = {
  generatedAt: string;
  source?: string;
  storageDir?: string;
  sessionsScanned: number;
  totals: CostSavingsTotals;
  byModel: CostSavingsModelRow[];
  backgroundRouteHint: string;
  narrative: string;
};

export function emptyCostSavingsSnapshot(now = new Date()): CostSavingsSnapshot {
  return {
    generatedAt: now.toISOString(),
    sessionsScanned: 0,
    totals: {
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      estimatedSavingsUsd: 0,
      backgroundRouteCalls: 0,
    },
    byModel: [],
    backgroundRouteHint: 'Background routes pick the cheapest hop on YOUR stack (secondary model / fallbacks).',
    narrative: 'No session model usage recorded yet.',
  };
}

export function normalizeCostSavingsSnapshot(raw: unknown): CostSavingsSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  // API wraps as { ok, data } or returns data directly
  const data = (rec.data && typeof rec.data === 'object' ? rec.data : rec) as Record<string, unknown>;
  if (!data.totals || typeof data.totals !== 'object') return null;

  const totalsRaw = data.totals as Record<string, unknown>;
  const byModelRaw = Array.isArray(data.byModel) ? data.byModel : [];

  return {
    generatedAt: String(data.generatedAt || new Date().toISOString()),
    source: typeof data.source === 'string' ? data.source : undefined,
    storageDir: typeof data.storageDir === 'string' ? data.storageDir : undefined,
    sessionsScanned: num(data.sessionsScanned),
    totals: {
      calls: num(totalsRaw.calls),
      inputTokens: num(totalsRaw.inputTokens),
      outputTokens: num(totalsRaw.outputTokens),
      estimatedCostUsd: num(totalsRaw.estimatedCostUsd),
      estimatedSavingsUsd: num(totalsRaw.estimatedSavingsUsd),
      backgroundRouteCalls: num(totalsRaw.backgroundRouteCalls),
    },
    byModel: byModelRaw
      .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
      .map((row) => ({
        modelKey: String(row.modelKey || 'unknown'),
        calls: num(row.calls),
        inputTokens: num(row.inputTokens),
        outputTokens: num(row.outputTokens),
        estimatedCostUsd: num(row.estimatedCostUsd),
      })),
    backgroundRouteHint: String(data.backgroundRouteHint || ''),
    narrative: String(data.narrative || ''),
  };
}

export function formatTokenCount(n: number): string {
  if (!Number.isFinite(n)) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}

export function formatUsd(n: number, digits = 4): string {
  if (!Number.isFinite(n)) return '$0.0000';
  return `$${n.toFixed(digits)}`;
}

export function savingsRatio(totals: CostSavingsTotals): number {
  const baseline = totals.estimatedCostUsd + totals.estimatedSavingsUsd;
  if (baseline <= 0) return 0;
  return Math.max(0, Math.min(1, totals.estimatedSavingsUsd / baseline));
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
