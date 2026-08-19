/**
 * Multi-tab terminal state — pure helpers (no React / DOM).
 */

export type TerminalTab = {
  id: string;
  title: string;
  kind: 'shell' | 'agent' | 'logs';
  sessionKey: string;
  agentActive?: boolean;
};

const DEFAULT_MAX_TABS = 8;

const KIND_TITLES: Record<TerminalTab['kind'], string> = {
  shell: 'Shell',
  agent: 'Agent',
  logs: 'Logs',
};

let tabSeq = 0;

function nextTabId(kind: TerminalTab['kind']): string {
  tabSeq += 1;
  return `term-${kind}-${tabSeq}-${Date.now().toString(36)}`;
}

function sanitizeWorkspaceId(workspaceId: string): string {
  return String(workspaceId || 'default')
    .trim()
    .replace(/[^a-zA-Z0-9._:-]+/g, '_')
    .slice(0, 120) || 'default';
}

export function createTerminalTab(
  input: Partial<TerminalTab> & { kind: TerminalTab['kind'] },
): TerminalTab {
  const kind = input.kind;
  const id = String(input.id || '').trim() || nextTabId(kind);
  const titleRaw = typeof input.title === 'string' ? input.title.trim() : '';
  const title = titleRaw || KIND_TITLES[kind] || 'Terminal';
  const sessionKey = String(input.sessionKey || '').trim() || `${kind}:${id}`;
  const tab: TerminalTab = {
    id,
    title,
    kind,
    sessionKey,
  };
  if (typeof input.agentActive === 'boolean') {
    tab.agentActive = input.agentActive;
  }
  return tab;
}

/**
 * Append a tab. If id already exists, replace in place.
 * When at `maxTabs` (default 8), drop the oldest tab that is not the incoming id.
 */
export function addTerminalTab(
  tabs: TerminalTab[],
  tab: TerminalTab,
  maxTabs: number = DEFAULT_MAX_TABS,
): TerminalTab[] {
  const list = (tabs || []).slice();
  const max = Number.isFinite(maxTabs) && maxTabs > 0 ? Math.floor(maxTabs) : DEFAULT_MAX_TABS;
  const existingIdx = list.findIndex(t => t.id === tab.id);
  if (existingIdx >= 0) {
    list[existingIdx] = tab;
    return list;
  }
  while (list.length >= max) {
    list.shift();
  }
  list.push(tab);
  return list;
}

export function removeTerminalTab(
  tabs: TerminalTab[],
  id: string,
): { tabs: TerminalTab[]; nextActiveId: string | null } {
  const list = tabs || [];
  const idx = list.findIndex(t => t.id === id);
  if (idx < 0) {
    return {
      tabs: list.slice(),
      nextActiveId: list[0]?.id ?? null,
    };
  }
  const next = list.filter(t => t.id !== id);
  const neighbor = list[idx + 1] || list[idx - 1] || null;
  const nextActiveId = neighbor && neighbor.id !== id ? neighbor.id : next[0]?.id ?? null;
  // Prefer the neighbor that remained after removal
  const resolved =
    next.find(t => t.id === list[idx + 1]?.id)?.id ??     next.find(t => t.id === list[idx - 1]?.id)?.id ??     next[0]?.id ??     null;
  return { tabs: next, nextActiveId: resolved ?? nextActiveId };
}

export function renameTerminalTab(
  tabs: TerminalTab[],
  id: string,
  title: string,
): TerminalTab[] {
  const trimmed = String(title ?? '').trim();
  if (!trimmed) {
    return (tabs || []).slice();
  }
  return (tabs || []).map(tab =>
    tab.id === id ? { ...tab, title: trimmed } : tab,
  );
}

export function setAgentActivity(
  tabs: TerminalTab[],
  id: string,
  active: boolean,
): TerminalTab[] {
  return (tabs || []).map(tab =>
    tab.id === id ? { ...tab, agentActive: Boolean(active) } : tab,
  );
}

export function pickActiveTab(
  tabs: TerminalTab[],
  activeId: string | null,
): TerminalTab | null {
  const list = tabs || [];
  if (list.length === 0) {
    return null;
  }
  if (activeId) {
    const found = list.find(t => t.id === activeId);
    if (found) return found;
  }
  return list[0] || null;
}

/** Default shell + agent tabs for a workspace. */
export function ensureDefaultTabs(workspaceId: string): TerminalTab[] {
  const ws = sanitizeWorkspaceId(workspaceId);
  return [
    createTerminalTab({
      id: `shell-${ws}`,
      kind: 'shell',
      title: 'Shell',
      sessionKey: `shell:${ws}`,
    }),
    createTerminalTab({
      id: `agent-${ws}`,
      kind: 'agent',
      title: 'Agent',
      sessionKey: `agent:${ws}`,
      agentActive: false,
    }),
  ];
}
