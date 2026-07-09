export type ReadinessState = 'live' | 'needs_setup' | 'available' | 'blocked' | 'unknown';

export type ReadinessBadge = {
  state: ReadinessState;
  label: string;
  tone: 'ready' | 'warning' | 'danger' | 'muted';
  detail?: string;
};

const LIVE = new Set(['ready', 'live', 'connected', 'trusted', 'available', 'active', 'ok', 'healthy']);
const SETUP = new Set(['setup', 'configurable', 'needs_setup', 'needs-setup', 'pending', 'configured', 'partial']);
const BLOCKED = new Set(['blocked', 'denied', 'error', 'failed', 'offline', 'unavailable', 'untrusted']);

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
  if (input.liveReady === true) {
    return { state: 'live', label: 'Live ready', tone: 'ready', detail: input.reason || undefined };
  }

  const status = String(input.status || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (LIVE.has(status)) {
    return { state: 'live', label: 'Live ready', tone: 'ready', detail: input.reason || undefined };
  }
  if (BLOCKED.has(status)) {
    return { state: 'blocked', label: 'Blocked', tone: 'danger', detail: input.reason || undefined };
  }
  if (SETUP.has(status) || input.configured === false) {
    return { state: 'needs_setup', label: 'Needs setup', tone: 'warning', detail: input.reason || undefined };
  }
  if (input.configured === true) {
    return { state: 'available', label: 'Available', tone: 'muted', detail: input.reason || 'Catalog support — not proven live yet.' };
  }
  if (status) {
    return { state: 'available', label: 'Available', tone: 'muted', detail: input.reason || status };
  }
  return { state: 'unknown', label: 'Unknown', tone: 'muted', detail: input.reason || undefined };
}

export function readinessFromProvider(entry: {
  status?: string | null;
  connected?: boolean | null;
  ready?: boolean | null;
  reason?: string | null;
}): ReadinessBadge {
  if (entry.connected || entry.ready) {
    return classifyReadiness({ liveReady: true, status: entry.status, reason: entry.reason });
  }
  return classifyReadiness({
    status: entry.status || 'needs_setup',
    configured: Boolean(entry.status),
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
}): ReadinessBadge {
  const status = String(entry.status || '').toLowerCase();
  if (status.includes('block') || status.includes('deny')) {
    return classifyReadiness({ blocked: true, reason: entry.risk || entry.status });
  }
  if (status.includes('ready') || status.includes('trust')) {
    return classifyReadiness({ liveReady: true, status: entry.status });
  }
  if (status.includes('setup') || status.includes('config') || status.includes('pending')) {
    return classifyReadiness({ status: 'needs_setup', reason: entry.risk || entry.status });
  }
  return classifyReadiness({
    status: entry.status || 'available',
    reason: 'Catalog/tool support is not the same as live readiness.',
  });
}
