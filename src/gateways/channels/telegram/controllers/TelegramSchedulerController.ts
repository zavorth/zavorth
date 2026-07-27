import { Context } from 'grammy';
import { ZavorthAutomationActionService } from '@zavorth/services/ZavorthAutomationActionService.js';
import { ZavorthAutomationControlPlaneService } from '@zavorth/services/ZavorthAutomationControlPlaneService.js';
import { SchedulerService } from '@zavorth/services/SchedulerService.js';
import { ZavorthScheduledTaskSurfaceService } from '@zavorth/services/ZavorthScheduledTaskSurfaceService.js';
import { t } from '../../../../gateways/channels/telegram/i18n.js';
import {
  buildReportSurfaceResponse,
  buildRuntimeSurfaceResponse,
  mapBooleanReceiptStatus,
} from '@zavorth/domain/surface/application/surface-response/index.js';
import { replyWithTelegramSurfaceResponse } from '../../../../gateways/channels/telegram/TelegramSurfaceResponseSender.js';
import { asErrorLike } from '../../../../utils/errorLike.js';

type SchedulerResolver = () => SchedulerService | undefined;

type TelegramStructuredScheduleRequest = {
  schedule?: unknown;
  command?: unknown;
  topic?: unknown;
  intent?: unknown;
};

export class TelegramSchedulerController {
  private readonly automationControlPlane = new ZavorthAutomationControlPlaneService();
  private readonly automationActionService = new ZavorthAutomationActionService({
    controlPlaneService: this.automationControlPlane,
  });

  constructor(private getSchedulerService: SchedulerResolver) {}

  public async handleSchedule(ctx: Context, args: string): Promise<void> {
    const schedulerService = this.getSchedulerService();
    if (!schedulerService) {
      await ctx.reply(t('scheduler.starting'));
      return;
    }

    const userId = ctx.from?.id.toString() || '';
    if (!args) {
      await ctx.reply(t('scheduler.usage'));
      return;
    }

    const parsed = this.parseStructuredScheduleRequest(args);
    if (!parsed?.schedule || !parsed.command) {
      await ctx.reply(t('scheduler.invalid_format'));
      return;
    }

    const schedule = parsed.schedule;
    const commandToRun = parsed.command;

    try {
      const surface = new ZavorthScheduledTaskSurfaceService({ schedulerService });
      const result = await surface.register({
        intent: commandToRun,
        command: commandToRun,
        schedule,
        requestedBy: userId,
        surface: 'telegram',
        approvalId: `telegram-schedule-${userId}`,
        approvedBy: userId,
        maxCommands: 1,
        maxMutations: 0,
      });
      await this.replySchedulerReport(
        ctx,
        result.ok ? 'schedule-created' : 'schedule-blocked',
        result.ok ? 'Governed schedule created' : 'Schedule blocked',
        surface.render(result),
        {
          command: commandToRun,
          schedule,
          taskId: result.task?.id || null,
          governed: true,
        },
        result.ok ? 'done' : 'failed',
      );
    } catch (error: unknown) {
      const err = asErrorLike(error);
      await ctx.reply(t('scheduler.create_failed', { error: error instanceof Error ? err.message : String(error) }));
    }
  }

  public async handleListSchedules(ctx: Context): Promise<void> {
    const schedulerService = this.getSchedulerService();
    if (!schedulerService) {
      await ctx.reply(t('scheduler.starting'));
      return;
    }

    const surface = new ZavorthScheduledTaskSurfaceService({ schedulerService });
    const result = surface.list();
    if (result.tasks.length === 0) {
      await this.replySchedulerReport(
        ctx,
        'schedule-list-empty',
        t('scheduler.task_list_empty'),
        surface.render(result),
        { count: 0 },
      );
      return;
    }

    await this.replySchedulerReport(
      ctx,
      'schedule-list',
      t('scheduler.task_list'),
      surface.render(result),
      { count: result.tasks.length },
    );
  }

