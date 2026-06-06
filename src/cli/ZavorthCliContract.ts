import type { Interface as ReadlineInterface } from 'readline/promises';
import type { SurfaceCommandBoundary } from '../api/internal/InternalSurfaceApiCompat.js';
import type { ZavorthGatewayService } from '../services/ZavorthGatewayService.js';
import type { SurfaceTaskDispatcherLike } from '../services/SurfaceRuntime.js';
import type { SurfaceOperationalIntentService } from '../services/SurfaceOperationalIntentService.js';
import type { LegacyUnifiedGatewayAdapter } from '../context-engine/LegacyUnifiedGatewayAdapter.js';
import type { SupervisedRuntimeService } from '../services/SupervisedRuntimeService.js';
import type {
  RuntimeAccessReadinessService,
} from '../runtime/access/RuntimeAccessReadinessService.js';
import type {
  RuntimeBootstrapService,
} from '../runtime/access/RuntimeBootstrapService.js';
import type {
  RuntimeBootstrapRepairService,
} from '../runtime/access/RuntimeBootstrapRepairService.js';
import type { AutoRepairService } from '../services/AutoRepairService.js';
import type { ZavorthMemoryPlaneService } from '../services/ZavorthMemoryPlaneService.js';
import type { ZavorthLayeredMemoryService } from '../services/ZavorthLayeredMemoryService.js';
import type { ZavorthLearningPlaneService } from '../services/ZavorthLearningPlaneService.js';
import type { ZavorthPlatformRegistryService } from '../services/ZavorthPlatformRegistryService.js';
import type { ZavorthPlatformCatalogSyncService } from '../services/ZavorthPlatformCatalogSyncService.js';
import type { ZavorthPlatformActionService } from '../services/ZavorthPlatformActionService.js';
import type { ZavorthPackagePublisher } from '../platform/publish/ZavorthPackagePublisher.js';
import type { ZavorthNodeMeshService } from '../services/ZavorthNodeMeshService.js';
import type { NodePairingService } from '../services/NodePairingService.js';
import type { NodeInvokeService } from '../services/NodeInvokeService.js';
import type { ZavorthSessionPlaneService } from '../services/ZavorthSessionPlaneService.js';
import type { NodeDeviceProfileService } from '../services/NodeDeviceProfileService.js';
import type { NodeCapabilityService } from '../services/NodeCapabilityService.js';
import type { ZavorthToolSurfaceService } from '../services/ZavorthToolSurfaceService.js';
import type { ZavorthHookPlaneService } from '../services/ZavorthHookPlaneService.js';
import type { AIGatewayProxyService } from '../services/AIGatewayProxyService.js';
import type { ZavorthGatewayRuntimeService } from '../services/ZavorthGatewayRuntimeService.js';
import type { ZavorthGatewayLauncherService } from '../services/ZavorthGatewayLauncherService.js';
import type { GatewayCompatibilityDoctorService } from '../services/GatewayCompatibilityDoctorService.js';
import type { GatewayUpstreamSyncService } from '../services/GatewayUpstreamSyncService.js';
import type { OperationsHealthService } from '../observability/OperationsHealthService.js';
import type { OperationsActionService } from '../services/OperationsActionService.js';
import type { OperationsCockpitService } from '../services/OperationsCockpitService.js';
import type { OperatorBriefService } from '../observability/OperatorBriefService.js';
import type { ZavorthCapabilityOsService } from '../services/ZavorthCapabilityOsService.js';
import type { ZavorthTaskOperatingSystemService } from '../services/ZavorthTaskOperatingSystemService.js';
import type { ZavorthSupervisorGraphService } from '../services/ZavorthSupervisorGraphService.js';
import type { ZavorthWorkspaceMemoryOsService } from '../services/ZavorthWorkspaceMemoryOsService.js';
import type { ZavorthSelfHealControlPlaneService } from '../services/ZavorthSelfHealControlPlaneService.js';
import type { ZavorthReleasePresenceControlPlaneService } from '../services/ZavorthReleasePresenceControlPlaneService.js';
import type { ZavorthAgentGateway } from '../runtime/agent/index.js';
import type { ExperienceCoreService } from '../services/experience/ExperienceCoreService.js';
import type { ZavorthHeadlessApprovalMode } from './headless/ZavorthHeadlessCommand.js';

