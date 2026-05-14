import { TaskManager } from './TaskManager.js';
import fs from 'fs';
import { LogRepository } from '../storage/LogRepository.js';
import { Database } from '../storage/Database.js';
import { config } from '../config/index.js';

export class RecoveryManager {
  private taskManager: TaskManager;
  private logRepo: LogRepository;

  constructor(taskManager: TaskManager, logRepo: LogRepository) {
    this.taskManager = taskManager;
    this.logRepo = logRepo;
  }

  public async runBootRecovery(): Promise<void> {
    this.logRepo.log('info', 'Recovery', 'Iniciando varredura de auto-recuperacao (Boot State Recovery).');

    try {
      const db = await Database.getInstance();

      // Busca tarefas zumbis que estavam rodando no momento de uma queda de forca/crash.
      const runningTasksRaw = db.all<{ task_id: string }>(
        'SELECT * FROM system_tasks WHERE status = ?',
        ['running'],
      );
      let zombiesCount = 0;
      let preservedZavorthBridgeCount = 0;
      let reconciledZavorthBridgeCount = 0;
      let closedPendingPermissionCount = 0;

      for (const row of runningTasksRaw) {
        const task = this.taskManager.getTask(row.task_id);
        if (!task) {
          continue;
        }

        const zavorthBridgeTracking = this.readZavorthBridgeTracking(task);
        if (zavorthBridgeTracking?.completedAt) {
          this.reconcileFinishedZavorthBridgeTask(task, zavorthBridgeTracking);
          reconciledZavorthBridgeCount++;
          continue;
        }

        if (this.shouldPreserveZavorthBridgeTask(task)) {
          preservedZavorthBridgeCount++;
          continue;
        }

        task.error_summary = 'Process died abruptly (Zombie State). Recovered via Boot Watchdog.';
        this.closeZavorthBridgeTracking(task, task.error_summary);
        this.taskManager.advanceState(task, 'failed');
        zombiesCount++;
      }

      const waitingTasks = db.all<{ task_id: string }>(
        'SELECT task_id FROM system_tasks WHERE status = ?',
        ['waiting_approval'],
      );
      for (const row of waitingTasks) {
        const task = this.taskManager.getTask(row.task_id);
        if (!task) {
          continue;
        }

        const zavorthBridgeTracking = this.readZavorthBridgeTracking(task);
        if (!zavorthBridgeTracking?.completedAt) {
          continue;
        }

        this.reconcileFinishedZavorthBridgeTask(task, zavorthBridgeTracking);
        reconciledZavorthBridgeCount++;
      }

      const pendingPermissions = db.all<{ permission_id: string; task_id: string | null }>(
        'SELECT permission_id, task_id FROM permission_requests WHERE status = ? AND executor = ? AND kind = ?',
        ['pending', 'zavorthBridge', 'ui_permission'],
      );
      for (const row of pendingPermissions) {
        const task = row.task_id ? this.taskManager.getTask(row.task_id) : undefined;
        const zavorthBridgeTracking = task ? this.readZavorthBridgeTracking(task) : null;
        const taskIsTerminal = Boolean(task && ['completed', 'failed', 'rejected', 'cancelled'].includes(task.status));
        const shouldClose = !task || taskIsTerminal || Boolean(zavorthBridgeTracking?.completedAt);
        if (!shouldClose) {
          continue;
        }

        db.run(
          'UPDATE permission_requests SET status = ?, updated_at = ?, decided_by = ?, decision_note = ? WHERE permission_id = ? AND status = ?',
          [
            'rejected',
            new Date().toISOString(),
            'system:recovery',
            'Pedido fechado no boot recovery porque a tarefa vinculada nao estava mais ativa.',
            row.permission_id,
            'pending',
          ],
        );
        closedPendingPermissionCount++;
      }

      const waitingTasksRaw = db.all<{ qtd: number }>(
        'SELECT count(*) as qtd FROM system_tasks WHERE status = ?',
        ['waiting_approval'],
      );
      const waitingCount = waitingTasksRaw.length > 0 ? waitingTasksRaw[0].qtd : 0;

      this.logRepo.log(
        'info',
        'Recovery',
        `Recuperacao concluida. Zumbis falhados: ${zombiesCount}. Tarefas ZavorthBridge preservadas: ${preservedZavorthBridgeCount}. Tarefas ZavorthBridge reconciliadas: ${reconciledZavorthBridgeCount}. Permissoes pendentes fechadas: ${closedPendingPermissionCount}. Tarefas aguardando aprovacao: ${waitingCount}`,
      );
    } catch (err: any) {
      this.logRepo.log('error', 'Recovery', `Falha ao tentar executar o fluxo de Recovery: ${err.message}`);
    }
  }

