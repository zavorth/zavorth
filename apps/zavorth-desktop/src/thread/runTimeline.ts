/**
 * Build a compact vertical run timeline from thread activity.
 */

export type TimelineKind = 'message' | 'tool' | 'approval' | 'receipt' | 'agent';

export type TimelineStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'approved'
  | 'rejected'
  | 'info';

export type TimelineItem = {
  id: string;
  kind: TimelineKind;
  at: number;
  title: string;
  detail?: string;
  status?: TimelineStatus;
  meta?: Record<string, unknown>;
};

export type RunTimelineMessage = {
  id: string;
  role: string;
  content?: string;
  title?: string;
  createdAt?: number | string;
  at?: number | string;
};

export type RunTimelineApproval = {
  id?: string;
  approvalId?: string;
  title?: string;
  summary?: string;
  action?: string;
  risk?: string;
  status?: string;
  createdAt?: number | string;
};

export type RunTimelineReceipt = {
  id?: string;
  action?: string;
  title?: string;
  summary?: string;
  status?: string;
  at?: number | string;
};

export type RunTimelineAgent = {
  id: string;
  role?: string;
  status?: string;
  task?: string;
  assignedTask?: string;
};

export type RunTimelineInput = {
  messages?: RunTimelineMessage[];
  approvals?: RunTimelineApproval[];
  receipts?: RunTimelineReceipt[];
  agents?: RunTimelineAgent[];
  now?: number;
};

function toAt(value: number | string | undefined | null, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const asNum = Number(value);
    if (Number.isFinite(asNum) && !value.includes('T') && value.length < 16) {
      return asNum;
    }
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function clip(text: string, max = 120): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}…`;
}

function normalizeApprovalStatus(status?: string): TimelineStatus {
  const value = String(status || 'pending').toLowerCase();
  if (value === 'approve' || value === 'approved') return 'approved';
  if (value === 'reject' || value === 'rejected') return 'rejected';
  if (value === 'failed' || value === 'error') return 'failed';
  return 'pending';
}

function normalizeReceiptStatus(status?: string): TimelineStatus {
  const value = String(status || 'ok').toLowerCase();
  if (value === 'failed' || value === 'error') return 'failed';
  if (value === 'pending') return 'pending';
  return 'success';
}

function normalizeAgentStatus(status?: string): TimelineStatus {
  const value = String(status || 'idle').toLowerCase();
  if (value === 'running' || value === 'queued' || value === 'active') return 'running';
  if (value === 'blocked' || value === 'waiting') return 'pending';
  if (value === 'failed' || value === 'error') return 'failed';
  if (value === 'completed' || value === 'done' || value === 'success') return 'success';
  return 'info';
}

function compareItems(a: TimelineItem, b: TimelineItem): number {
  if (a.at !== b.at) return a.at - b.at;
  return a.id.localeCompare(b.id);
}

export function buildRunTimeline(input: RunTimelineInput = {}): TimelineItem[] {
  const now = typeof input.now === 'number' && Number.isFinite(input.now) ? input.now : Date.now();
  const items: TimelineItem[] = [];

  for (const message of input.messages || []) {
    const id = String(message.id || '').trim();
    if (!id) continue;
    const role = String(message.role || '').toLowerCase();
    const content = String(message.content || '');
    const at = toAt(message.createdAt ?? message.at, now);

    if (role === 'tool') {
      items.push({
        id: `tool:${id}`,
        kind: 'tool',
        at,
        title: String(message.title || 'Tool').trim() || 'Tool',
        detail: content ? clip(content, 80) : undefined,
        status: 'success',
      });
      continue;
    }

    if (role === 'user' || role === 'assistant' || role === 'system') {
      const title =
        (message.title && String(message.title).trim()) ||
        clip(content, 80) ||
        (role === 'user' ? 'You' : role === 'assistant' ? 'Assistant' : 'System');
      items.push({
        id: `message:${id}`,
        kind: 'message',
        at,
        title,
        detail: content && title !== clip(content, 80) ? clip(content, 100) : undefined,
        status: 'info',
        meta: { role },
      });
    }
  }

  for (const approval of input.approvals || []) {
    const rawId = String(approval.id || approval.approvalId || '').trim();
    const id = rawId || `anon-${items.length}`;
    const title = String(approval.title || approval.action || 'Approval').trim() || 'Approval';
    items.push({
      id: `approval:${id}`,
      kind: 'approval',
      at: toAt(approval.createdAt, now),
      title,
      detail: approval.summary ? clip(String(approval.summary)) : undefined,
      status: normalizeApprovalStatus(approval.status),
      meta: approval.risk ? { risk: approval.risk } : undefined,
    });
  }

  for (const receipt of input.receipts || []) {
    const rawId = String(receipt.id || '').trim();
    const id = rawId || `anon-${items.length}`;
    const title = String(receipt.action || receipt.title || 'Receipt').trim() || 'Receipt';
    items.push({
      id: `receipt:${id}`,
      kind: 'receipt',
      at: toAt(receipt.at, now),
      title,
      detail: receipt.summary ? clip(String(receipt.summary)) : undefined,
      status: normalizeReceiptStatus(receipt.status),
    });
  }

  for (const agent of input.agents || []) {
    const id = String(agent.id || '').trim();
    if (!id) continue;
    const role = String(agent.role || 'Agent').trim() || 'Agent';
    const task = String(agent.task || agent.assignedTask || '').trim();
    items.push({
      id: `agent:${id}`,
      kind: 'agent',
      at: now,
      title: role,
      detail: task || undefined,
      status: normalizeAgentStatus(agent.status),
    });
  }

  return items.sort(compareItems);
}

export function filterTimeline(
  items: TimelineItem[],
  kinds?: TimelineKind[],
): TimelineItem[] {
  if (!kinds || kinds.length === 0) return items.slice();
  const set = new Set(kinds);
  return items.filter(item => set.has(item.kind));
}

export function timelineSummary(items: TimelineItem[]): {
  tools: number;
  approvals: number;
  receipts: number;
  agents: number;
} {
  let tools = 0;
  let approvals = 0;
  let receipts = 0;
  let agents = 0;
  for (const item of items) {
    if (item.kind === 'tool') tools += 1;
    else if (item.kind === 'approval') approvals += 1;
    else if (item.kind === 'receipt') receipts += 1;
    else if (item.kind === 'agent') agents += 1;
  }
  return { tools, approvals, receipts, agents };
}

/** Compact view: last N items (default 8). */
export function compactRunTimeline(
  items: TimelineItem[],
  limit = 8,
): { visible: TimelineItem[]; hiddenCount: number } {
  const safe = Array.isArray(items) ? items : [];
  const size = Math.max(1, Math.floor(limit) || 8);
  if (safe.length <= size) {
    return { visible: safe, hiddenCount: 0 };
  }
  return {
    visible: safe.slice(-size),
    hiddenCount: safe.length - size,
  };
}

export function runTimelineHasActivity(items: TimelineItem[]): boolean {
  return items.some(
    item =>
      item.kind === 'tool' ||
      item.kind === 'approval' ||
      item.kind === 'agent' ||
      item.status === 'running' ||
      item.status === 'pending',
  );
}
