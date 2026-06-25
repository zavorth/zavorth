export type ZavorthLearningMemoryLayer = 'session' | 'persistent' | 'skill';

export type ZavorthLearningMemoryRisk = 'low' | 'medium' | 'high';

export type ZavorthLearningMemoryDecision =
  | 'accepted'
  | 'accepted_session_only'
  | 'requires_review'
  | 'rejected';

export type ZavorthLearningMemoryReceipt = {
  id: string;
  generatedAt: string;
  layer: ZavorthLearningMemoryLayer;
  decision: ZavorthLearningMemoryDecision;
  risk: ZavorthLearningMemoryRisk;
  summary: string;
  reasons: string[];
  entryId: string | null;
  redaction: {
    rawTranscriptPersisted: false;
    rawSecretsPersisted: false;
  };
  controls: {
    ftsIndexed: boolean;
    topKOnly: true;
    untrustedOnRecall: true;
    canForget: true;
    canCorrect: true;
  };
};

export type ZavorthLearningMemoryEntry = {
  id: string;
  layer: ZavorthLearningMemoryLayer;
  userId: string | null;
  sessionId: string | null;
  workspace: string | null;
  key: string;
  content: string;
  source: string;
  confidence: number;
  risk: ZavorthLearningMemoryRisk;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  metadata: Record<string, unknown>;
};

export type ZavorthLearningMemorySearchResult = {
  generatedAt: string;
  query: string;
  limit: number;
  total: number;
  entries: Array<ZavorthLearningMemoryEntry & {
    score: number;
    trustBoundary: 'untrusted_memory';
  }>;
  receipt: ZavorthLearningMemoryReceipt;
};

export type ZavorthSkillMemoryCandidateAssessment = {
  generatedAt: string;
  intent: string;
  decision: 'allow_skill_candidate' | 'procedure_only' | 'reject_skill_candidate';
  scores: {
    generality: number;
    determinism: number;
    risk: ZavorthLearningMemoryRisk;
  };
  reasons: string[];
  receipt: ZavorthLearningMemoryReceipt;
};
