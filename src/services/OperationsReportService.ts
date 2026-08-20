import type { PermissionService } from './PermissionService.js';
import type { TaskManager } from '../orchestrator/TaskManager.js';
import type { Task } from '../contracts/TaskContract.js';
import type { RuntimeDiagnosticsService } from './RuntimeDiagnosticsService.js';
import { OperationsDashboardService, OperationsCockpitService } from './OperationsDashboardService.js';
import type { OperatorBriefService } from '../observability/OperatorBriefService.js';
import type { ProductObservabilityService } from '../observability/ProductObservabilityService.js';
import type {
  SessionContinuityService,
} from '../runtime/context/SessionContinuityService.js';
import { OperationsReportNarrativeSupport } from '../domain/observability/infrastructure/operations-report/OperationsReportNarrativeSupport.js';

import { OperationsReportOverviewSupport } from '../domain/observability/infrastructure/operations-report/OperationsReportOverviewSupport.js';
import { formatOperationsReportText } from '../domain/observability/infrastructure/operations-report/OperationsReportTextFormatter.js';
import type {
  OperationsReportOverviewReaders,
  OperationsReportRuntime,
  OperationsReportSnapshot,
  OperationsReportTextInput,
  PermissionListEntry,
} from '../domain/observability/infrastructure/operations-report/OperationsReportTypes.js';

export type {
  OperationsReportOverviewAction,
  OperationsReportOverviewReaders,
  OperationsReportOverviewSection,
  OperationsReportOverviewSnapshotLike,
  OperationsReportRuntime,
  OperationsReportSnapshot,
  OperationsReportTextInput,
  PermissionListEntry,
} from '../domain/observability/infrastructure/operations-report/OperationsReportTypes.js';

export class OperationsReportService {
  private readonly now: () => Date;
  private readonly narrativeSupport: OperationsReportNarrativeSupport;
  private readonly overviewSupport: OperationsReportOverviewSupport;

  constructor(
    private readonly operationsCockpit: OperationsCockpitService,
    private readonly runtimeDiagnostics?: RuntimeDiagnosticsService | null,
    private readonly taskManager?: TaskManager | null,
    private readonly permissionService?: PermissionService | null,
    private readonly operatorBriefService?: Pick<OperatorBriefService, 'readSnapshot'> | null,
    private readonly sessionContinuityService?: Pick<SessionContinuityService, 'buildSnapshot'> | null,
    private readonly continuityUserId: string | null = null,
    runtime: OperationsReportRuntime = {},
    private readonly productObservabilityService?: Pick<ProductObservabilityService, 'buildSnapshot'> | null,
  ) {
    this.now = runtime.now || (() => new Date());
    this.narrativeSupport = new OperationsReportNarrativeSupport(this.now);
    this.overviewSupport = new OperationsReportOverviewSupport();
  }

