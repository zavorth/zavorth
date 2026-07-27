/**
 * Shared readiness honesty classifier (P11).
 *
 * Rules (strict — catalog ≠ live):
 * 1. blocked → blocked
 * 2. liveReady === true → live (only explicit boolean proof)
 * 3. liveReady === false → never live
 * 4. Status string alone NEVER grants live
 * 5. configured without live → available / catalog (muted)
 *
 * Keep in sync with desktop `apps/zavorth-desktop/src/desktop-state/readiness.ts`
 * and Control `classifyControlReadiness` (live only via liveReady).
 *
 * Browser-safe and Node-safe. No filesystem or DOM dependencies.
 */

export type HonestReadinessState = 'live' | 'needs_setup' | 'available' | 'blocked' | 'unknown';

export type HonestReadinessTone = 'ready' | 'warning' | 'danger' | 'muted';

export type HonestReadinessBadge = {
  state: HonestReadinessState;
  label: string;
  tone: HonestReadinessTone;
  detail?: string;
};

/** Status tokens that mean setup incomplete — never live by themselves. */
const SETUP = new Set(['setup', 'configurable', 'needs_setup', 'needs-setup', 'pending', 'configured', 'partial']);
/** Status tokens that mean hard stop. */
const BLOCKED = new Set(['blocked', 'denied', 'error', 'failed', 'offline', 'unavailable', 'untrusted']);
/**
 * Soft / catalog-ish status tokens that must NOT auto-map to live.
 * Includes legacy false-positives: available, ready, ok, healthy, active.
 */
const CATALOG_MUTED = new Set([
  'available',
  'ready',
  'ok',
  'healthy',
  'active',
  'catalog',
  'supported',
  'listed',
  'connected',
  'trusted',
  'live',
]);

export type ClassifyHonestReadinessInput = {
  status?: string | null;
  liveReady?: boolean | null;
  configured?: boolean | null;
  blocked?: boolean | null;
  reason?: string | null;
};

/**
 * Classify readiness with strict honesty.
 * Only `liveReady === true` may return state `live`.
 */
export function classifyHonestReadiness(input: ClassifyHonestReadinessInput): HonestReadinessBadge {
  if (input.blocked) {
    return { state: 'blocked', label: 'Blocked', tone: 'danger', detail: input.reason || undefined };
  }

  if (input.liveReady === true) {
    return { state: 'live', label: 'Live ready', tone: 'ready', detail: input.reason || undefined };
  }

  const status = String(input.status || '').trim().toLowerCase().replace(/\s+/g, '_');

  if (BLOCKED.has(status)) {
    return { state: 'blocked', label: 'Blocked', tone: 'danger', detail: input.reason || undefined };
  }

  if (SETUP.has(status) || input.configured === false) {
    return { state: 'needs_setup', label: 'Needs setup', tone: 'warning', detail: input.reason || undefined };
  }

  if (input.configured === true || CATALOG_MUTED.has(status)) {
    return {
      state: 'available',
      label: 'Available',
      tone: 'muted',
      detail: input.reason || 'Catalog support — not proven live yet.',
    };
  }

  if (status) {
    return {
      state: 'available',
      label: 'Available',
      tone: 'muted',
      detail: input.reason || status,
    };
  }

  if (input.liveReady === false) {
    return { state: 'needs_setup', label: 'Needs setup', tone: 'warning', detail: input.reason || undefined };
  }

  return { state: 'unknown', label: 'Unknown', tone: 'muted', detail: input.reason || undefined };
}

/**
 * Provider helper: only `connected === true` or explicit `liveReady` grants live.
 * A bare `ready` flag without connection is catalog, not live.
 */
export function honestReadinessFromProvider(entry: {
  status?: string | null;
  connected?: boolean | null;
  ready?: boolean | null;
  liveReady?: boolean | null;
  reason?: string | null;
}): HonestReadinessBadge {
  if (entry.liveReady === true || entry.connected === true) {
    return classifyHonestReadiness({ liveReady: true, status: entry.status, reason: entry.reason });
  }

  if (entry.ready === true) {
    return classifyHonestReadiness({
      status: entry.status || 'available',
      configured: true,
      liveReady: false,
      reason: entry.reason || 'Provider marked ready in catalog but not connected/proven live.',
    });
  }

  return classifyHonestReadiness({
    status: entry.status || 'needs_setup',
    configured: Boolean(entry.status),
    liveReady: entry.liveReady === false ? false : undefined,
    reason: entry.reason || 'Provider is cataloged but not live-ready until credentials and test pass.',
  });
}

/**
 * Tool helper: status containing "ready"/"trusted" is catalog unless liveReady is true.
 */
export function honestReadinessFromTool(entry: {
  status?: string | null;
  risk?: string | null;
  liveReady?: boolean | null;
}): HonestReadinessBadge {
  const status = String(entry.status || '').trim().toLowerCase();
  if (new Set(['blocked', 'denied', 'untrusted']).has(status)) {
    return classifyHonestReadiness({ blocked: true, reason: entry.risk || entry.status });
  }
  if (entry.liveReady === true) {
    return classifyHonestReadiness({ liveReady: true, status: entry.status, reason: entry.risk || undefined });
  }
  if (new Set(['ready', 'trusted', 'available', 'active', 'healthy', 'ok']).has(status)) {
    return classifyHonestReadiness({
      status: 'available',
      configured: true,
      liveReady: false,
      reason: entry.risk || 'Catalog/tool support is not the same as live readiness.',
    });
  }
  if (new Set(['setup', 'needs_setup', 'config', 'configuration', 'pending']).has(status)) {
    return classifyHonestReadiness({ status: 'needs_setup', reason: entry.risk || entry.status });
  }
  return classifyHonestReadiness({
    status: entry.status || 'available',
    reason: 'Catalog/tool support is not the same as live readiness.',
  });
}
