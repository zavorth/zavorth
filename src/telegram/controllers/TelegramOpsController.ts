import { Context } from 'grammy';
import { ZavorthBridgePreferenceStore } from '../../agents/ZavorthBridgePreferenceStore.js';
import { AuditLogger } from '../../monitoring/AuditLogger.js';
import { ExecutionGateway } from '../../execution/ExecutionGateway.js';
import { LogRepository } from '../../storage/LogRepository.js';
import { DashboardService } from '../../services/DashboardService.js';
import { DailyReportService } from '../../services/DailyReportService.js';
import { DemoModeService } from '../../services/DemoModeService.js';
import { DemoGuideService } from '../../services/DemoGuideService.js';
import { OperatorModeService } from '../../services/OperatorModeService.js';
import { PresentationModeService } from '../../services/PresentationModeService.js';
import { RemoteModeManager } from '../../services/RemoteModeManager.js';
import type { RemoteModeCommand } from '../../services/RemoteModeManager.js';
import { RuntimeDiagnosticsService } from '../../services/RuntimeDiagnosticsService.js';
import { RuntimeAccessManifestService } from '../../runtime/access/RuntimeAccessManifestService.js';
import { RuntimeBootstrapService } from '../../runtime/access/RuntimeBootstrapService.js';
import { RuntimeOfficialRemoteAccessService } from '../../runtime/access/RuntimeOfficialRemoteAccessService.js';
import type { SidecarStatusCard } from '../../services/SidecarStatusService.js';
import { AutoRepairService } from '../../services/AutoRepairService.js';
import { SupervisedRuntimeService } from '../../services/SupervisedRuntimeService.js';
import { WslControlService } from '../../services/WslControlService.js';
import { IntegrationHubService } from '../../services/IntegrationHubService.js';
import { CapabilityLifecycleService } from '../../services/CapabilityLifecycleService.js';
import {
  ProductObservabilityService,
  type ProductObservabilitySnapshot,
} from '../../observability/ProductObservabilityService.js';
import { TelegramOpsAdministrationService } from './TelegramOpsAdministrationService.js';
import { TelegramOpsInsightService } from './TelegramOpsInsightService.js';
import { TelegramOpsModeCommandService } from './TelegramOpsModeCommandService.js';
import {
  TelegramOpsRuntimeCommandService,
  type TelegramOpsRuntimeMaintenanceCommand,
} from './TelegramOpsRuntimeCommandService.js';
import { ZavorthRuntimeReadinessService } from '../../services/ZavorthRuntimeReadinessService.js';
import { ZavorthRuntimeGuidedFixesService } from '../../services/ZavorthRuntimeGuidedFixesService.js';
import { ZavorthRuntimeReadinessUxService } from '../../services/ZavorthRuntimeReadinessUxService.js';
import { ZavorthReadyToGoService } from '../../services/ZavorthReadyToGoService.js';
import { ZavorthStayOnlineService } from '../../services/ZavorthStayOnlineService.js';
import { ZavorthExternalAgentOnboardingService } from '../../services/ZavorthExternalAgentOnboardingService.js';
import { ZavorthExternalAgentMigrationPackService } from '../../services/ZavorthExternalAgentMigrationPackService.js';
import { ZavorthExternalAgentGatewayService } from '../../services/ZavorthExternalAgentGatewayService.js';
import type { ZavorthExternalAgentMigrationPreset } from '../../contracts/ZavorthExternalAgentMigrationPackContract.js';

export class TelegramOpsController {
  private readonly administrationCommands: TelegramOpsAdministrationService;
  private readonly insightCommands: TelegramOpsInsightService;
  private readonly modeCommands: TelegramOpsModeCommandService;
  private readonly runtimeCommands: TelegramOpsRuntimeCommandService;

