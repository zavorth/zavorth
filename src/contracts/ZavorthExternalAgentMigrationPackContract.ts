import type { ZavorthExternalAgentOnboardingSnapshot } from './ZavorthExternalAgentOnboardingContract.js';
import type { ZavorthExternalAgentGatewayReceipt } from './ZavorthExternalAgentGatewayContract.js';

export const ZAVORTH_EXTERNAL_AGENT_MIGRATION_PACK_CONTRACT_VERSION =
  'zavorth-external-agent-migration-pack/1' as const;

export type ZavorthExternalAgentMigrationPreset =
  | 'preview'
  | 'user-data'
  | 'capabilities'
  | 'full';

export type ZavorthExternalAgentMigrationStatus =
  | 'needs-user-hint'
  | 'blocked'
  | 'preview-ready'
  | 'approval-required'
  | 'migrated'
  | 'partial';

export type ZavorthExternalAgentMigrationAssetKind =
  | 'persona'
  | 'memory'
  | 'skill'
  | 'command-policy'
  | 'messaging'
  | 'provider'
  | 'tts-asset'
  | 'workspace-instruction'
  | 'agent-profile'
  | 'unknown';

export type ZavorthExternalAgentMigrationAsset = {
  id: string;
  kind: ZavorthExternalAgentMigrationAssetKind;
  label: string;
  sourcePath: string | null;
  targetPath: string | null;
  action: 'copy-sanitized-draft' | 'materialize-skill-draft' | 'register-profile-preview' | 'secret-ref-only' | 'skip';
  status: 'planned' | 'written' | 'skipped' | 'blocked';
  risk: 'low' | 'medium' | 'high';
  reasons: string[];
  bytesRead: number;
  secretLikeContentDetected: boolean;
};

export type ZavorthExternalAgentMigrationReceipt = {
  id: string;
  generatedAt: string;
  status: ZavorthExternalAgentMigrationStatus;
  approvalId: string | null;
  apply: boolean;
  preset: ZavorthExternalAgentMigrationPreset;
  sourceFingerprint: string;
  assetsPlanned: number;
  assetsWritten: number;
  skippedSecrets: number;
  guarantees: {
    consentRequired: true;
    noExternalProcessStarted: true;
    noNetworkProbe: true;
    rawSecretsSerialized: false;
    writesRequireApproval: true;
    skillImportsAreDrafts: true;
    providerKeysBecomeSecretRefsOnly: true;
  };
};

export type ZavorthExternalAgentMigrationPackSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_EXTERNAL_AGENT_MIGRATION_PACK_CONTRACT_VERSION;
  surface: 'external-agent-migration-pack';
  status: ZavorthExternalAgentMigrationStatus;
  preset: ZavorthExternalAgentMigrationPreset;
  requestedBy: string;
  source: {
    kind: 'none' | 'exact-path' | 'approximate-path' | 'cli-command' | 'endpoint';
    value: string | null;
    fingerprint: string;
  };
  onboarding: ZavorthExternalAgentOnboardingSnapshot;
  summary: {
    candidates: number;
    assetsPlanned: number;
    assetsWritten: number;
    persona: number;
    memory: number;
    skills: number;
    commandPolicies: number;
    messaging: number;
    providers: number;
    ttsAssets: number;
    workspaceInstructions: number;
    agentProfiles: number;
    skippedSecrets: number;
    blockedAssets: number;
  };
  assets: ZavorthExternalAgentMigrationAsset[];
  registrationReceipts: ZavorthExternalAgentGatewayReceipt[];
  receipt: ZavorthExternalAgentMigrationReceipt;
  policy: {
    dryRunDefault: true;
    applyRequiresApprovalId: true;
    noDotEnvRead: true;
    noSecretFileRead: true;
    noRuntimeExecution: true;
    noNetworkProbe: true;
    importedSkillsDraftOnly: true;
    externalAgentRegistrationSeparateFromInvocation: true;
    rollbackByReceipt: true;
  };
  rollback: {
    available: boolean;
    affectedPaths: string[];
    instruction: string | null;
  };
  commands: {
    preview: string;
    apply: string;
    registerAsArm: string;
    check: string;
  };
};
