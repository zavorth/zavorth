import type { MnemosDreamCycleInput, MnemosDreamCycleSnapshot } from '../MnemosDreamCycleContract.js';
import type { ZavorthDynamicMissionHarnessInput, ZavorthDynamicMissionHarnessSnapshot } from '../ZavorthDynamicMissionHarnessContract.js';

export const ZAVORTH_EXPERIENCE_LEARNING_DAEMON_VERSION = 'experience-learning-daemon/v1' as const;
export const ZAVORTH_SKILL_FORGE_RUNTIME_VERSION = 'skill-forge-runtime/v1' as const;
export const ZAVORTH_CHANNEL_LIVE_CERTIFICATION_VERSION = 'channel-live-certification/v1' as const;
export const ZAVORTH_EXECUTION_BACKEND_PROVIDER_VERSION = 'execution-backend-provider/v1' as const;
export const ZAVORTH_NATIVE_AUTONOMY_SPINE_VERSION = 'native-autonomy-spine/v1' as const;

export type ZavorthNativeStatus = 'ready' | 'needs-review' | 'needs-approval' | 'attention' | 'blocked' | 'certified';
export type ZavorthLearningLane = 'green' | 'yellow' | 'red';
export type ZavorthLearningCandidateKind =
  | 'preference'
  | 'procedure'
  | 'skill-signal'
  | 'sensitive-user-model'
  | 'policy-change';

export type ZavorthTurnReceiptRef = {
  id: string;
  kind: string;
  status: string;
  summary: string;
};

export type ZavorthExperienceLearningTurnInput = {
  turnId: string;
  sessionId?: string | null;
  userId?: string | null;
  outcome: 'success' | 'failure' | 'interrupted';
  userMessage: string;
  assistantResponse: string;
  toolReceipts: ZavorthTurnReceiptRef[];
  toolCallCount: number;
  sourceSurface?: string | null;
  recallQuery?: string | null;
};

export type ZavorthExperienceLearningCandidate = {
  candidateId: string;
  kind: ZavorthLearningCandidateKind;
  lane: ZavorthLearningLane;
  risk: 'low' | 'medium' | 'high';
  status: 'auto-applied' | 'candidate' | 'blocked';
  approvalRequired: boolean;
  evidenceRefs: string[];
  confidence: number;
  expiry: string;
  receiptId: string;
  summary: string;
};

export type ZavorthExperienceLearningDaemonSnapshot = {
  version: typeof ZAVORTH_EXPERIENCE_LEARNING_DAEMON_VERSION;
  generatedAt: string;
  status: 'ready' | 'needs-review' | 'blocked';
  preTurnRecall: {
    ranBeforeTurn: boolean;
    query: string | null;
    results: Array<{
      id: string;
      summary: string;
      evidenceRefs: string[];
    }>;
  };
  postTurnReview: {
    ranAfterSuccessfulTurn: boolean;
    turnId: string;
    sourceSurface: string;
    redactedObservation: string;
  };
  candidates: ZavorthExperienceLearningCandidate[];
  safety: {
    redactionBeforeClassification: true;
    rawSecretsSerialized: false;
    psychologicalInferencesNeverGreen: true;
    policyChangesNeverGreen: true;
    receiptsRequired: true;
  };
};

export type ZavorthSkillForgeInput = {
  turnId: string;
  outcome: 'success' | 'failure' | 'interrupted';
  userMessage: string;
  assistantResponse: string;
  toolCallCount: number;
  observedFiles?: string[];
  requestedCapabilities?: string[];
};

export type ZavorthSkillForgeDraft = {
  draftId: string;
  title: string;
  status: 'draft' | 'rejected';
  materialized: boolean;
  approvalRequired: boolean;
  smokeRequired: boolean;
  rollbackAvailable: boolean;
  risk: 'low' | 'medium' | 'high';
  evidenceRefs: string[];
  preview: {
    manifest: string;
    skillBody: string;
    tests: string[];
  };
};

export type ZavorthSkillForgeRuntimeSnapshot = {
  version: typeof ZAVORTH_SKILL_FORGE_RUNTIME_VERSION;
  generatedAt: string;
  status: 'ready' | 'needs-approval' | 'attention';
  drafts: ZavorthSkillForgeDraft[];
  pipeline: Array<'observe' | 'draft' | 'scan' | 'smoke' | 'approve' | 'install' | 'measure' | 'curate'>;
  safety: {
    noDirectSkillFileWrites: true;
    executableSupportFilesHeldForApproval: true;
    importedToolsNeverExecutableByDefault: true;
    usageMetricsExcludePromptContent: true;
  };
};

export type ZavorthChannelProofResults = {
  handshake?: boolean;
  inboundEcho?: boolean;
  outboundEcho?: boolean;
  progressSignal?: boolean;
  stopCommand?: boolean;
  approvalCard?: boolean;
  fileSend?: boolean;
  receiptRecorded?: boolean;
};

