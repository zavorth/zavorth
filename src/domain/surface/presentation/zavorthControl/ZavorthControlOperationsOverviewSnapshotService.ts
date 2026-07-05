type LooseRecord = any;
import { ZavorthOperationalOverviewService } from '../../../../services/ZavorthOperationalOverviewService.js';
import { ZavorthTrustOverviewService } from '../../../../services/ZavorthTrustOverviewService.js';
import { ZavorthProductOverviewService } from '../../../../services/ZavorthProductOverviewService.js';
import { InternalControlPlaneCatalogApiService } from '../../../../api/internal/InternalControlPlaneCatalogApiService.js';
import { ZavorthDistributedRuntimeControlPlaneService } from '../../../../services/ZavorthDistributedRuntimeControlPlaneService.js';
import { ZavorthRuntimeStabilityControlPlaneService } from '../../../../services/ZavorthRuntimeStabilityControlPlaneService.js';
import { ZavorthReplayLearningControlPlaneService } from '../../../../services/ZavorthReplayLearningControlPlaneService.js';
import { ZavorthGovernanceControlPlaneService } from '../../../../services/ZavorthGovernanceControlPlaneService.js';
import { ZavorthTrustPlaneService } from '../../../../services/ZavorthTrustPlaneService.js';
import { ZavorthHubControlPlaneService } from '../../../../services/ZavorthHubControlPlaneService.js';
import { ZavorthEcosystemControlPlaneService } from '../../../../services/ZavorthEcosystemControlPlaneService.js';
import { ZavorthEvalControlPlaneService } from '../../../../services/ZavorthEvalControlPlaneService.js';
import { ZavorthRolloutReadinessControlPlaneService } from '../../../../services/ZavorthRolloutReadinessControlPlaneService.js';
import { logger } from '../../../../logger';

export type ZavorthControlOperationsOverviewSnapshotDeps = {
  workspaceRoot: string;
  continuityUserId: string;
  channelMesh: LooseRecord;
  nodeMesh: LooseRecord;
  remoteTransports: LooseRecord;
  accessManifest: LooseRecord;
  remoteTransportDoctor: LooseRecord;
  memoryPlane: LooseRecord;
  layeredMemory: LooseRecord;
  learningPlane: LooseRecord;
  workflowRuns: LooseRecord;
  executionGateway: LooseRecord;
  tenantGovernance: LooseRecord;
  securityMesh: LooseRecord;
  pluginRegistry: LooseRecord;
  platformRegistry: LooseRecord;
  teamCatalog: LooseRecord;
  workspaceExtensions: LooseRecord;
  mcpCapabilityControlPlane: LooseRecord;
  integrationHub: LooseRecord;
  skillLibraryPresentation: LooseRecord;
  skillInstallPlanPresentation: LooseRecord;
  mcpRuntime: LooseRecord;
  productObservability: LooseRecord;
  operatorBrief: LooseRecord;
  operationsHealth: LooseRecord;
};

export class ZavorthControlOperationsOverviewSnapshotService {
  public readOperationalOverviewSnapshot(
    deps: ZavorthControlOperationsOverviewSnapshotDeps,
  ): Promise<LooseRecord> {
    const overview = new ZavorthOperationalOverviewService({
      workspaceRoot: deps.workspaceRoot,
      distributedRuntimeControlPlaneService: {
        buildSnapshot: (input?: LooseRecord) => this.buildDistributedRuntimeService(deps).buildSnapshot(input),
      },
      runtimeStabilityControlPlaneService: {
        buildSnapshot: (input?: LooseRecord) => this.buildRuntimeStabilityService(deps).buildSnapshot(input),
      },
      replayLearningControlPlaneService: {
        buildSnapshot: (input?: LooseRecord) => this.buildReplayLearningService(deps).buildSnapshot(input),
      },
    });
    return overview.buildSnapshot({
      sessionId: 'classic-zavorthControl',
      chatId: 'zavorthControl:classic',
      userId: deps.continuityUserId,
      platform: 'web',
      workspace: deps.workspaceRoot,
      limit: 8,
    });
  }

