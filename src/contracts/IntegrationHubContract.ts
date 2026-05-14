import type {
  VendorLicenseDecision,
  VendorReleaseIndexEntry,
  VendorReleaseIndexSnapshot,
} from './VendorPlaneContract.js';

export type IntegrationInstallMode = 'api' | 'cli' | 'docker' | 'browser' | 'mcp';

export type IntegrationCapability =
  | 'chat'
  | 'code'
  | 'vision'
  | 'browser'
  | 'agents'
  | 'search'
  | 'automation'
  | 'memory';

export type IntegrationSupportLevel = 'native' | 'recipe' | 'experimental' | 'manual' | 'template';

export type IntegrationBindingKind = 'provider' | 'executor' | 'service' | 'manual' | 'planned';

export type IntegrationRequirementType = 'env' | 'binary' | 'docker' | 'account' | 'browser' | 'manual';

export type IntegrationQuestionType = 'single_choice' | 'multi_choice' | 'text' | 'boolean' | 'secret';

export type IntegrationConnectionStatus = 'discovered' | 'planned' | 'configured' | 'healthy' | 'degraded';

export type IntegrationBinding = {
  kind: IntegrationBindingKind;
  key: string | null;
  status: 'ready' | 'partial' | 'planned';
  summary: string;
};

export type IntegrationInstallModeDescriptor = {
  id: IntegrationInstallMode;
  label: string;
  summary: string;
  autoInstallable: boolean;
  safeByDefault: boolean;
};

export type IntegrationRequirement = {
  id: string;
  type: IntegrationRequirementType;
  label: string;
  description: string;
  required: boolean;
  secret?: boolean;
  envKey?: string | null;
};

export type IntegrationQuestionChoice = {
  value: string;
  label: string;
  description: string;
};

export type IntegrationQuestion = {
  id: string;
  label: string;
  type: IntegrationQuestionType;
  required: boolean;
  help: string;
  choices?: IntegrationQuestionChoice[];
  placeholder?: string;
};

export type IntegrationInstallStep = {
  id: string;
  title: string;
  description: string;
  kind: 'guided' | 'manual' | 'automatic' | 'verification';
  command?: string | null;
  blocking?: boolean;
};

export type IntegrationManifest = {
  id: string;
  label: string;
  aliases: string[];
  summary: string;
  description: string;
  supportLevel: IntegrationSupportLevel;
  category: 'remote' | 'local' | 'template';
  tags: string[];
  modes: IntegrationInstallModeDescriptor[];
  defaultMode: IntegrationInstallMode;
  capabilities: IntegrationCapability[];
  binding: IntegrationBinding;
  requirements: IntegrationRequirement[];
  onboardingQuestions: IntegrationQuestion[];
  installSteps: IntegrationInstallStep[];
  safetyNotes: string[];
  goodFor: string[];
};

export type IntegrationDraftAnswerMap = Record<string, string | string[] | boolean>;

export type InstalledIntegrationState = {
  id: string;
  nickname: string | null;
  requestedBy: string | null;
  status: IntegrationConnectionStatus;
  selectedMode: IntegrationInstallMode;
  enabledCapabilities: IntegrationCapability[];
  answers: IntegrationDraftAnswerMap;
  createdAt: string;
  updatedAt: string;
  configuredAt: string | null;
  lastHealthCheckAt: string | null;
  lastHealthStatus: 'ok' | 'warn' | 'error' | 'unknown';
  notes: string[];
};

export type IntegrationHubState = {
  version: number;
  updatedAt: string;
  entries: Record<string, InstalledIntegrationState>;
};

export type IntegrationSecretsState = {
  version: number;
  updatedAt: string;
  entries: Record<string, Record<string, string>>;
};

export type IntegrationDoctorFinding = {
  level: 'info' | 'warn' | 'error';
  title: string;
  detail: string;
};

export type IntegrationDoctorPlaybookStep = {
  id: string;
  label: string;
  detail: string;
  kind: 'automatic' | 'guided' | 'manual' | 'verification';
  status: 'done' | 'next' | 'pending' | 'optional';
  actionId?: string | null;
  command?: string | null;
};

export type IntegrationProbeStatus = 'ok' | 'failed' | 'not_configured' | 'unsupported';

export type IntegrationProbeTransport = 'api' | 'runtime' | 'cli' | 'docker' | 'unsupported';

export type IntegrationProbeSnapshot = {
  generatedAt: string;
  integrationId: string;
  label: string;
  status: IntegrationProbeStatus;
  transport: IntegrationProbeTransport;
  summary: string;
  detail: string;
  checkedTarget: string | null;
  httpStatus: number | null;
  latencyMs: number | null;
};

export type IntegrationDoctorSnapshot = {
  generatedAt: string;
  integrationId: string;
  label: string;
  nickname: string | null;
  status: 'ok' | 'warn' | 'error';
  binding: IntegrationBinding;
  configured: boolean;
  selectedMode: IntegrationInstallMode | null;
  enabledCapabilities: IntegrationCapability[];
  probe?: IntegrationProbeSnapshot | null;
  findings: IntegrationDoctorFinding[];
  playbook?: {
    headline: string;
    summary: string;
    steps: IntegrationDoctorPlaybookStep[];
  };
  nextAction: {
    label: string;
    command: string;
    reason: string;
  };
};

