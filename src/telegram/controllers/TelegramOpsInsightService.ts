import { Context } from 'grammy';
import { config } from '../../config/index.js';
import { ZavorthBridgePreferenceStore } from '../../agents/ZavorthBridgePreferenceStore.js';
import { IntegrationHubService } from '../../services/IntegrationHubService.js';
import { DemoModeService } from '../../services/DemoModeService.js';
import { OperatorModeService } from '../../services/OperatorModeService.js';
import { PresentationModeService } from '../../services/PresentationModeService.js';
import { RuntimeDiagnosticsService } from '../../services/RuntimeDiagnosticsService.js';
import { CapabilityLifecycleService } from '../../services/CapabilityLifecycleService.js';
import {
  ProductObservabilityService,
  type ProductObservabilitySnapshot,
} from '../../services/ProductObservabilityService.js';
import {
  TelegramOpsInsightPresentationService,
  type TelegramOpsSystemStatusSnapshot,
} from './TelegramOpsInsightPresentationService.js';
import { replyWithTelegramSurfaceResponse } from '../TelegramSurfaceResponseSender.js';

export type TelegramOpsInsightServiceDeps = {
  zavorthBridgePreferenceStore: ZavorthBridgePreferenceStore;
  demoModeService: DemoModeService;
  integrationHubService: IntegrationHubService;
  operatorModeService: OperatorModeService;
  presentationModeService: PresentationModeService;
  productObservabilityService: ProductObservabilityService;
  runtimeDiagnostics: RuntimeDiagnosticsService;
  capabilityLifecycleService: CapabilityLifecycleService;
};

export class TelegramOpsInsightService {
  private readonly presentationService = new TelegramOpsInsightPresentationService();

  constructor(private readonly deps: TelegramOpsInsightServiceDeps) {}

  public async handleStatus(ctx: Context): Promise<void> {
    const snapshot = this.deps.runtimeDiagnostics.writeSnapshot();
    const productObservability = await this.deps.productObservabilityService
      .buildSnapshot()
      .catch(() => null);
    await replyWithTelegramSurfaceResponse(
      ctx,
      this.presentationService.buildSystemStatusSurfaceResponse(
        snapshot,
        {
          demoEnabled: this.deps.demoModeService.isEnabled(),
          operatorEnabled: this.deps.operatorModeService.isEnabled(),
          presentationEnabled: this.deps.presentationModeService.isEnabled(),
        },
        productObservability,
      ),
    );
  }

  public async handleCapabilities(ctx: Context, args = ''): Promise<void> {
    const capabilityId = String(args || '').trim().toLowerCase();
    if (capabilityId) {
      const snapshot = this.deps.capabilityLifecycleService.describeCapability(capabilityId);
      const manifest = this.deps.capabilityLifecycleService.getManifest(capabilityId);
      if (!snapshot || !manifest) {
        await ctx.reply(`Nao reconheci a capability "${capabilityId}". Veja /capabilities.`);
        return;
      }
      await ctx.reply(this.presentationService.formatCapabilityDetailReply(manifest, snapshot));
      return;
    }

    await ctx.reply(this.formatCapabilitiesReply());
  }

  public async handleProfile(ctx: Context, args: string): Promise<void> {
    const requestedProfile = String(args || '').trim();
    if (!requestedProfile) {
      await ctx.reply(this.presentationService.formatProfileReply(this.deps.capabilityLifecycleService.buildSnapshot()));
      return;
    }

    const nextProfile = this.deps.capabilityLifecycleService.setProfile(
      requestedProfile,
      ctx.from?.id?.toString() || 'unknown',
    );
    await ctx.reply(
      this.presentationService.formatProfileReply(
        this.deps.capabilityLifecycleService.buildSnapshot(),
        `Perfil alterado para ${nextProfile}. Reinicie os sidecars opcionais se quiser preaquecer a nova trilha.`,
      ),
    );
  }