  constructor(
    logRepo: LogRepository,
    auditLogger: AuditLogger,
    executionGateway: ExecutionGateway,
    zavorthBridgePreferenceStore: ZavorthBridgePreferenceStore,
    dashboardService: DashboardService,
    dailyReportService: DailyReportService,
    demoModeService: DemoModeService,
    demoGuideService: DemoGuideService,
    operatorModeService: OperatorModeService,
    presentationModeService: PresentationModeService,
    remoteModeManager: RemoteModeManager,
    runtimeDiagnostics: RuntimeDiagnosticsService,
    wslControl: WslControlService,
    supervisedRuntimeService: SupervisedRuntimeService = new SupervisedRuntimeService(),
    autoRepairService: AutoRepairService = new AutoRepairService(),
    integrationHubService: IntegrationHubService = new IntegrationHubService(),
    productObservabilityService: ProductObservabilityService = new ProductObservabilityService(),
    capabilityLifecycleService: CapabilityLifecycleService = new CapabilityLifecycleService(),
    runtimeAccessManifestService: RuntimeAccessManifestService = new RuntimeAccessManifestService(),
    runtimeBootstrapService: RuntimeBootstrapService = new RuntimeBootstrapService(),
    runtimeOfficialRemoteAccessService: RuntimeOfficialRemoteAccessService = new RuntimeOfficialRemoteAccessService(),
  ) {
    this.administrationCommands = new TelegramOpsAdministrationService({
      auditLogger,
      executionGateway,
    });
    this.insightCommands = new TelegramOpsInsightService({
      zavorthBridgePreferenceStore,
      demoModeService,
      integrationHubService,
      operatorModeService,
      presentationModeService,
      productObservabilityService,
      runtimeDiagnostics,
      capabilityLifecycleService,
    });
    this.modeCommands = new TelegramOpsModeCommandService({
      dailyReportService,
      demoGuideService,
      demoModeService,
      operatorModeService,
      presentationModeService,
    });
    this.runtimeCommands = new TelegramOpsRuntimeCommandService({
      dashboardService,
      remoteModeManager,
      wslControl,
      supervisedRuntimeService,
      autoRepairService,
      runtimeAccessManifestService,
      runtimeBootstrapService,
      runtimeOfficialRemoteAccessService,
    });
  }

  public async handleReadiness(ctx: Context): Promise<void> {
    const readiness = await new ZavorthRuntimeReadinessService().buildSnapshot({
      userId: String(ctx.from?.id || 'telegram-operator'),
      sessionId: `telegram-${String(ctx.chat?.id || 'readiness')}`,
      workspaceHint: process.cwd(),
    });
    const uxService = new ZavorthRuntimeReadinessUxService();
    const ux = uxService.buildSnapshot(readiness);
    await ctx.reply(uxService.renderTelegram(ux), {
      reply_markup: ux.telegramProjection.replyMarkup as any,
    });
  }

