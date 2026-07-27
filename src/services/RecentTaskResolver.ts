import { Task } from '../contracts/TaskContract.js';
import { TaskManager } from '../orchestrator/TaskManager.js';

export class RecentTaskResolver {
  constructor(private readonly taskManager: TaskManager) {}

  public resolve(
    userId: string,
    currentTaskId: string | null,
    messageText: string,
    chatId?: string | null,
  ): string | null {
    void userId;
    void currentTaskId;
    void messageText;
    void chatId;
    return null;
  }

  public resolveExplicit(
    userId: string,
    currentTaskId: string | null,
    chatId?: string | null,
  ): string | null {
    const recentTasks = this.taskManager.getRecentTasks(12, userId);
    const candidate = recentTasks.find((task) => this.isRelevantFollowupTarget(task, currentTaskId, chatId || null));
    if (!candidate) {
      return 'I could not find a recent task of yours to correlate with that question.';
    }

    return RecentTaskResolver.formatTaskStatus(candidate);
  }

  private isRelevantFollowupTarget(task: Task, currentTaskId: string | null, chatId: string | null): boolean {
    if (!task || task.task_id === currentTaskId) {
      return false;
    }

    if (chatId && task.chat_id !== chatId) {
      return false;
    }

    if (task.command_type === '/task' && task.intent === 'unknown') {
      return false;
    }

    return true;
  }

  public static formatTaskStatus(task: Task): string {
    const shortRef = task.task_id.substring(0, 8);
    const requestSummary = RecentTaskResolver.truncate(
      task.raw_message || task.normalized_message || 'request without text',
      140,
    );

    switch (task.status) {
      case 'waiting_approval':
        return [
          'The last task is waiting for your approval.',
          `Short reference: ${shortRef}`,
          `request: ${requestSummary}`,
          task.metadata?.pendingPermissionId ? `Permission pending: ${String(task.metadata.pendingPermissionId).substring(0, 8)}`
            : 'It depends on approval before continuing.',
        ].join('\n');
      case 'approved':
      case 'running':
      case 'delivery_pending':
        return [
          'The last task is still running.',
          `Short reference: ${shortRef}`,
          `request: ${requestSummary}`,
          task.result_summary ? `Latest visible summary: ${RecentTaskResolver.truncate(task.result_summary, 220)}`
            : null,
        ]
          .filter(Boolean)
          .join('\n');
      case 'validating': {
        const deliveryStatus = String(task.metadata?.zavorthBridgeDeliveryStatus || '').trim().toLowerCase();
        if (deliveryStatus === 'captured' || deliveryStatus === 'delivery_pending') {
          return [
            'The latest task has already finished and I am delivering the response in Telegram.',
            `Short reference: ${shortRef}`,
            `request: ${requestSummary}`,
          ].join('\n');
        }

        return [
          'The last task finished and is in final validation.',
          `Short reference: ${shortRef}`,
          `request: ${requestSummary}`,
        ].join('\n');
      }
      case 'completed':
        return [
          'The last task has already finished.',
          `Short reference: ${shortRef}`,
          task.result_summary ? `Summary: ${RecentTaskResolver.truncate(task.result_summary, 220)}`
            : `request: ${requestSummary}`,
        ].join('\n');
      case 'failed':
        return [
          'The last task failed.',
          `Short reference: ${shortRef}`,
          `Reason: ${RecentTaskResolver.truncate(task.error_summary || 'failure without a recorded summary', 220)}`,
        ].join('\n');
      case 'parsed':
      case 'planned':
      case 'pending':
        return [
          'The last task was received, but has not finished initial processing yet.',
          `Short reference: ${shortRef}`,
          `request: ${requestSummary}`,
        ].join('\n');
      default:
        return [
          'I found a recent task associated with this.',
          `Short reference: ${shortRef}`,
          `Status: ${task.status}`,
          `request: ${requestSummary}`,
        ].join('\n');
    }
  }

  private static truncate(text: string, maxLength: number): string {
    const normalized = String(text || '').trim();
    if (normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.slice(0, maxLength - 3)}...`;
  }
}