export type IntegrationHubProviderEntry = {
  id: string;
  label: string;
  effectiveProviderName: string;
  mode: 'cloud' | 'local' | 'hybrid' | 'alias';
  readiness: 'ready' | 'needs_config' | 'needs_probe';
  currentModel: string | null;
  summary: string;
  issue: string | null;
};

export type IntegrationHubProviderProfile = {
  id: string;
  label: string;
  summary: string;
  preferredOrder: string[];
};

export type IntegrationHubProviderSnapshot = {
  generatedAt: string;
  activeProviderName: string;
  activeModelName: string;
  preferredZavorthBridgeModel: string | null;
  recommendedProfile: {
    id: string;
    label: string;
    providerName: string;
    modelName: string | null;
    fallbackOrder: string[];
  };
  ready: IntegrationHubProviderEntry[];
  needsConfiguration: IntegrationHubProviderEntry[];
  needsProbe: IntegrationHubProviderEntry[];
  profiles: IntegrationHubProviderProfile[];
  usageTargets: string[];
  recommendations: string[];
};

export type IntegrationHubMcpServerEntry = {
  id: string;
  capability: string | null;
  enabled: boolean;
  status: 'manifest_only' | 'connected' | 'failed' | 'disabled' | 'stopped';
  toolCount: number;
  toolNames: string[];
  summary: string;
  issue: string | null;
  lastAttemptedAt: string | null;
  lastConnectedAt: string | null;
};

export type IntegrationHubMcpSnapshot = {
  generatedAt: string;
  manifestPath: string;
  summary: {
    total: number;
    enabled: number;
    connected: number;
    failed: number;
    disabled: number;
    stopped: number;
    toolCount: number;
    capabilityCount: number;
  };
  capabilities: string[];
  entries: IntegrationHubMcpServerEntry[];
  recommendations: string[];
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export type IntegrationGuidedAction = {
  id: string;
  label: string;
  description: string;
  command: string | null;
  executable: boolean;
  manualOnly: boolean;
  kind: 'doctor' | 'install_step' | 'inspect' | 'recipe';
  severity: 'primary' | 'recommended' | 'manual';
  blocking: boolean;
  impact?: {
    level: 'read_only' | 'writes_runtime' | 'starts_local_service' | 'manual';
    summary: string;
    details: string[];
    requiresConfirmation: boolean;
  };
};

export type IntegrationActionPlan = {
  generatedAt: string;
  integrationId: string;
  primaryActionId: string | null;
  actions: IntegrationGuidedAction[];
};

export type IntegrationActionExecutionStatus =
  | 'started'
  | 'completed'
  | 'partial'
  | 'manual_only'
  | 'blocked'
  | 'failed_to_start'
  | 'failed';

export type IntegrationActionExecutionRecord = {
  executionId: string;
  integrationId: string;
  actionId: string;
  label: string;
  command: string;
  startedAt: string;
  finishedAt?: string | null;
  pid: number | null;
  logFile: string;
  status: IntegrationActionExecutionStatus;
  note: string | null;
  doctor?: IntegrationDoctorSnapshot | null;
  probe?: IntegrationProbeSnapshot | null;
  appliedEnvKeys?: string[];
  exitCode?: number | null;
};

export type IntegrationActionMonitorSnapshot = {
  generatedAt: string;
  integrationId: string;
  latestAction: IntegrationActionExecutionRecord | null;
  recentActions: IntegrationActionExecutionRecord[];
  logExcerpt: {
    logFile: string | null;
    lines: string[];
  };
};

export type IntegrationResolution = {
  requestedId: string;
  manifest: IntegrationManifest | null;
  matchedBy: 'id' | 'alias' | 'suggested' | 'template' | 'none';
  suggestion: IntegrationManifest | null;
  note: string;
};

export type IntegrationCatalogEntry = {
  manifest: IntegrationManifest;
  installed: InstalledIntegrationState | null;
  doctor: IntegrationDoctorSnapshot;
  readiness: 'ready' | 'needs_configuration' | 'planned';
  vendor?: {
    index: VendorReleaseIndexEntry;
    license: VendorLicenseDecision;
  } | null;
};

export type IntegrationDetailSnapshot = {
  manifest: IntegrationManifest;
  installed: InstalledIntegrationState | null;
  doctor: IntegrationDoctorSnapshot;
  readiness: IntegrationCatalogEntry['readiness'];
  storedSecretKeys: string[];
  actionPlan: IntegrationActionPlan;
  actionMonitor: IntegrationActionMonitorSnapshot;
  vendor?: {
    index: VendorReleaseIndexEntry;
    license: VendorLicenseDecision;
  } | null;
};

export type IntegrationCatalogSnapshot = {
  generatedAt: string;
  entries: IntegrationCatalogEntry[];
  featuredIds: string[];
  templateIds: string[];
  providers: IntegrationHubProviderSnapshot;
  mcp: IntegrationHubMcpSnapshot;
  vendors?: VendorReleaseIndexSnapshot;
  selected: IntegrationDetailSnapshot | null;
};

export type IntegrationInstallDraft = {
  resolution: IntegrationResolution;
  manifest: IntegrationManifest;
  installed: InstalledIntegrationState;
  selectedMode: IntegrationInstallMode;
  enabledCapabilities: IntegrationCapability[];
  missingRequirements: IntegrationRequirement[];
  unansweredQuestions: IntegrationQuestion[];
  nextAction: {
    label: string;
    command: string;
    reason: string;
  };
};
