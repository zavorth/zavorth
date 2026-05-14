export const ZAVORTH_SKILL_ECOSYSTEM_PACK_CONTRACT_VERSION = '2026-05-05.phase-8' as const;

export type ZavorthSkillEcosystemStatus = 'passed' | 'failed';

export type ZavorthSkillEcosystemCheckStatus = 'pass' | 'warn' | 'fail' | 'deny';

export type ZavorthSkillCapabilityTag =
  | 'personal-productivity'
  | 'app-connector'
  | 'workspace-qa'
  | 'research'
  | 'document'
  | 'release'
  | 'security'
  | 'workflow';

export type ZavorthSkillPermissionProfileId =
  | 'local-readonly'
  | 'workspace-write-approval'
  | 'network-read-approval'
  | 'connector-live-secretref'
  | 'tool-execution-approval';

export type ZavorthSkillPermissionProfile = {
  id: ZavorthSkillPermissionProfileId;
  label: string;
  readWorkspace: boolean;
  writeWorkspace: boolean;
  network: 'none' | 'read' | 'live-api';
  secrets: 'none' | 'secret-ref-required';
  toolExecution: 'none' | 'non-destructive' | 'approval-required';
  ownerApprovalRequired: boolean;
  enabledByDefault: false;
  liveExternalIoAllowedByDefault: false;
  notes: string[];
};

export type ZavorthSkillSecretRef = {
  id: string;
  provider: 'api-key' | 'oauth' | 'webhook' | 'token' | 'none';
  configured: boolean;
  secretValueSerialized: false;
};

export type ZavorthSkillSmokeTestPrompt = {
  id: string;
  prompt: string;
  destructive: false;
  requiresLiveSecret: boolean;
  expectedReceipt: 'inspect' | 'deny' | 'dry-run';
};

export type ZavorthSkillManifest = {
  id: string;
  name: string;
  description: string;
  version: '0.1.0';
  sourceKind: 'zavorth-curated' | 'workspace-catalog' | 'connector-concept';
  optional: true;
  enabledByDefault: false;
  inspectableBeforeEnablement: true;
  ownerApprovalRequiredForEnablement: boolean;
  capabilityTags: ZavorthSkillCapabilityTag[];
  permissionProfileId: ZavorthSkillPermissionProfileId;
  requiredSecretRefs: ZavorthSkillSecretRef[];
  smokeTests: ZavorthSkillSmokeTestPrompt[];
  testPrompts: string[];
  mcpBridgeOptional: boolean;
  acpBridgeOptional: boolean;
  liveExternalIoAllowedByDefault: false;
  secretValuesSerialized: false;
  notes: string[];
};

export type ZavorthSkillPermissionEvaluation = {
  manifestId: string;
  profileId: ZavorthSkillPermissionProfileId;
  status: ZavorthSkillEcosystemCheckStatus;
  inspectAllowed: true;
  enableAllowed: boolean;
  executeAllowed: boolean;
  denialRequired: boolean;
  reason: string;
  requiredSecretRefs: string[];
  missingSecretRefs: string[];
  ownerApprovalRequired: boolean;
  enabledByDefault: false;
  liveExternalIoAllowedByDefault: false;
  secretValuesSerialized: false;
};

export type ZavorthSkillSmokeResult = {
  id: string;
  manifestId: string;
  promptId: string;
  status: ZavorthSkillEcosystemCheckStatus;
  mode: 'inspect' | 'dry-run' | 'denial';
  destructive: false;
  liveSecretsUsed: false;
  liveExternalIoPerformed: false;
  artifactFirst: true;
  observed: string;
};

export type ZavorthSkillPackReceiptKind = 'import' | 'inspect' | 'enable' | 'execute' | 'denial' | 'smoke';

export type ZavorthSkillPackReceipt = {
  id: string;
  kind: ZavorthSkillPackReceiptKind;
  manifestId: string;
  status: ZavorthSkillEcosystemCheckStatus;
  artifactFirst: true;
  optionalSkill: true;
  inspectableBeforeEnablement: true;
  ownerApprovalRequired: boolean;
  liveSecretsUsed: false;
  liveExternalIoPerformed: false;
  secretValuesSerialized: false;
  enabledByDefault: false;
  reason: string;
};

