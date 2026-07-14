import { Context, InlineKeyboard } from 'grammy';
import { ZavorthBridgePreferenceStore } from '../../../../agents/ZavorthBridgePreferenceStore.js';
import { PermissionService } from '../../../../services/PermissionService.js';
import { PermissionRequest, PermissionStatus } from '../../../../contracts/PermissionRequest.js';
import { SkillLibraryPresentationService } from '../../../../services/SkillLibraryPresentationService.js';
import { SkillInstallPlanPresentationService } from '../../../../services/SkillInstallPlanPresentationService.js';
import { SkillMcpSidecarService } from '../../../../services/SkillMcpSidecarService.js';
import { TelegramHubActionService } from '../../../../gateways/channels/telegram/controllers/TelegramHubActionService.js';
import { HubSection, TelegramHubRenderService } from '../../../../gateways/channels/telegram/controllers/TelegramHubRenderService.js';
import { ZavorthFirstRunHumanOnboardingService } from '../../../../services/ZavorthFirstRunHumanOnboardingService.js';
import { asErrorLike } from '../../../../utils/errorLike';

export type TelegramHubControllerDeps = {
  zavorthBridgePreferenceStore: ZavorthBridgePreferenceStore;
  permissionService: PermissionService;
  isDemoModeEnabled: () => boolean;
  isOperatorModeEnabled: () => boolean;
  isPresentationModeEnabled: () => boolean;
  getHealthStats: () => Record<string, unknown>;
  formatSystemStatusReply: (stats: Record<string, unknown>) => string;
  formatModelsReply: (currentModel: string, preferredModel: string | null) => string;
  formatPermissionList: (permissions: PermissionRequest[], status: PermissionStatus | 'all') => string;
  handleZavorthControl: (ctx: Context) => Promise<void>;
  handleOperationalMode: (ctx: Context, args: string) => Promise<void>;
  handleWslCommand: (ctx: Context, args: string) => Promise<void>;
  handleAudit: (ctx: Context, args: string) => Promise<void>;
  renderHelpCard: (ctx: Context) => Promise<void>;
  skillLibraryPresentationService?: Pick<SkillLibraryPresentationService, 'buildSnapshot' | 'renderReport'>;
  skillInstallPlanPresentationService?: Pick<SkillInstallPlanPresentationService, 'renderReport'>;
  skillMcpSidecarService?: Pick<SkillMcpSidecarService, 'renderReport'>;
};

/**
 * agent-first hub: /start + buttons for first-run; free text never answers the wizard.
 */
export class TelegramHubController {
  private readonly actionService: TelegramHubActionService;
  private readonly renderService: TelegramHubRenderService;

  constructor(private deps: TelegramHubControllerDeps) {
    this.renderService = new TelegramHubRenderService({
      zavorthBridgePreferenceStore: this.deps.zavorthBridgePreferenceStore,
      permissionService: this.deps.permissionService,
      isDemoModeEnabled: this.deps.isDemoModeEnabled,
      isOperatorModeEnabled: this.deps.isOperatorModeEnabled,
      isPresentationModeEnabled: this.deps.isPresentationModeEnabled,
      skillLibraryPresentationService: this.deps.skillLibraryPresentationService,
    });
    this.actionService = new TelegramHubActionService({
      zavorthBridgePreferenceStore: this.deps.zavorthBridgePreferenceStore,
      permissionService: this.deps.permissionService,
      getHealthStats: this.deps.getHealthStats,
      formatSystemStatusReply: this.deps.formatSystemStatusReply,
      formatModelsReply: this.deps.formatModelsReply,
      formatPermissionList: this.deps.formatPermissionList,
      handleZavorthControl: this.deps.handleZavorthControl,
      handleOperationalMode: this.deps.handleOperationalMode,
      handleWslCommand: this.deps.handleWslCommand,
      handleAudit: this.deps.handleAudit,
      renderHelpCard: this.deps.renderHelpCard,
      formatRecipeMessage: (kind) => this.renderService.formatRecipeMessage(kind),
      skillLibraryPresentationService: this.deps.skillLibraryPresentationService,
      skillInstallPlanPresentationService: this.deps.skillInstallPlanPresentationService,
      skillMcpSidecarService: this.deps.skillMcpSidecarService,
    });
  }

  public async handleStartCommand(ctx: Context, args: string): Promise<void> {
    const handled = await this.tryHandleFirstRunSlash(ctx, args);
    if (handled) return;
    await this.renderHubPage(ctx, this.resolveStartSection(args));
  }

  public async handleMenuCommand(ctx: Context): Promise<void> {
    await this.renderHubPage(ctx, 'overview');
  }

  public async handleSettingsCommand(ctx: Context): Promise<void> {
    await this.renderHubPage(ctx, 'settings');
  }