  private shouldPreserveZavorthBridgeTask(task: any): boolean {
    const tracking = this.readZavorthBridgeTracking(task);
    if (!this.isZavorthBridgeTask(task) || !tracking) {
      return false;
    }

    if (tracking.completedAt) {
      return false;
    }

    const launchedAtMs = tracking.launchedAt ? Date.parse(String(tracking.launchedAt)) : Number.NaN;
    const maxPreserveAgeMs = Math.max(config.zavorthBridgePromptTimeoutSeconds * 1000, 10 * 60 * 1000);
    const pendingPermissionId = String(task?.metadata?.pendingPermissionId || '').trim();
    if (Number.isFinite(launchedAtMs) && Date.now() - launchedAtMs > maxPreserveAgeMs && !pendingPermissionId) {
      return false;
    }

    return true;
  }

  private reconcileFinishedZavorthBridgeTask(
    task: any,
    tracking: {
      completedAt?: string | null;
      deliveredResponse?: boolean;
      deliveryState?: string | null;
      pendingDeliverySummary?: string | null;
    },
  ): void {
    const delivered =
      Boolean(tracking.deliveredResponse) ||
      String(tracking.deliveryState || '').trim().toLowerCase() === 'delivered';

    task.requires_approval = false;
    task.approval_status = delivered ? 'approved' : 'not_required';
    task.metadata = {
      ...(task.metadata || {}),
      pendingPermissionId: null,
      pendingPermissionNotifiedAt: null,
      pendingPermissionNotificationError: null,
    };

    if (delivered) {
      task.error_summary = null;
      if (!task.result_summary && tracking.pendingDeliverySummary) {
        task.result_summary = tracking.pendingDeliverySummary;
      }

      if (task.status === 'waiting_approval' || task.status === 'approved') {
        this.taskManager.advanceState(task, 'running');
      }
      if (task.status === 'running' || task.status === 'validating' || task.status === 'delivery_pending') {
        this.taskManager.advanceState(task, 'completed');
        return;
      }

      this.taskManager.saveTask(task);
      return;
    }

    task.error_summary =
      task.error_summary ||
      'Sessao ZavorthBridge anterior terminou sem concluir a entrega e o pedido de permissao ficou obsoleto.';

    if (task.status === 'waiting_approval' || task.status === 'approved') {
      this.taskManager.advanceState(task, 'running');
    }
    if (task.status === 'running' || task.status === 'validating' || task.status === 'delivery_pending') {
      this.taskManager.advanceState(task, 'failed');
      return;
    }

    this.taskManager.saveTask(task);
  }

  private readZavorthBridgeTracking(task: any): {
    launchedAt?: string | null;
    completedAt?: string | null;
    deliveredResponse?: boolean;
    deliveryState?: string | null;
    pendingDeliverySummary?: string | null;
    lastDeliveryError?: string | null;
  } | null {
    const trackingFile = String(task?.metadata?.zavorthBridgeTrackingFile || '').trim();
    if (!trackingFile || !fs.existsSync(trackingFile)) {
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(trackingFile, 'utf8')) as {
        launchedAt?: string | null;
        completedAt?: string | null;
        deliveredResponse?: boolean;
        deliveryState?: string | null;
        pendingDeliverySummary?: string | null;
        lastDeliveryError?: string | null;
      };
    } catch {
      return null;
    }
  }

  private closeZavorthBridgeTracking(task: any, reason: string): void {
    const trackingFile = String(task?.metadata?.zavorthBridgeTrackingFile || '').trim();
    if (!trackingFile || !fs.existsSync(trackingFile)) {
      return;
    }

    try {
      const tracking = JSON.parse(fs.readFileSync(trackingFile, 'utf8')) as Record<string, any>;
      tracking.completedAt = tracking.completedAt || new Date().toISOString();
      if (!tracking.deliveredResponse) {
        tracking.deliveryState = tracking.deliveryState === 'delivered' ? 'delivered' : 'failed';
        tracking.lastDeliveryError = tracking.lastDeliveryError || reason;
      }
      fs.writeFileSync(trackingFile, JSON.stringify(tracking, null, 2), 'utf8');
    } catch {
      // Ignore tracking cleanup failures during boot recovery.
    }
  }

  private isZavorthBridgeTask(task: any): boolean {
    const commandType = String(task?.command_type || '').trim().toLowerCase();
    const executor = String(task?.executor_used || '').trim().toLowerCase();
    return commandType.startsWith('/ag') || executor.startsWith('zavorthBridge');
  }
}
