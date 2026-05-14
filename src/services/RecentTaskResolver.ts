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
    if (!this.looksLikeRecentTaskFollowup(messageText)) {
      return null;
    }

    const recentTasks = this.taskManager.getRecentTasks(12, userId);
    const candidate = recentTasks.find((task) => this.isRelevantFollowupTarget(task, currentTaskId, chatId || null));
    if (!candidate) {
      return 'Nao encontrei nenhuma tarefa recente sua para correlacionar com essa pergunta.';
    }

    return RecentTaskResolver.formatTaskStatus(candidate);
  }

  private looksLikeRecentTaskFollowup(messageText: string): boolean {
    const normalized = this.normalize(messageText);
    if (!normalized) {
      return false;
    }

    return [
      /\bcade\b/,
      /\bcad[eê]\b/,
      /\be ai\b/,
      /\bea[ií]\b/,
      /\bfoi\b/,
      /\bterminou\b/,
      /\bdeu certo\b/,
      /\bcomo ficou\b/,
      /\bficou pronto\b/,
      /\bqual foi\b/,
      /\bstatus\b/,
      /\bandamento\b/,
      /\bdepois disso\b/,
      /\bda ultima\b/,
      /\bdessa ultima\b/,
      /\bultima tarefa\b/,
      /\bultimo pedido\b/,
    ].some((pattern) => pattern.test(normalized));
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
      task.raw_message || task.normalized_message || 'pedido sem texto',
      140,
    );

    switch (task.status) {
      case 'waiting_approval':
        return [
          'A ultima tarefa esta esperando sua aprovacao.',
          `Referencia curta: ${shortRef}`,
          `Pedido: ${requestSummary}`,
          task.metadata?.pendingPermissionId
            ? `Permissao pendente: ${String(task.metadata.pendingPermissionId).substring(0, 8)}`
            : 'Ela depende de aprovacao antes de continuar.',
        ].join('\n');
      case 'approved':
      case 'running':
      case 'delivery_pending':
        return [
          'A ultima tarefa ainda esta em andamento.',
          `Referencia curta: ${shortRef}`,
          `Pedido: ${requestSummary}`,
          task.result_summary
            ? `Ultimo resumo visivel: ${RecentTaskResolver.truncate(task.result_summary, 220)}`
            : null,
        ]
          .filter(Boolean)
          .join('\n');
      case 'validating': {
        const deliveryStatus = String(task.metadata?.zavorthBridgeDeliveryStatus || '').trim().toLowerCase();
        if (deliveryStatus === 'captured' || deliveryStatus === 'delivery_pending') {
          return [
            'A ultima tarefa ja terminou e eu estou entregando a resposta no Telegram.',
            `Referencia curta: ${shortRef}`,
            `Pedido: ${requestSummary}`,
          ].join('\n');
        }

        return [
          'A ultima tarefa terminou e esta na validacao final.',
          `Referencia curta: ${shortRef}`,
          `Pedido: ${requestSummary}`,
        ].join('\n');
      }
      case 'completed':
        return [
          'A ultima tarefa ja terminou.',
          `Referencia curta: ${shortRef}`,
          task.result_summary
            ? `Resumo: ${RecentTaskResolver.truncate(task.result_summary, 220)}`
            : `Pedido: ${requestSummary}`,
        ].join('\n');
      case 'failed':
        return [
          'A ultima tarefa falhou.',
          `Referencia curta: ${shortRef}`,
          `Motivo: ${RecentTaskResolver.truncate(task.error_summary || 'falha sem resumo registrado', 220)}`,
        ].join('\n');
      case 'parsed':
      case 'planned':
      case 'pending':
        return [
          'A ultima tarefa foi recebida, mas ainda nao terminou o processamento inicial.',
          `Referencia curta: ${shortRef}`,
          `Pedido: ${requestSummary}`,
        ].join('\n');
      default:
        return [
          'Encontrei uma tarefa recente associada a isso.',
          `Referencia curta: ${shortRef}`,
          `Status: ${task.status}`,
          `Pedido: ${requestSummary}`,
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

  private normalize(text: string): string {
    return String(text || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}
