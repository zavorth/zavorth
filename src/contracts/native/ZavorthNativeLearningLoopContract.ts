import type { ZavorthAdaptiveLearningSnapshot } from './ZavorthAdaptiveLearningOsContract.js';

export const ZAVORTH_NATIVE_LEARNING_LOOP_CONTRACT_VERSION =
  '2026-05-24.phase-3-native-learning-loop' as const;

export type ZavorthNativeLearningLoopCandidateKind =
  | 'auto-skill-candidate'
  | 'skill-improvement-candidate'
  | 'approved-nudge'
  | 'user-model-update'
  | 'procedural-memory';

export type ZavorthNativeLearningLoopCandidateState =
  | 'suggested'
  | 'requires_approval'
  | 'quarantined'
  | 'promoted'
  | 'revoked';

export type ZavorthNativeLearningLoopRisk = 'low' | 'medium' | 'high' | 'critical';

export type ZavorthNativeLearningLoopCandidate = {
  id: string;
  kind: ZavorthNativeLearningLoopCandidateKind;
  title: string;
  summary: string;
  recommendation: string;
  confidence: number;
  risk: ZavorthNativeLearningLoopRisk;
  state: ZavorthNativeLearningLoopCandidateState;
  approvalRequired: boolean;
  reversible: true;
  source: {
    surface: string;
    workspace: string | null;
    sessionId: string | null;
    evidenceRefs: string[];
  };
  actions: Array<{
    id:
      | 'approve'
      | 'reject'
      | 'promote'
      | 'forget'
      | 'promoteProcedure'
      | 'promoteSkill'
      | 'preview-skill'
      | 'convert-to-procedure';
    label: string;
    command: string;
  }>;
  safety: {
    rawSecretsSerialized: false;
    canModifySecurityPolicy: false;
    securityPolicyFirewall: true;
    untrustedEvidence: true;
  };
};

export type ZavorthNativeLearningLoopSessionSearch = {
  query: string;
  total: number;
  topKOnly: true;
  untrustedOnRecall: true;
  entries: Array<{
    id: string;
    layer: string;
    key: string;
    contentPreview: string;
    score: number;
  }>;
};

export type ZavorthNativeLearningLoopUserModel = {
  mode: 'suggest-only';
  localOnly: true;
  reversible: true;
  approvedRecords: number;
  revokedRecords: number;
  preferences: number;
  procedures: number;
  codingStyle: number;
  debugPatterns: number;
  skillCandidates: number;
};

export type ZavorthNativeLearningLoopSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_NATIVE_LEARNING_LOOP_CONTRACT_VERSION;
  source: 'ZavorthNativeLearningLoopService';
  gate: 'native-learning-loop';
  status: 'passed' | 'attention' | 'blocked';
  summary: {
    candidates: number;
    quarantined: number;
    requiresApproval: number;
    promoted: number;
    tieredAutonomy: {
      auto: number;
      notify: number;
      approve: number;
    };
    sessionSearchReady: boolean;
    autoSkillCandidateReady: boolean;
    skillImprovementCandidateReady: boolean;
    approvedNudgesReady: boolean;
    reversibleUserModelReady: boolean;
    adaptiveLearningReady: boolean;
    adaptiveTechnicalScannerReady: boolean;
    adaptiveSemanticClassifierReady: boolean;
    adaptiveMultilingualRecallReady: boolean;
    adaptiveOperatorI18nReady: boolean;
    securityPolicyFirewallReady: boolean;
    rawSecretsSerialized: false;
    externalIoPerformed: false;
    workspaceMutationPerformed: false;
  };
  sessionSearch: ZavorthNativeLearningLoopSessionSearch | null;
  adaptiveLearning: ZavorthAdaptiveLearningSnapshot;
  userModel: ZavorthNativeLearningLoopUserModel;
  candidates: ZavorthNativeLearningLoopCandidate[];
  invariants: {
    neverLearnsSecurityPolicy: true;
    everyBehaviorChangeRequiresApproval: true;
    userModelIsReversible: true;
    recallIsTopKAndUntrusted: true;
    autoSkillsStartAsDrafts: true;
    skillImprovementsUseSandboxAndReceipts: true;
    nudgesAreApprovalCandidates: true;
  };
  commands: {
    inspect: 'npm run zavorth:native-learning-loop';
    inspectJson: 'npm run zavorth:native-learning-loop:json';
    check: 'npm run zavorth:native-learning-loop:check --silent';
    search: 'npm run zavorth:native-learning-loop -- --query "<term>"';
    observe: 'npm run zavorth:native-learning-loop -- --observe "<successful workflow>"';
    next: 'ZavorthControl Learning UX';
  };
};