  public async handleReadinessFixes(ctx: Context): Promise<void> {
    const readiness = await new ZavorthRuntimeReadinessService().buildSnapshot({
      userId: String(ctx.from?.id || 'telegram-operator'),
      sessionId: `telegram-${String(ctx.chat?.id || 'guided-fixes')}`,
      workspaceHint: process.cwd(),
    });
    const service = new ZavorthRuntimeGuidedFixesService();
    const fixes = service.buildSnapshot(readiness);
    await ctx.reply(service.renderTelegram(fixes), {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Readiness', callback_data: '/readiness' },
            { text: 'Providers', callback_data: '/models' },
          ],
          [
            { text: 'Dashboard', callback_data: '/dashboard' },
            { text: 'Approvals', callback_data: '/echoapprovals' },
          ],
        ],
      } as any,
    });
  }

  public async handleReadyToGo(ctx: Context): Promise<void> {
    const service = new ZavorthReadyToGoService();
    const readyToGo = await service.buildSnapshot({
      refreshProviders: false,
      userId: String(ctx.from?.id || 'telegram-operator'),
      sessionId: `telegram-${String(ctx.chat?.id || 'ready-to-go')}`,
      workspaceHint: process.cwd(),
    });
    await ctx.reply(service.renderTelegram(readyToGo), {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Readiness', callback_data: '/readiness' },
            { text: 'Fixes', callback_data: '/fixes' },
          ],
          [
            { text: 'Dashboard', callback_data: '/dashboard' },
            { text: 'Approvals', callback_data: '/echoapprovals' },
          ],
        ],
      } as any,
    });
  }

  public async handleStayOnline(ctx: Context): Promise<void> {
    const service = new ZavorthStayOnlineService();
    const stayOnline = await service.buildSnapshot({
      refreshProviders: false,
      userId: String(ctx.from?.id || 'telegram-operator'),
      sessionId: `telegram-${String(ctx.chat?.id || 'stay-online')}`,
      workspaceHint: process.cwd(),
    });
    await ctx.reply(service.renderTelegram(stayOnline), {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Ready', callback_data: '/ready' },
            { text: 'Readiness', callback_data: '/readiness' },
          ],
          [
            { text: 'Fixes', callback_data: '/fixes' },
            { text: 'Dashboard', callback_data: '/dashboard' },
          ],
        ],
      } as any,
    });
  }

  public async handleExternalAgentOnboarding(ctx: Context, args = ''): Promise<void> {
    const parsed = parseExternalAgentOnboardingTelegramArgs(args);
    const service = new ZavorthExternalAgentOnboardingService();
    const onboarding = service.buildSnapshot({
      ...parsed,
      requestedBy: String(ctx.from?.id || 'telegram-operator'),
      writeSnapshot: false,
    });
    await ctx.reply(service.renderText(onboarding), {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Status', callback_data: '/status' },
            { text: 'ACP', callback_data: '/agbridge' },
          ],
          [
            { text: 'Readiness', callback_data: '/readiness' },
            { text: 'Dashboard', callback_data: '/dashboard' },
          ],
        ],
      } as any,
    });
  }

  public async handleExternalAgentMigrationPack(ctx: Context, args = ''): Promise<void> {
    const parsed = parseExternalAgentMigrationTelegramArgs(args);
    const service = new ZavorthExternalAgentMigrationPackService();
    const snapshot = service.buildSnapshot({
      ...parsed,
      requestedBy: String(ctx.from?.id || 'telegram-operator'),
      writeReceipt: false,
    });
    await ctx.reply(service.renderText(snapshot), {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Onboarding', callback_data: '/agentonboarding' },
            { text: 'External Agents', callback_data: '/externalagent' },
          ],
          [
            { text: 'Approvals', callback_data: '/echoapprovals' },
            { text: 'Readiness', callback_data: '/readiness' },
          ],
        ],
      } as any,
    });
  }

  public async handleExternalAgentGateway(ctx: Context, args = ''): Promise<void> {
    const service = new ZavorthExternalAgentGatewayService();
    const parsed = parseExternalAgentGatewayTelegramArgs(args);
    if (parsed.action === 'run') {
      const receipt = await service.invoke({
        profileId: parsed.id || '',
        prompt: parsed.prompt || '',
        approvalGranted: parsed.approved,
        dryRun: !parsed.approved,
        requestedBy: String(ctx.from?.id || 'telegram-operator'),
      });
      await ctx.reply(service.renderReceiptText(receipt), {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Approvals', callback_data: '/echoapprovals' },
              { text: 'Readiness', callback_data: '/readiness' },
            ],
          ],
        } as any,
      });
      return;
    }

    const registry = service.buildRegistrySnapshot();
    await ctx.reply(service.renderRegistryText(registry), {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Onboarding', callback_data: '/agentonboarding' },
            { text: 'ACP', callback_data: '/agbridge' },
          ],
          [
            { text: 'Dashboard', callback_data: '/dashboard' },
            { text: 'Readiness', callback_data: '/readiness' },
          ],
        ],
      } as any,
    });
  }

  public async handleStatus(ctx: Context): Promise<void> {
    await this.insightCommands.handleStatus(ctx);
  }

  public async handleCapabilities(ctx: Context, args = ''): Promise<void> {
    await this.insightCommands.handleCapabilities(ctx, args);
  }

  public async handleProfile(ctx: Context, args: string): Promise<void> {
    await this.insightCommands.handleProfile(ctx, args);
  }

  public async handleEnable(ctx: Context, args: string): Promise<void> {
    await this.insightCommands.handleEnable(ctx, args);
  }

  public async handleDisable(ctx: Context, args: string): Promise<void> {
    await this.insightCommands.handleDisable(ctx, args);
  }

  public async handleIntegrations(ctx: Context, args: string): Promise<void> {
    await this.insightCommands.handleIntegrations(ctx, args);
  }

  public async handleConnect(ctx: Context, args: string): Promise<void> {
    await this.insightCommands.handleConnect(ctx, args);
  }

  public async handleOperatorMode(ctx: Context, args: string): Promise<void> {
    await this.modeCommands.handleOperatorMode(ctx, args);
  }

  public async handlePresentationMode(ctx: Context, args: string): Promise<void> {
    await this.modeCommands.handlePresentationMode(ctx, args);
  }

  public async handleDemo(ctx: Context, args: string): Promise<void> {
    await this.modeCommands.handleDemo(ctx, args);
  }

  public async handleDailyReport(ctx: Context, args: string): Promise<void> {
    await this.modeCommands.handleDailyReport(ctx, args);
  }

  public async buildModelsReply(): Promise<string> {
    return this.insightCommands.buildModelsReply();
  }

  public async handleModels(ctx: Context): Promise<void> {
    await this.insightCommands.handleModels(ctx);
  }

  public parseRemoteModeCommand(rawText: string): RemoteModeCommand | null {
    return this.runtimeCommands.parseRemoteModeCommand(rawText);
  }

  public parseRuntimeMaintenanceCommand(
    rawText: string,
  ): TelegramOpsRuntimeMaintenanceCommand | null {
    return this.runtimeCommands.parseRuntimeMaintenanceCommand(rawText);
  }

  public async handleChanges(ctx: Context): Promise<void> {
    await this.runtimeCommands.handleChanges(ctx);
  }

  public async handleAccess(ctx: Context, args: string): Promise<void> {
    await this.runtimeCommands.handleAccess(ctx, args);
  }

  public async handleBootstrap(ctx: Context): Promise<void> {
    await this.runtimeCommands.handleBootstrap(ctx);
  }

  public async handleSelfUpdate(ctx: Context, args: string): Promise<void> {
    await this.runtimeCommands.handleSelfUpdate(ctx, args);
  }

  public async handleAutoRepair(ctx: Context, args: string): Promise<void> {
    await this.runtimeCommands.handleAutoRepair(ctx, args);
  }

  public async handleRemoteMode(ctx: Context, mode: RemoteModeCommand): Promise<void> {
    await this.runtimeCommands.handleRemoteMode(ctx, mode);
  }

  public formatSystemStatusReply(snapshot: {
    process: {
      uptimeSeconds: number;
      rssMb: number;
      heapMb: number;
      platform: string;
      cpuArch: string;
    };
    runtime?: {
      hostSupervisor?: { pid: number | null; alive: boolean };
      telegramWorker?: { pid: number | null; alive: boolean };
    };
    sidecars?: {
      AIGateway?: SidecarStatusCard;
      ZavorthTerminal?: SidecarStatusCard;
    };
    tasks?: {
      activeCount: number;
      staleCount?: number;
      byStatus: Record<string, number>;
      recentFailures: Array<{
        taskId: string;
        executor: string | null;
        commandType: string;
        errorSummary: string | null;
      }>;
    };
  }, productObservability: ProductObservabilitySnapshot | null = null): string {
    return this.insightCommands.formatSystemStatusReply(snapshot, productObservability);
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
    const resumableWorkflow = snapshot.learning?.workflowResumeStages?.[0]
      || snapshot.workflows?.recent?.find((entry) => Boolean(entry.resume_stage_label))
      || null;
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
      const stageLabel = String((resumableWorkflow as any).stage_label || (resumableWorkflow as any).resume_stage_label || '').trim();
      lines.push(
        `- Workflow para retomar: ${workflowLabel}${stageLabel ? ` · ${stageLabel}` : ''}.`,
      );
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
  */

  public formatModelsReply(currentModel: string, preferredZavorthBridgeModel: string | null): string {
    return this.insightCommands.formatModelsReply(currentModel, preferredZavorthBridgeModel);
  }

  public formatCapabilitiesReply(): string {
    return this.insightCommands.formatCapabilitiesReply();
  }

  public formatRemoteModeReply(result: any, mode: string): string {
    return this.runtimeCommands.formatRemoteModeReply(result, mode);
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
    return this.modeCommands.formatOperatorModeReply(status, mode);
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
    return this.modeCommands.formatPresentationModeReply(status, mode);
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
    return this.modeCommands.formatDemoModeReply(status, mode);
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
    return this.modeCommands.formatDailyReportStatusReply(status, mode);
  }

  public async handleAudit(ctx: Context, args: string): Promise<void> {
    await this.administrationCommands.handleAudit(ctx, args);
  }

  public async handleOperationalMode(ctx: Context, args: string): Promise<void> {
    await this.administrationCommands.handleOperationalMode(ctx, args);
  }

  public async handleDashboard(ctx: Context): Promise<void> {
    await this.runtimeCommands.handleDashboard(ctx);
  }

  public async handleWslCommand(ctx: Context, args: string): Promise<void> {
    await this.runtimeCommands.handleWslCommand(ctx, args);
  }
}

