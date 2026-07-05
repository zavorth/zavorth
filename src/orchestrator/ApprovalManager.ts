import { TaskManager } from './TaskManager.js';
import { Task } from '../contracts/TaskContract.js';
import { ExecutionLifecycleLinkService } from '../services/ExecutionLifecycleLinkService.js';

export class ApprovalManager {
  private taskManager: TaskManager;
  private readonly lifecycleLinks = new ExecutionLifecycleLinkService();

  constructor(taskManager: TaskManager) {
    this.taskManager = taskManager;
  }

  public processApproval(task_id: string, action: 'approve' | 'reject'): Task {
    const task = this.taskManager.getTask(task_id);
    
    if (!task) {
      throw new Error(`Task ${task_id} not found.`);
    }

    if (task.status !== 'waiting_approval') {
      throw new Error(`Task ${task_id} is not waiting for approval. Current status: ${task.status}`);
    }

    const existingLifecycle = Array.isArray(task.metadata?.execution_lifecycle)
      ? task.metadata.execution_lifecycle
      : [];
    const approvalId = String(
      task.metadata?.approvalId
      || task.metadata?.approval_id
      || task.metadata?.pendingPermissionId
      || task.task_id,
    ).trim();
    const approvalLifecycle = this.lifecycleLinks.buildApprovalLifecycle([
      {
        approvalId,
        taskId: task.task_id,
        status: action === 'approve' ? 'approved' : 'rejected',
        kind: 'task_approval',
        reason: action === 'approve' ? 'Task approval granted.' : 'Task approval rejected.',
        source: task.source,
      },
    ], {
      traceId: task.metadata?.traceId || task.metadata?.trace_id || null,
      runId: task.metadata?.runId || task.metadata?.run_id || task.task_id,
      sessionId: task.metadata?.sessionId || task.metadata?.session_id || task.chat_id || null,
      approvalId,
      surface: task.source,
      source: 'approval-manager',
      parentId: task.task_id,
    });

    this.taskManager.advanceState(task, action === 'approve' ? 'approved' : 'rejected', {
      actor: 'approval-manager',
      reason: action === 'approve' ? 'Approval granted.' : 'Approval rejected.',
      metadataPatch: {
        execution_lifecycle: [...existingLifecycle, ...approvalLifecycle].slice(-50),
      },
    });

    return task;
  }
}
