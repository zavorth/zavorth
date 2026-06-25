import { Context } from 'grammy';
import { DemoGuideService } from '../../../../services/DemoGuideService.js';
import { DemoModeService } from '../../../../services/DemoModeService.js';
import { DemoFlowService } from '../../../../services/DemoFlowService.js';
import { PresentationModeService } from '../../../../services/PresentationModeService.js';

export type TelegramOpsDemoCommandServiceDeps = {
  demoGuideService: DemoGuideService;
  demoModeService: DemoModeService;
  presentationModeService: PresentationModeService;
};

export class TelegramOpsDemoCommandService {
  private readonly demoFlowService = new DemoFlowService();

  constructor(private readonly deps: TelegramOpsDemoCommandServiceDeps) {}

  public async handleDemo(ctx: Context, args: string): Promise<void> {
    const normalized = String(args || '').trim().toLowerCase();
    const userId = ctx.from?.id?.toString() || 'unknown';
    const totalSteps = this.demoFlowService.getScenarios().length;

    if (!normalized || normalized === 'list' || normalized === 'overview') {
      await ctx.reply(this.demoFlowService.formatOverview({ demoModeEnabled: this.deps.demoModeService.isEnabled() }));
      return;
    }

    if (normalized === 'status') {
      const lines = [this.formatDemoModeReply(this.deps.demoModeService.getStatus(), 'status')];
      const session = this.deps.demoGuideService.getSession(userId);
      if (session) {
        const scenario = this.demoFlowService.getScenarios()[session.currentIndex] || null;
        lines.push('');
        if (session.completed) {
          lines.push('Sequencia guiada: concluida.');
          lines.push('Use /demo reset para reiniciar ou /demo pitch para fechar a apresentacao.');
        } else {
          lines.push(
            `Sequencia guiada em andamento: etapa ${session.currentIndex + 1}/${totalSteps}${scenario ? ` - ${scenario.title}` : ''}.`,
          );
          lines.push('Use /demo next para avancar ou /demo reset para reiniciar.');
        }
      }

      await ctx.reply(lines.join('\n'));
      return;
    }

    if (['on', 'ativar', 'ligar', 'enable'].includes(normalized)) {
      const autoPresentationEnabled = !this.deps.presentationModeService.isEnabled();
      if (autoPresentationEnabled) {
        this.deps.presentationModeService.enable(userId, 'Ativado junto com modo demo.');
      }
      const status = this.deps.demoModeService.enable(userId, 'Ativado via Telegram.', autoPresentationEnabled);
      await ctx.reply(this.formatDemoModeReply(status, 'activate'));
      return;
    }

    if (['off', 'desativar', 'desligar', 'stop', 'disable'].includes(normalized)) {
      const previous = this.deps.demoModeService.getStatus();
      if (previous.autoPresentationEnabled && this.deps.presentationModeService.isEnabled()) {
        this.deps.presentationModeService.disable(userId, 'Desativado junto com modo demo.');
      }
      const status = this.deps.demoModeService.disable(userId, 'Desativado via Telegram.');
      await ctx.reply(this.formatDemoModeReply(status, 'deactivate'));
      return;
    }

    if (normalized === 'short') {
      await ctx.reply(this.demoFlowService.formatShortPresentation());
      return;
    }

    if (normalized === 'pitch') {
      await ctx.reply(this.demoFlowService.formatPitch());
      return;
    }

    if (normalized === 'checklist') {
      await ctx.reply(this.demoFlowService.formatChecklist());
      return;
    }

    if (normalized === 'full' || normalized === 'runbook') {
      await ctx.reply(this.demoFlowService.formatFullRunbook());
      return;
    }

    if (normalized === 'start') {
      const lines: string[] = [];
      if (!this.deps.demoModeService.isEnabled()) {
        const autoPresentationEnabled = !this.deps.presentationModeService.isEnabled();
        if (autoPresentationEnabled) {
          this.deps.presentationModeService.enable(userId, 'Ativado junto com sequencia guiada.');
        }
        this.deps.demoModeService.enable(
          userId,
          'Ativado automaticamente pela sequencia guiada.',
          autoPresentationEnabled,
        );
        lines.push('Modo demo ativado para esta sequencia.');
      }

      this.deps.demoGuideService.start(userId);
      lines.push(this.demoFlowService.formatGuidedStart());
      lines.push('');
      lines.push(this.demoFlowService.formatGuidedStep(0) || 'Nao encontrei etapas configuradas para esta demo.');
      await ctx.reply(lines.join('\n'));
      return;
    }

    if (normalized === 'next') {
      const currentSession = this.deps.demoGuideService.getSession(userId);
      if (!currentSession) {
        await ctx.reply('Ainda nao existe uma sequencia guiada ativa. Use /demo start para comecar.');
        return;
      }

      const session = this.deps.demoGuideService.next(userId, totalSteps);
      if (!session || session.completed) {
        await ctx.reply(this.demoFlowService.formatGuidedCompletion());
        return;
      }

      await ctx.reply(
        this.demoFlowService.formatGuidedStep(session.currentIndex) || 'Nao encontrei a proxima etapa da sequencia.',
      );
      return;
    }

    if (normalized === 'reset') {
      const removed = this.deps.demoGuideService.reset(userId);
      await ctx.reply(
        removed
          ? 'Sequencia guiada reiniciada. Quando quiser recomecar, use /demo start.'
          : 'Nao havia sequencia guiada ativa. Use /demo start para comecar.',
      );
      return;
    }

    const scenario = this.demoFlowService.formatScenario(normalized);
    if (!scenario) {
      await ctx.reply(
        'Use /demo, /demo start, /demo next, /demo short, /demo research, /demo files, /demo workflow, /demo stitch ou /demo full.',
      );
      return;
    }

    await ctx.reply(scenario);
  }

  public formatDemoModeReply(
    status: {
      enabled: boolean;
      updatedAt: string | null;
      updatedBy: string | null;
      note: string | null;
      autoPresentationEnabled: boolean;
    },
    mode: 'status' | 'activate' | 'deactivate',
  ): string {
    const lines: string[] = [];

    if (mode === 'activate') {
      lines.push(
        'Modo demo ativado.',
        'Agora o Zavorth fica mais preparado para apresentacao, com respostas mais limpas e um roteiro pronto pelo /demo.',
      );
      if (status.autoPresentationEnabled) {
        lines.push('O modo apresentacao tambem foi ativado automaticamente.');
      }
    } else if (mode === 'deactivate') {
      lines.push('Modo demo desativado.');
      if (status.autoPresentationEnabled) {
        lines.push('O modo apresentacao vinculado a esta demo tambem foi desligado.');
      } else {
        lines.push('O modo apresentacao independente foi preservado.');
      }
    } else {
      lines.push(status.enabled ? 'O modo demo esta ativo.' : 'O modo demo esta inativo.');
      lines.push('Atalhos: /demo pitch | /demo checklist | /demo full');
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
      lines.push('Sugestao: rode /demo checklist antes de mostrar o Zavorth para outras pessoas.');
    }

    return lines.join('\n');
  }
}
