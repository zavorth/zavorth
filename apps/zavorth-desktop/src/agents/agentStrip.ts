/**
 * Multi-agent strip model for Desktop thread chrome.
 */

export type AgentStripStatus = 'idle' | 'running' | 'blocked' | 'done' | 'error';

export type AgentStripItem = {
  id: string;
  label: string;
  role: string;
  status: AgentStripStatus;
  task?: string;
};

export type AgentStripSource = {
  id: string;
  name?: string;
  role?: string;
  typeName?: string;
  status?: string;
  task?: string;
  assignedTask?: string;
  busy?: boolean;
};

function normalizeStatus(status?: string, busy?: boolean): AgentStripStatus {
  if (busy) return 'running';
  const value = String(status || 'idle').toLowerCase().trim();
  if (value === 'running' || value === 'queued' || value === 'active') return 'running';
  if (value === 'blocked' || value === 'waiting') return 'blocked';
  if (value === 'failed' || value === 'error') return 'error';
  if (value === 'completed' || value === 'done' || value === 'success') return 'done';
  if (value === 'idle') return 'idle';
  return 'idle';
}

/**
 * Build strip items from agent sources. Empty / blank ids are dropped.
 * Returns a flat list (UI wraps visibility separately).
 */
export function buildAgentStrip(
  agents: AgentStripSource[] | null | undefined,
): AgentStripItem[] {
  const list = Array.isArray(agents) ? agents : [];
  const items: AgentStripItem[] = [];

  for (const agent of list) {
    const id = String(agent.id || '').trim();
    if (!id) continue;

    const typeName = String(agent.typeName || '').trim();
    const roleRaw = String(agent.role || '').trim();
    const name = String(agent.name || '').trim();

    const label = name || roleRaw || typeName || id;
    const role = roleRaw || typeName || 'agent';
    const taskRaw = String(agent.task || agent.assignedTask || '').trim();
    const status = normalizeStatus(agent.status, agent.busy);

    const item: AgentStripItem = {
      id,
      label,
      role,
      status,
    };
    if (taskRaw) item.task = taskRaw;
    items.push(item);
  }

  return items;
}

export function agentStripVisible(items: AgentStripItem[] | null | undefined): boolean {
  return Array.isArray(items) && items.length > 0;
}

export function countActiveAgents(items: AgentStripItem[] | null | undefined): number {
  if (!Array.isArray(items)) return 0;
  return items.filter(item => item.status === 'running' || item.status === 'blocked').length;
}

/** Alias for callers that prefer a model object. */
export function buildAgentStripModel(agents: AgentStripSource[] | null | undefined): {
  items: AgentStripItem[];
  visible: boolean;
  activeCount: number;
  totalCount: number;
} {
  const items = buildAgentStrip(agents);
  return {
    items,
    visible: agentStripVisible(items),
    activeCount: countActiveAgents(items),
    totalCount: items.length,
  };
}