  public async handleHubCallback(ctx: Context, data: string): Promise<void> {
    const parts = String(data || '').split(':');
    // hub:firstrun:<action>[:value]
    if (parts[1] === 'firstrun') {
      await this.handleFirstRunCallback(ctx, parts.slice(2));
      return;
    }

    const [, type, value] = parts;

    if (type === 'page') {
      await ctx.answerCallbackQuery();
      await this.renderHubPage(ctx, (value || 'overview') as HubSection, true);
      return;
    }

    if (type === 'action') {
      await ctx.answerCallbackQuery();
      await this.handleHubAction(ctx, value || '');
      return;
    }

    await ctx.answerCallbackQuery({ text: 'Unknown hub action.' });
  }

  private async tryHandleFirstRunSlash(ctx: Context, args: string): Promise<boolean> {
    const service = this.getFirstRunService(ctx);
    const normalized = String(args || '').trim().toLowerCase();

    // Explicit hub destinations are navigation, not onboarding answers.
    if (['recipes', 'playbooks', 'skills', 'library', 'security', 'safe', 'permissions', 'perms', 'settings', 'ops', 'quickstart', 'start'].includes(normalized)) {
      return false;
    }

    // Explicit setup verbs always open first-run UI even if complete.
    if (normalized === 'restart' || normalized === 'reset') {
      const snap = service.reset();
      await this.replyFirstRunCard(ctx, snap.welcomeLines.join('\n'));
      return true;
    }
    if (normalized === 'skip') {
      const done = service.complete({
        language: service.buildSnapshot().state.language || 'en',
        surface: 'telegram',
        allowLearning: service.buildSnapshot().state.allowLearning ?? true,
      });
      await ctx.reply(done.summary);
      return true;
    }
    if (normalized === 'setup' || normalized === 'onboarding' || normalized === 'tour') {
      await this.replyFirstRunCard(ctx, service.buildSnapshot().welcomeLines.join('\n'));
      return true;
    }

    // Structured apply: /start lang=en surface=telegram learn=yes
    const structured = this.parseStructuredFirstRunArgs(normalized);
    if (structured) {
      if (structured.complete) {
        const done = service.complete({
          language: structured.language || service.buildSnapshot().state.language || 'en',
          surface: (structured.surface as any) || 'telegram',
          allowLearning: structured.allowLearning ?? true,
        });
        await ctx.reply(done.summary);
        return true;
      }
      const snap = service.applyStep(structured);
      await this.replyFirstRunCard(ctx, snap.welcomeLines.join('\n') + (snap.nextPrompt ? `\n\n${snap.nextPrompt}` : ''));
      return true;
    }

    if (!service.needsOnboarding()) {
      return false;
    }

    // Default /start while incomplete: show button card (not free-text wizard).
    await this.replyFirstRunCard(ctx, service.buildSnapshot().welcomeLines.join('\n'));
    return true;
  }

  private async handleFirstRunCallback(ctx: Context, parts: string[]): Promise<void> {
    const service = this.getFirstRunService(ctx);
    const action = String(parts[0] || '').trim().toLowerCase();
    const value = String(parts[1] || '').trim().toLowerCase();

    if (action === 'skip') {
      const done = service.complete({
        language: service.buildSnapshot().state.language || 'en',
        surface: 'telegram',
        allowLearning: service.buildSnapshot().state.allowLearning ?? true,
      });
      await ctx.answerCallbackQuery({ text: 'Setup skipped' });
      await ctx.reply(done.summary);
      return;
    }

    if (action === 'restart') {
      const snap = service.reset();
      await ctx.answerCallbackQuery({ text: 'Setup restarted' });
      await this.replyFirstRunCard(ctx, snap.welcomeLines.join('\n'), true);
      return;
    }

    if (action === 'lang' && value) {
      const snap = service.applyStep({ language: value });
      await ctx.answerCallbackQuery({ text: `Language: ${value}` });
      if (snap.completed) {
        await ctx.reply(snap.summary || snap.welcomeLines.join('\n'));
      } else {
        await this.replyFirstRunCard(ctx, snap.welcomeLines.join('\n') + (snap.nextPrompt ? `\n\n${snap.nextPrompt}` : ''), true);
      }
      return;
    }

    if (action === 'surface' && value) {
      const snap = service.applyStep({ surface: value });
      await ctx.answerCallbackQuery({ text: `Surface: ${value}` });
      if (snap.completed) {
        await ctx.reply(snap.summary || snap.welcomeLines.join('\n'));
      } else {
        await this.replyFirstRunCard(ctx, snap.welcomeLines.join('\n') + (snap.nextPrompt ? `\n\n${snap.nextPrompt}` : ''), true);
      }
      return;
    }

    if (action === 'learn' && (value === 'yes' || value === 'no')) {
      const snap = service.applyStep({ allowLearning: value === 'yes' });
      await ctx.answerCallbackQuery({ text: value === 'yes' ? 'Learning on' : 'Learning off' });
      if (snap.completed || !service.needsOnboarding()) {
        await ctx.reply(snap.welcomeLines.join('\n'));
      } else {
        await this.replyFirstRunCard(
          ctx,
          snap.welcomeLines.join('\n') + (snap.nextPrompt ? `\n\n${snap.nextPrompt}` : ''),
          true,
        );
      }
      return;
    }

    await ctx.answerCallbackQuery({ text: 'Unknown setup action' });
    await this.replyFirstRunCard(ctx, service.buildSnapshot().welcomeLines.join('\n'));
  }

