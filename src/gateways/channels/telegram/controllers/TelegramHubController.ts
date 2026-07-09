import { Context } from 'grammy';
import { ZavorthBridgePreferenceStore } from '../../../../agents/ZavorthBridgePreferenceStore.js';
import { PermissionService } from '../../../../services/PermissionService.js';
import { PermissionRequest, PermissionStatus } from '../../../../contracts/PermissionRequest.js';
import { SkillLibraryPresentationService } from '../../../../services/SkillLibraryPresentationService.js';
import { SkillInstallPlanPresentationService } from '../../../../services/SkillInstallPlanPresentationService.js';
import { SkillMcpSidecarService } from '../../../../services/SkillMcpSidecarService.js';
import { TelegramHubActionService } from '../../../../gateways/channels/telegram/controllers/TelegramHubActionService.js';
import { HubSection, TelegramHubRenderService } from '../../../../gateways/channels/telegram/controllers/TelegramHubRenderService.js';

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
    await this.renderHubPage(ctx, this.resolveStartSection(args));
  }

  public async handleMenuCommand(ctx: Context): Promise<void> {
    await this.renderHubPage(ctx, 'overview');
  }

  public async handleSettingsCommand(ctx: Context): Promise<void> {
    await this.renderHubPage(ctx, 'settings');
  }

  public async handleHubCallback(ctx: Context, data: string): Promise<void> {
    const [, type, value] = data.split(':');

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

    await ctx.answerCallbackQuery({ text: 'Acao do hub desconhecida.' });
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
      } catch (err: any) { const error = err; const e = err;
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
