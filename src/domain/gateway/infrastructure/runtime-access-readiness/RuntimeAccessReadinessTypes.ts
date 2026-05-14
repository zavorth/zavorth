import type { IntegrationHubMcpSnapshot } from '../../../../contracts/IntegrationHubContract.js';
import type { ModelPickerContract } from '../../../../contracts/ModelPickerContract.js';
import type { HostIdentityStatus } from '../../../../services/HostIdentityService.js';
import type { TenantRegistrySummary } from '../../../../services/TenantRegistryService.js';

export type RuntimeAccessLockSnapshot = {
  active: boolean;
  pid: number | null;
  owner: string | null;
  startedAt: string | null;
  alive: boolean;
};

export type RuntimeAccessAuthStatus = {
  enabled: boolean;
  source: 'env' | 'runtime-file' | 'missing';
  tokenFile: string;
};

export type RuntimeAccessReadinessStep = {
  id: string;
  title: string;
  description: string;
  blocking: boolean;
};

export type RuntimeAccessDiscordBridgeSnapshot = {
  mode: 'bridge' | 'native' | 'unknown';
  enabled: boolean;
  started: boolean;
  allowDirectMessages: boolean;
  allowedGuildIds: string[];
  pendingInbox: number;
  pendingOutbox: number;
  lastError: string | null;
  updatedAt: string | null;
};

export type RuntimeAccessTenantSnapshot = {
  file: string;
} & TenantRegistrySummary;

export type RuntimeAccessProviderSnapshot = {
  activeProviderName: string;
  activeModelName: string;
  preferredZavorthBridgeModel: string | null;
  readyCount: number;
  needsConfigurationCount: number;
  needsProbeCount: number;
  recommendedProfile: string;
  readyProviders: string[];
  pendingConfigProviders: string[];
  probeProviders: string[];
  recommendations: string[];
  modelPicker?: ModelPickerContract | null;
};

export type RuntimeAccessMcpSnapshot = {
  manifestPath: string;
  summary: IntegrationHubMcpSnapshot['summary'];
  capabilities: string[];
  recommendations: string[];
};

export type RuntimeAccessNodeMeshSmokeSnapshot = {
  available: boolean;
  status: 'passed' | 'failed' | 'running' | 'missing';
  checkedAt: string | null;
  summary: string | null;
  command: string;
  file: string;
  nodeId: string | null;
  finalNodeStatus: string | null;
  recentCapabilityId: string | null;
  error: string | null;
  stale: boolean;
  ageMs: number | null;
  maxAgeMs: number;
};

export type RuntimeAccessSystemOverlordSmokeSnapshot = {
  available: boolean;
  status: 'passed' | 'failed' | 'running' | 'skipped' | 'missing';
  checkedAt: string | null;
  summary: string | null;
  command: string;
  file: string;
  stale: boolean;
  ageMs: number | null;
  maxAgeMs: number;
  items: Array<{
    capability: 'browser.control' | 'network.tunnel' | 'wsl.exec' | 'docker.exec';
    status: 'passed' | 'failed' | 'skipped';
    runtimeTarget: string | null;
    summary: string;
    error: string | null;
    operatorNextStep: string | null;
  }>;
};

export type RuntimeAccessChannelProviderDoctorSnapshot = {
  available: boolean;
  status: 'passed' | 'failed' | 'skipped' | 'missing';
  checkedAt: string | null;
  summary: string | null;
  command: string;
  file: string;
  stale: boolean;
  ageMs: number | null;
  maxAgeMs: number;
  items: Array<{
    channelId: 'telegram' | 'discord' | 'slack' | 'whatsapp' | 'signal' | 'imessage' | 'teams' | 'email';
    mode: 'native' | 'cloud-api' | 'stub' | 'local-outbox' | 'baileys' | 'bridge' | 'signal-cli' | 'mac-bridge' | 'graph-bot' | 'smtp-imap' | 'unknown';
    status: 'passed' | 'failed' | 'skipped';
    configured: boolean;
    summary: string;
    error: string | null;
  }>;
};

export type RuntimeAccessRemoteTransportDoctorSnapshot = {
  available: boolean;
  status: 'passed' | 'failed' | 'running' | 'skipped' | 'missing';
  checkedAt: string | null;
  summary: string | null;
  command: string;
  file: string;
  stale: boolean;
  ageMs: number | null;
  maxAgeMs: number;
  recommendedAction: string | null;
  items: Array<{
    transportId: 'discord-transport' | 'AIGateway' | 'zavorth-terminal' | 'node-host' | string;
    mode: 'native' | 'remote' | 'local' | 'stub' | 'unknown';
    status: 'passed' | 'failed' | 'running' | 'skipped';
    configured: boolean;
    summary: string;
    error: string | null;
  }>;
};

