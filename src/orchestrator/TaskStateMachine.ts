import type { Task, TaskStatus } from '../contracts/TaskContract.js';

export type ZavorthTaskOsState =
  | 'queued'
  | 'planning'
  | 'awaiting_permission'
  | 'running'
  | 'awaiting_artifact'
  | 'delivering'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

export type ZavorthTaskOsStateDescriptor = {
  state: ZavorthTaskOsState;
  legacyStatus: TaskStatus;
  phase: 'intake' | 'planning' | 'permission' | 'execution' | 'artifact' | 'delivery' | 'terminal' | 'paused';
  terminal: boolean;
  active: boolean;
  resumable: boolean;
  retryable: boolean;
  approvalResumesTask: boolean;
  ambiguous: false;
  allowedActions: Array<'approve' | 'reject' | 'resume' | 'retry' | 'cancel' | 'redeliver_artifacts'>;
};

export class TaskStateMachine {
  public static readonly FORMAL_STATES: ZavorthTaskOsState[] = [
    'queued',
    'planning',
    'awaiting_permission',
    'running',
    'awaiting_artifact',
    'delivering',
    'completed',
    'failed',
    'cancelled',
    'paused',
  ];

  public static describe(task: Pick<Task, 'status' | 'approval_status' | 'requires_approval' | 'artifacts' | 'metadata'>): ZavorthTaskOsStateDescriptor {
    const legacyStatus = task.status;
    const state = this.toFormalState(task);
    const terminal = state === 'completed' || state === 'failed' || state === 'cancelled';
    const active = !terminal && state !== 'paused';
    const approvalResumesTask = state === 'awaiting_permission';
    const retryable = state === 'completed' || state === 'failed' || state === 'cancelled';
    const resumable = state === 'paused'
      || state === 'awaiting_permission'
      || state === 'running'
      || state === 'awaiting_artifact'
      || state === 'delivering';
    const allowedActions = this.resolveAllowedActions(state, task);

    return {
      state,
      legacyStatus,
      phase: this.resolvePhase(state),
      terminal,
      active,
      resumable,
      retryable,
      approvalResumesTask,
      ambiguous: false,
      allowedActions,
    };
  }

  public static toFormalState(task: Pick<Task, 'status' | 'approval_status' | 'requires_approval' | 'artifacts' | 'metadata'>): ZavorthTaskOsState {
    if (task.metadata?.paused === true || task.metadata?.pause_reason) {
      return 'paused';
    }

    switch (task.status) {
      case 'pending':
      case 'parsed':
        return 'queued';
      case 'planned':
        return 'planning';
      case 'waiting_approval':
      case 'approved':
        return task.approval_status === 'pending' || task.requires_approval
          ? 'awaiting_permission'
          : 'running';
      case 'running':
        return 'running';
      case 'validating':
        return Array.isArray(task.artifacts) && task.artifacts.length > 0
          ? 'running'
          : 'awaiting_artifact';
      case 'delivery_pending':
        return Array.isArray(task.artifacts) && task.artifacts.length > 0
          ? 'delivering'
          : 'awaiting_artifact';
      case 'completed':
        return 'completed';
      case 'failed':
      case 'rejected':
      case 'reverted':
        return 'failed';
      case 'cancelled':
        return 'cancelled';
      case 'rollback_pending':
        return 'paused';
      default:
        return 'paused';
    }
  }

  private static resolvePhase(state: ZavorthTaskOsState): ZavorthTaskOsStateDescriptor['phase'] {
    switch (state) {
      case 'queued':
        return 'intake';
      case 'planning':
        return 'planning';
      case 'awaiting_permission':
        return 'permission';
      case 'running':
        return 'execution';
      case 'awaiting_artifact':
        return 'artifact';
      case 'delivering':
        return 'delivery';
      case 'paused':
        return 'paused';
      default:
        return 'terminal';
    }
  }

  private static resolveAllowedActions(
    state: ZavorthTaskOsState,
    task: Pick<Task, 'artifacts'>,
  ): ZavorthTaskOsStateDescriptor['allowedActions'] {
    const actions: ZavorthTaskOsStateDescriptor['allowedActions'] = [];
    if (state === 'awaiting_permission') {
      actions.push('approve', 'reject');
    }
    if (state === 'paused' || state === 'awaiting_permission' || state === 'awaiting_artifact' || state === 'delivering') {
      actions.push('resume');
    }
    if (state === 'completed' || state === 'failed' || state === 'cancelled') {
      actions.push('retry');
    }
    if (!['completed', 'failed', 'cancelled'].includes(state)) {
      actions.push('cancel');
    }
    if (Array.isArray(task.artifacts) && task.artifacts.length > 0) {
      actions.push('redeliver_artifacts');
    }
    return Array.from(new Set(actions));
  }
}
