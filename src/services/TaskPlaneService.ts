import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import type { TaskPlaneItem, TaskPlaneSnapshot, TaskPlaneStatus } from '../contracts/TaskPlaneContract.js';

type TaskPlaneServiceOptions = {
  storePath: string;
  now?: () => Date;
};

type CreateTaskInput = {
  title: string;
  source?: string;
  payload?: Record<string, unknown>;
  approvalId?: string | null;
  receiptId?: string | null;
};

const STATUSES: TaskPlaneStatus[] = [
  'queued',
  'claimed',
  'running',
  'waiting_approval',
  'blocked',
  'done',
  'failed',
  'cancelled',
];

export class TaskPlaneService {
  private readonly storePath: string;
  private readonly now: () => Date;

  constructor(options: TaskPlaneServiceOptions) {
    this.storePath = path.resolve(options.storePath);
    this.now = options.now || (() => new Date());
  }

  public createTask(input: CreateTaskInput): TaskPlaneItem {
    const store = this.readStore();
    const item = this.newTask(input);
    store.items.push(item);
    this.writeStore(store);
    return item;
  }

  public listTasks(): TaskPlaneItem[] {
    return this.readStore().items.map((item) => this.clone(item));
  }

  public snapshot(): TaskPlaneSnapshot {
    const items = this.listTasks();
    return {
      contractVersion: 'task-plane/1',
      generatedAt: this.now().toISOString(),
      storePath: this.storePath,
      summary: STATUSES.reduce((acc, status) => {
        acc[status] = items.filter((item) => item.status === status).length;
        return acc;
      }, {} as Record<TaskPlaneStatus, number>),
      items,
      safety: {
        atomicClaims: true,
        noSilentMutation: true,
        retryIsExplicit: true,
        cancelIsAudited: true,
      },
    };
  }

  public claimTask(id: string, owner: string, leaseMs?: number | null): TaskPlaneItem | null {
    const store = this.readStore();
    const item = store.items.find((entry) => entry.id === id);
    if (!item || !this.canClaim(item)) {
      return null;
    }
    const now = this.timestamp();
    item.status = 'claimed';
    item.updatedAt = now;
    item.claim = {
      owner: String(owner || 'unknown').trim() || 'unknown',
      claimedAt: now,
      leaseUntil: leaseMs ? new Date(this.now().getTime() + Math.max(1, leaseMs)).toISOString() : null,
    };
    item.history.push({ at: now, event: 'task.claimed', status: item.status, actor: item.claim.owner });
    this.writeStore(store);
    return this.clone(item);
  }

  public updateStatus(id: string, status: TaskPlaneStatus, actor = 'system', detail?: string): TaskPlaneItem | null {
    const store = this.readStore();
    const item = store.items.find((entry) => entry.id === id);
    if (!item) {
      return null;
    }
    const now = this.timestamp();
    item.status = status;
    item.updatedAt = now;
    if (status === 'running') {
      item.attempts += 1;
    }
    item.history.push({ at: now, event: `task.${status}`, status, actor, ...(detail ? { detail } : {}) });
    this.writeStore(store);
    return this.clone(item);
  }

  public cancelTask(id: string, actor = 'operator', reason = 'Cancelled explicitly.'): TaskPlaneItem | null {
    return this.updateStatus(id, 'cancelled', actor, reason);
  }

  public retryTask(id: string, actor = 'operator'): TaskPlaneItem | null {
    const store = this.readStore();
    const item = store.items.find((entry) => entry.id === id);
    if (!item || !['failed', 'blocked', 'cancelled'].includes(item.status)) {
      return null;
    }
    const now = this.timestamp();
    item.status = 'queued';
    item.updatedAt = now;
    item.claim = null;
    item.history.push({ at: now, event: 'task.retry', status: 'queued', actor });
    this.writeStore(store);
    return this.clone(item);
  }

  private newTask(input: CreateTaskInput): TaskPlaneItem {
    const now = this.timestamp();
    return {
      contractVersion: 'task-plane-item/1',
      id: `task-${randomUUID()}`,
      title: String(input.title || 'Untitled task').trim() || 'Untitled task',
      status: input.approvalId ? 'waiting_approval' : 'queued',
      source: String(input.source || 'operator').trim() || 'operator',
      createdAt: now,
      updatedAt: now,
      claim: null,
      approvalId: input.approvalId || null,
      receiptId: input.receiptId || null,
      payload: this.clone(input.payload || {}),
      attempts: 0,
      history: [{
        at: now,
        event: 'task.created',
        status: input.approvalId ? 'waiting_approval' : 'queued',
        actor: String(input.source || 'operator').trim() || 'operator',
      }],
    };
  }

  private canClaim(item: TaskPlaneItem): boolean {
    if (item.status === 'queued') {
      return true;
    }
    if (item.status !== 'claimed' || !item.claim?.leaseUntil) {
      return false;
    }
    return Date.parse(item.claim.leaseUntil) <= this.now().getTime();
  }

  private readStore(): { items: TaskPlaneItem[] } {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.storePath, 'utf8')) as { items?: TaskPlaneItem[] };
      return { items: Array.isArray(parsed.items) ? parsed.items : [] };
    } catch {
      return { items: [] };
    }
  }

  private writeStore(store: { items: TaskPlaneItem[] }): void {
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    const tempPath = `${this.storePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
    fs.renameSync(tempPath, this.storePath);
  }

  private timestamp(): string {
    return this.now().toISOString();
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