export type RuntimeAccessLearningSnapshot = {
  available: boolean;
  generatedAt: string | null;
  summary: {
    total: number;
    pending: number;
    approved: number;
    promoted: number;
    quarantined: number;
    highConfidence: number;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export type RuntimeAccessLayeredMemorySnapshot = {
  available: boolean;
  generatedAt: string | null;
  summary: {
    total: number;
    episodic: number;
    semantic: number;
    procedural: number;
  };
  budgets: {
    perLayer: number;
    episodicUsage: number;
    semanticUsage: number;
    proceduralUsage: number;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export type RuntimeAccessPlatformSnapshot = {
  available: boolean;
  generatedAt: string | null;
  summary: {
    total: number;
    plugins: number;
    skills: number;
    mcps: number;
    collections: number;
    recipes: number;
    reviewPending: number;
    quarantined: number;
    learnedLocal: number;
  };
  catalogSyncSummary: string | null;
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export type RuntimeAccessDashboardSnapshot = {
  active: boolean;
  pid: number | null;
  host: string;
  port: number;
  url: string;
  startedAt: string | null;
  updatedAt: string | null;
};

export type RuntimeAccessReadinessInput = {
  hostSupervisor?: RuntimeAccessLockSnapshot | null;
  telegramWorker?: RuntimeAccessLockSnapshot | null;
  discordBridge?: RuntimeAccessDiscordBridgeSnapshot | null;
  providers?: RuntimeAccessProviderSnapshot | null;
  mcp?: RuntimeAccessMcpSnapshot | null;
  tenants?: RuntimeAccessTenantSnapshot | null;
  dashboard?: RuntimeAccessDashboardSnapshot | null;
  nodeMeshSmoke?: RuntimeAccessNodeMeshSmokeSnapshot | null;
  systemOverlordSmoke?: RuntimeAccessSystemOverlordSmokeSnapshot | null;
  channelProviderDoctor?: RuntimeAccessChannelProviderDoctorSnapshot | null;
  remoteTransportDoctor?: RuntimeAccessRemoteTransportDoctorSnapshot | null;
  learning?: Partial<RuntimeAccessLearningSnapshot> | null;
  layeredMemory?: Partial<RuntimeAccessLayeredMemorySnapshot> | null;
  platform?: Partial<RuntimeAccessPlatformSnapshot> | null;
  authStatus?: RuntimeAccessAuthStatus | null;
  hostIdentityStatus?: HostIdentityStatus | null;
};

export type RuntimeAccessReadinessReport = {
  checkedAt: string;
  runtime: {
    hostSupervisor: RuntimeAccessLockSnapshot;
    telegramWorker: RuntimeAccessLockSnapshot;
    discordBridge: RuntimeAccessDiscordBridgeSnapshot;
    providers: RuntimeAccessProviderSnapshot;
    mcp: RuntimeAccessMcpSnapshot;
    tenants: RuntimeAccessTenantSnapshot;
    dashboard: RuntimeAccessDashboardSnapshot | null;
    nodeMeshSmoke: RuntimeAccessNodeMeshSmokeSnapshot;
    systemOverlordSmoke: RuntimeAccessSystemOverlordSmokeSnapshot;
    channelProviderDoctor: RuntimeAccessChannelProviderDoctorSnapshot;
    remoteTransportDoctor: RuntimeAccessRemoteTransportDoctorSnapshot;
    learning: RuntimeAccessLearningSnapshot;
    layeredMemory: RuntimeAccessLayeredMemorySnapshot;
    platform: RuntimeAccessPlatformSnapshot;
    hostAuthorized: boolean | null;
    firstRun: boolean | null;
  };
  auth: RuntimeAccessAuthStatus;
  local: {
    baseUrl: string;
    dashboardUrl: string;
    appUrl: string;
    ready: boolean;
    issues: string[];
  };
  remote: {
    baseUrl: string | null;
    appUrl: string | null;
    ready: boolean;
    issues: string[];
  };
  recommendations: string[];
  nextSteps: RuntimeAccessReadinessStep[];
  summary: string;
};

export type RuntimeAccessResolvedInput = {
  hostSupervisor: RuntimeAccessLockSnapshot;
  telegramWorker: RuntimeAccessLockSnapshot;
  discordBridge: RuntimeAccessDiscordBridgeSnapshot;
  providers: RuntimeAccessProviderSnapshot;
  mcp: RuntimeAccessMcpSnapshot;
  tenants: RuntimeAccessTenantSnapshot;
  dashboard: RuntimeAccessDashboardSnapshot | null;
  nodeMeshSmoke: RuntimeAccessNodeMeshSmokeSnapshot;
  systemOverlordSmoke: RuntimeAccessSystemOverlordSmokeSnapshot;
  channelProviderDoctor: RuntimeAccessChannelProviderDoctorSnapshot;
  remoteTransportDoctor: RuntimeAccessRemoteTransportDoctorSnapshot;
  learning: RuntimeAccessLearningSnapshot;
  layeredMemory: RuntimeAccessLayeredMemorySnapshot;
  platform: RuntimeAccessPlatformSnapshot;
  auth: RuntimeAccessAuthStatus;
  hostIdentity: HostIdentityStatus | null;
};
