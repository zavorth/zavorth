import {
  type UserModelConfig,
  resolveUserModelConfig,
} from '../../contracts/user-model/UserModelConfigContract.js';
import {
  type EvidenceReference,
  type UserModelFact,
  type UserModelFactSource,
  type UserModelFactStatus,
} from '../../contracts/user-model/UserModelFactContract.js';

export type ObservationInput = {
  source: UserModelFactSource;
  evidence: EvidenceReference;
  language?: string;
  surface?: string | null;
  timestamp?: string;
};

export class UserModelConfidenceEngine {
  private readonly config: UserModelConfig;
  private readonly now: () => Date;

  public constructor(options?: { config?: UserModelConfig; now?: () => Date }) {
    this.config = options?.config || resolveUserModelConfig();
    this.now = options?.now || (() => new Date());
  }

  public getSourceWeight(source: UserModelFactSource): number {
    switch (source) {
      case 'explicit':
        return this.config.sourceAuthorityWeights.explicit;
      case 'conversation':
        return this.config.sourceAuthorityWeights.userCorrection;
      case 'behavior':
        return this.config.sourceAuthorityWeights.behavioralPattern;
      case 'llm':
        return this.config.sourceAuthorityWeights.llmInference;
      case 'migration':
        return this.config.sourceAuthorityWeights.migration;
      case 'question':
        return this.config.sourceAuthorityWeights.userCorrection;
      default:
        return 0.5;
    }
  }

  public aggregateConfidence(priorConfidence: number, observationProbability: number): number {
    const p1 = Math.max(0, Math.min(1, priorConfidence));
    const p2 = Math.max(0, Math.min(1, observationProbability));
    const finalP = 1 - (1 - p1) * (1 - p2);
    return Math.round(finalP * 1000) / 1000;
  }

  public calculateDecayedConfidence(fact: UserModelFact, asOfDate?: Date): number {
    const currentDate = asOfDate || this.now();
    const lastObservedTime = new Date(fact.lastObservedAt).getTime();
    const currentTime = currentDate.getTime();

    if (Number.isNaN(lastObservedTime) || currentTime <= lastObservedTime) {
      return fact.confidence;
    }

    const elapsedDays = (currentTime - lastObservedTime) / (1000 * 60 * 60 * 24);
    const halfLifeDays = this.config.decayHalfLifeDays;

    if (halfLifeDays <= 0) {
      return fact.confidence;
    }

    const decayFactor = Math.pow(0.5, elapsedDays / halfLifeDays);
    const decayed = fact.confidence * decayFactor;
    return Math.max(0, Math.min(1, Math.round(decayed * 1000) / 1000));
  }

  public resolveFactStatus(confidence: number, evidence: EvidenceReference[]): UserModelFactStatus {
    if (!evidence || evidence.length === 0) {
      return 'draft';
    }

    if (confidence >= this.config.activationConfidenceThreshold) {
      return 'active';
    }

    return 'draft';
  }

  public reinforceFact(existingFact: UserModelFact, observation: ObservationInput): UserModelFact {
    const observationTimestamp = observation.timestamp || this.now().toISOString();
    const sourceWeight = this.getSourceWeight(observation.source);
    const updatedConfidence = this.aggregateConfidence(existingFact.confidence, sourceWeight);

    const updatedEvidence: EvidenceReference[] = [
      ...existingFact.evidence,
      observation.evidence,
    ];

    const updatedStatus = this.resolveFactStatus(updatedConfidence, updatedEvidence);

    return {
      ...existingFact,
      version: existingFact.version + 1,
      confidence: updatedConfidence,
      status: existingFact.status === 'superseded' || existingFact.status === 'retracted'
        ? existingFact.status
        : updatedStatus,
      evidence: updatedEvidence,
      occurrences: existingFact.occurrences + 1,
      lastObservedAt: observationTimestamp,
      language: observation.language || existingFact.language,
      surface: observation.surface !== undefined ? observation.surface : existingFact.surface,
    };
  }

  public supersedeFact(olderFact: UserModelFact, newerFactId: string): UserModelFact {
    return {
      ...olderFact,
      version: olderFact.version + 1,
      status: 'superseded',
      supersededBy: newerFactId,
    };
  }

  public retractFact(fact: UserModelFact): UserModelFact {
    return {
      ...fact,
      version: fact.version + 1,
      status: 'retracted',
    };
  }
}
