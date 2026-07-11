/**
 * Control surface Proof OS pure model.
 *
 * Browser-safe and Node-safe. Mirrors desktop proofBridge / riskBudgetBridge
 * language so Control keeps the same honesty rules (catalog ≠ live).
 * No filesystem or DOM dependencies.
 */

export type ControlProofEventKind =
  | 'chat'
  | 'approval'
  | 'runtime'
  | 'system'
  | 'channel'
  | 'memory'
  | 'marketplace'
  | 'workboard'
  | 'action'
  | 'evidence'
  | 'unknown';

export type ControlProofEventStatus = 'ok' | 'failed' | 'pending' | 'info';

export type ControlProofEvent = {
  id: string;
  runId: string | null;
  kind: ControlProofEventKind | string;
  surface: string;
  title: string;
  summary: string;
  status: ControlProofEventStatus | string;
  riskLevel?: string;
  approvalId?: string | null;
  artifacts?: Array<{ id: string; type: string; label?: string }>;
  createdAt: string;
  source: string;
  metadata?: Record<string, unknown>;
};

export type ControlRiskBudgetMode = 'observer' | 'operator' | 'autopilot' | string;

export type ControlRiskBudgetView = {
  mode: ControlRiskBudgetMode;
  modeLabel: string;
  dayKey: string;
  frozen: boolean;
  counters: Record<string, number>;
  limits: Record<string, number>;
  updatedAt?: string | null;
  notes?: string | null;
};

export type ControlReadinessState =
  | 'live'
  | 'catalog'
  | 'needs_setup'
  | 'blocked'
  | 'unknown';

export type ControlReadinessBadge = {
  state: ControlReadinessState;
  label: string;
  tone: 'ready' | 'warning' | 'danger' | 'muted';
  detail?: string;
};

const MODE_LABELS: Record<string, string> = {
  observer: 'Observer',
  operator: 'Operator',
  autopilot: 'Autopilot',
};

const SHORT_DIM: Record<string, string> = {
  diskMutations: 'disk',
  shellCommands: 'shell',
  networkSends: 'network',
  modelCostUnits: 'model',
};

const STATUS_SET = new Set(['ok', 'failed', 'pending', 'info']);
const KIND_HINTS: Array<{ match: RegExp; kind: ControlProofEventKind }> = [
  { match: /approv/, kind: 'approval' },
  { match: /chat|message/, kind: 'chat' },
  { match: /channel/, kind: 'channel' },
  { match: /memory|recall/, kind: 'memory' },
  { match: /market/, kind: 'marketplace' },
  { match: /workboard|board|kanban/, kind: 'workboard' },
  { match: /runtime|agent/, kind: 'runtime' },
  { match: /evidence|proof/, kind: 'evidence' },
  { match: /action|tool|exec/, kind: 'action' },
  { match: /system|boot|config/, kind: 'system' },
];

