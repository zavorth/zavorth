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