  public readTrustOverviewSnapshot(
    deps: ZavorthControlOperationsOverviewSnapshotDeps,
  ): Promise<LooseRecord> {
    const trustPlane = this.buildTrustPlaneService(deps);
    const overview = new ZavorthTrustOverviewService({
      workspaceRoot: deps.workspaceRoot,
      governanceControlPlaneService: {
        buildSnapshot: (input?: LooseRecord) => new ZavorthGovernanceControlPlaneService({
          workspaceRoot: deps.workspaceRoot,
          tenantGovernanceService: deps.tenantGovernance,
          trustPlaneService: trustPlane as LooseRecord,
          channelMeshService: deps.channelMesh,
          nodeMeshService: deps.nodeMesh,
          remoteTransportService: deps.remoteTransports,
          pluginRegistryService: deps.pluginRegistry,
          platformRegistryService: deps.platformRegistry,
          teamCatalogService: deps.teamCatalog,
        }).buildSnapshot(input),
      },
      trustPlaneService: trustPlane as LooseRecord,
      tenantGovernanceService: deps.tenantGovernance,
    });
    return Promise.resolve()
      .then(() => overview.buildSnapshot({ limit: 8 }))
      .catch(() => this.buildTrustOverviewFallback(deps));
  }

  public readProductOverviewSnapshot(
    deps: ZavorthControlOperationsOverviewSnapshotDeps,
  ): Promise<LooseRecord> {
    const distributedRuntime = this.buildDistributedRuntimeService(deps);
    const evalControlPlane = new ZavorthEvalControlPlaneService({
      productObservabilityService: deps.productObservability,
      operatorBriefService: deps.operatorBrief,
      operationsHealthService: deps.operationsHealth,
    });
    const overview = new ZavorthProductOverviewService({
      workspaceRoot: deps.workspaceRoot,
      hubControlPlaneService: {
        buildSnapshot: (input?: LooseRecord) => new ZavorthHubControlPlaneService({
          integrationHubService: deps.integrationHub,
          pluginRegistryService: deps.pluginRegistry,
          platformRegistryService: deps.platformRegistry,
          skillLibraryPresentationService: deps.skillLibraryPresentation,
          skillInstallPlanPresentationService: deps.skillInstallPlanPresentation,
          mcpCapabilityControlPlaneService: deps.mcpCapabilityControlPlane,
          mcpRuntimeService: deps.mcpRuntime,
        }).buildSnapshot(input),
      },
      ecosystemControlPlaneService: {
        buildSnapshot: (input?: LooseRecord) => new ZavorthEcosystemControlPlaneService({
          workspaceRoot: deps.workspaceRoot,
          platformRegistryService: deps.platformRegistry,
        }).buildSnapshot(input),
      },
      evalControlPlaneService: evalControlPlane as LooseRecord,
      rolloutReadinessControlPlaneService: {
        buildSnapshot: (input?: LooseRecord) => new ZavorthRolloutReadinessControlPlaneService({
          workspaceRoot: deps.workspaceRoot,
          distributedRuntimeControlPlaneService: distributedRuntime as LooseRecord,
          evalControlPlaneService: evalControlPlane as LooseRecord,
        }).buildSnapshot(input),
      },
    });
    return Promise.resolve()
      .then(() => overview.buildSnapshot({
        workspace: deps.workspaceRoot,
        profile: 'prod',
        rolloutScope: 'production',
      }))
      .catch(() => this.buildProductOverviewFallback(deps));
  }

  public readControlPlaneCatalogSnapshot(
    deps: ZavorthControlOperationsOverviewSnapshotDeps,
  ): Promise<LooseRecord> {
    const catalog = new InternalControlPlaneCatalogApiService({
      workspaceRoot: deps.workspaceRoot,
      operationalOverviewService: {
        buildSnapshot: () => this.readOperationalOverviewSnapshot(deps),
      } as LooseRecord,
      trustOverviewService: {
        buildSnapshot: () => this.readTrustOverviewSnapshot(deps),
      } as LooseRecord,
      productOverviewService: {
        buildSnapshot: () => this.readProductOverviewSnapshot(deps),
      } as LooseRecord,
    });
    return catalog.readSnapshot({
      planeId: 'operations-control-plane-catalog',
      surface: 'web',
      requestedBy: deps.continuityUserId,
      profile: 'prod',
      query: {
        sessionId: 'classic-zavorthControl',
        chatId: 'zavorthControl:classic',
        userId: deps.continuityUserId,
        platform: 'web',
        workspace: deps.workspaceRoot,
        profile: 'prod',
        rolloutScope: 'production',
        limit: 8,
      },
    });
  }

