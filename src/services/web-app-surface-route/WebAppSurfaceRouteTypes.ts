import * as http from 'http';

// Gateway snapshot input
interface GatewaySnapshotInput {
  sessionId: string;
  chatId: string;
  userId: string;
}

// Gateway channel router interface
export interface GatewayChannelRouter {
  getChannel: (id: string) => unknown;
  sendToSession: (...args: unknown[]) => Promise<unknown>;
  spawnSession: (...args: unknown[]) => unknown;
}

// Control plane snapshot options
interface ControlPlaneSnapshotOptions {
  selectedId?: string | null;
  query?: string | null;
  recommendFor?: string | null;
  recipeId?: string | null;
  workspace?: string | null;
  sourceSurface?: string | null;
  executor?: string | null;
  workflow?: string | null;
  profile?: string | null;
  limit?: number;
  refresh?: boolean;
  includeSources?: boolean;
  scope?: string | null;
  channelId?: string | null;
  mode?: string | null;
  intentText?: string | null;
  autoApply?: boolean;
  autoDoctor?: boolean;
  autoTest?: boolean;
  localOnly?: boolean;
  sessionId?: string;
  userId?: string | null;
  platform?: string;
  chatId?: string | null;
}

// Skill catalog snapshot
interface SkillCatalogSnapshot {
  selected: unknown;
  selectedRecipe: unknown;
  recipes: Array<{
    skillIds?: string[];
    [key: string]: unknown;
  }>;
  recommendations: unknown;
  summary: unknown;
}

// Skill catalog API
interface SkillCatalogApi {
  buildSnapshot: (options: ControlPlaneSnapshotOptions) => SkillCatalogSnapshot;
}

// Skill library presentation
interface SkillLibraryPresentation {
  buildSnapshot: (options: ControlPlaneSnapshotOptions) => {
    catalog?: SkillCatalogSnapshot;
    actions?: unknown[];
    [key: string]: unknown;
  };
}

// Skill install plan presentation
interface SkillInstallPlanPresentation {
  buildSnapshot: (options: ControlPlaneSnapshotOptions) => {
    focus: unknown;
    steps: unknown;
    actions: unknown;
    [key: string]: unknown;
  };
}

// Skill MCP sidecar
interface SkillMcpSidecar {
  buildSnapshot: (options: ControlPlaneSnapshotOptions) => unknown;
}

// Skill bridge activation
interface SkillBridgeActivation {
  executeCommand: (options: {
    args: string;
    channel: string;
    actorId: string;
  }) => Promise<{
    status: string;
    registry: unknown;
    surfaceActions: unknown;
    [key: string]: unknown;
  }>;
}

