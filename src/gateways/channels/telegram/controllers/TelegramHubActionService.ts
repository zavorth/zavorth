import { Context } from 'grammy';
import { config } from '../../../../config/index.js';
import { ZavorthBridgePreferenceStore } from '../../../../agents/ZavorthBridgePreferenceStore.js';
import { PermissionRequest, PermissionStatus } from '../../../../contracts/PermissionRequest.js';
import { PermissionService } from '../../../../services/PermissionService.js';
import { SkillLibraryPresentationService } from '../../../../services/SkillLibraryPresentationService.js';
import { SkillInstallPlanPresentationService } from '../../../../services/SkillInstallPlanPresentationService.js';
import { SkillMcpSidecarService } from '../../../../services/SkillMcpSidecarService.js';

type HubRecipeKind = 'codex' | 'external_executor' | 'zavorthBridge' | 'permissions';

type TelegramHubActionServiceDeps = {
  zavorthBridgePreferenceStore: Pick<ZavorthBridgePreferenceStore, 'getPreferredModel'>;
  permissionService: Pick<PermissionService, 'listRequests'>;
  getHealthStats: () => Record<string, unknown>;
  formatSystemStatusReply: (stats: Record<string, unknown>) => string;
  formatModelsReply: (currentModel: string, preferredModel: string | null) => string;
  formatPermissionList: (permissions: PermissionRequest[], status: PermissionStatus | 'all') => string;
  handleDashboard: (ctx: Context) => Promise<void>;
  handleOperationalMode: (ctx: Context, args: string) => Promise<void>;
  handleWslCommand: (ctx: Context, args: string) => Promise<void>;
  handleAudit: (ctx: Context, args: string) => Promise<void>;
  renderHelpCard: (ctx: Context) => Promise<void>;
  formatRecipeMessage: (kind: HubRecipeKind) => string;
  skillLibraryPresentationService?: Pick<SkillLibraryPresentationService, 'renderReport'>;
  skillInstallPlanPresentationService?: Pick<SkillInstallPlanPresentationService, 'renderReport'>;
  skillMcpSidecarService?: Pick<SkillMcpSidecarService, 'renderReport'>;
};

export class TelegramHubActionService {
  private readonly skillLibraryPresentationService: Pick<SkillLibraryPresentationService, 'renderReport'>;
  private readonly skillInstallPlanPresentationService: Pick<SkillInstallPlanPresentationService, 'renderReport'>;
  private readonly skillMcpSidecarService: Pick<SkillMcpSidecarService, 'renderReport'>;

  constructor(private readonly deps: TelegramHubActionServiceDeps) {
    this.skillLibraryPresentationService =
      deps.skillLibraryPresentationService || new SkillLibraryPresentationService();
    this.skillInstallPlanPresentationService =
      deps.skillInstallPlanPresentationService || new SkillInstallPlanPresentationService();
    this.skillMcpSidecarService =
      deps.skillMcpSidecarService || new SkillMcpSidecarService();
  }

  public async handleHubAction(ctx: Context, action: string): Promise<void> {
    switch (action) {
      case 'status': {
        const stats = this.deps.getHealthStats();
        await ctx.reply(this.deps.formatSystemStatusReply(stats));
        return;
      }
      case 'models': {
        const currentModel = config.geminiModel || 'gemini-2.5-flash';
        const preferredZavorthBridgeModel = await this.deps.zavorthBridgePreferenceStore.getPreferredModel();
        await ctx.reply(this.deps.formatModelsReply(currentModel, preferredZavorthBridgeModel));
        return;
      }
      case 'dashboard':
        await this.deps.handleDashboard(ctx);
        return;
      case 'permissions': {
        const permissions = await this.deps.permissionService.listRequests('pending', 10);
        await ctx.reply(this.deps.formatPermissionList(permissions, 'pending'));
        return;
      }
      case 'recipe_codex':
        await ctx.reply(this.deps.formatRecipeMessage('codex'), { parse_mode: 'Markdown' });
        return;
      case 'recipe_external_executor':
        await ctx.reply(this.deps.formatRecipeMessage('external_executor'), { parse_mode: 'Markdown' });
        return;
      case 'recipe_zavorthBridge':
        await ctx.reply(this.deps.formatRecipeMessage('zavorthBridge'), { parse_mode: 'Markdown' });
        return;
      case 'recipe_permissions':
        await ctx.reply(this.deps.formatRecipeMessage('permissions'), { parse_mode: 'Markdown' });
        return;
      case 'skills_library':
        await ctx.reply(this.skillLibraryPresentationService.renderReport({}));
        return;
      case 'skills_plan':
        await ctx.reply(this.skillInstallPlanPresentationService.renderReport({
          recipeId: 'spec-driven-delivery',
        }));
        return;
      case 'skills_mcp':
        await ctx.reply(this.skillMcpSidecarService.renderReport({}));
        return;
      case 'mode':
        await this.deps.handleOperationalMode(ctx, '');
        return;
      case 'wsl':
        await this.deps.handleWslCommand(ctx, '');
        return;
      case 'audit':
        await this.deps.handleAudit(ctx, '10');
        return;
      case 'help':
        await this.deps.renderHelpCard(ctx);
        return;
      default:
        await ctx.reply('Acao rapida do hub nao reconhecida.');
    }
  }
}