function parseExternalAgentGatewayTelegramArgs(args: string): {
  action: 'list' | 'run';
  id: string | null;
  prompt: string | null;
  approved: boolean;
} {
  const raw = String(args || '').trim();
  if (!raw || /^list\b/i.test(raw)) {
    return { action: 'list', id: null, prompt: null, approved: false };
  }
  const approvalPattern = /\b(approve-external-execution|approve external execution|approved external execution|aprovo executar agente|autorizo executar agente|pode executar agente)\b/i;
  const approved = approvalPattern.test(raw);
  const withoutApprovalWords = raw.replace(approvalPattern, '').trim();
  const match = withoutApprovalWords.match(/^run\s+([a-zA-Z0-9._:-]+)(?:\s+--\s+([\s\S]+)|\s+([\s\S]+))?$/i);
  if (!match) {
    return { action: 'list', id: null, prompt: null, approved };
  }
  return {
    action: 'run',
    id: match[1],
    prompt: String(match[2] || match[3] || '').trim() || null,
    approved,
  };
}

function parseExternalAgentOnboardingTelegramArgs(args: string): {
  consent: boolean;
  pathHint: string | null;
  approximatePathHint: string | null;
  commandHint: string | null;
  endpointHint: string | null;
} {
  const raw = String(args || '').trim();
  const consent = /\b(consent|autorizo|autorizei|pode|read-only|somente leitura)\b/i.test(raw);
  const cleaned = raw
    .replace(/\b(consent|autorizo|autorizei|pode|read-only|somente leitura)\b/gi, '')
    .trim();
  const lower = cleaned.toLowerCase();
  const readRest = (prefix: string): string | null => {
    if (!lower.startsWith(prefix)) return null;
    const value = cleaned.slice(prefix.length).trim();
    return value || null;
  };

  const pathHint = readRest('path ') || readRest('pasta ');
  const approximatePathHint = readRest('approx ') || readRest('aprox ') || readRest('aproximada ');
  const commandHint = readRest('command ') || readRest('cli ') || readRest('comando ');
  const endpointHint = readRest('endpoint ') || readRest('url ');

  return {
    consent,
    pathHint,
    approximatePathHint,
    commandHint,
    endpointHint,
  };
}

