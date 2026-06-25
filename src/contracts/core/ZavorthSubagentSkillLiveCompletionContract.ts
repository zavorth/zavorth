export const ZAVORTH_SUBAGENT_SKILL_LIVE_COMPLETION_CONTRACT_VERSION =
  '2026-05-14.checkpoint-6-subagent-skill-live-completion' as const;

export type ZavorthSubagentSkillCompletionStatus = 'passed' | 'attention' | 'blocked';

export type ZavorthSubagentSkillReadinessProof =
  | 'none'
  | 'catalog'
  | 'compiler'
  | 'mock-live-worker'
  | 'live-worker'
  | 'imported-skill'
  | 'bridge-envelope'
  | 'owner-approved-live'
  | 'policy-blocked';

export type ZavorthSubagentSkillCompletionEntry = {
  id: string;
  label: string;
  kind: 'subagent-runtime' | 'natural-router' | 'skill-bridge' | 'skill-catalog' | 'large-absorption';
  status: ZavorthSubagentSkillCompletionStatus;
  catalogReady: boolean;
  liveReady: boolean;
  defaultRouteAllowed: boolean;
  readinessProof: ZavorthSubagentSkillReadinessProof;
  defaultBlockReason: string | null;
  evidence: string[];
};

export type ZavorthSubagentSkillCompletionSkillEntry = {
  name: string;
  sourceId: string | null;
  imported: boolean;
  bridgeReady: boolean;
  liveReady: boolean;
  defaultRouteAllowed: boolean;
  readinessProof: ZavorthSubagentSkillReadinessProof;
  defaultBlockReason: string | null;
  riskLevel: string | null;
  instructionsOnly: true;
  executableCodeAllowed: false;
};

export type ZavorthSubagentSkillLiveCompletionSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SUBAGENT_SKILL_LIVE_COMPLETION_CONTRACT_VERSION;
  source: 'ZavorthSubagentSkillLiveCompletionService';
  status: ZavorthSubagentSkillCompletionStatus;
  entries: ZavorthSubagentSkillCompletionEntry[];
  skills: ZavorthSubagentSkillCompletionSkillEntry[];
  summary: {
    entries: number;
    passed: number;
    attention: number;
    blocked: number;
    subagentRuntimeLiveReady: boolean;
    naturalInvocationReady: boolean;
    importedSkills: number;
    bridgeReadySkills: number;
    defaultRouteAllowedSkills: number;
    liveReadySkills: number;
    rawSecretsSerialized: false;
    workspaceMutationPerformed: false;
    externalIoPerformed: false;
  };
  liveCompletion: {
    subagentsCanSpawnExplicitly: boolean;
    subagentsCanRunMockLiveWorkers: boolean;
    subagentsCanUseLiveWorkersWhenProviderReady: boolean;
    naturalRouterCanSelectSubagents: boolean;
    naturalRouterCanSelectSkills: boolean;
    skillsAreInstructionsOnlyByDefault: true;
    skillLiveUseRequiresOwnerApproval: true;
    importedSkillSupportFilesAreNotExecutableTools: true;
    defaultRouteRequiresReadinessProof: true;
  };
  safety: {
    policyBrokerRequired: true;
    approvalRequiredForWorkspaceMutation: true;
    approvalRequiredForSensitiveNetwork: true;
    approvalRequiredForExternalSend: true;
    spawnDepthLimited: true;
    childCountLimited: true;
    promptInjectionScanRequiredForSkills: true;
    rawSecretsSerialized: false;
    noUnboundedSpawn: true;
    noLiveSkillCodeExecutionByDefault: true;
  };
  commands: {
    inspect: 'npm run zavorth:subagent-skill-live-completion';
    inspectJson: 'npm run zavorth:subagent-skill-live-completion:json';
    check: 'npm run zavorth:subagent-skill-live-completion:check --silent';
    nextStage: 'Surface controls - Scheduler, Perception and Device Live Completion';
  };
};
