import type {
  ZavorthAdaptiveLearningLaneId,
  ZavorthAdaptiveLearningSensitivity,
  ZavorthUserModelUse,
} from './ZavorthAdaptiveLearningOsContract.js';
import type { ZavorthLearningMemoryRisk } from './ZavorthMemoryLearningLoopContract.js';

export type ZavorthAdaptiveSemanticClassifierInput = {
  text: string;
  redactedText: string;
  technicalFindings: string[];
  userId?: string | null;
  sessionId?: string | null;
  workspace?: string | null;
  sourceSurface?: string | null;
};

export type ZavorthAdaptiveSemanticLlmGateInput = {
  systemPrompt: string;
  redactedText: string;
  technicalFindings: string[];
  sourceSurface?: string | null;
  responseSchema: string;
  localClassification: Pick<
    ZavorthAdaptiveSemanticClassification,
    'language' | 'confidence' | 'recommendedLane' | 'sensitivity' | 'risk' | 'reasons'
  >;
};

export type ZavorthAdaptiveSemanticLlmGate = {
  classify(input: ZavorthAdaptiveSemanticLlmGateInput): Promise<string | Record<string, unknown>>;
};

export type ZavorthAdaptiveSemanticClassification = {
  provider: 'local-heuristic' | 'semantic-provider';
  language: string;
  confidence: number;
  recommendedLane: ZavorthAdaptiveLearningLaneId;
  sensitivity: ZavorthAdaptiveLearningSensitivity;
  risk: ZavorthLearningMemoryRisk;
  reasons: string[];
  usedFor: ZavorthUserModelUse[];
  claim: string | null;
  evidence: string[];
};

export type ZavorthAdaptiveSemanticClassifier = {
  classify(input: ZavorthAdaptiveSemanticClassifierInput): Promise<ZavorthAdaptiveSemanticClassification>;
};