function parseExternalAgentMigrationTelegramArgs(args: string): {
  consent: boolean;
  pathHint: string | null;
  approximatePathHint: string | null;
  commandHint: string | null;
  endpointHint: string | null;
  preset: ZavorthExternalAgentMigrationPreset | null;
  apply: boolean;
  approvalId: string | null;
  overwrite: boolean;
  registerAsArm: boolean;
} {
  const raw = String(args || '').trim();
  const consent = /\b(consent|autorizo|autorizei|pode|read-only|somente leitura)\b/i.test(raw);
  const apply = /\b(apply|aplicar|importar agora|migrar agora)\b/i.test(raw);
  const overwrite = /\b(overwrite|sobrescrever)\b/i.test(raw);
  const registerAsArm = /\b(register-as-arm|usar como braco|registrar como braco|braço)\b/i.test(raw);
  const approvalId = readTelegramOption(raw, 'approval-id') || readTelegramOption(raw, 'approval') || readTelegramOption(raw, 'aprovacao');
  const preset = normalizeTelegramMigrationPreset(readTelegramOption(raw, 'preset') || readTelegramOption(raw, 'modo'));
  const cleaned = raw
    .replace(/\b(consent|autorizo|autorizei|pode|read-only|somente leitura|apply|aplicar|importar agora|migrar agora|overwrite|sobrescrever|register-as-arm|usar como braco|registrar como braco|braço)\b/gi, '')
    .replace(/\s+--(?:approval-id|approval|aprovacao|preset|modo)(?:=|\s+)\S+/gi, '')
    .trim();
  const lower = cleaned.toLowerCase();
  const readRest = (prefix: string): string | null => {
    if (!lower.startsWith(prefix)) return null;
    const value = cleaned.slice(prefix.length).trim();
    return value || null;
  };

  return {
    consent,
    pathHint: readRest('path ') || readRest('pasta '),
    approximatePathHint: readRest('approx ') || readRest('aprox ') || readRest('aproximada '),
    commandHint: readRest('command ') || readRest('cli ') || readRest('comando '),
    endpointHint: readRest('endpoint ') || readRest('url '),
    preset,
    apply,
    approvalId,
    overwrite,
    registerAsArm,
  };
}

function readTelegramOption(raw: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(raw || '').match(new RegExp(`(?:^|\\s)--${escaped}(?:=|\\s+)(\\S+)`, 'i'));
  return match?.[1]?.trim() || null;
}

function normalizeTelegramMigrationPreset(value: string | null): ZavorthExternalAgentMigrationPreset | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (['preview', 'user-data', 'capabilities', 'full'].includes(normalized)) {
    return normalized as ZavorthExternalAgentMigrationPreset;
  }
  if (normalized === 'usuario' || normalized === 'dados') return 'user-data';
  if (normalized === 'capacidades') return 'capabilities';
  if (normalized === 'completo') return 'full';
  return null;
}
