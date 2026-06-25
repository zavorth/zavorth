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

type SchedulerResolver = () => SchedulerService | undefined;

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

    const match = args.match(/^(every\s+\d+[mh])\s+(.+)$/i);
    if (!match) {
      await ctx.reply(t('scheduler.invalid_format'));
      return;
    }

    const schedule = match[1].toLowerCase();
    const commandToRun = match[2];

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
      // Marker: Agendamento governado criado
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
      await ctx.reply(t('scheduler.create_failed', { error: error.message }));
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

    const match = trimmedArgs.match(/^every\s+(\d+[mh])\s+(.+)$/i);
    if (!match) {
      await ctx.reply(t('scheduler.report_format'));
      return;
    }

    const schedule = `every ${match[1]}`;
    const topic = match[2].trim();
    const surface = new ZavorthScheduledTaskSurfaceService({ schedulerService });
    const result = await surface.register({
      intent: `Relatorio recorrente: ${topic}`,
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

    // Marker: Relatorio governado agendado
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

    const taskMatch = normalizedArgs.match(/^(pause|resume|remove|delete|reapprove|renew)\s+(.+)$/i);
    if (taskMatch) {
      const verb = taskMatch[1].toLowerCase();
      const execution = await this.automationActionService.execute({
        actionId: verb === 'pause'
          ? 'pause'
          : verb === 'resume'
            ? 'resume'
            : (verb === 'reapprove' || verb === 'renew') ? 'reapprove' : 'remove',
        taskId: String(taskMatch[2] || '').trim() || null,
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
      `Proximo passo: ${execution.snapshot.narrative.nextAction}`,
    ].join('\n');
  }
}
