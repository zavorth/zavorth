import { Context } from 'grammy';
import { SkillMcpSidecarService } from '../../../../services/SkillMcpSidecarService.js';
import { SkillLibraryPresentationService } from '../../../../services/SkillLibraryPresentationService.js';
import { SkillInstallPlanPresentationService } from '../../../../services/SkillInstallPlanPresentationService.js';
import { UniversalSkillBridgeActivationService } from '../../../../services/UniversalSkillBridgeActivationService.js';
import { buildReportSurfaceResponse } from '../../../../domain/surface/application/surface-response/index.js';
import { replyWithTelegramSurfaceResponse } from '../../../../gateways/channels/telegram/TelegramSurfaceResponseSender.js';

type TelegramSkillCatalogControllerDeps = {
  skillMcpSidecarService?: Pick<SkillMcpSidecarService, 'renderReport'>;
  skillLibraryPresentationService?: Pick<SkillLibraryPresentationService, 'renderReport'>;
  skillInstallPlanPresentationService?: Pick<SkillInstallPlanPresentationService, 'renderReport'>;
  skillBridgeActivationService?: Pick<UniversalSkillBridgeActivationService, 'executeCommand' | 'renderReport'>;
};

export class TelegramSkillCatalogController {
  private readonly skillMcpSidecarService: Pick<SkillMcpSidecarService, 'renderReport'>;
  private readonly skillLibraryPresentationService: Pick<SkillLibraryPresentationService, 'renderReport'>;
  private readonly skillInstallPlanPresentationService: Pick<SkillInstallPlanPresentationService, 'renderReport'>;
  private readonly skillBridgeActivationService: Pick<UniversalSkillBridgeActivationService, 'executeCommand' | 'renderReport'>;

  constructor(deps: TelegramSkillCatalogControllerDeps = {}) {
    this.skillMcpSidecarService = deps.skillMcpSidecarService || new SkillMcpSidecarService();
    this.skillLibraryPresentationService =
      deps.skillLibraryPresentationService || new SkillLibraryPresentationService();
    this.skillInstallPlanPresentationService =
      deps.skillInstallPlanPresentationService || new SkillInstallPlanPresentationService({
        skillLibraryPresentationService: this.skillLibraryPresentationService as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      });
    this.skillBridgeActivationService =
      deps.skillBridgeActivationService || new UniversalSkillBridgeActivationService();
  }

  public async handleSkills(ctx: Context, args: string): Promise<void> {
    const normalizedArgs = String(args || '').trim();
    const lower = normalizedArgs.toLowerCase();
    const stripCommandPrefix = (value: string, command: string): string =>
      value.slice(command.length).trim() || '';

    if (this.isSkillBridgeActivationCommand(lower)) {
      const snapshot = await this.skillBridgeActivationService.executeCommand({
        args: normalizedArgs,
        channel: 'telegram',
        actorId: String((ctx as any).from?.id || '').trim() || null, // eslint-disable-line @typescript-eslint/no-explicit-any
      });
      await this.replySkillReport(
        ctx,
        'skill-bridge-activation',
        'Universal Skill Bridge Activation',
        this.skillBridgeActivationService.renderReport(snapshot),
        {
          status: snapshot.status,
          action: snapshot.action,
          selectedId: snapshot.selectedId,
          policyProfile: 'telegram-skill-bridge-activation',
        },
        'telegram-skill-bridge-activation',
      );
      return;
    }

    if (lower === 'library' || lower.startsWith('library ')) {
      const query = stripCommandPrefix(normalizedArgs, 'library') || null;
      const report = this.skillLibraryPresentationService.renderReport({
        selectedId: query,
        query,
      });
      await this.replySkillReport(ctx, 'skill-library', 'Skill library', report, { query });
      return;
    }

    if (lower === 'plan' || lower.startsWith('plan ')) {
      const remainder = stripCommandPrefix(normalizedArgs, 'plan');
      const lowerRemainder = remainder.toLowerCase();
      if (lowerRemainder.startsWith('recipe ')) {
        const recipeId = remainder.slice('recipe '.length).trim() || null;
        await this.replySkillReport(
          ctx,
          'skill-install-plan',
          'Skill installation plan',
          this.skillInstallPlanPresentationService.renderReport({ recipeId }),
          { recipeId },
        );
        return;
      }
      if (lowerRemainder.startsWith('recommend ')) {
        const recommendFor = remainder.slice('recommend '.length).trim() || null;
        await this.replySkillReport(
          ctx,
          'skill-install-recommendation',
          'Recomendaction de skills',
          this.skillInstallPlanPresentationService.renderReport({ recommendFor }),
          { recommendFor },
        );
        return;
      }
      const report = this.skillInstallPlanPresentationService.renderReport({
        selectedId: remainder || null,
        query: remainder || null,
      });
      await this.replySkillReport(ctx, 'skill-install-plan', 'Skill installation plan', report, {
        query: remainder || null,
      });
      return;
    }

    if (lower === 'mcp' || lower.startsWith('mcp ')) {
      const query = normalizedArgs.slice(3).trim() || null;
      await this.replySkillReport(
        ctx,
        'skill-mcp-sidecar',
        'Skill MCP sidecar',
        this.skillMcpSidecarService.renderReport({ query }),
        { query },
      );
      return;
    }

    if (lower.startsWith('recipe ')) {
      const recipeId = normalizedArgs.slice('recipe '.length).trim() || null;
      await this.replySkillReport(
        ctx,
        'skill-install-plan',
        'Skill installation plan',
        this.skillInstallPlanPresentationService.renderReport({ recipeId }),
        { recipeId },
      );
      return;
    }

    if (lower.startsWith('recommend ')) {
      const recommendFor = normalizedArgs.slice('recommend '.length).trim() || null;
      await this.replySkillReport(
        ctx,
        'skill-install-recommendation',
        'Recomendaction de skills',
        this.skillInstallPlanPresentationService.renderReport({ recommendFor }),
        { recommendFor },
      );
      return;
    }

    await this.replySkillReport(
      ctx,
      'skill-library',
      'Skill library',
      this.skillLibraryPresentationService.renderReport({
        selectedId: normalizedArgs || null,
        query: normalizedArgs || null,
      }),
      { query: normalizedArgs || null },
    );
  }

  private async replySkillReport(
    ctx: Context,
    id: string,
    title: string,
    report: string,
    metadata: Record<string, unknown> = {},
    policyProfile = 'telegram-skill-catalog',
  ): Promise<void> {
    await replyWithTelegramSurfaceResponse(
      ctx,
      buildReportSurfaceResponse({
        id: `telegram-${id}`,
        title,
        text: report,
        policyProfile,
        metadata,
      }),
    );
  }

  private isSkillBridgeActivationCommand(lower: string): boolean {
    return lower === 'bridge'
      || lower.startsWith('bridge ')
      || lower === 'origin'
      || lower.startsWith('origin ')
      || lower === 'run'
      || lower.startsWith('run ')
      || lower === 'invoke'
      || lower.startsWith('invoke ')
      || lower === 'dry-run'
      || lower.startsWith('dry-run ')
      || lower === 'dryrun'
      || lower.startsWith('dryrun ')
      || lower === 'live'
      || lower.startsWith('live ');
  }
}
