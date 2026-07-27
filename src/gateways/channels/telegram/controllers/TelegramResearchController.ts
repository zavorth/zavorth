import { Context } from 'grammy';
import { TaskManager } from '../../../../orchestrator/TaskManager.js';

export class TelegramResearchController {
  constructor(private taskManager: TaskManager) {}

  public async handleResearch(ctx: Context, args: string): Promise<void> {
    await this.enqueueResearch(ctx, '/research', args);
  }

  public async handleDeepResearch(ctx: Context, args: string): Promise<void> {
    await this.enqueueResearch(ctx, '/deepresearch', args);
  }

  private async enqueueResearch(ctx: Context, commandType: '/research' | '/deepresearch', args: string): Promise<void> {
    const query = String(args || '').trim();
    if (!query) {
      await ctx.reply(
        commandType === '/deepresearch'
          ? 'Usage: /deepresearch <topic>'
          : 'Usage: /research <term>\nExample: /research latest artificial intelligence news',
      );
      return;
    }

    const chatId = ctx.chat?.id?.toString() || '';
    const userId = ctx.from?.id?.toString() || '';
    const rawMessage = `${commandType} ${query}`.trim();
    const task = this.taskManager.createPendingTask(
      chatId,
      userId,
      rawMessage,
      query,
      commandType,
    );
    task.intent = commandType === '/deepresearch' ? 'deep_research' : 'research';
    task.workspace = 'web';
    task.risk_level = 0;
    task.metadata = {
      ...(task.metadata || {}),
      research_query: query,
      async_queue: {
        enqueued_at: new Date().toISOString(),
      },
    };
    this.taskManager.saveTask(task);

    await ctx.reply(
      [
        `${commandType === '/deepresearch' ? 'Deep Research' : 'Pesquisa'} aceita e enfileirada.`,
        `Short reference: ${task.task_id.substring(0, 8)}`,
        'I will notify you here when it is done.',
      ].join('\n'),
    );
  }
}
