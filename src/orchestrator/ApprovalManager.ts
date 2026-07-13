import { TaskManager } from './TaskManager.js';
import { Task } from '../contracts/TaskContract.js';
import { ExecutionLifecycleLinkService } from '../services/ExecutionLifecycleLinkService.js';
import { HighRiskConfirmationService } from '../services/HighRiskConfirmationService.js';

export type ApprovalManagerProcessOptions = {
  surface?: string | null;
  actor?: string | null;
  /** @deprecated Ignored — TOTP removed. */
  approvalCode?: string | null;
  enforceHighRiskGate?: boolean;
  env?: NodeJS.ProcessEnv;
  highRiskConfirmation?: HighRiskConfirmationService;
};

export class ApprovalManager {
  private taskManager: TaskManager;
  private readonly lifecycleLinks = new ExecutionLifecycleLinkService();
  private readonly highRisk: HighRiskConfirmationService;

  constructor(
    taskManager: TaskManager,
    highRiskConfirmation?: HighRiskConfirmationService,
  ) {
    this.taskManager = taskManager;
    this.highRisk = highRiskConfirmation || new HighRiskConfirmationService();
  }

  public processApproval(
    task_id: string,
    action: 'approve' | 'reject',
    options: ApprovalManagerProcessOptions = {},
  ): Task {
    const task = this.taskManager.getTask(task_id);

    if (!task) {
      throw new Error(`Task ${task_id} not found.`);
    }

    if (task.status !== 'waiting_approval') {
      throw new Error(
        `Task ${task_id} is not waiting for approval. Current status: ${task.status}`,
      );
    }

    if (action === 'approve' && options.enforceHighRiskGate !== false) {
      const gate = (options.highRiskConfirmation || this.highRisk).assertApprovalGate({
        task,
        approvalGranted: true,
        env: options.env,
      });
      if (!gate.ok) {
        throw new Error(
          (options.highRiskConfirmation || this.highRisk).formatGateFailure(gate),
        );
      }
      task.metadata = {
        ...(task.metadata || {}),
        highRiskGate: {
          reason: gate.reason,
          requiresTotp: false,
          highRisk: gate.highRisk,
          surface: String(options.surface || task.source || 'unknown'),
          at: new Date().toISOString(),
        },
      };
    }

    const existingLifecycle = Array.isArray(task.metadata?.execution_lifecycle)
      ? task.metadata.execution_lifecycle
      : [];
    const approvalId = String(
      task.metadata?.approvalId ||
        task.metadata?.approval_id ||
        task.metadata?.pendingPermissionId ||
        task.task_id,
    ).trim();
    const surface = String(options.surface || task.source || 'unknown');
    const approvalLifecycle = this.lifecycleLinks.buildApprovalLifecycle(
      [
        {
          approvalId,
          taskId: task.task_id,
          status: action === 'approve' ? 'approved' : 'rejected',
          kind: 'task_approval',
          reason:
            action === 'approve' ? 'Task approval granted.' : 'Task approval rejected.',
          source: surface,
        },
      ],
      {
        traceId: task.metadata?.traceId || task.metadata?.trace_id || null,
        runId: task.metadata?.runId || task.metadata?.run_id || task.task_id,
        sessionId: task.metadata?.sessionId || task.metadata?.session_id || task.chat_id || null,
        approvalId,
        surface,
        source: 'approval-manager',
        parentId: task.task_id,
      },
    );

    this.taskManager.advanceState(task, action === 'approve' ? 'approved' : 'rejected', {
      actor: options.actor || 'approval-manager',
      reason: action === 'approve' ? 'Approval granted.' : 'Approval rejected.',
      metadataPatch: {
        execution_lifecycle: [...existingLifecycle, ...approvalLifecycle].slice(-50),
      },
    });

    return task;
  }
}
