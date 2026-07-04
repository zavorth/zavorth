import {
  buildSubagentIdentity,
  type ZavorthSubagentVisualIdentity,
} from '../../../../src/services/ZavorthSubagentIdentityService';

export interface ActiveSubagent {
  id: string;
  role: string;
  typeName: string;
  status: 'idle' | 'queued' | 'running' | 'blocked' | 'completed' | 'failed';
  lastActive: string;
  assignedTask?: string;
  identity: ZavorthSubagentVisualIdentity;
  messages: Array<{ role: 'parent' | 'subagent'; text: string; timestamp: string }>;
}

export const SUBAGENTS_STORAGE_KEY = 'zvd:subagents-list';

type SubagentStorage = Pick<Storage, 'getItem' | 'setItem'>;

function fallbackStorage(): SubagentStorage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

function toIso(now: () => number | string): string {
  const value = now();
  return typeof value === 'string' ? value : new Date(value).toISOString();
}

function sanitizeSubagent(value: unknown): ActiveSubagent | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<ActiveSubagent>;
  const id = String(raw.id || '').trim();
  const role = String(raw.role || '').trim();
  const typeName = String(raw.typeName || '').trim();
  if (!id || !role || !typeName) return null;
  const status = raw.status === 'queued'
    || raw.status === 'running'
    || raw.status === 'blocked'
    || raw.status === 'completed'
    || raw.status === 'failed'
    ? raw.status
    : 'idle';
  const identity = buildDesktopIdentity(id, typeName, role, status);
  return {
    id,
    role,
    typeName,
    status,
    identity,
    lastActive: String(raw.lastActive || new Date(0).toISOString()),
    assignedTask: raw.assignedTask ? String(raw.assignedTask) : undefined,
    messages: Array.isArray(raw.messages)
      ? raw.messages
          .map(message => {
            if (!message || typeof message !== 'object') return null;
            const item = message as ActiveSubagent['messages'][number];
            return {
              role: item.role === 'subagent' ? 'subagent' as const : 'parent' as const,
              text: String(item.text || ''),
              timestamp: String(item.timestamp || new Date(0).toISOString()),
            };
          })
          .filter((message): message is ActiveSubagent['messages'][number] => Boolean(message))
      : [],
  };
}

export function defaultSubagents(now: () => number | string = Date.now): ActiveSubagent[] {
  const current = typeof now() === 'string' ? new Date(now() as string).getTime() : Number(now());
  const hourAgo = new Date(current - 3600000).toISOString();
  const twoHoursAgo = new Date(current - 7200000).toISOString();
  const fourHoursAgo = new Date(current - 14400000).toISOString();
  return [
    {
      id: 'agent_research_default',
      role: 'Codebase & Docs Researcher',
      typeName: 'research',
      status: 'completed',
      identity: buildDesktopIdentity('agent_research_default', 'research', 'Codebase & Docs Researcher', 'completed'),
      lastActive: hourAgo,
      assignedTask: 'Analyze package.json configurations and search for outdated dependencies',
      messages: [
        {
          role: 'parent',
          text: 'Analyze dependencies in the desktop root and check for old libraries.',
          timestamp: hourAgo,
        },
        {
          role: 'subagent',
          text: 'Checked packages. Found 2 dependency alerts. Vite and Electron can be upgraded safely.',
          timestamp: new Date(current - 3500000).toISOString(),
        },
      ],
    },
    {
      id: 'agent_auditor_default',
      role: 'Security Auditor',
      typeName: 'auditor',
      status: 'idle',
      identity: buildDesktopIdentity('agent_auditor_default', 'auditor', 'Security Auditor', 'idle'),
      lastActive: twoHoursAgo,
      assignedTask: 'Audit codebase against OWASP API Security top 10 rules',
      messages: [],
    },
    {
      id: 'agent_debugger_default',
      role: 'Test Runner & Debugger',
      typeName: 'debugger',
      status: 'idle',
      identity: buildDesktopIdentity('agent_debugger_default', 'debugger', 'Test Runner & Debugger', 'idle'),
      lastActive: fourHoursAgo,
      assignedTask: 'Watch test suites and fix broken assertions automatically',
      messages: [],
    },
  ];
}

export function loadSubagents(
  storage: SubagentStorage | null = fallbackStorage(),
  now: () => number | string = Date.now,
): ActiveSubagent[] {
  if (!storage) return defaultSubagents(now);
  try {
    const saved = storage.getItem(SUBAGENTS_STORAGE_KEY);
    if (!saved) return defaultSubagents(now);
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed)
      ? parsed.map(sanitizeSubagent).filter((item): item is ActiveSubagent => Boolean(item))
      : defaultSubagents(now);
  } catch {
    return defaultSubagents(now);
  }
}

export function persistSubagents(
  subagents: ActiveSubagent[],
  storage: SubagentStorage | null = fallbackStorage(),
): ActiveSubagent[] {
  storage?.setItem(SUBAGENTS_STORAGE_KEY, JSON.stringify(subagents));
  return subagents;
}

export function createSubagent(
  role: string,
  typeName: string,
  idFactory: () => string = () => `agent_${self.crypto.randomUUID()}`,
  now: () => number | string = Date.now,
): ActiveSubagent {
  const id = idFactory();
  const safeRole = role.trim() || 'Desktop Agent';
  const safeType = typeName.trim() || 'general';
  return {
    id,
    role: safeRole,
    typeName: safeType,
    status: 'idle',
    identity: buildDesktopIdentity(id, safeType, safeRole, 'idle'),
    lastActive: toIso(now),
    messages: [],
  };
}

export function appendSubagentTask(
  subagents: ActiveSubagent[],
  id: string,
  task: string,
  now: () => number | string = Date.now,
): ActiveSubagent[] {
  const timestamp = toIso(now);
  return subagents.map(agent => agent.id === id
    ? {
        ...agent,
        status: 'running',
        identity: buildDesktopIdentity(agent.id, agent.typeName, agent.role, 'running'),
        assignedTask: task,
        lastActive: timestamp,
        messages: [...agent.messages, { role: 'parent', text: task, timestamp }],
      }
    : agent);
}

export function completeSubagentTask(
  subagents: ActiveSubagent[],
  id: string,
  task: string,
  now: () => number | string = Date.now,
): ActiveSubagent[] {
  const timestamp = toIso(now);
  return subagents.map(agent => agent.id === id
    ? {
        ...agent,
        status: 'completed',
        identity: buildDesktopIdentity(agent.id, agent.typeName, agent.role, 'completed'),
        lastActive: timestamp,
        messages: [
          ...agent.messages,
          {
            role: 'subagent',
            text: `Execution complete. Executed workspace analysis for: "${task}". No vulnerabilities found. Output: SUCCESS.`,
            timestamp,
          },
        ],
      }
    : agent);
}

export function deleteSubagent(subagents: ActiveSubagent[], id: string): ActiveSubagent[] {
  return subagents.filter(agent => agent.id !== id);
}

function buildDesktopIdentity(
  sessionId: string,
  roleId: string,
  label: string,
  status: ActiveSubagent['status'],
): ZavorthSubagentVisualIdentity {
  return buildSubagentIdentity({
    roleId,
    sessionId,
    status,
    label,
  });
}