  public async handleUnschedule(ctx: Context, args: string): Promise<void> {
    const schedulerService = this.getSchedulerService();
    if (!schedulerService) {
      await ctx.reply(t('scheduler.starting'));
      return;
    }

    const idPrefix = String(args || '').trim();
    if (!idPrefix) {
      await ctx.reply(t('scheduler.id_required'));
      return;
    }

    const surface = new ZavorthScheduledTaskSurfaceService({ schedulerService });
    const result = await surface.lifecycle({
      action: 'revoke',
      taskId: idPrefix,
      requestedBy: String(ctx.from?.id || 'telegram-user'),
      surface: 'telegram',
      approvalId: `telegram-unschedule-${String(ctx.from?.id || 'telegram-user')}`,
      approvedBy: String(ctx.from?.id || 'telegram-user'),
    });
    await this.replySchedulerReport(
      ctx,
      result.ok ? 'schedule-removed' : 'schedule-remove-blocked',
      t('scheduler.removal'),
      surface.render(result),
      { taskId: result.task?.id || null, idPrefix },
      result.ok ? 'done' : 'failed',
    );
  }

  public async handleReport(ctx: Context, args: string, userId: string): Promise<void> {
    const schedulerService = this.getSchedulerService();
    if (!schedulerService) {
      await ctx.reply(t('scheduler.starting'));
      return;
    }

    const trimmedArgs = String(args || '').trim();
    if (!trimmedArgs) {
      await ctx.reply(t('scheduler.report_usage'));
      return;
    }

    const parsed = this.parseStructuredScheduleRequest(trimmedArgs);
    if (!parsed?.schedule || !parsed.topic) {
      await ctx.reply(t('scheduler.report_format'));
      return;
    }

    const schedule = parsed.schedule;
    const topic = parsed.topic;
    const surface = new ZavorthScheduledTaskSurfaceService({ schedulerService });
    const result = await surface.register({
      intent: `Recurring report: ${topic}`,
      command: `/deepresearch ${topic}`,
      schedule,
      requestedBy: userId,
      surface: 'telegram',
      approvalId: `telegram-report-${userId}`,
      approvedBy: userId,
      maxCommands: 1,
      maxMutations: 0,
      maxNetworkRequests: 1,
    });

    await this.replySchedulerReport(
      ctx,
      result.ok ? 'report-scheduled' : 'report-blocked',
      result.ok ? 'Recurring report scheduled' : 'Report blocked',
      surface.render(result),
      {
        topic,
        schedule,
        taskId: result.task?.id || null,
        governed: true,
      },
      result.ok ? 'done' : 'failed',
    );
  }

  public async handleAutomations(ctx: Context, args: string, userId: string): Promise<void> {
    const normalizedArgs = String(args || '').trim();
    const lower = normalizedArgs.toLowerCase();

    if (!normalizedArgs || lower === 'status' || lower === 'show' || lower === 'open') {
      await this.replySchedulerReport(
        ctx,
        'automations-status',
        'Automations e scheduled runs',
        await this.automationControlPlane.renderReport(),
      );
      return;
    }

    if (lower === 'maintenance on' || lower === 'maint on') {
      const execution = await this.automationActionService.execute({
        actionId: 'maintenance-on',
        requestedBy: userId,
        sourceSurface: 'telegram',
      });
      await this.replyAutomationExecution(ctx, execution);
      return;
    }

    if (lower === 'maintenance off' || lower === 'maint off') {
      const execution = await this.automationActionService.execute({
        actionId: 'maintenance-off',
        requestedBy: userId,
        sourceSurface: 'telegram',
      });
      await this.replyAutomationExecution(ctx, execution);
      return;
    }

    if (lower === 'maintenance run' || lower === 'maint run') {
      const execution = await this.automationActionService.execute({
        actionId: 'maintenance-run',
        requestedBy: userId,
        sourceSurface: 'telegram',
      });
      await this.replyAutomationExecution(ctx, execution);
      return;
    }

    const taskAction = this.parseTaskAction(normalizedArgs);
    if (taskAction) {
      const execution = await this.automationActionService.execute({
        actionId: taskAction.verb === 'pause'
          ? 'pause'
          : taskAction.verb === 'resume'
            ? 'resume'
            : (taskAction.verb === 'reapprove' || taskAction.verb === 'renew') ? 'reapprove' : 'remove',
        taskId: taskAction.taskId,
        requestedBy: userId,
        sourceSurface: 'telegram',
      });
      await this.replyAutomationExecution(ctx, execution);
      return;
    }

    const execution = await this.automationActionService.execute({
      actionId: 'create',
      intentText: normalizedArgs,
      requestedBy: userId,
      sourceSurface: 'telegram',
    });
    await this.replyAutomationExecution(ctx, execution);
  }