export type ZavorthCliFlags = {
  command: string | null;
  repl: boolean;
  json: boolean;
  live: boolean;
  userId: string;
  platform: 'web' | 'telegram' | 'discord';
  chatId: string;
  sessionId: string;
  workspaceHint: string | null;
  commandText: string | null;
  headless: boolean;
  approvalMode: ZavorthHeadlessApprovalMode | null;
  terminalStream?: CliTerminalStreamSink | null;
  terminalAbortSignal?: AbortSignal | null;
};

export type CliWriter = {
  line: (text: string) => void;
  error: (text: string) => void;
};

export type ZavorthCliIo = {
  write?: (value: string) => void;
  error?: (value: string) => void;
};

export type CliReadlineFactory = () => ReadlineInterface;

export type ZavorthCliRuntime = {
  commandService: SurfaceCommandBoundary;
  gatewayService: Pick<ZavorthGatewayService, 'buildHydratedSnapshot'> & Partial<Pick<
    ZavorthGatewayService,
    'buildSnapshot' | 'buildDomainSummarySnapshot' | 'buildDomainSnapshot'
  >>;
  legacyUnifiedGateway?: Pick<LegacyUnifiedGatewayAdapter, 'handleEvent'> | null;
  surfaceTaskDispatcher?: SurfaceTaskDispatcherLike | null;
  surfaceOperationalIntentService?: Pick<SurfaceOperationalIntentService, 'decideResponse'> | null;
  supervisedRuntimeService?: Pick<SupervisedRuntimeService, 'inspect' | 'summarizeRecentChanges' | 'requestReload'>;
  runtimeAccessReadinessService?: Pick<RuntimeAccessReadinessService, 'inspect'> &
    Partial<Pick<RuntimeAccessReadinessService, 'inspectLive'>>;
  runtimeBootstrapService?: Pick<RuntimeBootstrapService, 'inspect'>;
  runtimeBootstrapRepairService?: Pick<RuntimeBootstrapRepairService, 'repair'>;
  autoRepairService?: Pick<AutoRepairService, 'run' | 'readLastReport' | 'summarizeLastRun'>;
  memoryPlaneService?: Pick<ZavorthMemoryPlaneService, 'buildSnapshot'>;
  layeredMemoryService?: Pick<ZavorthLayeredMemoryService, 'buildStatus' | 'search' | 'readProcedures' | 'readMetrics'>;
  learningPlaneService?: Pick<
    ZavorthLearningPlaneService,
    'buildSnapshot' | 'executeAction' | 'readMetrics' | 'resetState' | 'exportState'
  >;
  experienceCoreService?: Pick<ExperienceCoreService, 'buildHome' | 'executeCommand' | 'buildTimelineForRun'>;
  platformRegistryService?: Pick<
    ZavorthPlatformRegistryService,
    'buildSnapshot' | 'buildSummarySnapshot' | 'buildStatusSummarySnapshot'
  >;
  platformCatalogSyncService?: Pick<ZavorthPlatformCatalogSyncService, 'sync'>;
  platformActionService?: Pick<ZavorthPlatformActionService, 'execute'>;
  platformPublisherService?: Pick<ZavorthPackagePublisher, 'publishDetailed'>;
  nodeMeshService?: Pick<ZavorthNodeMeshService, 'buildSnapshot'>;
  nodePairingService?: Pick<NodePairingService, 'createPairingDraft'>;
  nodeInvokeService?: Pick<NodeInvokeService, 'invoke'>;
  sessionPlaneService?: Pick<
    ZavorthSessionPlaneService,
    'buildSnapshot' | 'buildStatusSummary' | 'renderOverviewReport' | 'renderHistoryReport' | 'sendToSession' | 'spawnSession'
  >;
  nodeDeviceProfileService?: Pick<NodeDeviceProfileService, 'listProfiles' | 'resolveProfile' | 'describeProfile'>;
  nodeCapabilityService?: Pick<NodeCapabilityService, 'listCatalog'>;
  toolSurfaceService?: Pick<ZavorthToolSurfaceService, 'buildSnapshot'>;
  hookPlaneService?: Pick<ZavorthHookPlaneService, 'buildSnapshot'>;
  gatewayControlService?: Pick<ZavorthGatewayRuntimeService, 'buildGatewayControlApiSnapshot'>;
  AIGatewayGatewayService?: Pick<AIGatewayProxyService, 'readStatus'>;
  AIGatewayGatewayLauncherService?: Pick<ZavorthGatewayLauncherService, 'ensureStarted'>;
  GatewayCompatibilityDoctorService?: Pick<GatewayCompatibilityDoctorService, 'run' | 'readLastReport'>;
  GatewayUpstreamSyncService?: Pick<GatewayUpstreamSyncService, 'sync' | 'promote' | 'rollback' | 'readLastReport'>;
  operationsHealthService?: Pick<OperationsHealthService, 'readSnapshotFast' | 'readSnapshotLive'>;
  operationsActionService?: Pick<OperationsActionService, 'listDefinitions' | 'execute'>;
  operationsCockpitService?: Pick<OperationsCockpitService, 'readSnapshot'> &
    Partial<Pick<OperationsCockpitService, 'readSnapshotFast' | 'readSnapshotLive'>>;
  operatorBriefService?: Pick<OperatorBriefService, 'readSnapshot'> &
    Partial<Pick<OperatorBriefService, 'readSnapshotFast' | 'readSnapshotLive' | 'readSnapshotFromCockpit'>>;
  capabilityOsService?: Pick<ZavorthCapabilityOsService, 'buildSnapshot' | 'explainRoute'>;
  taskOperatingSystemService?: Pick<
    ZavorthTaskOperatingSystemService,
    'buildSnapshot' | 'listArtifactsForTask' | 'buildContinuationPlan'
  >;
  supervisorGraphService?: Pick<ZavorthSupervisorGraphService, 'buildSnapshot'>;
  workspaceMemoryOsService?: Pick<ZavorthWorkspaceMemoryOsService, 'buildReview' | 'resolveFollowUp' | 'executeAction'>;
  selfHealControlPlaneService?: Pick<ZavorthSelfHealControlPlaneService, 'buildPreview' | 'buildDailyReport'>;
  releasePresenceControlPlaneService?: Pick<
    ZavorthReleasePresenceControlPlaneService,
    'buildStatus' | 'buildDiff' | 'buildRollbackPreview' | 'buildRemotePresence'
  >;
  agentGateway?: Pick<
    ZavorthAgentGateway,
    | 'handle'
    | 'addRuntimeEventBus'
    | 'removeRuntimeEventBus'
    | 'buildSnapshot'
    | 'listWorkflowJobs'
    | 'processQueuedWorkflows'
    | 'findPendingApproval'
    | 'approve'
    | 'reject'
    | 'steer'
  > | null;
};