export type ZavorthChannelLiveCertificationInput = {
  channelId: string;
  configured: boolean;
  proofResults?: ZavorthChannelProofResults;
};

export type ZavorthLiveProof = {
  id: string;
  label: string;
  status: 'passed' | 'failed';
  required: true;
};

export type ZavorthChannelLiveCertificationSnapshot = {
  version: typeof ZAVORTH_CHANNEL_LIVE_CERTIFICATION_VERSION;
  generatedAt: string;
  channelId: string;
  status: 'certified' | 'attention' | 'needs-configuration';
  proofs: ZavorthLiveProof[];
  readiness: {
    cataloged: true;
    configured: boolean;
    liveReady: boolean;
    defaultRouteAllowed: boolean;
    outboxOnly: boolean;
    proofRefs: string[];
  };
  blockedReasons: string[];
  safety: {
    stubsNeverDefaultRoute: true;
    stopRequiredBeforeLiveRoute: true;
    receiptsRequiredForExternalSend: true;
    rawSecretsSerialized: false;
  };
};

export type ZavorthBackendProofResults = {
  doctor?: boolean;
  prepareWorkspace?: boolean;
  run?: boolean;
  stream?: boolean;
  upload?: boolean;
  download?: boolean;
  snapshot?: boolean;
  hibernate?: boolean;
  resume?: boolean;
  cleanup?: boolean;
  costEstimate?: boolean;
};

export type ZavorthExecutionBackendProviderInput = {
  backendId: string;
  configured: boolean;
  command?: string | null;
  mutationRequested?: boolean;
  approvalId?: string | null;
  proofResults?: ZavorthBackendProofResults;
};

export type ZavorthExecutionBackendProviderSnapshot = {
  version: typeof ZAVORTH_EXECUTION_BACKEND_PROVIDER_VERSION;
  generatedAt: string;
  backendId: string;
  status: 'certified' | 'attention' | 'needs-configuration';
  proofs: ZavorthLiveProof[];
  readiness: {
    configured: boolean;
    liveReady: boolean;
    liveMutationAllowed: boolean;
    proofRefs: string[];
  };
  executionPlan: {
    mode: 'live' | 'dry-run';
    commandPreview: string | null;
    willMutate: boolean;
    reason: string;
  };
  approval: {
    required: boolean;
    present: boolean;
    reason: string | null;
  };
  safety: {
    noLiveMutationWithoutProof: true;
    unprovenBackendDryRunOnly: true;
    costEstimateRequired: true;
    rawSecretsSerialized: false;
  };
};

export type ZavorthNativeAutonomySpineInput = {
  turn: ZavorthExperienceLearningTurnInput;
  channel?: ZavorthChannelLiveCertificationInput | null;
  backend?: ZavorthExecutionBackendProviderInput | null;
  mission?: ZavorthDynamicMissionHarnessInput | null;
  dreamCycle?: MnemosDreamCycleInput | null;
};

export type ZavorthNativeAutonomySpineSnapshot = {
  version: typeof ZAVORTH_NATIVE_AUTONOMY_SPINE_VERSION;
  generatedAt: string;
  status: 'ready' | 'attention' | 'blocked';
  stages: Array<{
    id:
      | 'pre-turn-recall'
      | 'post-turn-learning'
      | 'skill-forge'
      | 'dynamic-mission-harness'
      | 'mnemos-dream-cycle'
      | 'channel-certification'
      | 'backend-provider'
      | 'review-center';
    status: 'ready' | 'attention' | 'blocked';
    summary: string;
  }>;
  learning: ZavorthExperienceLearningDaemonSnapshot;
  skillForge: ZavorthSkillForgeRuntimeSnapshot;
  learningWrite?: {
    mode: 'governed' | 'autonomous';
    appliedPreferences: number;
    draftedSkills: number;
    blocked: number;
    receiptIds: string[];
    preferenceStorePath: string | null;
    skillDraftRoot: string | null;
  };
  dynamicMission: ZavorthDynamicMissionHarnessSnapshot | null;
  dreamCycle: MnemosDreamCycleSnapshot | null;
  channel: ZavorthChannelLiveCertificationSnapshot | null;
  backend: ZavorthExecutionBackendProviderSnapshot | null;
  summary: {
    organicLearningReady: boolean;
    skillForgeReady: boolean;
    dynamicMissionReady: boolean;
    dreamCycleReady: boolean;
    liveChannelReady: boolean;
    backendProviderReady: boolean;
    learningWriteApplied: boolean;
  };
  reviewCenter: {
    actions: string[];
    receipts: string[];
    quietLanes: boolean;
  };
  safety: {
    rawSecretsSerialized: false;
    noLiveMutationWithoutProof: true;
    noDirectSkillFileWrites: true;
    noArbitraryMissionExecution: true;
    dreamCycleCandidateStoreOnly: true;
    channelDefaultRequiresProof: true;
    reviewAndForgetAvailable: true;
  };
};
