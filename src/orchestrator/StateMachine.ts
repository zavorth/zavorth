import { TaskStatus } from '../contracts/TaskContract.js';

type StateDescriptor = {
  rank: number;
  lane: 'intake' | 'planning' | 'approval' | 'execution' | 'delivery' | 'rollback' | 'terminal';
  active: boolean;
  terminal: boolean;
  approvalPending: boolean;
  resumable: boolean;
  retryable: boolean;
};

export class StateMachine {
  private static readonly DESCRIPTORS: Record<TaskStatus, StateDescriptor> = {
    pending: { rank: 1, lane: 'intake', active: true, terminal: false, approvalPending: false, resumable: true, retryable: false },
    parsed: { rank: 2, lane: 'intake', active: true, terminal: false, approvalPending: false, resumable: true, retryable: false },
    planned: { rank: 3, lane: 'planning', active: true, terminal: false, approvalPending: false, resumable: true, retryable: false },
    waiting_approval: { rank: 4, lane: 'approval', active: true, terminal: false, approvalPending: true, resumable: true, retryable: false },
    approved: { rank: 5, lane: 'approval', active: true, terminal: false, approvalPending: false, resumable: true, retryable: false },
    running: { rank: 6, lane: 'execution', active: true, terminal: false, approvalPending: false, resumable: true, retryable: false },
    validating: { rank: 7, lane: 'execution', active: true, terminal: false, approvalPending: false, resumable: true, retryable: false },
    delivery_pending: { rank: 8, lane: 'delivery', active: true, terminal: false, approvalPending: false, resumable: true, retryable: false },
    completed: { rank: 9, lane: 'terminal', active: false, terminal: true, approvalPending: false, resumable: false, retryable: true },
    failed: { rank: 9, lane: 'terminal', active: false, terminal: true, approvalPending: false, resumable: false, retryable: true },
    rejected: { rank: 9, lane: 'terminal', active: false, terminal: true, approvalPending: false, resumable: false, retryable: true },
    reverted: { rank: 9, lane: 'terminal', active: false, terminal: true, approvalPending: false, resumable: false, retryable: true },
    cancelled: { rank: 9, lane: 'terminal', active: false, terminal: true, approvalPending: false, resumable: false, retryable: true },
    rollback_pending: { rank: 10, lane: 'rollback', active: true, terminal: false, approvalPending: false, resumable: true, retryable: false },
  };

  private static readonly TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
    pending: ['parsed', 'cancelled', 'failed'],
    parsed: ['planned', 'waiting_approval', 'running', 'failed', 'cancelled'],
    planned: ['waiting_approval', 'running', 'failed', 'cancelled'],
    waiting_approval: ['approved', 'rejected', 'cancelled', 'failed', 'running'],
    approved: ['running', 'failed', 'cancelled'],
    running: ['waiting_approval', 'validating', 'delivery_pending', 'completed', 'failed', 'cancelled'],
    validating: ['delivery_pending', 'completed', 'failed', 'cancelled'],
    delivery_pending: ['completed', 'failed', 'cancelled'],
    completed: ['rollback_pending'],
    failed: ['rollback_pending'],
    rejected: [],
    reverted: [],
    cancelled: [],
    rollback_pending: ['reverted', 'failed'],
  };

  public static canTransition(current: TaskStatus, next: TaskStatus): boolean {
    if (current === next) {
      return true;
    }

    const allowed = this.TRANSITIONS[current];
    return Array.isArray(allowed) ? allowed.includes(next) : false;
  }

  public static transition(current: TaskStatus, next: TaskStatus): TaskStatus {
    if (!this.canTransition(current, next)) {
      throw new Error(`State transition invalid: Cannot go from ${current} to ${next}`);
    }

    return next;
  }

  public static isTerminal(status: TaskStatus): boolean {
    return this.DESCRIPTORS[status]?.terminal === true;
  }

  public static isActive(status: TaskStatus): boolean {
    return this.DESCRIPTORS[status]?.active === true;
  }

  public static isApprovalPending(status: TaskStatus): boolean {
    return this.DESCRIPTORS[status]?.approvalPending === true;
  }

  public static getRank(status: TaskStatus): number {
    return this.DESCRIPTORS[status]?.rank || 0;
  }

  public static getLane(status: TaskStatus): StateDescriptor['lane'] {
    return this.DESCRIPTORS[status]?.lane || 'terminal';
  }

  public static canResume(status: TaskStatus): boolean {
    return this.DESCRIPTORS[status]?.resumable === true;
  }

  public static canRetry(status: TaskStatus): boolean {
    return this.DESCRIPTORS[status]?.retryable === true;
  }

  public static buildLifecycleSnapshot(status: TaskStatus, updatedAt: string): Record<string, unknown> {
    return {
      current_status: status,
      lane: this.getLane(status),
      rank: this.getRank(status),
      is_active: this.isActive(status),
      is_terminal: this.isTerminal(status),
      approval_pending: this.isApprovalPending(status),
      can_resume: this.canResume(status),
      can_retry: this.canRetry(status),
      allowed_next_statuses: this.getAllowedTransitions(status),
      updated_at: updatedAt,
    };
  }

  public static shouldPreservePersistedStatus(existing: TaskStatus, incoming: TaskStatus): boolean {
    if (existing === incoming) {
      return false;
    }

    if (this.canTransition(existing, incoming)) {
      return false;
    }

    if (this.isTerminal(existing) && !this.isTerminal(incoming)) {
      return true;
    }

    return this.getRank(existing) > this.getRank(incoming);
  }

  public static getActiveStatuses(): TaskStatus[] {
    return (Object.entries(this.DESCRIPTORS) as Array<[TaskStatus, StateDescriptor]>)
      .filter(([, descriptor]) => descriptor.active)
      .map(([status]) => status);
  }

  public static getTerminalStatuses(): TaskStatus[] {
    return (Object.entries(this.DESCRIPTORS) as Array<[TaskStatus, StateDescriptor]>)
      .filter(([, descriptor]) => descriptor.terminal)
      .map(([status]) => status);
  }

  public static getAllowedTransitions(current: TaskStatus): TaskStatus[] {
    return [...(this.TRANSITIONS[current] || [])];
  }
}