// MCP capability control plane
interface McpCapabilityControlPlane {
  buildSnapshot: () => {
    entries?: Array<{
      id?: string;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  };
}

// MCP runtime
interface McpRuntime {
  readSnapshot: () => {
    entries?: Array<{
      id?: string;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  };
  reloadServer: (serverId: string) => Promise<unknown>;
  stopServer: (serverId: string) => Promise<boolean>;
}

// MCP browser doctor
interface McpBrowserDoctor {
  run: () => Promise<{
    ok: boolean;
    [key: string]: unknown;
  }>;
}

// Product observability
interface ProductObservability {
  buildSnapshot: (options: ControlPlaneSnapshotOptions) => Promise<unknown>;
}

// Eval control plane
interface EvalControlPlane {
  buildSnapshot: (options: ControlPlaneSnapshotOptions) => Promise<unknown>;
}

// QA control plane
interface QaControlPlane {
  buildSnapshot: (options: ControlPlaneSnapshotOptions) => unknown;
}

// Governance control plane
interface GovernanceControlPlane {
  buildSnapshot: (options: ControlPlaneSnapshotOptions) => unknown;
}

// Replay learning control plane
interface ReplayLearningControlPlane {
  buildSnapshot: (options: ControlPlaneSnapshotOptions) => Promise<unknown>;
}

// Ecosystem control plane
interface EcosystemControlPlane {
  buildSnapshot: (options: ControlPlaneSnapshotOptions) => unknown;
}

// Distributed runtime control plane
interface DistributedRuntimeControlPlane {
  buildSnapshot: (options: ControlPlaneSnapshotOptions) => Promise<unknown>;
}

// Runtime stability control plane
interface RuntimeStabilityControlPlane {
  buildSnapshot: () => unknown;
}

// Rollout readiness control plane
interface RolloutReadinessControlPlane {
  buildSnapshot: (options: ControlPlaneSnapshotOptions) => Promise<unknown>;
}

// Natural setup control plane
interface NaturalSetupControlPlane {
  buildSnapshot: (options: ControlPlaneSnapshotOptions) => Promise<unknown>;
}

// Automation control plane
interface AutomationControlPlane {
  buildSnapshot: (options?: ControlPlaneSnapshotOptions) => Promise<unknown>;
}

// Automation actions
interface AutomationActions {
  execute: (options: {
    actionId: string;
    intentText?: string | null;
    taskId?: string | null;
    requestedBy: string;
    sourceSurface: string;
  }) => Promise<{
    ok: boolean;
    status?: string;
    snapshot?: unknown;
    [key: string]: unknown;
  }>;
  apply?: (options: {
    planId: string;
    requestedBy?: string;
  }) => Promise<{
    [key: string]: unknown;
  }>;
}

// Watch mode control plane
interface WatchModeControlPlane {
  buildSnapshot: (options?: ControlPlaneSnapshotOptions) => unknown;
}

// Hub control plane
interface HubControlPlane {
  buildSnapshot: (options?: ControlPlaneSnapshotOptions) => unknown;
}

// Hub actions
interface HubActions {
  execute: (options: {
    actionId: string;
    requestedBy: string;
    workspace?: string;
    selectedId?: string | null;
    query?: string | null;
    recommendFor?: string | null;
  }) => Promise<{
    ok: boolean;
    hub?: unknown;
    [key: string]: unknown;
  }>;
}

// Codex remote
interface CodexRemote {
  buildSnapshot: (options: {
    runtimeUserId: string;
    selectedSessionId?: string;
  }) => Promise<{
    sessionBroker: {
      sessions: unknown;
      summary: unknown;
      selected: unknown;
    };
    [key: string]: unknown;
  }>;
}

// Codex remote actions
interface CodexRemoteActions {
  execute: (input: CodexRemoteActionInput) => Promise<{
    ok: boolean;
    [key: string]: unknown;
  }>;
}

// Codex remote action input
interface CodexRemoteActionInput {
  actionId: string;
  profileId: string | null;
  profileLabel: string | null;
  profileDescription: string | null;
  codexCliPath: string | null;
  codexHome: string | null;
  prompt: string | null;
  title: string | null;
  sessionId: string | null;
  permissionId: string | null;
  decisionNote: string | null;
  workspaceRoot: string | null;
  runtimeUserId: string;
  sourceSurface: string;
  requireApproval: boolean;
  sessionSpawner: GatewayChannelRouter | null;
}

// Natural setup mutation planner
interface NaturalSetupMutationPlanner {
  apply: (options: {
    planId: string;
    requestedBy: string;
  }) => Promise<{
    ok: boolean;
    status?: string;
    snapshot?: unknown;
    mutationPlan?: unknown;
    results?: unknown;
    summary?: unknown;
    [key: string]: unknown;
  }>;
  preview: (options: {
    channelId?: string | null;
    mode?: string | null;
    intentText?: string | null;
    doctor?: boolean;
    test?: boolean;
    localOnly?: boolean;
    sourceSurface: string;
  }) => Promise<{
    trustDecision?: unknown;
    [key: string]: unknown;
  }>;
}

// Natural setup mutation planner service constructor
interface NaturalSetupMutationPlannerService {
  new (options: {
    controlPlaneService?: unknown;
    channelSetupAssistant?: unknown;
    channelActions?: unknown;
  }): NaturalSetupMutationPlanner;
}

// Capability catalog
interface CapabilityCatalog {
  buildSnapshot: () => unknown;
}

// Operator brief
interface OperatorBrief {
  readSnapshot: () => unknown;
}

// Memory plane snapshot
interface MemoryPlaneSnapshot {
  [key: string]: unknown;
}

// WebAppSurfaceRouteDeps with proper types
export type WebAppSurfaceRouteDeps = {
  // Core functions
  writeJson: (res: http.ServerResponse, body: unknown, statusCode?: number) => void;
  readJsonBody: (req: http.IncomingMessage) => Promise<Record<string, unknown>>;
  resolveSessionId: (url: URL) => string;
  buildMemoryPlaneSnapshot: (sessionId: string) => Promise<MemoryPlaneSnapshot>;

  // Runtime and realtime
  runtime: { webUserId?: string | null } | null;
  realtime: { createSession: () => string; getChatId: (sessionId: string) => string | null } | null;

  // Gateway services
  runtimeGateway: {
    buildHydratedSnapshot: (input: GatewaySnapshotInput) => Promise<unknown>;
    buildDomainSummarySnapshot?: () => unknown;
    buildDomainSnapshot?: () => unknown;
  } | null;
  gateway: {
  } | null;
  gatewayRuntime?: {
    buildCanonicalSnapshot: (input: GatewaySnapshotInput) => Promise<unknown>;
  } | null;
  gatewayChannelRouter: GatewayChannelRouter | null;

  // Skill services
  skillCatalogApi?: SkillCatalogApi;
  skillLibraryPresentation?: SkillLibraryPresentation;
  skillInstallPlanPresentation?: SkillInstallPlanPresentation;
  skillMcpSidecar?: SkillMcpSidecar;
  skillBridgeActivation?: SkillBridgeActivation;

  // MCP services
  mcpCapabilityControlPlane?: McpCapabilityControlPlane;
  mcpRuntime?: McpRuntime;
  mcpBrowserDoctor?: McpBrowserDoctor;

  // Control planes
  productObservability?: ProductObservability;
  evalControlPlane?: EvalControlPlane;
  qaControlPlane?: QaControlPlane;
  governanceControlPlane?: GovernanceControlPlane;
  replayLearningControlPlane?: ReplayLearningControlPlane;
  ecosystemControlPlane?: EcosystemControlPlane;
  distributedRuntimeControlPlane?: DistributedRuntimeControlPlane;
  runtimeStabilityControlPlane?: RuntimeStabilityControlPlane;
  rolloutReadinessControlPlane?: RolloutReadinessControlPlane;
  naturalSetupControlPlane?: NaturalSetupControlPlane;
  automationControlPlane?: AutomationControlPlane;
  watchModeControlPlane?: WatchModeControlPlane;
  hubControlPlane?: HubControlPlane;

  // Action services
  automationActions?: AutomationActions;
  hubActions?: HubActions;
  codexRemote?: CodexRemote;
  codexRemoteActions?: CodexRemoteActions;

  // Other services
  naturalSetupMutationPlanner?: NaturalSetupMutationPlanner;
  channelSetupAssistant?: unknown;
  channelActions?: unknown;
  capabilityCatalog?: CapabilityCatalog;
  operatorBrief?: OperatorBrief;
  workspaceRoot?: string;
  channelMesh?: any;
  channelInstall?: any;
  channelProviderDoctor?: any;
  naturalChannelSetupTurn?: any;
  remoteTransports?: any;
  remoteTransportActions?: any;
  remoteTransportDoctor?: any;
  gatewayChannelRegistry?: any;
  [key: string]: any;
};
