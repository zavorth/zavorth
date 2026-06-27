// @ts-nocheck
import fs from 'fs';
import { type Context } from 'grammy';
import { Task } from '@zavorth/contracts/TaskContract.js';
import { TaskManager } from '../../../../orchestrator/TaskManager.js';
import { ZavorthBridgeCliAdapter } from '../../../../agents/ZavorthBridgeCliAdapter.js';
import { ZavorthBridgeCompanionBridgeLike } from '../../../../gateways/channels/telegram/controllers/TelegramZavorthBridgeService.js';

type TelegramZavorthBridgeTaskExecutionServiceDeps = {
  taskManager: Pick<TaskManager, 'advanceState'>;
  persistTask: (task: Task) => void;
  createCompanionBridge?: () => ZavorthBridgeCompanionBridgeLike;
  tryDirectResearchRoute: (ctx: Context, task: Task, prompt: string) => Promise<boolean>;
  tryResearchFallback: (ctx: Context, task: Task, prompt: string, error: unknown) => Promise<boolean>;
};

export class TelegramZavorthBridgeTaskExecutionService {
  constructor(private readonly deps: TelegramZavorthBridgeTaskExecutionServiceDeps) {}

  public async handleTaskExecution(ctx: Context, task: Task, prompt: string): Promise<void> {
    if (!prompt.trim()) {
      await ctx.reply('Use /ag <request> or /bridge <request> with a clear instruction for me to start ZavorthBridge.');
      return;
    }

    this.deps.taskManager.advanceState(task, 'running');

    if (await this.deps.tryDirectResearchRoute(ctx, task, prompt)) {
      return;
    }

    const adapter = new ZavorthBridgeCliAdapter();
    const bridge = this.deps.createCompanionBridge?.();

    try {
      const result = await adapter.executePrompt(task, prompt, task.workspace);
      if (bridge && (await bridge.isOnline()) && result.metadata?.delivery_mode !== 'companion-reuse') {
        await bridge.openHandoff(result.metadata.handoff_file, task.task_id).catch(() => undefined);
        await bridge.syncPendingHandoffs(task.task_id).catch(() => undefined);
      }
      const status = bridge ? await bridge.readStatus().catch(() => null) : null;
      const companionInstanceId = result.metadata?.companion_instance_id || status?.instanceId || null;
      task.executor_used = result.executor;
      task.metadata = {
        ...(task.metadata || {}),
        zavorthBridgeDeliveryMode: result.metadata?.delivery_mode || null,
        zavorthBridgeHandoffFile: result.metadata?.handoff_file || null,
        zavorthBridgeTrackingFile: result.metadata?.tracking_file || null,
        zavorthBridgeResponseFile: result.metadata?.response_file || null,
        zavorthBridgePreferredModel: result.metadata?.preferred_model || null,
        zavorthBridgeCompanionInstanceId: companionInstanceId,
      };
      this.deps.persistTask(task);

      if (companionInstanceId && result.metadata?.tracking_file && fs.existsSync(result.metadata.tracking_file)) {
        const tracking = JSON.parse(fs.readFileSync(result.metadata.tracking_file, 'utf8'));
        tracking.companionInstanceId = companionInstanceId;
        fs.writeFileSync(result.metadata.tracking_file, JSON.stringify(tracking, null, 2), 'utf8');
      }
      await ctx.reply(
        [
          'Delivered the task to the real ZavorthBridge.',
          `Short reference: ${task.task_id.substring(0, 8)}`,
          'I only come back here if it finishes, fails, or requests your approval.',
        ].join('\n'),
      );
    } catch (error: unknown) {
      const fallbackApplied = await this.deps.tryResearchFallback(ctx, task, prompt, error);
      if (fallbackApplied) {
        return;
      }

      task.error_summary = error.message;
      this.deps.persistTask(task);
      this.deps.taskManager.advanceState(task, 'failed');
      await ctx.reply(
        [
          'Could not start ZavorthBridge right now.',
          '',
          `Reason: ${error.message}`,
          '',
          'Immediate alternative for web research: use /research <topic>.',
        ].join('\n'),
      );
    }
  }
}
