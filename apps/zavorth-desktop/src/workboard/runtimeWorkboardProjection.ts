import type { CardPriority, WorkboardBoard } from '../views/panels/WorkboardPanel';

export type RuntimeWorkboardTaskStatus =
  | 'queued'
  | 'claimed'
  | 'running'
  | 'blocked'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type RuntimeWorkboardTask = {
  taskId: string;
  sessionId: string;
  parentTaskId: string | null;
  title: string;
  status: RuntimeWorkboardTaskStatus;
  risk?: string;
  attempts?: number;
  failureCount?: number;
  maxRetries?: number;
  claimedBy: string | null;
  claimedAt?: string | null;
  heartbeatAt: string | null;
  heartbeatDeadlineAt?: string | null;
  blockedReason: string | null;
  artifactRefs?: string[];
  comments?: Array<{
    id: string;
    author: string;
    body: string;
    createdAt: string;
  }>;
  summary: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type RuntimeWorkboardProjection = {
  selectedTaskId: string | null;
  selectedTask: RuntimeWorkboardTask | null;
  sessions: Array<{
    sessionId: string;
    objective: string;
    status: string;
    maxDepth: number;
    maxChildren: number;
  }>;
  tasks: RuntimeWorkboardTask[];
  workers: Array<{
    workerId: string;
    status: 'busy' | 'idle' | 'expired';
    currentTaskId: string | null;
  }>;
  receipts: Array<{
    receiptId: string;
    action: string;
    taskId: string | null;
    workerId: string | null;
    status: string;
  }>;
  summary: {
    sessions: number;
    queued: number;
    running: number;
    completed: number;
    blocked: number;
  };
  safety: {
    sqliteDurable: true;
    mutationRequiresApproval: true;
    retryBounded: true;
    spawnDepthBounded: true;
  };
};

const RUNTIME_COLUMNS: Array<{ id: RuntimeWorkboardTaskStatus; name: string; color: string }> = [
  { id: 'queued', name: 'Queued', color: '#60a5fa' },
  { id: 'claimed', name: 'Claimed', color: '#a78bfa' },
  { id: 'running', name: 'Running', color: '#22d3ee' },
  { id: 'blocked', name: 'Blocked', color: '#facc15' },
  { id: 'completed', name: 'Completed', color: '#4ade80' },
  { id: 'failed', name: 'Failed', color: '#f87171' },
  { id: 'cancelled', name: 'Cancelled', color: '#71717a' },
];

export function mapRuntimeWorkboardToBoard(runtimeWorkboard: RuntimeWorkboardProjection): WorkboardBoard {
  const firstSession = runtimeWorkboard.sessions[0] || null;
  return {
    id: 'runtime-workboard',
    name: 'Runtime Workboard',
    description: firstSession?.objective || 'Shared dispatcher state',
    columns: RUNTIME_COLUMNS.map((column, order) => ({
      id: column.id,
      name: column.name,
      order,
      color: column.color,
    })),
    cards: runtimeWorkboard.tasks.map((task) => ({
      id: task.taskId,
      title: task.title,
      description: buildRuntimeDescription(task),
      priority: priorityForRuntimeTask(task),
      assignee: task.claimedBy || undefined,
      labels: buildRuntimeLabels(task),
      columnId: task.status,
      createdAt: task.createdAt || task.updatedAt || new Date(0).toISOString(),
      updatedAt: task.updatedAt || task.heartbeatAt || undefined,
    })),
  };
}

function buildRuntimeDescription(task: RuntimeWorkboardTask): string {
  const parts = [
    task.summary,
    task.blockedReason ? `Blocked: ${task.blockedReason}` : null,
    task.heartbeatAt ? `Heartbeat: ${formatIso(task.heartbeatAt)}` : null,
  ].filter(Boolean);
  return parts.join(' | ');
}

function buildRuntimeLabels(task: RuntimeWorkboardTask): string[] {
  const artifactCount = task.artifactRefs?.length || 0;
  const commentCount = task.comments?.length || 0;
  return [
    task.status,
    task.claimedBy ? `worker ${task.claimedBy}` : null,
    typeof task.attempts === 'number' && typeof task.maxRetries === 'number'
      ? `retry ${task.attempts}/${task.maxRetries}`
      : null,
    artifactCount === 1 ? '1 artifact' : artifactCount > 1 ? `${artifactCount} artifacts` : null,
    commentCount === 1 ? '1 comment' : commentCount > 1 ? `${commentCount} comments` : null,
  ].filter((label): label is string => Boolean(label));
}

function priorityForRuntimeTask(task: RuntimeWorkboardTask): CardPriority {
  if (task.status === 'failed' || task.status === 'blocked') return 'critical';
  if (task.risk && task.risk !== 'read-only') return 'high';
  if ((task.failureCount || 0) > 0) return 'high';
  if (task.status === 'running' || task.status === 'claimed') return 'medium';
  return 'low';
}

function formatIso(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString();
}
