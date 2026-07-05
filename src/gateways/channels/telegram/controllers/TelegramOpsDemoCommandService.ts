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
          lines.push('Guided sequence: completed.');
          lines.push('Use /demo reset to restart or /demo pitch to close the presentation.');
        } else {
          lines.push(
            `Guided sequence in progress: step ${session.currentIndex + 1}/${totalSteps}${scenario ? ` - ${scenario.title}` : ''}.`,
          );
          lines.push('Use /demo next to advance or /demo reset to restart.');
        }
      }

      await ctx.reply(lines.join('\n'));
      return;
    }

    if (['on', 'ativar', 'ligar', 'enable'].includes(normalized)) {
      const autoPresentationEnabled = !this.deps.presentationModeService.isEnabled();
      if (autoPresentationEnabled) {
        this.deps.presentationModeService.enable(userId, 'Enabled with demo mode.');
      }
      const status = this.deps.demoModeService.enable(userId, 'Enabled through Telegram.', autoPresentationEnabled);
      await ctx.reply(this.formatDemoModeReply(status, 'activate'));
      return;
    }

    if (['off', 'desativar', 'desligar', 'stop', 'disable'].includes(normalized)) {
      const previous = this.deps.demoModeService.getStatus();
      if (previous.autoPresentationEnabled && this.deps.presentationModeService.isEnabled()) {
        this.deps.presentationModeService.disable(userId, 'Disabled with demo mode.');
      }
      const status = this.deps.demoModeService.disable(userId, 'Disabled through Telegram.');
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
          this.deps.presentationModeService.enable(userId, 'Enabled with the guided sequence.');
        }
        this.deps.demoModeService.enable(
          userId,
          'Automatically enabled by the guided sequence.',
          autoPresentationEnabled,
        );
        lines.push('Demo mode enabled for this sequence.');
      }

      this.deps.demoGuideService.start(userId);
      lines.push(this.demoFlowService.formatGuidedStart());
      lines.push('');
      lines.push(this.demoFlowService.formatGuidedStep(0) || 'I could not find configured steps for this demo.');
      await ctx.reply(lines.join('\n'));
      return;
    }

    if (normalized === 'next') {
      const currentSession = this.deps.demoGuideService.getSession(userId);
      if (!currentSession) {
        await ctx.reply('There is no active guided sequence yet. Use /demo start to begin.');
        return;
      }

      const session = this.deps.demoGuideService.next(userId, totalSteps);
      if (!session || session.completed) {
        await ctx.reply(this.demoFlowService.formatGuidedCompletion());
        return;
      }

      await ctx.reply(
        this.demoFlowService.formatGuidedStep(session.currentIndex) || 'I could not find the next step in the sequence.',
      );
      return;
    }

    if (normalized === 'reset') {
      const removed = this.deps.demoGuideService.reset(userId);
      await ctx.reply(
        removed
          ? 'Guided sequence reset. Use /demo start when you want to begin again.'
          : 'There was no active guided sequence. Use /demo start to begin.',
      );
      return;
    }

    const scenario = this.demoFlowService.formatScenario(normalized);
    if (!scenario) {
      await ctx.reply(
        'Use /demo, /demo start, /demo next, /demo short, /demo research, /demo files, /demo workflow, /demo stitch, or /demo full.',
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
        'Demo mode enabled.',
        'Zavorth is now better prepared for presentation, with cleaner responses and a ready script through /demo.',
      );
      if (status.autoPresentationEnabled) {
        lines.push('Presentation mode was also enabled automatically.');
      }
    } else if (mode === 'deactivate') {
      lines.push('Demo mode disabled.');
      if (status.autoPresentationEnabled) {
        lines.push('The presentation mode linked to this demo was also disabled.');
      } else {
        lines.push('Independent presentation mode was preserved.');
      }
    } else {
      lines.push(status.enabled ? 'Demo mode is active.' : 'Demo mode is inactive.');
      lines.push('Shortcuts: /demo pitch | /demo checklist | /demo full');
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
      lines.push('Suggestion: run /demo checklist before showing Zavorth to other people.');
    }

    return lines.join('\n');
  }
}
