import type {
  ZavorthUniversalSkillCapabilityTag,
  ZavorthUniversalSkillPermissionProfileId,
} from './ZavorthUniversalSkillIntakeContract.js';

export const ZAVORTH_NATIVE_INTELLIGENCE_PACK_CONTRACT_VERSION =
  '2026-05-10.native-intelligence-phase-1' as const;

export type ZavorthNativeIntelligencePackStatus =
  | 'passed'
  | 'attention'
  | 'blocked';

export type ZavorthNativeSkillPresetId =
  | 'basic'
  | 'developer'
  | 'security'
  | 'research'
  | 'ops'
  | 'power-user';

export type ZavorthNativeSkillCategory =
  | 'reasoning'
  | 'orchestration'
  | 'security'
  | 'engineering'
  | 'research'
  | 'operations'
  | 'channels'
  | 'memory'
  | 'onboarding';

export type ZavorthNativeSkillRiskLevel =
  | 'low'
  | 'medium'
  | 'high'
  | 'blocked';

export type ZavorthNativeSkillDefinition = {
  id: string;
  name: string;
  description: string;
  category: ZavorthNativeSkillCategory;
  permissionProfileId: ZavorthUniversalSkillPermissionProfileId;
  riskLevel: ZavorthNativeSkillRiskLevel;
  capabilityTags: ZavorthUniversalSkillCapabilityTag[];
  presets: ZavorthNativeSkillPresetId[];
  inputContract: string[];
  outputContract: string[];
  runtimePolicy: {
    native: true;
    trustedSourceId: 'zavorth-native';
    noExecutionByDefault: true;
    noDirectToolUseByDefault: true;
    requiresPolicyBroker: true;
    receiptsRequired: true;
    untrustedContentMustBeDelimited: true;
  };
};

export type ZavorthNativeSkillFileStatus = {
  skillId: string;
  dirPath: string;
  skillFilePath: string;
  manifestPath: string;
  skillFileExists: boolean;
  manifestExists: boolean;
  manifestMatchesDefinition: boolean;
  issues: string[];
};

export type ZavorthNativeSkillRuntimeEntry = ZavorthNativeSkillDefinition & {
  fileStatus: ZavorthNativeSkillFileStatus;
  catalogVisible: boolean;
  activationReady: boolean;
};

export type ZavorthNativeSkillPreset = {
  id: ZavorthNativeSkillPresetId;
  label: string;
  description: string;
  skillIds: string[];
  defaultForUserType: string;
};

export type ZavorthNativeIntelligencePackSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_NATIVE_INTELLIGENCE_PACK_CONTRACT_VERSION;
  status: ZavorthNativeIntelligencePackStatus;
  projectRoot: string;
  nativeRootPath: string;
  selectedPreset: ZavorthNativeSkillPresetId;
  presets: ZavorthNativeSkillPreset[];
  skills: ZavorthNativeSkillRuntimeEntry[];
  activationPlan: {
    requested: boolean;
    presetId: ZavorthNativeSkillPresetId;
    requestedSkillIds: string[];
    readySkillIds: string[];
    blockedSkillIds: string[];
    approvalRequiredSkillIds: string[];
    noExecutionPerformed: true;
    noDirectToolUsePerformed: true;
    receiptsPrepared: number;
  };
  catalog: {
    sourceId: 'zavorth-native';
    sourceConfigured: boolean;
    policyAllowsSource: boolean;
    catalogVisibleSkillCount: number;
    missingFromCatalog: string[];
  };
  summary: {
    nativeSkills: number;
    presets: number;
    missingSkillFiles: number;
    manifestIssues: number;
    activationReady: number;
    approvalRequired: number;
    catalogVisible: number;
    executionPerformed: false;
    directToolUsePerformed: false;
  };
  policy: {
    nativePackIsZavorthOwned: true;
    externalSourceRequired: false;
    noExecutionByDefault: true;
    noDirectToolUseByDefault: true;
    policyBrokerRequiredForActions: true;
    receiptsRequiredForActivation: true;
    skillFilesAreStaticProductAssets: true;
    importedSkillsRemainSeparate: true;
  };
  commands: {
    list: 'npm run zavorth:native-intelligence-pack';
    listJson: 'npm run zavorth:native-intelligence-pack:json';
    activatePreset: 'npm run zavorth:native-intelligence-pack -- --preset developer --activate';
    check: 'npm run zavorth:native-intelligence-pack:check --silent';
    nextPhase: 'Phase 2 - Governed Subagent Model';
  };
};