  public async buildSnapshot(
    referenceDate: Date = this.now(),
    overviewReaders: OperationsReportOverviewReaders = {},
  ): Promise<OperationsReportSnapshot> {
    const cockpit = this.operationsCockpit.readSnapshot();
    const operatorBrief = this.operatorBriefService?.readSnapshot() || null;
    const diagnostics = this.runtimeDiagnostics?.buildSnapshot() || null;
    const recentTasks = this.taskManager?.getRecentTasks(120) || [];
    const continuity = this.sessionContinuityService && this.continuityUserId
      ? this.sessionContinuityService.buildSnapshot('operations-report', 'report:daily', this.continuityUserId)
      : null;
    const tasksLast24h = this.filterTasksSince(recentTasks, new Date(referenceDate.getTime() - 24 * 60 * 60 * 1000));

    const [productObservability, overviews, pendingPermissions] = await Promise.all([
      this.productObservabilityService
        ? this.productObservabilityService.buildSnapshot(referenceDate)
        : Promise.resolve(null),
      this.overviewSupport.buildOverviewSections(overviewReaders),
      this.permissionService
        ? Promise.resolve(this.permissionService.listRequests('pending', 20))
            .then((items) => ((items as unknown as PermissionListEntry[]) || []))
        : Promise.resolve([] as PermissionListEntry[]),
    ]);

    const completedLast24h = tasksLast24h.filter((task) => task.status === 'completed').length;
    const failedLast24h = tasksLast24h.filter((task) =>
      ['failed', 'rejected', 'cancelled'].includes(String(task.status)),
    ).length;
    const waitingApprovalLast24h = tasksLast24h.filter((task) => task.status === 'waiting_approval').length;
    const activeCount = diagnostics?.tasks.activeCount || 0;
    const topExecutors = this.buildExecutorSummary(tasksLast24h);
    const tenantSummary = this.narrativeSupport.getTenantSummary(cockpit);

    const executiveSummary = [
      cockpit.headline,
      ...(operatorBrief ? [`Briefing the operator: ${operatorBrief.headline}`] : []),
      ...(continuity ? [`Continuidade: ${continuity.suggestedAction.reason}`] : []),
      ...(overviews.operational ? [`Overview operational: ${overviews.operational.operatorSummary}`] : []),
      ...(overviews.trust ? [`Overview de trust: ${overviews.trust.operatorSummary}`] : []),
      ...(overviews.product ? [`Overview de produto: ${overviews.product.operatorSummary}`] : []),
      ...(productObservability ? this.overviewSupport.buildProductExecutiveSummary(productObservability) : []),
      `${cockpit.summary.readySidecars}/${cockpit.summary.enabledSidecars} sidecars habilitados are ready.`,
      this.narrativeSupport.buildChannelSummary(cockpit),
      this.narrativeSupport.buildChannelProviderDoctorSummary(cockpit),
      this.narrativeSupport.buildRemoteTransportDoctorSummary(cockpit),
      this.narrativeSupport.buildTenantSummary(cockpit),
      this.narrativeSupport.buildNodeMeshSummary(cockpit),
      this.narrativeSupport.buildZavorthBridgeMobileSummary(cockpit),
      `Host com ${cockpit.summary.freeDiskPercent}% de espaco livre e publish ${cockpit.summary.publishAgeLabel}.`,
      this.narrativeSupport.buildMaintenanceAutomationSummary(cockpit),
    ];

    const runtime = {
      uptimeLabel: cockpit.runtime.uptimeLabel,
      memoryLabel: cockpit.runtime.memoryLabel,
      platformLabel: cockpit.runtime.platformLabel,
    };

    const operations = {
      sidecarsLabel: `${cockpit.summary.readySidecars}/${cockpit.summary.enabledSidecars} ready`,
      channelsLabel: this.narrativeSupport.buildChannelLabel(cockpit),
      channelProviderDoctorLabel: this.narrativeSupport.buildChannelProviderDoctorLabel(cockpit),
      remoteTransportDoctorLabel: this.narrativeSupport.buildRemoteTransportDoctorLabel(cockpit),
      tenantsLabel: this.narrativeSupport.buildTenantLabel(cockpit),
      nodeMeshSmokeLabel: this.narrativeSupport.buildNodeMeshLabel(cockpit),
      publishLabel: cockpit.summary.publishAgeLabel,
      storageLabel: `${cockpit.summary.freeDiskPercent}% livre`,
      automationLabel: this.narrativeSupport.buildMaintenanceAutomationLabel(cockpit),
    };

    const alerts = cockpit.alerts.slice(0, 4).map((alert) => ({
      source: alert.source,
      title: alert.title,
      detail: alert.detail,
    }));

    const actions = cockpit.actions.slice(0, 4).map((action) => ({
      label: action.label,
      command: action.command,
      reason: action.reason,
    }));

    const normalizedPermissions = pendingPermissions.slice(0, 4).map((permission) => ({
      executor: String(permission.executor || 'n/d'),
      kind: String(permission.kind || 'n/d'),
      reason: String(permission.reason || 'without detalhe.').slice(0, 120),
    }));

    const productObservabilitySummary = productObservability
      ? this.overviewSupport.buildProductObservabilitySummary(productObservability)
      : null;

    const operatorBriefSnapshot = operatorBrief
      ? {
          posture: operatorBrief.posture,
          headline: operatorBrief.headline,
          nextAction: {
            label: operatorBrief.nextAction.label,
            command: operatorBrief.nextAction.command,
            reason: operatorBrief.nextAction.reason,
          },
        }
      : null;

    const tenants = {
      totalCount: tenantSummary.totalCount,
      sharedCount: tenantSummary.sharedCount,
      personalCount: tenantSummary.personalCount,
      pendingOnboardingCount: tenantSummary.pendingOnboardingCount,
      publicServerCount: tenantSummary.publicServerCount,
      byPlatform: { ...tenantSummary.byPlatform },
      recent: tenantSummary.recent.map((tenant) => ({
        tenantId: tenant.tenantId,
        platform: tenant.platform,
        policyProfile: tenant.policyProfile,
        onboardingStatus: tenant.onboardingStatus,
        lastSeenAt: tenant.lastSeenAt,
      })),
    };

    const tasks = {
      activeCount,
      completedLast24h,
      failedLast24h,
      waitingApprovalLast24h,
      topExecutors,
    };

    const textInput: OperationsReportTextInput = {
      generatedAt: referenceDate.toISOString(),
      operatorBrief: operatorBriefSnapshot,
      continuity,
      executiveSummary,
      runtime,
      operations,
      tenants,
      tasks,
      productObservability: productObservabilitySummary,
      overviews,
      pendingPermissions: normalizedPermissions,
      alerts,
      actions,
    };

    return {
      generatedAt: referenceDate.toISOString(),
      headline: cockpit.headline,
      operatorBrief: operatorBriefSnapshot,
      continuity,
      executiveSummary,
      runtime,
      operations,
      tenants,
      tasks,
      productObservability: productObservabilitySummary,
      overviews,
      pendingPermissions: normalizedPermissions,
      alerts,
      actions,
      text: formatOperationsReportText(textInput),
    };
  }

  public async buildTextReport(
    referenceDate: Date = this.now(),
    overviewReaders: OperationsReportOverviewReaders = {},
  ): Promise<string> {
    const snapshot = await this.buildSnapshot(referenceDate, overviewReaders);
    return snapshot.text;
  }

  private filterTasksSince(tasks: Task[], since: Date): Task[] {
    const cutoff = since.getTime();
    return tasks.filter((task) => {
      const updatedAt = Date.parse(String(task.updated_at || ''));
      return Number.isFinite(updatedAt) && updatedAt >= cutoff;
    });
  }

  private buildExecutorSummary(tasks: Task[]): string[] {
    const counts = new Map<string, number>();
    for (const task of tasks) {
      const key = String(task.executor_used || task.command_type || 'unknown').trim();
      if (!key) {
        continue;
      }
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([executor, count]) => `${executor}:${count}`);
  }
}
