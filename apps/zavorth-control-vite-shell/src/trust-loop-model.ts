/**
 * Control shell Trust Loop pure model.
 * Single source: monorepo `src/services/control/ControlTrustLoopModel.ts`.
 * Browser-safe re-export + localStorage helpers for the Vite shell.
 */

export {
  CONTROL_TRUST_LOOP_CACHE_KEY,
  CONTROL_TRUST_LOOP_CACHE_VERSION,
  buildRiskBudgetView,
  classifyControlReadiness,
  formatProofLine,
  formatRiskBudgetLine,
  normalizeProofEvents,
  parseTrustLoopCache,
  readHonestBoolean,
  riskBudgetModeLabel,
  sanitizeCachedReadinessBadge,
  selectLatestProof,
  serializeTrustLoopCache,
  type ControlProofEvent,
  type ControlProofEventKind,
  type ControlProofEventStatus,
  type ControlTrustLoopCache,
  type ControlReadinessBadge,
  type ControlReadinessState,
  type ControlRiskBudgetMode,
  type ControlRiskBudgetView,
} from '../../../src/services/control/ControlTrustLoopModel';

import {
  CONTROL_TRUST_LOOP_CACHE_KEY,
  buildRiskBudgetView,
  classifyControlReadiness,
  normalizeProofEvents,
  parseTrustLoopCache,
  selectLatestProof,
  serializeTrustLoopCache,
  type ControlProofEvent,
  type ControlTrustLoopCache,
  type ControlReadinessBadge,
  type ControlRiskBudgetView,
} from '../../../src/services/control/ControlTrustLoopModel';

export type TrustLoopPanelModel = {
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

/** Read optional Trust Loop cache from localStorage. */
export function readTrustLoopCache(storage?: StorageLike | null): ControlTrustLoopCache | null {
  const store = resolveStorage(storage);
  if (!store) return null;
  try {
    const raw = store.getItem(CONTROL_TRUST_LOOP_CACHE_KEY);
    if (!raw) return null;
    return parseTrustLoopCache(JSON.parse(raw));
  } catch {
    // Corrupt JSON / poisoned payload → fail closed (no cache).
    return null;
  }
}

/** Persist Trust Loop model snapshot for offline/honest fallback. */
export function writeTrustLoopCache(
  model: TrustLoopPanelModel,
  storage?: StorageLike | null,
): boolean {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    const payload = serializeTrustLoopCache({
      proofs: model.proofs,
      riskBudget: model.riskBudget,
      readinessItems: model.readinessItems,
    });
    store.setItem(CONTROL_TRUST_LOOP_CACHE_KEY, JSON.stringify(payload));
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
    liveReady: input.live === true && !input.authRequired,
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
 *
 * Honesty rules:
 * - Explicit empty live proofs/runs stay empty (do not resurrect poisoned cache proofs).
 * - Explicit riskBudgetState / readinessItems win over cache.
 * - Cache only fills dimensions that were not provided by the caller.
 * - parseTrustLoopCache already demotes cached "live" badges.
 */
export function composeTrustLoopPanelModel(input: {
  proofs?: unknown[];
  runs?: unknown[];
  riskBudgetState?: unknown;
  readinessItems?: ControlReadinessBadge[];
  useCacheFallback?: boolean;
  storage?: StorageLike | null;
  latest?: number;
} = {}): TrustLoopPanelModel {
  const proofsProvided = Array.isArray(input.proofs) || Array.isArray(input.runs);
  const riskBudgetProvided = Object.prototype.hasOwnProperty.call(input, 'riskBudgetState');
  const readinessProvided = Array.isArray(input.readinessItems);

  const fromProofs = normalizeProofEvents(Array.isArray(input.proofs) ? input.proofs : []);
  const fromRuns = proofEventsFromRuns(Array.isArray(input.runs) ? input.runs : []);
  let proofs = [...fromProofs, ...fromRuns];
  let riskBudget = buildRiskBudgetView(input.riskBudgetState);
  let readinessItems = input.readinessItems;

  if (input.useCacheFallback !== false) {
    const needProofs = !proofsProvided && proofs.length === 0;
    const needBudget = !riskBudgetProvided && !riskBudget;
    const needReadiness = !readinessProvided && !readinessItems?.length;

    if (needProofs || needBudget || needReadiness) {
      const cached = readTrustLoopCache(input.storage);
      if (cached) {
        if (needProofs) proofs = cached.proofs;
        if (needBudget) riskBudget = cached.riskBudget;
        if (needReadiness && cached.readinessItems?.length) {
          readinessItems = cached.readinessItems;
        }
      }
    }
  }

  proofs = selectLatestProof(proofs, input.latest ?? 12);
  const model: TrustLoopPanelModel = {
    proofs,
    riskBudget,
    readinessItems,
  };
  writeTrustLoopCache(model, input.storage);
  return model;
}