export type ZavorthCliServiceOverrides = {
  gateway?: Pick<ZavorthGatewayService, 'buildHydratedSnapshot'> & Partial<Pick<
    ZavorthGatewayService,
    'buildSnapshot' | 'buildDomainSummarySnapshot' | 'buildDomainSnapshot'
  >>;
  legacyUnifiedGateway?: Pick<LegacyUnifiedGatewayAdapter, 'handleEvent'> | null;
  surfaceTaskDispatcher?: SurfaceTaskDispatcherLike | null;
  supervisedRuntime?: Pick<SupervisedRuntimeService, 'inspect' | 'summarizeRecentChanges' | 'requestReload'>;
  runtimeAccessReadiness?: Pick<RuntimeAccessReadinessService, 'inspect'> &
    Partial<Pick<RuntimeAccessReadinessService, 'inspectLive'>>;
  runtimeBootstrap?: Pick<RuntimeBootstrapService, 'inspect'>;
  runtimeBootstrapRepair?: Pick<RuntimeBootstrapRepairService, 'repair'>;
  autoRepair?: Pick<AutoRepairService, 'run' | 'readLastReport' | 'summarizeLastRun'>;
  memoryPlane?: Pick<ZavorthMemoryPlaneService, 'buildSnapshot'>;
  layeredMemory?: Pick<ZavorthLayeredMemoryService, 'buildStatus' | 'search' | 'readProcedures' | 'readMetrics'>;
  learningPlane?: Pick<
    ZavorthLearningPlaneService,
    'buildSnapshot' | 'executeAction' | 'readMetrics' | 'resetState' | 'exportState'
  >;
  experienceCore?: Pick<ExperienceCoreService, 'buildHome' | 'executeCommand' | 'buildTimelineForRun'>;
  platformRegistry?: Pick<
    ZavorthPlatformRegistryService,
    'buildSnapshot' | 'buildSummarySnapshot' | 'buildStatusSummarySnapshot'
  >;
  platformCatalogSync?: Pick<ZavorthPlatformCatalogSyncService, 'sync'>;
  platformAction?: Pick<ZavorthPlatformActionService, 'execute'>;
  platformPublisher?: Pick<ZavorthPackagePublisher, 'publishDetailed'>;
  nodeMesh?: Pick<ZavorthNodeMeshService, 'buildSnapshot'>;
  nodePairing?: Pick<NodePairingService, 'createPairingDraft'>;
  nodeInvoke?: Pick<NodeInvokeService, 'invoke'>;
  sessionPlane?: Pick<
    ZavorthSessionPlaneService,
    'buildSnapshot' | 'buildStatusSummary' | 'renderOverviewReport' | 'renderHistoryReport' | 'sendToSession' | 'spawnSession'
  >;
  nodeDeviceProfiles?: Pick<NodeDeviceProfileService, 'listProfiles' | 'resolveProfile' | 'describeProfile'>;
  nodeCapabilities?: Pick<NodeCapabilityService, 'listCatalog'>;
  toolSurface?: Pick<ZavorthToolSurfaceService, 'buildSnapshot'>;
  hookPlane?: Pick<ZavorthHookPlaneService, 'buildSnapshot'>;
  gatewayControl?: Pick<ZavorthGatewayRuntimeService, 'buildGatewayControlApiSnapshot'>;
  AIGatewayGateway?: Pick<AIGatewayProxyService, 'readStatus'>;
  AIGatewayGatewayLauncher?: Pick<ZavorthGatewayLauncherService, 'ensureStarted'>;
  AIGatewayCompatibilityDoctor?: Pick<GatewayCompatibilityDoctorService, 'run' | 'readLastReport'>;
  AIGatewayUpstreamSync?: Pick<GatewayUpstreamSyncService, 'sync' | 'promote' | 'rollback' | 'readLastReport'>;
  operationsHealth?: Pick<OperationsHealthService, 'readSnapshotFast' | 'readSnapshotLive'>;
  operationsAction?: Pick<OperationsActionService, 'listDefinitions' | 'execute'>;
  operationsCockpit?: Pick<OperationsCockpitService, 'readSnapshot'> &
    Partial<Pick<OperationsCockpitService, 'readSnapshotFast' | 'readSnapshotLive'>>;
  operatorBrief?: Pick<OperatorBriefService, 'readSnapshot'> &
    Partial<Pick<OperatorBriefService, 'readSnapshotFast' | 'readSnapshotLive' | 'readSnapshotFromCockpit'>>;
  capabilityOs?: Pick<ZavorthCapabilityOsService, 'buildSnapshot' | 'explainRoute'>;
  taskOperatingSystem?: Pick<
    ZavorthTaskOperatingSystemService,
    'buildSnapshot' | 'listArtifactsForTask' | 'buildContinuationPlan'
  >;
  supervisorGraph?: Pick<ZavorthSupervisorGraphService, 'buildSnapshot'>;
  workspaceMemoryOs?: Pick<ZavorthWorkspaceMemoryOsService, 'buildReview' | 'resolveFollowUp' | 'executeAction'>;
  selfHealControlPlane?: Pick<ZavorthSelfHealControlPlaneService, 'buildPreview' | 'buildDailyReport'>;
  releasePresenceControlPlane?: Pick<
    ZavorthReleasePresenceControlPlaneService,
    'buildStatus' | 'buildDiff' | 'buildRollbackPreview' | 'buildRemotePresence'
  >;
  agentGateway?: Pick<
    ZavorthAgentGateway,
    | 'handle'
    | 'addRuntimeEventBus'
    | 'removeRuntimeEventBus'
    | 'buildSnapshot'
    | 'listWorkflowJobs'
    | 'processQueuedWorkflows'
    | 'findPendingApproval'
    | 'approve'
    | 'reject'
    | 'steer'
  > | null;
  commandService?: SurfaceCommandBoundary;
};

export type ZavorthCliDeps = {
  writer?: CliWriter;
  runtime?: ZavorthCliRuntime;
  readlineFactory?: CliReadlineFactory;
};

export type CliExecutionResult = {
  ok: boolean;
  handled: boolean;
  output: string[];
  error: string | null;
};

export type CliRuntimeProfile = 'ops' | 'surface' | 'summary' | 'task';

export type CliTerminalStreamEvent = {
  type: 'start' | 'delta' | 'tool' | 'done' | 'status' | 'error';
  text?: string;
  delta?: string;
  accumulated?: string;
  title?: string;
  status?: string;
  runId?: string;
  streamId?: string;
  raw?: Record<string, unknown>;
};

export type CliTerminalStreamSink = {
  onEvent: (event: CliTerminalStreamEvent) => void | Promise<void>;
};
