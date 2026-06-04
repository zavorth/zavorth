import type { ProfileRuntimeBundle } from './ProfileManifestContract.js';
import type { ZavorthCapabilityAtlasSnapshot } from './ZavorthCapabilityAtlasContract.js';

export const ZAVORTH_AGENT_KERNEL_SNAPSHOT_VERSION = '2026-06-02.agent-kernel-snapshot.v1' as const;

export type ZavorthAgentKernelStatus = 'ready' | 'attention' | 'blocked';

export type ZavorthIntentDecisionKind =
  | 'direct_response'
  | 'zavorth_action'
  | 'memory'
  | 'background_task'
  | 'swarm'
  | 'sandbox'
  | 'channel'
  | 'approval';

export type ZavorthQuietAutonomyMode =
  | 'manual'
  | 'quiet-staging'
  | 'quiet-curation'
  | 'creative-staging';

export type ZavorthCapabilityPassport = {
  status: ZavorthAgentKernelStatus;
  generatedAt: string;
  install: {
    projectRoot: string;
    homeRoot: string;
    homeSource: string;
    isolated: boolean;
    cleanInstallReady: boolean;
    warnings: string[];
  };
  activeProfile: {
    id: string;
    label: string;
    source: string;
    autonomy: string;
    trustMode: string;
    approvalMode: string;
    sandboxMode: string;
    memoryMode: string;
    learning: string;
    maxToolRounds: number;
    allowedTools: string[];
    requireApprovalFor: string[];
  };
  providers: {
    status: ZavorthAgentKernelStatus | 'unknown';
    activeProvider: string;
    activeModel: string;
    routes: number;
    executionReady: number;
    liveReady: number;
    needsCredentials: number;
    needsBaseUrl: number;
    needsConnector: number;
  };
  channels: {
    status: ZavorthAgentKernelStatus;
    total: number;
    ready: number;
    configured: number;
    liveReady: number;
    defaultRouteAllowed: number;
  };
  runtime: {
    actionHarness: 'ready';
    memory: 'ready' | 'attention';
    taskPlane: 'ready';
    goalLoop: 'ready' | 'attention';
    swarmScalePlane: 'ready' | 'attention';
    sandbox: 'ready' | 'attention';
    voiceWake: 'ready' | 'attention';
  };
  canDo: string[];
  missing: string[];
  safety: {
    noRawSecrets: true;
    noHiddenLiveNetworkByDefault: true;
    riskyMutationUsesPreviewApprovalReceipt: true;
    channelsCannotBypassActionHarness: true;
    quietAutonomyIsReversible: true;
  };
};

export type ZavorthIntentDecision = {
  contractVersion: typeof ZAVORTH_AGENT_KERNEL_SNAPSHOT_VERSION;
  generatedAt: string;
  kind: ZavorthIntentDecisionKind;
  confidence: number;
  risk: 'safe' | 'attention' | 'danger';
  reason: string;
  nextSurface: string;
  suggestedActionId: string | null;
  requiresPreview: boolean;
  requiresApproval: boolean;
  backgroundAllowed: boolean;
  fallback: ZavorthIntentDecisionKind;
  hints: {
    cognitiveCategory: string;
    useFastModel: boolean;
    trivialChat: boolean;
  };
};

export type ZavorthPerformanceMemoryRouteStats = {
  routeId: string;
  providerId: string;
  taskKind: string;
  attempts: number;
  successes: number;
  failures: number;
  averageLatencyMs: number;
  averageTokens: number;
  averageCostUsd: number;
  score: number;
  lastUsedAt: string;
};

export type ZavorthPerformanceMemorySnapshot = {
  contractVersion: typeof ZAVORTH_AGENT_KERNEL_SNAPSHOT_VERSION;
  generatedAt: string;
  store: 'state-db' | 'json';
  sampleCount: number;
  taskKinds: string[];
  topRoutes: ZavorthPerformanceMemoryRouteStats[];
  recommendations: Array<{
    taskKind: string;
    routeId: string;
    providerId: string;
    reason: string;
  }>;
  safety: {
    noPromptBodiesStored: true;
    noSecretsStored: true;
    aggregateOnlyInLlmContext: true;
  };
};

export type ZavorthAgentKernelSnapshot = {
  contractVersion: typeof ZAVORTH_AGENT_KERNEL_SNAPSHOT_VERSION;
  schemaVersion: 1;
  surface: 'agent-kernel-snapshot';
  generatedAt: string;
  status: ZavorthAgentKernelStatus;
  projectRoot: string;
  activeProfile: ProfileRuntimeBundle | null;
  capabilityPassport: ZavorthCapabilityPassport;
  capabilityAtlas: Pick<ZavorthCapabilityAtlasSnapshot, 'status' | 'summary' | 'entries' | 'llmContextBlock'>;
  intentDecision: ZavorthIntentDecision | null;
  performanceMemory: ZavorthPerformanceMemorySnapshot;
  quietAutonomy: {
    mode: ZavorthQuietAutonomyMode;
    silent: string[];
    notify: string[];
    requireApproval: string[];
    silentReceipts: boolean;
    rollbackRequired: boolean;
    maxSilentRisk: string;
    interruptMode: string;
    operatorSummary: string;
    dailyProductRule: string;
    llmGuidance: string;
  };
  llmContextBlock: string;
  cleanInstallCertification: {
    status: ZavorthAgentKernelStatus;
    checks: Array<{
      id: string;
      status: ZavorthAgentKernelStatus;
      summary: string;
    }>;
    command: string;
  };
};
