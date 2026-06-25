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

    if (['on', 'ativar', 'ligar', 'enable'].includes(normalized)) {
      const status = this.deps.dailyReportService.enable(userId, 'Ativado via Telegram.');
      await ctx.reply(this.formatDailyReportStatusReply(status, 'activate'));
      return;
    }

    if (['off', 'desativar', 'desligar', 'disable'].includes(normalized)) {
      const status = this.deps.dailyReportService.disable(userId, 'Desativado via Telegram.');
      await ctx.reply(this.formatDailyReportStatusReply(status, 'deactivate'));
      return;
    }

    if (['now', 'agora'].includes(normalized)) {
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
      lines.push('Relatorio diario ativado.');
    } else if (mode === 'deactivate') {
      lines.push('Relatorio diario desativado.');
    } else {
      lines.push(status.enabled ? 'O relatorio diario esta ativo.' : 'O relatorio diario esta inativo.');
    }

    if (status.lastSentAt) {
      lines.push(`Ultimo envio: ${status.lastSentAt}`);
    }

    if (status.nextPlannedAt && status.enabled) {
      lines.push(`Proximo envio previsto: ${status.nextPlannedAt}`);
    }

    if (status.updatedAt) {
      lines.push(`Ultima configuracao: ${status.updatedAt}`);
    }

    if (status.updatedBy) {
      lines.push(`Alterado por: ${status.updatedBy}`);
    }

    if (status.note) {
      lines.push(`Observacao: ${status.note}`);
    }

    if (status.enabled) {
      lines.push('Use /dailyreport now para enviar um resumo imediato.');
    }

    return lines.join('\n');
  }
}
