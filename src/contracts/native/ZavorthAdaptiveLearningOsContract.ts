import type {
  ZavorthLearningMemoryEntry,
  ZavorthLearningMemoryReceipt,
  ZavorthLearningMemoryRisk,
  ZavorthLearningMemoryLayer,
} from './ZavorthMemoryLearningLoopContract.js';
import type { ZavorthAdaptiveSemanticClassification } from './ZavorthAdaptiveLearningSemanticContract.js';

export const ZAVORTH_ADAPTIVE_LEARNING_OS_CONTRACT_VERSION =
  '2026-06-04.adaptive-learning-os.v1' as const;

export type ZavorthAdaptiveLearningLaneId = 'green' | 'yellow' | 'red';

export type ZavorthAdaptiveLearningDecision =
  | 'auto_applied'
  | 'staged_for_digest'
  | 'requires_approval'
  | 'rejected';

export type ZavorthAdaptiveLearningSensitivity =
  | 'normal'
  | 'sensitive'
  | 'blocked';

export type ZavorthAdaptiveTechnicalScan = {
  scanned: true;
  normalized: string;
  redactedText: string;
  findings: string[];
  evidence: string[];
  blocked: boolean;
  lane: ZavorthAdaptiveLearningLaneId;
  sensitivity: ZavorthAdaptiveLearningSensitivity;
  risk: ZavorthLearningMemoryRisk;
  containsSecret: boolean;
  promptInjection: boolean;
  policyChange: boolean;
};

export type ZavorthUserModelUse =
  | 'response_style'
  | 'planning_depth'
  | 'tool_routing'
  | 'skill_recommendation'
  | 'memory_recall'
  | 'safety_only';

export type ZavorthAdaptiveUserModelRecord = {
  id: string;
  claim: string;
  evidence: string[];
  confidence: number;
  sensitivity: ZavorthAdaptiveLearningSensitivity;
  expiresAt: string | null;
  userEditable: true;
  usedFor: ZavorthUserModelUse[];
  status: 'auto_accepted' | 'requires_review' | 'rejected' | 'revoked';
  lane: ZavorthAdaptiveLearningLaneId;
};

export type ZavorthAdaptiveLearningLedgerEntry = {
  id: string;
  generatedAt: string;
  type: 'observation' | 'user_model' | 'memory' | 'skill' | 'procedure' | 'nudge';
  lane: ZavorthAdaptiveLearningLaneId;
  decision: ZavorthAdaptiveLearningDecision;
  risk: ZavorthLearningMemoryRisk;
  summary: string;
  evidenceRefs: string[];
  reversible: true;
  rollbackRef: string | null;
};

export type ZavorthAdaptiveLearningLaneSnapshot = {
  id: ZavorthAdaptiveLearningLaneId;
  label: 'Green Lane' | 'Yellow Lane' | 'Red Lane';
  mode: 'silent' | 'digest' | 'approval';
  decisions: ZavorthAdaptiveLearningDecision[];
  items: number;
  allowedActions: string[];
};

export type ZavorthAdaptiveShadowSkillDraft = {
  id: string;
  title: string;
  lane: 'yellow';
  state: 'drafted' | 'sandbox_tested' | 'waiting_approval';
  intent: string;
  installBlocked: true;
  sandboxRequired: true;
  promotionRequiresApproval: true;
  evidence: string[];
};

export type ZavorthAdaptiveProcedureDraft = {
  id: string;
  title: string;
  lane: 'yellow';
  status: 'draft';
  summary: string;
  promotionRequiresApproval: true;
  evidence: string[];
};

export type ZavorthAdaptiveMultilingualRecallInput = {
  query: string;
  userId?: string | null;
  sessionId?: string | null;
  workspace?: string | null;
  layers?: ZavorthLearningMemoryLayer[];
  limit?: number;
};

export type ZavorthAdaptiveMultilingualRecallResult = {
  generatedAt: string;
  query: string;
  queriesTried: string[];
  total: number;
  entries: Array<ZavorthLearningMemoryEntry & {
    score: number;
    trustBoundary: 'untrusted_memory';
  }>;
  safety: {
    localOnly: true;
    topKOnly: true;
    untrustedOnRecall: true;
    noExternalTranslationPerformed: true;
  };
};

export type ZavorthAdaptiveLearningSnapshot = {
  contractVersion: typeof ZAVORTH_ADAPTIVE_LEARNING_OS_CONTRACT_VERSION;
  generatedAt: string;
  source: 'ZavorthAdaptiveLearningOsService';
  status: 'ready' | 'attention' | 'blocked';
  summary: {
    greenAutoApplied: number;
    yellowDigestItems: number;
    redApprovalRequired: number;
    userModelRecords: number;
      shadowSkillDrafts: number;
      procedureDrafts: number;
      technicalScannerFindings: number;
      semanticClassifierUsed: boolean;
      multilingualRecallReady: boolean;
      i18nReady: boolean;
    };
  lanes: {
    green: ZavorthAdaptiveLearningLaneSnapshot;
    yellow: ZavorthAdaptiveLearningLaneSnapshot;
    red: ZavorthAdaptiveLearningLaneSnapshot;
  };
  userModel: {
    mode: 'evidence-bound';
    localOnly: true;
    userEditable: true;
    records: ZavorthAdaptiveUserModelRecord[];
  };
  memoryWrites: ZavorthLearningMemoryReceipt[];
  shadowSkills: ZavorthAdaptiveShadowSkillDraft[];
  procedures: ZavorthAdaptiveProcedureDraft[];
  classification: {
    technical: ZavorthAdaptiveTechnicalScan;
    semantic: ZavorthAdaptiveSemanticClassification | null;
  };
  ledger: {
    entries: ZavorthAdaptiveLearningLedgerEntry[];
    appendOnly: true;
    canForget: true;
    canCorrect: true;
  };
  safety: {
    localOnly: true;
    rawPsychologicalDiagnosisBlocked: true;
    sensitiveInferencesNeedApproval: true;
    securityPolicyLearningBlocked: true;
    redLaneNeverSilent: true;
    technicalScannerReady: true;
    semanticClassifierGoverned: true;
    multilingualRecallLocalOnly: true;
    operatorI18nReady: true;
    noExternalIoPerformed: true;
    noWorkspaceMutationPerformed: true;
  };
  invariants: {
    everyDurableBehaviorChangeRequiresApproval: true;
    userModelClaimsCarryEvidence: true;
    userCanEditOrForgetClaims: true;
    autoSkillsStartAsDrafts: true;
    shadowLearningBeforePromotion: true;
    greenLaneLimitedToLowRiskReversibleLearning: true;
  };
  commands: {
    inspect: 'npm run zavorth:adaptive-learning-os';
    inspectJson: 'npm run zavorth:adaptive-learning-os:json';
    observe: 'npm run zavorth:adaptive-learning-os -- --observe "<observation>"';
    check: 'npm run zavorth:adaptive-learning-os:check --silent';
  };
};
