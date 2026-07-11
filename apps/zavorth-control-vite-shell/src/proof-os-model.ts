/**
 * Control shell Proof OS pure model.
 * Single source: monorepo `src/services/control/ControlProofOsModel.ts`.
 * Browser-safe re-export + localStorage helpers for the Vite shell.
 */

export {
  CONTROL_PROOF_OS_CACHE_KEY,
  buildRiskBudgetView,
  classifyControlReadiness,
  formatProofLine,
  formatRiskBudgetLine,
  normalizeProofEvents,
  parseProofOsCache,
  riskBudgetModeLabel,
  selectLatestProof,
  serializeProofOsCache,
  type ControlProofEvent,
  type ControlProofEventKind,
  type ControlProofEventStatus,
  type ControlProofOsCache,
  type ControlReadinessBadge,
  type ControlReadinessState,
  type ControlRiskBudgetMode,
  type ControlRiskBudgetView,
} from '../../../src/services/control/ControlProofOsModel';

import {
  CONTROL_PROOF_OS_CACHE_KEY,
  buildRiskBudgetView,
  classifyControlReadiness,
  normalizeProofEvents,
  parseProofOsCache,
  selectLatestProof,
  serializeProofOsCache,
  type ControlProofEvent,
  type ControlProofOsCache,
  type ControlReadinessBadge,
  type ControlRiskBudgetView,
} from '../../../src/services/control/ControlProofOsModel';

export type ProofOsPanelModel = {
  proofs: ControlProofEvent[];
  riskBudget: ControlRiskBudgetView | null;
  readinessItems?: ControlReadinessBadge[];
};

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function resolveStorage(storage?: StorageLike | null): StorageLike | null {
  if (storage) return storage;
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // private mode / SSR
  }
  return null;
}

