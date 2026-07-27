import type { SecurityPolicyBrokerReceipt, SecurityPolicyBrokerSurface } from '../../security/SecurityPolicyBroker.js';
import type { SubagentResultReceipt, SubagentScopeMode } from '../../runtime/agent/subagents/index.js';
import type {
  ZavorthNativeSkillPresetId,
  ZavorthNativeSkillRiskLevel,
} from '../ZavorthNativeIntelligencePackContract.js';
import type { ZavorthUniversalSkillPermissionProfileId } from '../ZavorthUniversalSkillIntakeContract.js';

export const ZAVORTH_GOVERNED_SUBAGENT_CONTRACT_VERSION =
  '2026-05-10.governed-subagent-gate-2' as const;

export type ZavorthGovernedSubagentStatus =
  | 'passed'
  | 'attention'
  | 'blocked';

export type ZavorthGovernedSubagentProfileId =
  | 'planner'
  | 'researcher'
  | 'auditor'
  | 'coder'
  | 'qa'
  | 'operator'
  | 'memory-curator';

export type ZavorthGovernedSubagentRuntimeStatus =
  | 'ready'
  | 'approval-required'
  | 'blocked';

export type ZavorthGovernedSubagentBudget = {
  maxToolCalls: number;
  maxWallClockMs: number;
  maxOutputBytes: number;
  maxPromptChars: number;
  maxFileReads: number;
  maxFileWrites: number;
  maxNetworkCalls: number;
};

export type ZavorthGovernedSubagentProfile = {
  id: ZavorthGovernedSubagentProfileId;
  label: string;
  objective: string;
  nativeSkillIds: string[];
  permissionProfileId: ZavorthUniversalSkillPermissionProfileId;
  riskLevel: ZavorthNativeSkillRiskLevel;
  scopeMode: SubagentScopeMode;
  allowedSurfaces: SecurityPolicyBrokerSurface[];
  allowedToolIds: string[];
  deniedPaths: string[];
  requiresUserApproval: boolean;
  requiresAdminPolicy: boolean;
  budget: ZavorthGovernedSubagentBudget;
  handoffContract: {
    accepts: string[];
    produces: string[];
    mustNotProduce: string[];
  };
  isolation: {
    noSharedMutableMemoryByDefault: true;
    untrustedContentMustBeDelimited: true;
    toolOutputsMustBeReceipted: true;
    launchRequiresPolicyBroker: true;
  };
};

export type ZavorthGovernedSubagentPreparedRole = {
  profile: ZavorthGovernedSubagentProfile;
  runtimeStatus: ZavorthGovernedSubagentRuntimeStatus;
  nativeSkills: {
    requiredSkillIds: string[];
    readySkillIds: string[];
    missingSkillIds: string[];
  };
  policyReceipt: SecurityPolicyBrokerReceipt;
  subagentReceipt: SubagentResultReceipt;
  launchBoundary: {
    preparedOnly: true;
    noSubagentLaunched: true;
    noToolInvoked: true;
    noWorkspaceMutation: true;
    approvalRequiredBeforeLaunch: true;
  };
};

export type ZavorthGovernedSubagentSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_GOVERNED_SUBAGENT_CONTRACT_VERSION;
  status: ZavorthGovernedSubagentStatus;
  source: 'ZavorthGovernedSubagentService';
  projectRoot: string;
  selectedPreset: ZavorthNativeSkillPresetId;
  task: string | null;
  profiles: ZavorthGovernedSubagentProfile[];
  selectedProfileIds: ZavorthGovernedSubagentProfileId[];
  preparedRoles: ZavorthGovernedSubagentPreparedRole[];
  summary: {
    profiles: number;
    selectedRoles: number;
    readyRoles: number;
    approvalRequiredRoles: number;
    blockedRoles: number;
    nativePackStatus: string;
    nativeSkillsReady: number;
    policyReceipts: number;
    subagentReceipts: number;
    executionPerformed: false;
    directToolUsePerformed: false;
    workspaceMutationPerformed: false;
  };
  guarantees: {
    compilerOnly: true;
    noSubagentsLaunched: true;
    noToolsInvoked: true;
    noWorkspaceMutation: true;
    launchRequiresUserApproval: true;
    launchRequiresPolicyBroker: true;
    launchRequiresBudget: true;
    nativeSkillsBackEveryRole: true;
    untrustedContentDelimited: true;
    receiptsRequired: true;
  };
  commands: {
    preview: 'npm run zavorth:governed-subagents';
    previewJson: 'npm run zavorth:governed-subagents:json';
    prepareDeveloper: 'npm run zavorth:governed-subagents -- --preset developer --prepare';
    check: 'npm run zavorth:governed-subagents:check --silent';
    nextAction: 'Approval gate - Large Skill Absorption Pipeline';
  };
};