  public async handleEnable(ctx: Context, args: string): Promise<void> {
    const tokens = String(args || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    const capabilityId = tokens[0] || '';
    const requestedScope = tokens[1] || 'once';
    const scope = requestedScope === 'once' || requestedScope === 'session' || requestedScope === 'host'
      ? requestedScope
      : 'once';
    if (!capabilityId) {
      await ctx.reply('Use /enable <capability> [once|session|host]. Veja ids em /capabilities.');
      return;
    }

    const updated = this.deps.capabilityLifecycleService.enableCapability(
      capabilityId,
      ctx.from?.id?.toString() || 'unknown',
      scope,
    );
    if (!updated) {
      await ctx.reply(`Nao reconheci a capability "${capabilityId}". Veja /capabilities.`);
      return;
    }

    const approval = updated.approvalRequired
      ? this.deps.capabilityLifecycleService.buildApprovalRequest(
          capabilityId,
          ctx.from?.id?.toString() || 'unknown',
          `Habilitacao manual via /enable ${capabilityId}.`,
        )
      : null;

    await ctx.reply(this.presentationService.formatCapabilityToggleReply('enable', updated, approval));
  }

  public async handleDisable(ctx: Context, args: string): Promise<void> {
    const capabilityId = String(args || '').trim().toLowerCase();
    if (!capabilityId) {
      await ctx.reply('Use /disable <capability>. Veja ids em /capabilities.');
      return;
    }

    const updated = this.deps.capabilityLifecycleService.disableCapability(
      capabilityId,
      ctx.from?.id?.toString() || 'unknown',
    );
    if (!updated) {
      await ctx.reply(`Nao reconheci a capability "${capabilityId}". Veja /capabilities.`);
      return;
    }

    await ctx.reply(this.presentationService.formatCapabilityToggleReply('disable', updated, null));
  }

  public async handleIntegrations(ctx: Context, args: string): Promise<void> {
    const requestedId = String(args || '').trim();
    await ctx.reply(
      requestedId
        ? this.deps.integrationHubService.renderManifestReport(requestedId)
        : this.deps.integrationHubService.renderCatalogReport(),
    );
  }

  public async handleConnect(ctx: Context, args: string): Promise<void> {
    const rawArgs = String(args || '').trim();
    if (!rawArgs) {
      await ctx.reply('Use /connect <integracao>. Exemplos: /connect openrouter, /connect zerocloud.');
      return;
    }

    const tokens = rawArgs.split(/\s+/).filter(Boolean);
    const requestedId = tokens[0] || '';
    const explicitMode = tokens
      .slice(1)
      .find((entry) => ['api', 'cli', 'docker', 'browser', 'mcp'].includes(entry.toLowerCase()));
    const userId = ctx.from?.id?.toString() || 'unknown';

    await ctx.reply(
      this.deps.integrationHubService.renderConnectReport({
        requestedId,
        requestedBy: userId,
        selectedMode: explicitMode || null,
        persist: true,
      }),
    );
  }

  public async buildModelsReply(): Promise<string> {
    const currentModel = config.geminiModel || 'gemini-2.5-flash';
    const preferredZavorthBridgeModel = await this.deps.zavorthBridgePreferenceStore.getPreferredModel();
    return this.formatModelsReply(currentModel, preferredZavorthBridgeModel);
  }

  public async handleModels(ctx: Context): Promise<void> {
    const currentModel = config.geminiModel || 'gemini-2.5-flash';
    const preferredZavorthBridgeModel = await this.deps.zavorthBridgePreferenceStore.getPreferredModel();
    await replyWithTelegramSurfaceResponse(
      ctx,
      this.presentationService.buildModelsSurfaceResponse(currentModel, preferredZavorthBridgeModel),
    );
  }

  public formatSystemStatusReply(
    snapshot: TelegramOpsSystemStatusSnapshot,
    productObservability: ProductObservabilitySnapshot | null = null,
  ): string {
    return this.presentationService.formatSystemStatusReply(
      snapshot,
      {
        demoEnabled: this.deps.demoModeService.isEnabled(),
        operatorEnabled: this.deps.operatorModeService.isEnabled(),
        presentationEnabled: this.deps.presentationModeService.isEnabled(),
      },
      productObservability,
    );
  }

  public formatModelsReply(currentModel: string, preferredZavorthBridgeModel: string | null): string {
    return this.presentationService.formatModelsReply(currentModel, preferredZavorthBridgeModel);
  }

  public formatCapabilitiesReply(): string {
    return this.presentationService.formatCapabilitiesReply(this.deps.capabilityLifecycleService.buildSnapshot());
  }

  /*
  private formatProductObservabilityLines(snapshot: ProductObservabilitySnapshot | null): string[] {
    if (!snapshot) {
      return ['- Observabilidade de produto: indisponivel agora.'];
    }

    const lines: string[] = [];
    const topSurface = snapshot.surfaces?.sources?.[0] || null;
    const topRoute = snapshot.learning?.routes?.topSuccessful?.[0] || null;
    const highestFriction = snapshot.learning?.routes?.highestFriction?.[0] || null;
    const resumableWorkflow =
      snapshot.learning?.workflowResumeStages?.[0] ||
      snapshot.workflows?.recent?.find((entry) => Boolean(entry.resume_stage_label)) ||
      null;
    const topExecutor = snapshot.executors?.top?.[0] || null;
    const topPolicy = snapshot.learning?.approvedPolicies?.[0] || null;

    if (topSurface) {
      lines.push(`- Superficie mais ativa: ${topSurface.label} (${topSurface.count} pedido(s)).`);
    }

    if (topRoute) {
      lines.push(
        `- Melhor rota recente: ${topRoute.executor} em ${topRoute.kind}/${topRoute.subtype} (${topRoute.completed}/${topRoute.total} concluida(s)).`,
      );
    }

    if (resumableWorkflow) {
      const workflowLabel = String((resumableWorkflow as any).workflow || '').trim() || 'workflow';
      const stageLabel = String(
        (resumableWorkflow as any).stage_label || (resumableWorkflow as any).resume_stage_label || '',
      ).trim();
      lines.push(`- Workflow para retomar: ${workflowLabel}${stageLabel ? ` Â· ${stageLabel}` : ''}.`);
    }

    if (topExecutor) {
      lines.push(
        `- Executor em destaque: ${topExecutor.executor} (${Math.round(Number(topExecutor.success_rate || 0) * 100)}% de sucesso).`,
      );
    }

    if (highestFriction) {
      lines.push(
        `- Maior atrito recente: ${highestFriction.executor} em ${highestFriction.kind}/${highestFriction.subtype} (${highestFriction.failed} falha(s), ${highestFriction.waitingApproval} aguardando aprovacao).`,
      );
    }

    if (topPolicy) {
      lines.push(
        `- Politica mais reaproveitada: ${topPolicy.executor}/${topPolicy.kind} (${topPolicy.count} liberacao(oes)).`,
      );
    }

    if (lines.length === 0) {
      lines.push('- Observabilidade de produto: aguardando sinais suficientes nesta janela.');
    }

    return lines;
  }

  private describeRuntimeTaskStatus(status: string): string {
    switch (status) {
      case 'running':
        return 'executando';
      case 'waiting_approval':
        return 'aguardando aprovacao';
      case 'delivery_pending':
        return 'entregando';
      case 'planned':
        return 'planejadas';
      case 'approved':
        return 'aprovadas';
      default:
        return status.replace(/_/g, ' ');
    }
  }

  private formatSidecarStatusLine(sidecar: SidecarStatusCard | undefined, url: string | null | undefined): string {
    if (!sidecar) {
      return 'sem dados ainda.';
    }

    if (!sidecar.enabled) {
      return 'desativado.';
    }

    if (sidecar.ready) {
      return `pronto${url ? ` em ${url}` : ''}.`;
    }

    if (sidecar.running) {
      return `subindo${url ? ` em ${url}` : ''}.`;
    }

    return sidecar.message || 'ainda nao iniciado.';
  }
  */
}
