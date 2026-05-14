export type ZavorthFirstRunTonePreference = 'conciso' | 'equilibrado' | 'detalhado';

export type ZavorthFirstRunMemoryMode = 'off' | 'local-metadata' | 'local-summary';

export type ZavorthFirstRunSafetyPosture = 'preview-first' | 'approval-required' | 'local-only';

export type ZavorthFirstRunProviderStatus = 'deferred' | 'configured-placeholder';

export type ZavorthFirstRunWizardQuestion = {
  id:
    | 'user-display-name'
    | 'agent-display-name'
    | 'tone-preference'
    | 'workspace-root'
    | 'provider-model'
    | 'memory-mode'
    | 'safety-posture'
    | 'summary-confirmation';
  prompt: string;
  required: boolean;
  defaultValue: string | null;
  choices: string[];
};

export type ZavorthFirstRunProviderProfile = {
  providerId: string;
  modelId: string;
  providerStatus: ZavorthFirstRunProviderStatus;
  rawSecretStored: false;
};

export type ZavorthFirstRunWorkspaceProfile = {
  schemaVersion: 'zavorth.first-run.profile/v1';
  profileId: string;
  createdAt: string;
  updatedAt: string;
  userDisplayName: string;
  preferredAddress: string;
  agentDisplayName: string;
  tonePreference: ZavorthFirstRunTonePreference;
  workspaceRoot: string;
  provider: ZavorthFirstRunProviderProfile;
  memoryMode: ZavorthFirstRunMemoryMode;
  safetyPosture: ZavorthFirstRunSafetyPosture;
  privacy: {
    rawSecretSerialized: false;
    rawEnvSerialized: false;
    rawIntentSerialized: false;
    redacted: true;
  };
};

export type ZavorthFirstRunBootstrapPaths = {
  storageRoot: string;
  runtimeDir: string;
  profilePath: string;
  workspacePath: string;
  identityPath: string;
  policyPath: string;
};

export type ZavorthFirstRunBootstrapWrite = {
  path: string;
  action: 'create' | 'update' | 'skip';
  reason: string;
};

export type ZavorthFirstRunBootstrapPlan = {
  nativeContract: 'ZavorthFirstRunBootstrapPlan/v1';
  generatedAt: string;
  mode: 'dry-run' | 'apply';
  status: 'ready' | 'profile-exists' | 'blocked' | 'non-interactive';
  dryRun: boolean;
  nonInteractiveSafe: boolean;
  paths: ZavorthFirstRunBootstrapPaths;
  questions: ZavorthFirstRunWizardQuestion[];
  profile: ZavorthFirstRunWorkspaceProfile;
  existingProfile: {
    exists: boolean;
    path: string;
    summary: string | null;
  };
  writes: ZavorthFirstRunBootstrapWrite[];
  summary: string[];
  willNotWrite: string[];
  nextCommands: string[];
  redactedJson: string;
  safety: {
    canApply: boolean;
    requiresConfirmation: boolean;
    rawSecretSerialized: false;
    runtimePersistentStartPerformed: false;
    providerExecutionPerformed: false;
    toolExecutionPerformed: false;
    messageSendPerformed: false;
    rawImportPerformed: false;
    warnings: string[];
    blockers: string[];
  };
};

export type ZavorthFirstRunBootstrapApplyResult = {
  nativeContract: 'ZavorthFirstRunBootstrapApplyResult/v1';
  status: 'applied' | 'cancelled' | 'dry-run' | 'profile-exists' | 'blocked';
  dryRun: boolean;
  writtenFiles: string[];
  skippedFiles: string[];
  profile: ZavorthFirstRunWorkspaceProfile | null;
  paths: ZavorthFirstRunBootstrapPaths;
  redactedJson: string | null;
  summary: string[];
  nextCommands: string[];
  rawSecretSerialized: false;
  runtimePersistentStartPerformed: false;
};

export type ZavorthWorkspaceIdentityProfileSnapshot = {
  nativeContract: 'ZavorthWorkspaceIdentityProfileSnapshot/v1';
  configured: boolean;
  profilePath: string;
  userDisplayName: string | null;
  agentDisplayName: string | null;
  tonePreference: ZavorthFirstRunTonePreference | null;
  workspaceRoot: string | null;
  memoryMode: ZavorthFirstRunMemoryMode | null;
  safetyPosture: ZavorthFirstRunSafetyPosture | null;
  providerStatus: ZavorthFirstRunProviderStatus | null;
};

export type ZavorthFirstRunBootstrapAnswers = {
  userDisplayName?: string | null;
  preferredAddress?: string | null;
  agentDisplayName?: string | null;
  tonePreference?: ZavorthFirstRunTonePreference | string | null;
  workspaceRoot?: string | null;
  providerId?: string | null;
  modelId?: string | null;
  providerStatus?: ZavorthFirstRunProviderStatus | string | null;
  memoryMode?: ZavorthFirstRunMemoryMode | string | null;
  safetyPosture?: ZavorthFirstRunSafetyPosture | string | null;
};