  private async replyFirstRunCard(ctx: Context, text: string, edit = false): Promise<void> {
    const service = this.getFirstRunService(ctx);
    const snap = service.buildSnapshot();
    const keyboard = this.buildFirstRunKeyboard(snap.state.step, snap.completed);
    const body = [
      text,
      '',
      'agent-first setup: use the buttons (or /start skip). Free text goes to the agent.',
    ].join('\n');
    const options = { reply_markup: keyboard };

    if (edit && ctx.callbackQuery?.message?.message_id && ctx.chat?.id) {
      try {
        await ctx.api.editMessageText(ctx.chat.id, ctx.callbackQuery.message.message_id, body, options);
        return;
      } catch (error: unknown) {
        const err = asErrorLike(error);
        if (!(err instanceof Error) || !err.message?.includes('not modified')) {
          await ctx.reply(body, options);
        }
        return;
      }
    }

    await ctx.reply(body, options);
  }

  private buildFirstRunKeyboard(step: number, completed: boolean): InlineKeyboard {
    const kb = new InlineKeyboard();
    if (completed) {
      kb.text('Open hub', 'hub:page:overview').row();
      kb.text('Restart setup', 'hub:firstrun:restart');
      return kb;
    }
    if (step <= 1) {
      kb.text('English', 'hub:firstrun:lang:en')
        .text('Português', 'hub:firstrun:lang:pt')
        .text('Español', 'hub:firstrun:lang:es')
        .row();
    }
    if (step === 2) {
      kb.text('Telegram', 'hub:firstrun:surface:telegram')
        .text('Desktop', 'hub:firstrun:surface:desktop')
        .row();
      kb.text('Web', 'hub:firstrun:surface:web')
        .text('Terminal', 'hub:firstrun:surface:cli')
        .row();
    }
    if (step >= 3) {
      kb.text('Learn: yes', 'hub:firstrun:learn:yes')
        .text('Learn: no', 'hub:firstrun:learn:no')
        .row();
    }
    kb.text('Skip setup', 'hub:firstrun:skip');
    return kb;
  }

  private parseStructuredFirstRunArgs(args: string): null | {
    language?: string;
    surface?: string;
    allowLearning?: boolean;
    complete?: boolean;
  } {
    if (!args || !/=/.test(args)) return null;
    const out: {
      language?: string;
      surface?: string;
      allowLearning?: boolean;
      complete?: boolean;
    } = {};
    for (const token of args.split(/\s+/)) {
      const [k, v] = token.split('=');
      if (!k || v == null) continue;
      if (k === 'lang' || k === 'language') out.language = v;
      if (k === 'surface') out.surface = v;
      if (k === 'learn' || k === 'learning') {
        out.allowLearning = /^(1|true|yes|on|sim)$/i.test(v);
      }
      if (k === 'done' || k === 'complete') {
        out.complete = /^(1|true|yes)$/i.test(v);
      }
    }
    if (!out.language && !out.surface && out.allowLearning === undefined && !out.complete) {
      return null;
    }
    return out;
  }

  private getFirstRunService(ctx: Context): ZavorthFirstRunHumanOnboardingService {
    const userId = ctx.from?.id?.toString() || null;
    return new ZavorthFirstRunHumanOnboardingService({
      projectRoot: process.cwd(),
      userId,
    });
  }

  private async renderHubPage(ctx: Context, section: HubSection, edit = false): Promise<void> {
    const text = await this.renderService.buildHubPageText(section);
    const keyboard = this.renderService.buildHubKeyboard(section);
    const options = {
      reply_markup: keyboard,
      parse_mode: 'Markdown' as const,
    };

    if (edit && ctx.callbackQuery?.message?.message_id && ctx.chat?.id) {
      try {
        await ctx.api.editMessageText(ctx.chat.id, ctx.callbackQuery.message.message_id, text, options);
        return;
      } catch (error: unknown) {
        const err = asErrorLike(error);
        if (!(err instanceof Error) || !err.message?.includes('not modified')) {
          await ctx.reply(text, options);
        }
        return;
      }
    }

    await ctx.reply(text, options);
  }

  private async handleHubAction(ctx: Context, action: string): Promise<void> {
    await this.actionService.handleHubAction(ctx, action);
  }

  private resolveStartSection(args: string): HubSection {
    switch ((args || '').trim().toLowerCase()) {
      case 'tour':
      case 'onboarding':
        return 'onboarding1';
      case 'recipes':
      case 'playbooks':
        return 'recipes';
      case 'skills':
      case 'library':
        return 'skills';
      case 'security':
      case 'safe':
        return 'security';
      case 'permissions':
      case 'perms':
        return 'permissions';
      case 'settings':
      case 'ops':
        return 'settings';
      case 'quickstart':
      case 'start':
        return 'quickstart';
      default:
        return 'overview';
    }
  }
}
