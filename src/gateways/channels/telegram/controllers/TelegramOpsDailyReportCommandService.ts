import { Context } from 'grammy';
import { DailyReportService } from '../../../../services/DailyReportService.js';

export type TelegramOpsDailyReportCommandServiceDeps = {
  dailyReportService: DailyReportService;
};

export class TelegramOpsDailyReportCommandService {
  constructor(private readonly deps: TelegramOpsDailyReportCommandServiceDeps) {}

  public async handleDailyReport(ctx: Context, args: string): Promise<void> {
    const normalized = String(args || '').trim().toLowerCase();
    const userId = ctx.from?.id?.toString() || 'unknown';

    if (!normalized || normalized === 'status') {
      await ctx.reply(this.formatDailyReportStatusReply(this.deps.dailyReportService.getStatus()));
      return;
    }

    if (normalized === 'on') {
      const status = this.deps.dailyReportService.enable(userId, 'Activated through Telegram.');
      await ctx.reply(this.formatDailyReportStatusReply(status, 'activate'));
      return;
    }

    if (normalized === 'off') {
      const status = this.deps.dailyReportService.disable(userId, 'Disabled via Telegram.');
      await ctx.reply(this.formatDailyReportStatusReply(status, 'deactivate'));
      return;
    }

    if (normalized === 'now') {
      const result = await this.deps.dailyReportService.sendNow(userId);
      await ctx.reply(result.message);
      return;
    }

    await ctx.reply('Use /dailyreport [status|on|off|now].');
  }

  public formatDailyReportStatusReply(
    status: {
      enabled: boolean;
      lastSentAt: string | null;
      updatedAt: string | null;
      updatedBy: string | null;
      note: string | null;
      nextPlannedAt: string | null;
    },
    mode: 'status' | 'activate' | 'deactivate' = 'status',
  ): string {
    const lines: string[] = [];

    if (mode === 'activate') {
      lines.push('Daily report activated.');
    } else if (mode === 'deactivate') {
      lines.push('Daily report deactivated.');
    } else {
      lines.push(status.enabled ? 'Daily report is active.' : 'Daily report is inactive.');
    }

    if (status.lastSentAt) {
      lines.push(`Last sent: ${status.lastSentAt}`);
    }

    if (status.nextPlannedAt && status.enabled) {
      lines.push(`Next planned send: ${status.nextPlannedAt}`);
    }

    if (status.updatedAt) {
      lines.push(`Last configuration: ${status.updatedAt}`);
    }

    if (status.updatedBy) {
      lines.push(`Changed by: ${status.updatedBy}`);
    }

    if (status.note) {
      lines.push(`Note: ${status.note}`);
    }

    if (status.enabled) {
      lines.push('Use /dailyreport now to send an immediate summary.');
    }

    return lines.join('\n');
  }
}
