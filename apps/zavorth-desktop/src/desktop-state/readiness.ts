export type ReadinessState = 'live' | 'needs_setup' | 'available' | 'blocked' | 'unknown';

export type ReadinessBadge = {
  state: ReadinessState;
  label: string;
  tone: 'ready' | 'warning' | 'danger' | 'muted';
  detail?: string;
};

/**
 * Honesty rules (catalog ? live):
 * 1. blocked → blocked
 * 2. liveReady === true → live (only explicit boolean proof)
 * 3. liveReady === false → never live
 * 4. Status string alone NEVER grants live
 * 5. configured without live → available (muted catalog)
 *
 * Keep in sync with monorepo `src/services/honesty/ReadinessHonesty.ts`.
 */

/** Status tokens that mean setup incomplete ; never live by themselves. */
const SETUP = new Set(['setup', 'configurable', 'needs_setup', 'needs-setup', 'pending', 'configured', 'partial']);
/** Status tokens that mean hard stop. */
const BLOCKED = new Set(['blocked', 'denied', 'error', 'failed', 'offline', 'unavailable', 'untrusted']);
/**
 * Soft / catalog-ish status tokens that previously (incorrectly) auto-mapped to live.
 * `available`, `ready`, `ok`, `healthy`, `active` must NOT imply live.
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

export function classifyReadiness(input: {
  status?: string | null;
  liveReady?: boolean | null;
  configured?: boolean | null;
  blocked?: boolean | null;
  reason?: string | null;
}): ReadinessBadge {
  if (input.blocked) {
    return { state: 'blocked', label: 'Blocked', tone: 'danger', detail: input.reason || undefined };
  }

  // Only explicit boolean proof grants live. Status alone is never enough.
  if (input.liveReady === true) {
    return { state: 'live', label: 'Live ready', tone: 'ready', detail: input.reason || undefined };
  }

  // liveReady === false never yields live; fall through to catalog/setup classification.
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
      detail: input.reason || 'Catalog support ; not proven live yet.',
    };
  }

  if (status) {
    // Any other status string is catalog/muted, never live.
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

export function readinessFromProvider(entry: {
  status?: string | null;
  connected?: boolean | null;
  ready?: boolean | null;
  liveReady?: boolean | null;
  reason?: string | null;
}): ReadinessBadge {
  // Explicit liveReady or a real connection proof may grant live.
  // `ready` alone (without connection) is catalog/available ; not live.
  if (entry.liveReady === true || entry.connected === true) {
    return classifyReadiness({ liveReady: true, status: entry.status, reason: entry.reason });
  }

  if (entry.ready === true) {
    return classifyReadiness({
      status: entry.status || 'available',
      configured: true,
      liveReady: false,
      reason: entry.reason || 'Provider marked ready in catalog but not connected/proven live.',
    });
  }

  return classifyReadiness({
    status: entry.status || 'needs_setup',
    configured: Boolean(entry.status),
    liveReady: entry.liveReady === false ? false : undefined,
    reason: entry.reason || 'Provider is cataloged but not live-ready until credentials and test pass.',
  });
}

export function readinessFromChannel(entry: {
  status?: string | null;
  liveReady?: boolean | null;
  configured?: boolean | null;
  readiness?: string | null;
  summary?: string | null;
}): ReadinessBadge {
  return classifyReadiness({
    status: entry.readiness || entry.status,
    liveReady: entry.liveReady,
    configured: entry.configured,
    reason: entry.summary || undefined,
  });
}

export function readinessFromTool(entry: {
  status?: string | null;
  risk?: string | null;
  liveReady?: boolean | null;
}): ReadinessBadge {
  const status = String(entry.status || '').toLowerCase();
  if (new Set(['blocked', 'denied', 'untrusted']).has(status)) {
    return classifyReadiness({ blocked: true, reason: entry.risk || entry.status });
  }
  // Live only with explicit liveReady ; status "ready"/"trusted" is catalog honesty.
  if (entry.liveReady === true) {
    return classifyReadiness({ liveReady: true, status: entry.status, reason: entry.risk || undefined });
  }
  if (
    new Set(['ready', 'trusted', 'available', 'active', 'healthy', 'ok']).has(status)
    || status.includes('trust')
    || status.includes('available')
    || status === 'active'
    || status === 'healthy'
    || status === 'ok'
  ) {
    return classifyReadiness({
      status: 'available',
      configured: true,
      liveReady: false,
      reason: entry.risk || 'Catalog/tool support is not the same as live readiness.',
    });
  }
  if (new Set(['setup', 'needs_setup', 'config', 'configuration', 'pending']).has(status)) {
    return classifyReadiness({ status: 'needs_setup', reason: entry.risk || entry.status });
  }
  return classifyReadiness({
    status: entry.status || 'available',
    reason: 'Catalog/tool support is not the same as live readiness.',
  });
}
