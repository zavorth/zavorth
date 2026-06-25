export const MNEMOS_DREAM_CYCLE_VERSION = 'mnemos-dream-cycle/v1' as const;

export type MnemosDreamMemoryKind =
  | 'preference'
  | 'procedure'
  | 'project-fact'
  | 'user-model'
  | 'policy';

export type MnemosDreamObservation = {
  id: string;
  kind: MnemosDreamMemoryKind;
  text: string;
  evidenceRefs: string[];
  updatedAt: string;
  confidence: number;
  expiry?: string | null;
};

export type MnemosDreamSession = {
  sessionId: string;
  createdAt: string;
  summary: string;
  observations: MnemosDreamObservation[];
};

export type MnemosDreamCycleInput = {
  storeId: string;
  existingMemories?: MnemosDreamObservation[];
  sessions: MnemosDreamSession[];
  pruneBefore?: string | null;
};

export type MnemosDreamCandidateMemory = {
  id: string;
  kind: Exclude<MnemosDreamMemoryKind, 'user-model' | 'policy'>;
  text: string;
  evidenceRefs: string[];
  confidence: number;
  updatedAt: string;
  expiry: string | null;
};

export type MnemosDreamActionKind =
  | 'keep'
  | 'merge-duplicate'
  | 'prune-stale'
  | 'refresh-relative-date'
  | 'resolve-contradiction'
  | 'quarantine-secret';

export type MnemosDreamAction = {
  actionId: string;
  kind: MnemosDreamActionKind;
  evidenceRefs: string[];
  summary: string;
};

export type MnemosDreamQuarantineItem = {
  id: string;
  kind: 'sensitive-user-model' | 'policy-change' | 'secret';
  evidenceRefs: string[];
  approvalRequired: true;
  summary: string;
};

export type MnemosDreamCycleSnapshot = {
  version: typeof MNEMOS_DREAM_CYCLE_VERSION;
  generatedAt: string;
  status: 'ready' | 'needs-review' | 'blocked';
  sourceStore: {
    storeId: string;
    immutable: true;
    sessionsRead: number;
    memoriesRead: number;
  };
  candidateStore: {
    storeId: string;
    status: 'candidate';
    memories: MnemosDreamCandidateMemory[];
  };
  actions: MnemosDreamAction[];
  quarantine: MnemosDreamQuarantineItem[];
  review: {
    applyCommand: string;
    rejectCommand: string;
    rollbackAvailable: true;
    receiptId: string;
  };
  safety: {
    sourceStoreImmutable: true;
    separateCandidateStore: true;
    rawSecretsSerialized: false;
    sensitivePsychologyQuarantined: true;
    policyChangesQuarantined: true;
    redactionBeforeWrite: true;
  };
};

export type MnemosDreamReviewActionInput = {
  action: 'apply' | 'reject';
  actor: string;
  approvalId?: string | null;
};

export type MnemosDreamReviewActionResult = {
  status: 'applied' | 'rejected' | 'blocked';
  action: MnemosDreamReviewActionInput['action'];
  actor: string;
  appliedStoreId: string | null;
  candidateStoreId: string;
  rollbackReceiptId: string | null;
  reason: string | null;
};

export type MnemosDreamCycleScheduleInput = {
  lastDreamAt?: string | null;
  sessionsSinceLastDream: number;
  idleMinutes: number;
  minimumIntervalHours?: number;
  minimumSessions?: number;
  minimumIdleMinutes?: number;
};

export type MnemosDreamCycleScheduleDecision = {
  shouldRun: boolean;
  reasons: string[];
  nextEligibleAt: string | null;
  safety: {
    schedulerDecisionOnly: true;
    sourceStoreImmutable: true;
  };
};
