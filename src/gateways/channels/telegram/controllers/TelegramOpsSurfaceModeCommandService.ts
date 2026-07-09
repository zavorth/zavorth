import { Context } from 'grammy';
import { t } from '../../../../gateways/channels/telegram/i18n.js';
import { OperatorModeService } from '@zavorth/services/OperatorModeService.js';

type ModeAction = 'activate' | 'deactivate' | 'status';

const MODE_ALIASES: Record<string, ModeAction> = {
  on: 'activate', ativar: 'activate', ligar: 'activate', enable: 'activate', activate: 'activate',
  off: 'deactivate', desativar: 'deactivate', desligar: 'deactivate', disable: 'deactivate', deactivate: 'deactivate',
  status: 'status',
};

import { PresentationModeService } from '@zavorth/services/PresentationModeService.js';

export type TelegramOpsSurfaceModeCommandServiceDeps = {
  operatorModeService: OperatorModeService;
  presentationModeService: PresentationModeService;
};

export class TelegramOpsSurfaceModeCommandService {
  constructor(private readonly deps: TelegramOpsSurfaceModeCommandServiceDeps) {}

  public async handleOperatorMode(ctx: Context, args: string): Promise<void> {
    const normalized = String(args || '').trim().toLowerCase();

    if (!normalized || normalized === 'status') {
      const status = this.deps.operatorModeService.getStatus();
      await ctx.reply(this.formatOperatorModeReply(status, 'status'));
      return;
    }

    const userId = ctx.from?.id?.toString() || 'unknown';
    const action = MODE_ALIASES[normalized];
    if (action === 'activate') {
      const status = this.deps.operatorModeService.enable(userId, 'Activated via Telegram.');
      await ctx.reply(this.formatOperatorModeReply(status, 'activate'));
      return;
    }

    if (action === 'deactivate') {
      const status = this.deps.operatorModeService.disable(userId, 'Deactivated via Telegram.');
      await ctx.reply(this.formatOperatorModeReply(status, 'deactivate'));
      return;
    }

    await ctx.reply('Use /operator [on|off|status].');
  }

  public async handlePresentationMode(ctx: Context, args: string): Promise<void> {
    const normalized = String(args || '').trim().toLowerCase();

    if (!normalized || normalized === 'status') {
      const status = this.deps.presentationModeService.getStatus();
      await ctx.reply(this.formatPresentationModeReply(status, 'status'));
      return;
    }

    const userId = ctx.from?.id?.toString() || 'unknown';
    const action = MODE_ALIASES[normalized];
    if (action === 'activate') {
      const status = this.deps.presentationModeService.enable(userId, 'Activated via Telegram.');
      await ctx.reply(this.formatPresentationModeReply(status, 'activate'));
      return;
    }

    if (action === 'deactivate') {
      const status = this.deps.presentationModeService.disable(userId, 'Deactivated via Telegram.');
      await ctx.reply(this.formatPresentationModeReply(status, 'deactivate'));
      return;
    }

    await ctx.reply('Use /presentation [on|off|status].');
  }

  public formatOperatorModeReply(
    status: {
      enabled: boolean;
      updatedAt: string | null;
      updatedBy: string | null;
      note: string | null;
    },
    mode: 'status' | 'activate' | 'deactivate',
  ): string {
    const lines: string[] = [];

    if (mode === 'activate') {
      lines.push(
        'Operator mode activated.',
        'Now I will prepare the task and stop before acting, awaiting your approval via /approve.',
      );
    } else if (mode === 'deactivate') {
      lines.push(
        'Operator mode deactivated.',
        'Now Zavorth resumes immediate execution when policy and risk allow.',
      );
    } else {
      lines.push(status.enabled ? 'Operator mode is active.' : 'Operator mode is inactive.');
    }

    if (status.updatedAt) {
      lines.push(`Last change: ${status.updatedAt}`);
    }

    if (status.updatedBy) {
      lines.push(`Changed by: ${status.updatedBy}`);
    }

    if (status.note) {
      lines.push(`Note: ${status.note}`);
    }

    if (status.enabled) {
      lines.push('While active, executable tasks will stop at waiting_approval before running.');
    }

    return lines.join('\n');
  }

  public formatPresentationModeReply(
    status: {
      enabled: boolean;
      updatedAt: string | null;
      updatedBy: string | null;
      note: string | null;
    },
    mode: 'status' | 'activate' | 'deactivate',
  ): string {
    const lines: string[] = [];

    if (mode === 'activate') {
      lines.push(
        'Presentation mode activated.',
        'Now Zavorth will hide more internal details in common replies and speak more directly.',
      );
    } else if (mode === 'deactivate') {
      lines.push(
        'Presentation mode deactivated.',
        'Now Zavorth resumes showing more technical context in operational replies.',
      );
    } else {
      lines.push(status.enabled ? 'Presentation mode is active.' : 'Presentation mode is inactive.');
    }

    if (status.updatedAt) {
      lines.push(`Last change: ${status.updatedAt}`);
    }

    if (status.updatedBy) {
      lines.push(`Changed by: ${status.updatedBy}`);
    }

    if (status.note) {
      lines.push(`Note: ${status.note}`);
    }

    if (status.enabled) {
      lines.push(
        'In this mode, common responses avoid showing executor, gateway, risk, and other internal details when not needed.',
      );
    }

    return lines.join('\n');
  }
}