  private async replySchedulerReport(
    ctx: Context,
    id: string,
    title: string,
    report: string,
    metadata: Record<string, unknown> = {},
    status: 'done' | 'failed' = 'done',
  ): Promise<void> {
    await replyWithTelegramSurfaceResponse(
      ctx,
      buildReportSurfaceResponse({
        id: `telegram-scheduler-${id}`,
        title,
        text: report,
        status,
        policyProfile: 'telegram-scheduler',
        metadata,
      }),
    );
  }

  private async replyAutomationExecution(
    ctx: Context,
    execution: Awaited<ReturnType<ZavorthAutomationActionService['execute']>>,
  ): Promise<void> {
    await replyWithTelegramSurfaceResponse(
      ctx,
      buildRuntimeSurfaceResponse({
        id: `telegram-automation-${execution.actionId || 'action'}`,
        title: 'Automations e scheduled runs',
        summary: execution.summary,
        text: this.formatAutomationReply(execution),
        status: mapBooleanReceiptStatus(execution.ok),
        policyProfile: 'telegram-automation',
        metadata: {
          actionId: execution.actionId,
          ok: execution.ok,
        },
      }),
    );
  }

  private formatAutomationReply(
    execution: Awaited<ReturnType<ZavorthAutomationActionService['execute']>>,
  ): string {
    return [
      'Scheduled runs: Automations e scheduled runs',
      '',
      execution.summary,
      ...execution.details.map((entry) => `- ${entry}`),
      '',
      execution.snapshot.narrative.operatorSummary,
      `Next step: ${execution.snapshot.narrative.nextAction}`,
    ].join('\n');
  }

  private parseStructuredScheduleRequest(args: string): { schedule: string; command: string; topic?: string } | null {
    const raw = String(args || '').trim();
    if (!raw || !this.looksLikeJsonObject(raw)) {
      return null;
    }
    let parsed: TelegramStructuredScheduleRequest;
    try {
      parsed = JSON.parse(raw) as TelegramStructuredScheduleRequest;
    } catch {
      return null;
    }
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const schedule = this.serializeSchedule(parsed.schedule);
    const command = typeof parsed.command === 'string' ? parsed.command.trim() : '';
    const topic = typeof parsed.topic === 'string' ? parsed.topic.trim() : '';
    const intent = typeof parsed.intent === 'string' ? parsed.intent.trim() : '';
    const resolvedCommand = command || intent;
    if (!schedule || !resolvedCommand) {
      return null;
    }
    return {
      schedule,
      command: resolvedCommand,
      topic: topic || undefined,
    };
  }

  private serializeSchedule(schedule: unknown): string | null {
    if (typeof schedule === 'string') {
      const trimmed = schedule.trim();
      return trimmed || null;
    }
    if (schedule && typeof schedule === 'object') {
      return JSON.stringify(schedule);
    }
    return null;
  }

  private looksLikeJsonObject(value: string): boolean {
    return value.startsWith('{') && value.endsWith('}');
  }

  private parseTaskAction(args: string): { verb: string; taskId: string } | null {
    const parts = this.splitWhitespace(args);
    if (parts.length < 2) {
      return null;
    }
    const verb = parts[0]?.toLowerCase() || '';
    if (!['pause', 'resume', 'remove', 'delete', 'reapprove', 'renew'].includes(verb)) {
      return null;
    }
    const taskId = parts.slice(1).join(' ').trim();
    return taskId ? { verb, taskId } : null;
  }

  private splitWhitespace(value: string): string[] {
    const parts: string[] = [];
    let current = '';
    for (const char of value) {
      if (char.trim() === '') {
        if (current) {
          parts.push(current);
          current = '';
        }
        continue;
      }
      current += char;
    }
    if (current) {
      parts.push(current);
    }
    return parts;
  }
}