export type ZavorthSkillEcosystemImporterSnapshot = {
  status: ZavorthSkillEcosystemCheckStatus;
  manifests: ZavorthSkillManifest[];
  selectedSkills: number;
  connectorConcepts: number;
  workspaceCatalogInputs: number;
  enabledByDefault: false;
  liveExternalIoPerformed: false;
  secretValuesSerialized: false;
};

export type ZavorthSkillPermissionProfileSnapshot = {
  status: ZavorthSkillEcosystemCheckStatus;
  profiles: ZavorthSkillPermissionProfile[];
  evaluations: ZavorthSkillPermissionEvaluation[];
  enablementsAllowed: number;
  enablementsDenied: number;
  liveSkillsRequiringOwnerApproval: number;
  liveSkillsMissingSecretRefs: number;
  enabledByDefault: false;
  liveExternalIoPerformed: false;
  secretValuesSerialized: false;
};

export type ZavorthSkillSmokeRunnerSnapshot = {
  status: ZavorthSkillEcosystemCheckStatus;
  smokeTests: number;
  passed: number;
  denied: number;
  failed: number;
  results: ZavorthSkillSmokeResult[];
  nonDestructiveOnly: true;
  liveSecretsUsed: false;
  liveExternalIoPerformed: false;
  secretValuesSerialized: false;
};

export type ZavorthSkillPackReceiptSnapshot = {
  status: ZavorthSkillEcosystemCheckStatus;
  receipts: ZavorthSkillPackReceipt[];
  imports: number;
  inspections: number;
  enablements: number;
  executions: number;
  denials: number;
  smokes: number;
  enabledByDefault: false;
  liveExternalIoPerformed: false;
  secretValuesSerialized: false;
};

export type ZavorthSkillEcosystemPackSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SKILL_ECOSYSTEM_PACK_CONTRACT_VERSION;
  status: ZavorthSkillEcosystemStatus;
  phase: 8;
  statement: 'Zavorth skill ecosystem capacity is optional, manifest-driven, policy-aware and receipt-first.';
  runtime: {
    platform: NodeJS.Platform;
    arch: string;
    nodeVersion: string;
    cwd: string;
  };
  importer: ZavorthSkillEcosystemImporterSnapshot;
  permissions: ZavorthSkillPermissionProfileSnapshot;
  smokeRunner: ZavorthSkillSmokeRunnerSnapshot;
  receipts: ZavorthSkillPackReceiptSnapshot;
  summary: {
    manifests: number;
    connectorConcepts: number;
    capabilityTags: number;
    permissionProfiles: number;
    smokeTests: number;
    receipts: number;
    optionalSkills: number;
    inspectableBeforeEnablement: number;
    enabledByDefault: false;
    liveSkillsRequireOwnerApproval: boolean;
    liveSkillsRequireSecretRef: boolean;
    nonDestructiveSmokeOnly: true;
    liveExternalIoPerformed: false;
    secretValuesSerialized: false;
  };
  policy: {
    optionalEcosystemCapacity: true;
    inspectBeforeEnablement: true;
    nonDestructiveSmokeOnly: true;
    liveSkillsRequireOwnerApproval: true;
    liveSkillsRequireSecretRef: true;
    noSecretsInReceipts: true;
    noCoreBloat: true;
    mcpAcpBridgeOptional: true;
  };
  commands: {
    inspect: 'npm run zavorth-skill-ecosystem-pack --silent';
    inspectJson: 'npm run zavorth-skill-ecosystem-pack:json --silent';
    check: 'npm run zavorth-skill-ecosystem-pack:check --silent';
    qa: 'npm run qa:zavorth-skill-ecosystem-pack --silent';
    nextPhase: 'Phase 9 - Full Functional Closure';
  };
};
