import type { RuntimeCapabilitiesSnapshot } from '../apiClient';
import type { DesktopWorkspaceScope } from '../workspaceScopes';

export type RightRailTab = 'activity' | 'preview' | 'files' | 'terminal' | 'logs' | 'git';

export type RightRailState = {
  open: boolean;
  tab: RightRailTab;
  width: number;
};

export const RIGHT_RAIL_STORAGE_KEY = 'zvd:right-rail';
export const RIGHT_RAIL_WIDTH_MIN = 320;
export const RIGHT_RAIL_WIDTH_MAX = 720;
export const RIGHT_RAIL_WIDTH_DEFAULT = 390;

export const RIGHT_RAIL_TABS: Array<{ id: RightRailTab; labelKey: string; titleKey: string }> = [
  { id: 'activity', labelKey: 'activity', titleKey: 'workspaceActivity' },
  { id: 'preview', labelKey: 'preview', titleKey: 'webPreviewTitle' },
  { id: 'files', labelKey: 'files', titleKey: 'workspaceFiles' },
  { id: 'terminal', labelKey: 'terminal', titleKey: 'workspaceTerminal' },
  { id: 'logs', labelKey: 'logs', titleKey: 'runtimeLogs' },
  { id: 'git', labelKey: 'git', titleKey: 'gitStatus' },
];

export function isRightRailTab(value: unknown): value is RightRailTab {
  return RIGHT_RAIL_TABS.some(tab => tab.id === value);
}

export function clampRightRailWidth(value: number): number {
  if (!Number.isFinite(value)) {
    return RIGHT_RAIL_WIDTH_DEFAULT;
  }
  return Math.min(RIGHT_RAIL_WIDTH_MAX, Math.max(RIGHT_RAIL_WIDTH_MIN, Math.round(value)));
}

export function readStoredRightRailState(storage?: Pick<Storage, 'getItem'> | null): RightRailState {
  const fallback: RightRailState = {
    open: false,
    tab: 'activity',
    width: RIGHT_RAIL_WIDTH_DEFAULT,
  };

  if (!storage) {
    return fallback;
  }

  try {
    const raw = storage.getItem(RIGHT_RAIL_STORAGE_KEY);
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw) as Partial<RightRailState>;
    return {
      open: Boolean(parsed.open),
      tab: isRightRailTab(parsed.tab) ? parsed.tab : fallback.tab,
      width: clampRightRailWidth(Number(parsed.width)),
    };
  } catch {
    return fallback;
  }
}

export function writeStoredRightRailState(
  state: RightRailState,
  storage?: Pick<Storage, 'setItem'> | null,
): void {
  if (!storage) {
    return;
  }
  storage.setItem(RIGHT_RAIL_STORAGE_KEY, JSON.stringify({
    open: state.open,
    tab: state.tab,
    width: clampRightRailWidth(state.width),
  }));
}

export function terminalSessionStorageKey(workspaceId: string): string {
  return `zvd:pty-session:${sanitizeWorkspaceId(workspaceId)}`;
}

export function resolvePersistentTerminalSessionId(
  workspaceId: string,
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null,
): string {
  const key = terminalSessionStorageKey(workspaceId);
  const fallback = `${sanitizeWorkspaceId(workspaceId)}-local`;
  if (!storage) {
    return fallback;
  }
  const existing = storage.getItem(key);
  if (existing) {
    return existing;
  }
  storage.setItem(key, fallback);
  return fallback;
}

export type DevServerCandidate = {
  url: string;
  source: 'runtime' | 'workspace' | 'default';
};

export function buildDevServerCandidates(
  runtimeCapabilities: RuntimeCapabilitiesSnapshot | null | undefined,
  workspaceScope?: DesktopWorkspaceScope | null,
): DevServerCandidate[] {
  const seen = new Set<string>();
  const candidates: DevServerCandidate[] = [];
  const runtime = runtimeCapabilities as RuntimeCapabilitiesSnapshot & {
    devServerUrl?: string;
    devServers?: Array<{ url?: string; port?: number }>;
    preview?: { url?: string };
    webPreview?: { url?: string };
    workspace?: RuntimeCapabilitiesSnapshot['workspace'] & {
      devServerUrl?: string;
      devServers?: Array<{ url?: string; port?: number }>;
    };
  } | null | undefined;

  const push = (value: unknown, source: DevServerCandidate['source']) => {
    const url = normalizeDevServerUrl(value);
    if (!url || seen.has(url)) {
      return;
    }
    seen.add(url);
    candidates.push({ url, source });
  };

  push(runtime?.devServerUrl, 'runtime');
  push(runtime?.preview?.url, 'runtime');
  push(runtime?.webPreview?.url, 'runtime');
  for (const server of runtime?.devServers || []) {
    push(server.url || (server.port ? `localhost:${server.port}` : null), 'runtime');
  }
  push(runtime?.workspace?.devServerUrl, 'workspace');
  for (const server of runtime?.workspace?.devServers || []) {
    push(server.url || (server.port ? `localhost:${server.port}` : null), 'workspace');
  }

  if (workspaceScope?.path) {
    for (const port of [5173, 3000, 4173, 5174, 8080]) {
      push(`localhost:${port}`, 'default');
    }
  }

  if (candidates.length === 0) {
    push('localhost:5173', 'default');
  }

  return candidates;
}

export type GitRailSummary = {
  workspaceLabel: string;
  workspacePath: string | null;
  branch: string;
  status: string;
  dirty: boolean;
};

export function buildGitRailSummary(
  workspaceScope: DesktopWorkspaceScope | null | undefined,
  runtimeCapabilities: RuntimeCapabilitiesSnapshot | null | undefined,
): GitRailSummary {
  const runtime = runtimeCapabilities as RuntimeCapabilitiesSnapshot & {
    git?: { branch?: string; status?: string; dirty?: boolean };
  } | null | undefined;

  return {
    workspaceLabel: workspaceScope?.shortLabel || workspaceScope?.label || 'Workspace',
    workspacePath: workspaceScope?.path || null,
    branch: runtime?.git?.branch || 'Not detected',
    status: runtime?.git?.status || (workspaceScope?.path ? 'Run Git status from Command Center' : 'Choose a workspace folder'),
    dirty: Boolean(runtime?.git?.dirty),
  };
}

function normalizeDevServerUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?/i.test(trimmed)) {
    return `http://${trimmed}`;
  }
  return null;
}

function sanitizeWorkspaceId(value: string): string {
  return (value || 'workspace').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'workspace';
}
