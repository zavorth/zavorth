import { UserModelConfidenceEngine } from '../../../src/services/user-model/UserModelConfidenceEngine.js';
import type { UserModelFact } from '../../../src/contracts/user-model/UserModelFactContract.js';

describe('UserModelConfidenceEngine', () => {
  let engine: UserModelConfidenceEngine;

  const baseFact: UserModelFact = {
    id: 'fact-pref-1',
    userId: 'user-alpha',
    content: 'Prefers English for code comments',
    kind: 'preference',
    category: 'language',
    status: 'draft',
    version: 1,
    confidence: 0.6,
    evidence: [
      {
        turnId: 'turn-1',
        citation: 'Inferred from dialogue',
        timestamp: '2026-08-01T00:00:00.000Z',
      },
    ],
    source: 'llm',
    language: 'en',
    surface: null,
    lastObservedAt: '2026-08-01T00:00:00.000Z',
    occurrences: 1,
  };

  beforeEach(() => {
    engine = new UserModelConfidenceEngine();
  });

  describe('Bayesian Confidence Aggregation', () => {
    it('aggregates probabilities using P = 1 - (1 - p1) * (1 - p2)', () => {
      // p1 = 0.6, p2 = 0.6 => 1 - (0.4 * 0.4) = 0.84
      const result = engine.aggregateConfidence(0.6, 0.6);
      expect(result).toBe(0.84);
    });

    it('aggregates with explicit weight (p2 = 1.0) reaching 1.0', () => {
      const result = engine.aggregateConfidence(0.5, 1.0);
      expect(result).toBe(1.0);
    });

    it('clamps inputs properly between 0 and 1', () => {
      expect(engine.aggregateConfidence(-0.5, 0.5)).toBe(0.5);
      expect(engine.aggregateConfidence(1.5, 0.5)).toBe(1.0);
    });
  });

  describe('Temporal Half-Life Decay', () => {
    it('decays confidence exponentially over half-life days', () => {
      const thirtyDaysLater = new Date('2026-08-31T00:00:00.000Z');
      const decayed = engine.calculateDecayedConfidence(
        { ...baseFact, confidence: 0.8 },
        thirtyDaysLater,
      );
      // Half life is 30 days, elapsed is 30 days => 0.8 * 0.5 = 0.4
      expect(decayed).toBeCloseTo(0.4, 2);
    });

    it('returns exact confidence if observation is newer than or equal to current date', () => {
      const sameTime = new Date('2026-08-01T00:00:00.000Z');
      expect(engine.calculateDecayedConfidence(baseFact, sameTime)).toBe(0.6);
    });
  });

  describe('Fact Lifecycle State Transitions', () => {
    it('promotes fact from draft to active when confidence reaches threshold with evidence', () => {
      const reinforced = engine.reinforceFact(baseFact, {
        source: 'conversation', // weight 0.85
        evidence: {
          turnId: 'turn-2',
          citation: 'User affirmed English comments',
          timestamp: '2026-08-02T00:00:00.000Z',
        },
      });

      // 1 - (1 - 0.6) * (1 - 0.85) = 1 - 0.4 * 0.15 = 0.94 >= 0.70 threshold
      expect(reinforced.confidence).toBe(0.94);
      expect(reinforced.status).toBe('active');
      expect(reinforced.occurrences).toBe(2);
      expect(reinforced.evidence).toHaveLength(2);
    });

    it('never promotes fact to active if evidence is missing', () => {
      const status = engine.resolveFactStatus(0.99, []);
      expect(status).toBe('draft');
    });

    it('supersedes older fact with pointer to newer fact', () => {
      const superseded = engine.supersedeFact(baseFact, 'fact-pref-2');
      expect(superseded.status).toBe('superseded');
      expect(superseded.supersededBy).toBe('fact-pref-2');
      expect(superseded.version).toBe(2);
    });

    it('retracts fact cleanly', () => {
      const retracted = engine.retractFact(baseFact);
      expect(retracted.status).toBe('retracted');
      expect(retracted.version).toBe(2);
    });
  });
});