  private buildDistributedRuntimeService(
    deps: ZavorthControlOperationsOverviewSnapshotDeps,
  ): ZavorthDistributedRuntimeControlPlaneService {
    return new ZavorthDistributedRuntimeControlPlaneService({
      workspaceRoot: deps.workspaceRoot,
      channelMeshService: deps.channelMesh,
      nodeMeshService: deps.nodeMesh,
      remoteTransportService: deps.remoteTransports,
      runtimeAccessManifestService: deps.accessManifest,
    });
  }

  private buildRuntimeStabilityService(
    deps: ZavorthControlOperationsOverviewSnapshotDeps,
  ): ZavorthRuntimeStabilityControlPlaneService {
    return new ZavorthRuntimeStabilityControlPlaneService({
      workspaceRoot: deps.workspaceRoot,
      nodeMeshService: deps.nodeMesh,
      remoteTransportService: deps.remoteTransports,
      remoteTransportDoctorService: deps.remoteTransportDoctor,
    });
  }

  private buildReplayLearningService(
    deps: ZavorthControlOperationsOverviewSnapshotDeps,
  ): ZavorthReplayLearningControlPlaneService {
    return new ZavorthReplayLearningControlPlaneService({
      workspaceRoot: deps.workspaceRoot,
      memoryPlaneService: deps.memoryPlane,
      layeredMemoryService: deps.layeredMemory,
      learningPlaneService: deps.learningPlane,
      workflowRunService: deps.workflowRuns,
      hostActionService: deps.executionGateway,
    });
  }

  private buildTrustPlaneService(
    deps: ZavorthControlOperationsOverviewSnapshotDeps,
  ): ZavorthTrustPlaneService {
    return new ZavorthTrustPlaneService({
      securityMeshService: deps.securityMesh,
      mcpCapabilityControlPlaneService: deps.mcpCapabilityControlPlane,
      pluginRegistryService: deps.pluginRegistry,
      workspaceExtensionsService: deps.workspaceExtensions,
      nodeMeshService: deps.nodeMesh,
    });
  }

  private buildTrustOverviewFallback(
    deps: ZavorthControlOperationsOverviewSnapshotDeps,
  ): LooseRecord {
    const tenants = this.safeSync(
      () => deps.tenantGovernance?.buildSnapshot?.({ limit: 8 }),
      { summary: {}, narrative: {}, pendingOnboarding: [] },
    );
    const securityMesh = this.safeSync(
      () => deps.securityMesh?.buildSnapshot?.(),
      { posture: { level: 'baseline' }, narrative: {} },
    );
    const plugins = this.safeSync(
      () => deps.pluginRegistry?.buildSnapshot?.(),
      { summary: {} },
    );
    return {
      generatedAt: new Date().toISOString(),
      workspaceRoot: deps.workspaceRoot,
      summary: {
        posture: 'attention',
        healthyPlanes: 0,
        attentionPlanes: 3,
        criticalPlanes: 0,
        tenants: Number(tenants?.summary?.total || 0) || 0,
        pendingOnboarding: Number(tenants?.summary?.pendingOnboarding || 0) || 0,
        restrictedShared: Number(tenants?.summary?.restrictedShared || 0) || 0,
        pendingApprovals: 0,
        highRiskCapabilities: 0,
        trustedPlugins: Number(plugins?.summary?.trusted || 0) || 0,
        restrictedNodes: 0,
        recommendedActions: 0,
      },
      cards: [
        {
          id: 'governance',
          label: 'Governance Plane',
          posture: 'attention',
          summary: 'Governance overview em modo degradado.',
          nextAction: 'Revisar tenants e trust decisions.',
          command: '/trust',
          source: 'governance',
        },
        {
          id: 'trust-plane',
          label: 'Trust Plane',
          posture: 'attention',
          summary: String(securityMesh?.narrative?.operatorSummary || 'Trust plane parcial no zavorthControl.'),
          nextAction: 'Revalidar trust boundary e security mesh.',
          command: '/trust',
          source: 'trust',
        },
        {
          id: 'tenant-governance',
          label: 'Tenant Governance',
          posture: 'attention',
          summary: `${Number(tenants?.summary?.pendingOnboarding || 0) || 0} onboarding pendente(s).`,
          nextAction: String(tenants?.narrative?.nextAction || 'Concluir onboarding dos tenants principais.'),
          command: '/tenants',
          source: 'tenants',
        },
      ],
      actions: [],
      sourceSnapshots: {
        governance: null,
        trust: securityMesh,
        tenants,
      },
      narrative: {
        headline: 'Trust Overview',
        operatorSummary: 'Overview de trust em modo fail-soft, preservando sinais essenciais de tenancy e boundary.',
        nextAction: String(tenants?.narrative?.nextAction || 'Revisar trust, governance e tenants.'),
      },
    };
  }