const READINESS_STATES: ControlReadinessState[] = [
  'live',
  'catalog',
  'needs_setup',
  'blocked',
  'unknown',
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readString(value: unknown, fallback = ''): string {
  if (value == null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function readNullableString(value: unknown): string | null {
  const text = readString(value, '');
  return text || null;
}

function readNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Non-negative finite number for budget counters/limits (display honesty). */
function readNonNegative(value: unknown, fallback = 0): number {
  return Math.max(0, readNumber(value, fallback));
}

/**
 * Strict-ish boolean for cache/API payloads.
 * String "false" must not become true (Boolean("false") === true).
 */
export function readHonestBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value !== 0;
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase();
    if (text === 'true' || text === '1' || text === 'yes' || text === 'on') return true;
    if (text === 'false' || text === '0' || text === 'no' || text === 'off' || text === '') return false;
  }
  if (value == null) return fallback;
  return Boolean(value);
}

function normalizeStatus(value: unknown): ControlProofEventStatus {
  const text = String(value || '').toLowerCase();
  if (STATUS_SET.has(text)) return text as ControlProofEventStatus;
  if (/fail|error|denied|block/.test(text)) return 'failed';
  if (/pend|wait|hold/.test(text)) return 'pending';
  if (/ok|success|applied|approved|pass|done|complete/.test(text)) return 'ok';
  return 'info';
}

function normalizeKind(value: unknown): ControlProofEventKind | string {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return 'unknown';
  for (const entry of KIND_HINTS) {
    if (entry.match.test(text)) return entry.kind;
  }
  return text;
}

/**
 * Normalize raw proof-like objects (ledger events, desktop receipts, run rows)
 * into ControlProofEvent[].
 */
export function normalizeProofEvents(raw: unknown[]): ControlProofEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: ControlProofEvent[] = [];

  for (const entry of raw) {
    const obj = asRecord(entry);
    if (!obj) continue;

    const meta = asRecord(obj.metadata) || undefined;
    const id = readString(obj.id, '');
    if (!id) continue;

    const createdAt = readString(
      obj.createdAt ?? obj.at ?? obj.updatedAt ?? obj.timestamp,
      new Date(0).toISOString(),
    );

    const runId =
      readNullableString(obj.runId)
      ?? readNullableString(meta?.runId)
      ?? readNullableString(obj.sessionId)
      ?? null;

    const artifactsRaw = obj.artifacts ?? meta?.artifacts;
    const artifacts = Array.isArray(artifactsRaw)
      ? artifactsRaw
        .map((item) => {
          const art = asRecord(item);
          if (!art) return null;
          const artId = readString(art.id, '');
          if (!artId) return null;
          const label = readString(art.label, '');
          return {
            id: artId,
            type: readString(art.type, 'artifact'),
            ...(label ? { label } : {}),
          };
        })
        .filter((item): item is { id: string; type: string; label?: string } => item != null)
      : undefined;

    out.push({
      id,
      runId,
      kind: normalizeKind(obj.kind ?? obj.type ?? meta?.proofKind),
      surface: readString(obj.surface, 'control'),
      title: readString(obj.title, 'Receipt'),
      summary: readString(obj.summary ?? obj.detail ?? obj.message, 'No details.'),
      status: normalizeStatus(obj.status),
      riskLevel: readString(obj.riskLevel ?? meta?.riskLevel ?? meta?.risk, 'none') || 'none',
      approvalId: readNullableString(obj.approvalId ?? meta?.approvalId),
      artifacts,
      createdAt,
      source: readString(obj.source, 'control'),
      metadata: meta,
    });
  }

  return out;
}

/** Latest n proof events (newest first by createdAt). */
export function selectLatestProof(events: ControlProofEvent[], n = 5): ControlProofEvent[] {
  const limit = Math.max(0, Math.floor(Number(n) || 0));
  if (!Array.isArray(events) || limit === 0) return [];
  return [...events]
    .sort((a, b) => {
      const ta = Date.parse(a.createdAt) || 0;
      const tb = Date.parse(b.createdAt) || 0;
      if (tb !== ta) return tb - ta;
      return String(b.id).localeCompare(String(a.id));
    })
    .slice(0, limit);
}

/** One-line proof list entry. Example: `ok · approval · Allow shell · 12:04` */
export function formatProofLine(event: ControlProofEvent): string {
  if (!event) return 'Proof · unavailable';
  const status = readString(event.status, 'info');
  const kind = readString(event.kind, 'system');
  const title = readString(event.title, 'Receipt');
  let time = '';
  const ms = Date.parse(event.createdAt);
  if (Number.isFinite(ms) && ms > 0) {
    try {
      time = new Date(ms).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
      time = '';
    }
  }
  const core = `${status} · ${kind} · ${title}`;
  return time ? `${core} · ${time}` : core;
}