/** Read optional Proof OS cache from localStorage. */
export function readProofOsCache(storage?: StorageLike | null): ControlProofOsCache | null {
  const store = resolveStorage(storage);
  if (!store) return null;
  try {
    const raw = store.getItem(CONTROL_PROOF_OS_CACHE_KEY);
    if (!raw) return null;
    return parseProofOsCache(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Persist Proof OS model snapshot for offline/honest fallback. */
export function writeProofOsCache(
  model: ProofOsPanelModel,
  storage?: StorageLike | null,
): boolean {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    const payload = serializeProofOsCache({
      proofs: model.proofs,
      riskBudget: model.riskBudget,
      readinessItems: model.readinessItems,
    });
    store.setItem(CONTROL_PROOF_OS_CACHE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/**
 * Project runtime runs / receipts into ControlProofEvent[].
 * Thin companion projection — does not invent live readiness.
 */
export function proofEventsFromRuns(runs: unknown[]): ControlProofEvent[] {
  if (!Array.isArray(runs)) return [];
  const raw = runs.map((run) => {
    if (!run || typeof run !== 'object') return null;
    const r = run as Record<string, unknown>;
    const id = String(r.id || r.runId || '').trim();
    if (!id) return null;
    return {
      id: `run-${id}`,
      runId: id,
      kind: r.kind || 'runtime',
      surface: r.surface || r.channel || 'control',
      title: r.title || r.summary || id,
      summary: r.summary || r.nextAction || r.status || 'Recorded run',
      status: r.status || 'info',
      riskLevel: r.riskLevel || r.risk || 'none',
      approvalId: r.approvalId ?? null,
      artifacts: Array.isArray(r.artifacts) ? r.artifacts : [],
      createdAt: r.updatedAt || r.createdAt || new Date().toISOString(),
      source: r.source || r.channel || 'control-runs',
      metadata: {
        projectedFrom: 'control-run',
        channel: r.channel,
        status: r.status,
      },
    };
  }).filter(Boolean);
  return normalizeProofEvents(raw);
}

/** Build readiness chips from Control live/catalog signals. */
export function buildControlReadinessItems(input: {
  live?: boolean | null;
  authRequired?: boolean | null;
  providerLiveReady?: boolean | null;
  providerCatalogReady?: boolean | null;
  channelLiveReady?: boolean | null;
  channelCatalogReady?: boolean | null;
} = {}): ControlReadinessBadge[] {
  const items: ControlReadinessBadge[] = [];

  const runtime = classifyControlReadiness({
    blocked: Boolean(input.authRequired),
    liveReady: Boolean(input.live) && !input.authRequired,
    catalogReady: false,
    configured: input.live === false ? false : undefined,
  });
  if (runtime.state === 'live') {
    items.push({ ...runtime, label: 'Live', detail: 'Runtime bridge live.' });
  } else if (runtime.state === 'blocked') {
    items.push({ ...runtime, label: 'Blocked', detail: 'Auth required before live work.' });
  } else if (runtime.state === 'needs_setup') {
    items.push({ ...runtime, label: 'Needs setup', detail: 'Runtime not live yet.' });
  } else {
    items.push({ ...runtime, detail: runtime.detail || 'Runtime readiness unknown.' });
  }

  if (input.providerLiveReady != null || input.providerCatalogReady != null) {
    // liveReady wins; catalogReady alone never becomes live.
    const badge = classifyControlReadiness({
      liveReady: input.providerLiveReady === true,
      catalogReady: input.providerCatalogReady === true && input.providerLiveReady !== true,
      configured: input.providerLiveReady === true || input.providerCatalogReady === true
        ? true
        : input.providerLiveReady === false && input.providerCatalogReady === false
          ? false
          : undefined,
    });
    items.push({
      ...badge,
      detail: badge.state === 'live'
        ? 'Provider proven live.'
        : badge.state === 'catalog'
          ? 'Provider catalog ≠ live.'
          : badge.detail,
    });
  }

  if (input.channelLiveReady != null || input.channelCatalogReady != null) {
    const badge = classifyControlReadiness({
      liveReady: input.channelLiveReady === true,
      catalogReady: input.channelCatalogReady === true && input.channelLiveReady !== true,
      configured: input.channelLiveReady === true || input.channelCatalogReady === true
        ? true
        : input.channelLiveReady === false && input.channelCatalogReady === false
          ? false
          : undefined,
    });
    items.push({
      ...badge,
      detail: badge.state === 'catalog'
        ? 'Channel catalog ≠ live.'
        : badge.detail,
    });
  }

  return items;
}

/**
 * Compose panel model from live inputs + optional cache fallback.
 */
export function composeProofOsPanelModel(input: {
  proofs?: unknown[];
  runs?: unknown[];
  riskBudgetState?: unknown;
  readinessItems?: ControlReadinessBadge[];
  useCacheFallback?: boolean;
  storage?: StorageLike | null;
  latest?: number;
} = {}): ProofOsPanelModel {
  const fromProofs = normalizeProofEvents(Array.isArray(input.proofs) ? input.proofs : []);
  const fromRuns = proofEventsFromRuns(Array.isArray(input.runs) ? input.runs : []);
  let proofs = [...fromProofs, ...fromRuns];
  let riskBudget = buildRiskBudgetView(input.riskBudgetState);
  let readinessItems = input.readinessItems;

  if ((proofs.length === 0 || !riskBudget || !readinessItems?.length) && input.useCacheFallback !== false) {
    const cached = readProofOsCache(input.storage);
    if (cached) {
      if (proofs.length === 0) proofs = cached.proofs;
      if (!riskBudget) riskBudget = cached.riskBudget;
      if (!readinessItems?.length && cached.readinessItems?.length) {
        readinessItems = cached.readinessItems;
      }
    }
  }

  proofs = selectLatestProof(proofs, input.latest ?? 12);
  const model: ProofOsPanelModel = {
    proofs,
    riskBudget,
    readinessItems,
  };
  writeProofOsCache(model, input.storage);
  return model;
}