  private async buildProductOverviewFallback(
    deps: ZavorthControlOperationsOverviewSnapshotDeps,
  ): Promise<LooseRecord> {
    const platform = this.safeSync(
      () => deps.platformRegistry?.buildSnapshot?.(),
      { summary: {} },
    );
    const observability = await this.safeAsync(
      () => deps.productObservability?.buildSnapshot?.({ sourceSurface: 'product-overview-fallback' }),
      { summary: {}, scope: null, insights: [] },
    );
    const integrations = this.safeSync(
      () => deps.integrationHub?.buildCatalogSnapshot?.(null),
      { entries: [] },
    );
    const integrationCount = Array.isArray(integrations?.entries) ? integrations.entries.length : 0;
    return {
      generatedAt: new Date().toISOString(),
      workspaceRoot: deps.workspaceRoot,
      scope: {
        workspace: deps.workspaceRoot,
        selectedId: null,
        query: null,
        recommendFor: null,
        profile: 'prod',
        rolloutScope: 'production',
      },
      summary: {
        posture: 'attention',
        healthyPlanes: 0,
        attentionPlanes: 4,
        criticalPlanes: 0,
        integrations: integrationCount,
        platformEntries: Number(platform?.summary?.total || 0) || 0,
        sdkFilesReady: 0,
        sdkFilesExpected: 0,
        scorecards: Number(observability?.totals?.totalTasks || 0) > 0 ? 1 : 0,
        regressions: 0,
        releaseReady: false,
        rolloutGateStatus: 'unknown',
        recommendedActions: 0,
      },
      cards: [
        {
          id: 'hub',
          label: 'Hub Plane',
          posture: 'attention',
          summary: `${integrationCount} integration(s) visiveis no fallback.`,
          nextAction: 'Revalidar hub e catalogos.',
          command: 'npm run ops:hub',
          source: 'hub',
        },
        {
          id: 'ecosystem',
          label: 'Ecosystem Plane',
          posture: 'attention',
          summary: `${Number(platform?.summary?.total || 0) || 0} entrada(s) de platform no fallback.`,
          nextAction: 'Revalidar ecosystem e SDKs.',
          command: 'npm run ops:ecosystem',
          source: 'ecosystem',
        },
        {
          id: 'evals',
          label: 'Eval Plane',
          posture: 'attention',
          summary: 'Product observability foi preservado parcialmente no fallback.',
          nextAction: 'Revisar scorecards e regressions do produto.',
          command: null,
          source: 'evals',
        },
        {
          id: 'rollout',
          label: 'Rollout Readiness',
          posture: 'attention',
          summary: 'Gate de rollout degradado para leitura parcial.',
          nextAction: 'Revalidar rollout readiness antes de promover.',
          command: 'npm run qa:phases:7-10',
          source: 'rollout',
        },
      ],
      actions: [],
      sourceSnapshots: {
        hub: integrations,
        ecosystem: platform,
        evals: observability,
        rollout: null,
      },
      narrative: {
        headline: 'Product Overview',
        operatorSummary: 'Overview de produto em modo fail-soft, mantendo sinais de hub, platform e observability.',
        nextAction: 'Revisar hub, ecosystem, evals e rollout readiness.',
      },
    };
  }

  private safeSync<T>(reader: () => T, fallback: T): T {
    try {
      const value = reader();
      return value === undefined || value === null ? fallback : value;
    } catch (error) { logger.warn('[Zavorth Control Operations Overview Snapshot] operation failed', error); return fallback; }
  }

  private async safeAsync<T>(reader: () => Promise<T> | T, fallback: T): Promise<T> {
    try {
      const value = await reader();
      return value === undefined || value === null ? fallback : value;
    } catch (error) { logger.warn('[Zavorth Control Operations Overview Snapshot] operation failed', error); return fallback; }
  }
}


