import { Context } from 'grammy';
import { OperatorModeService } from '../../services/OperatorModeService.js';
import { PresentationModeService } from '../../services/PresentationModeService.js';

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
    if (['on', 'ativar', 'ligar', 'enable'].includes(normalized)) {
      const status = this.deps.operatorModeService.enable(userId, 'Ativado via Telegram.');
      await ctx.reply(this.formatOperatorModeReply(status, 'activate'));
      return;
    }

    if (['off', 'desativar', 'desligar', 'disable'].includes(normalized)) {
      const status = this.deps.operatorModeService.disable(userId, 'Desativado via Telegram.');
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
    if (['on', 'ativar', 'ligar', 'enable'].includes(normalized)) {
      const status = this.deps.presentationModeService.enable(userId, 'Ativado via Telegram.');
      await ctx.reply(this.formatPresentationModeReply(status, 'activate'));
      return;
    }

    if (['off', 'desativar', 'desligar', 'disable'].includes(normalized)) {
      const status = this.deps.presentationModeService.disable(userId, 'Desativado via Telegram.');
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
        'Modo operador ativado.',
        'Agora eu vou preparar a tarefa e parar antes de agir, esperando sua aprovacao via /approve.',
      );
    } else if (mode === 'deactivate') {
      lines.push(
        'Modo operador desativado.',
        'Agora o Zavorth volta a executar imediatamente quando a politica e o risco permitirem.',
      );
    } else {
      lines.push(status.enabled ? 'O modo operador esta ativo.' : 'O modo operador esta inativo.');
    }

    if (status.updatedAt) {
      lines.push(`Ultima alteracao: ${status.updatedAt}`);
    }

    if (status.updatedBy) {
      lines.push(`Alterado por: ${status.updatedBy}`);
    }

    if (status.note) {
      lines.push(`Observacao: ${status.note}`);
    }

    if (status.enabled) {
      lines.push('Enquanto ele estiver ativo, tarefas executaveis vao parar em waiting_approval antes de rodar.');
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
        'Modo apresentacao ativado.',
        'Agora o Zavorth vai esconder mais detalhes internos nas respostas comuns e falar de forma mais direta.',
      );
    } else if (mode === 'deactivate') {
      lines.push(
        'Modo apresentacao desativado.',
        'Agora o Zavorth volta a mostrar mais contexto tecnico nas respostas operacionais.',
      );
    } else {
      lines.push(status.enabled ? 'O modo apresentacao esta ativo.' : 'O modo apresentacao esta inativo.');
    }

    if (status.updatedAt) {
      lines.push(`Ultima alteracao: ${status.updatedAt}`);
    }

    if (status.updatedBy) {
      lines.push(`Alterado por: ${status.updatedBy}`);
    }

    if (status.note) {
      lines.push(`Observacao: ${status.note}`);
    }

    if (status.enabled) {
      lines.push(
        'Nesse modo, respostas comuns evitam mostrar executor, gateway, risco e outros detalhes internos sem necessidade.',
      );
    }

    return lines.join('\n');
  }
}