export function riskBudgetModeLabel(mode: string | null | undefined): string {
  const key = String(mode || '').trim().toLowerCase();
  return MODE_LABELS[key] || (key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Operator');
}

/**
 * Build a Control risk-budget view from a state-like object.
 * Returns null when the payload cannot represent a budget (missing mode + counters).
 */
export function buildRiskBudgetView(stateLike: unknown): ControlRiskBudgetView | null {
  const obj = asRecord(stateLike);
  if (!obj) return null;

  const mode = readString(obj.mode, '');
  const countersRaw = asRecord(obj.counters);
  const limitsRaw = asRecord(obj.limits);
  if (!mode && !countersRaw && !limitsRaw) return null;

  const counters: Record<string, number> = {};
  const limits: Record<string, number> = {};
  for (const dim of ['diskMutations', 'shellCommands', 'networkSends', 'modelCostUnits']) {
    counters[dim] = readNonNegative(countersRaw?.[dim], 0);
    limits[dim] = readNonNegative(limitsRaw?.[dim], 0);
  }
  // Preserve any extra dimensions if present.
  if (countersRaw) {
    for (const [key, value] of Object.entries(countersRaw)) {
      if (!(key in counters)) counters[key] = readNonNegative(value, 0);
    }
  }
  if (limitsRaw) {
    for (const [key, value] of Object.entries(limitsRaw)) {
      if (!(key in limits)) limits[key] = readNonNegative(value, 0);
    }
  }

  return {
    mode: mode || 'operator',
    modeLabel: riskBudgetModeLabel(mode || 'operator'),
    dayKey: readString(obj.dayKey, ''),
    frozen: readHonestBoolean(obj.frozen, false),
    counters,
    limits,
    updatedAt: readNullableString(obj.updatedAt),
    notes: readNullableString(obj.notes),
  };
}

/**
 * Compact status line. Example: `Operator · disk 3/50 · shell 1/30`
 */
export function formatRiskBudgetLine(view: ControlRiskBudgetView | null | undefined): string {
  if (!view) return 'Risk budget · unavailable';
  const mode = view.modeLabel || riskBudgetModeLabel(view.mode);
  const frozen = view.frozen ? ' · FROZEN' : '';
  const parts = ['diskMutations', 'shellCommands', 'networkSends'].map((dim) => {
    const short = SHORT_DIM[dim] || dim;
    const used = readNonNegative(view.counters?.[dim], 0);
    const limit = readNonNegative(view.limits?.[dim], 0);
    return `${short} ${used}/${limit}`;
  });
  return `${mode} · ${parts.join(' · ')}${frozen}`;
}

/**
 * Honest readiness classification for Control.
 * NEVER maps catalog-only → live.
 *
 * Priority: blocked → live (explicit liveReady only) → catalog → needs_setup → unknown.
 */
export function classifyControlReadiness(input: {
  catalogReady?: boolean;
  liveReady?: boolean;
  configured?: boolean;
  blocked?: boolean;
  label?: string;
}): ControlReadinessBadge {
  const custom = readString(input?.label, '');

  if (input?.blocked) {
    return {
      state: 'blocked',
      label: custom || 'Blocked',
      tone: 'danger',
      detail: 'Blocked by policy or runtime gate.',
    };
  }

  // Live requires explicit liveReady — catalog alone is never enough.
  // Strict equality: string "true" / 1 must not grant live.
  if (input?.liveReady === true) {
    return {
      state: 'live',
      label: custom || 'Live',
      tone: 'ready',
      detail: 'Proven live on this surface.',
    };
  }

  if (input?.catalogReady === true) {
    return {
      state: 'catalog',
      label: custom || 'Catalog only',
      tone: 'muted',
      detail: 'Catalog support is not live proof.',
    };
  }

  if (input?.configured === true) {
    // Configured but not catalog/live flagged — still not live.
    return {
      state: 'catalog',
      label: custom || 'Catalog only',
      tone: 'muted',
      detail: 'Configured in catalog; not proven live.',
    };
  }

  if (input?.configured === false || input?.liveReady === false) {
    return {
      state: 'needs_setup',
      label: custom || 'Needs setup',
      tone: 'warning',
      detail: 'Setup required before live use.',
    };
  }

  return {
    state: 'unknown',
    label: custom || 'Unknown',
    tone: 'muted',
  };
}

/**
 * Sanitize a readiness badge recovered from localStorage.
 * Cache is offline/stale by definition — never trust `live` without re-proof.
 */
export function sanitizeCachedReadinessBadge(raw: unknown): ControlReadinessBadge | null {
  const rec = asRecord(raw);
  if (!rec) return null;

  let state = readString(rec.state, 'unknown') as ControlReadinessState;
  if (!READINESS_STATES.includes(state)) return null;

  let label = readString(rec.label, state);
  let detail = readString(rec.detail, '') || undefined;
  const labelLower = label.toLowerCase();

  // Cache cannot prove live (poison or stale). Always demote live → catalog.
  if (state === 'live') {
    state = 'catalog';
    label = 'Catalog only';
    detail = detail || 'Cached readiness is not live proof.';
  }

  let tone: ControlReadinessBadge['tone'] = 'muted';
  if (state === 'blocked') {
    tone = 'danger';
    label = labelLower.includes('block') ? label : 'Blocked';
  } else if (state === 'needs_setup') {
    tone = 'warning';
    label = labelLower.includes('setup') ? label : 'Needs setup';
  } else if (state === 'catalog') {
    tone = 'muted';
    // Poison: state catalog + label "Live"
    if (labelLower.includes('live') && !labelLower.includes('catalog')) {
      label = 'Catalog only';
      detail = detail || 'Cached readiness is not live proof.';
    }
  } else {
    tone = 'muted';
  }

  return {
    state,
    label,
    tone,
    detail,
  };
}

/** Cache payload shape for Control localStorage (`zavorth.control.proof-os.v1`). */
export type ControlProofOsCache = {
  version: 1;
  updatedAt: string;
  proofs: ControlProofEvent[];
  riskBudget: ControlRiskBudgetView | null;
  readinessItems?: ControlReadinessBadge[];
};

export const CONTROL_PROOF_OS_CACHE_KEY = 'zavorth.control.proof-os.v1';
export const CONTROL_PROOF_OS_CACHE_VERSION = 1 as const;

export function serializeProofOsCache(model: {
  proofs?: ControlProofEvent[];
  riskBudget?: ControlRiskBudgetView | null;
  readinessItems?: ControlReadinessBadge[];
  updatedAt?: string;
}): ControlProofOsCache {
  return {
    version: CONTROL_PROOF_OS_CACHE_VERSION,
    updatedAt: model.updatedAt || new Date().toISOString(),
    proofs: Array.isArray(model.proofs) ? model.proofs : [],
    riskBudget: model.riskBudget ?? null,
    readinessItems: Array.isArray(model.readinessItems) ? model.readinessItems : undefined,
  };
}

export function parseProofOsCache(raw: unknown): ControlProofOsCache | null {
  const obj = asRecord(raw);
  if (!obj) return null;

  // Reject unknown future / garbage versions. Missing version → treat as v1 legacy.
  if (obj.version != null) {
    const version = Number(obj.version);
    if (!Number.isFinite(version) || version !== CONTROL_PROOF_OS_CACHE_VERSION) {
      return null;
    }
  }

  const proofs = normalizeProofEvents(Array.isArray(obj.proofs) ? obj.proofs : []);
  const riskBudget = buildRiskBudgetView(obj.riskBudget);
  const readinessRaw = Array.isArray(obj.readinessItems) ? obj.readinessItems : [];
  const readinessItems = readinessRaw
    .map((item) => sanitizeCachedReadinessBadge(item))
    .filter((item): item is ControlReadinessBadge => Boolean(item));

  return {
    version: CONTROL_PROOF_OS_CACHE_VERSION,
    updatedAt: readString(obj.updatedAt, new Date(0).toISOString()),
    proofs,
    riskBudget,
    readinessItems: readinessItems.length ? readinessItems : undefined,
  };
}
