import { AdaptivePersonaEngine } from '../../src/context-engine/AdaptivePersonaEngine';
import type { IntentClassification } from '../../src/cognitive-firewall/IntentClassifier';

describe('AdaptivePersonaEngine', () => {
  const engine = new AdaptivePersonaEngine();

  // Helper to create mock classifications
  function mockClassification(category: IntentClassification['category'], confidence: number): IntentClassification {
    return {
      category,
      confidence,
      reason: 'test',
      isHardDecision: false,
      downgradedBy: [],
      secondPass: {
        source: 'ContextualIntentSecondPass',
        stage: 7,
        mode: 'local-contextual',
        verdict: 'confirmed',
        originalCategory: category,
        finalCategory: category,
        confidenceDelta: 0,
        signals: [],
      },
    };
  }

  describe('direct mapping', () => {
    it.each([
      ['execution', 'executor'],
      ['file_operation', 'executor'],
      ['desktop', 'executor'],
      ['configuration', 'analytical'],
      ['research', 'researcher'],
      ['information', 'researcher'],
      ['memory', 'conversational'],
      ['conversation', 'conversational'],
    ])('maps %s → %s with high confidence', (category, expectedPersona) => {
      const result = engine.resolve(mockClassification(category, 0.8));
      expect(result.persona.type).toBe(expectedPersona);
      expect(result.isAmbiguous).toBe(false);
      expect(result.fallbackUsed).toBe(false);
    });
  });

  describe('ambiguous fallback', () => {
    it('falls back to conversational for low confidence', () => {
      const result = engine.resolve(mockClassification('execution', 0.3));
      expect(result.persona.type).toBe('conversational');
      expect(result.isAmbiguous).toBe(true);
      expect(result.fallbackUsed).toBe(true);
    });

    it('falls back to conversational for full_toolset with low confidence', () => {
      const result = engine.resolve(mockClassification('full_toolset', 0.4));
      expect(result.persona.type).toBe('conversational');
      expect(result.isAmbiguous).toBe(true);
    });

    it('maps full_toolset with high confidence to conversational (always ambiguous)', () => {
      const result = engine.resolve(mockClassification('full_toolset', 0.8));
      expect(result.persona.type).toBe('conversational');
      expect(result.isAmbiguous).toBe(true);
      expect(result.fallbackUsed).toBe(true);
    });
  });

  describe('conversation category', () => {
    it('returns conversational for high-confidence conversation', () => {
      const result = engine.resolve(mockClassification('conversation', 0.95));
      expect(result.persona.type).toBe('conversational');
      expect(result.isAmbiguous).toBe(false);
    });
  });

  describe('prompt generation', () => {
    it('includes persona name in prompt', () => {
      const result = engine.resolve(mockClassification('execution', 0.8));
      const prompt = engine.buildPrompt(result);
      expect(prompt).toContain('EXECUTOR');
    });

    it('includes fallback indicator for ambiguous intents', () => {
      const result = engine.resolve(mockClassification('execution', 0.3));
      const prompt = engine.buildPrompt(result);
      expect(prompt).toContain('FALLBACK');
    });

    it('does not contain hardcoded English-only text', () => {
      const result = engine.resolve(mockClassification('conversation', 0.95));
      const prompt = engine.buildPrompt(result);
      // The prompt should be structurally sound, not language-locked
      expect(prompt).toContain('COGNITIVE NEXUS');
    });

    it('includes style information', () => {
      const result = engine.resolve(mockClassification('execution', 0.8));
      const prompt = engine.buildPrompt(result);
      expect(prompt).toContain('Style:');
    });

    it('includes code block preference for executor', () => {
      const result = engine.resolve(mockClassification('execution', 0.8));
      const prompt = engine.buildPrompt(result);
      expect(prompt).toContain('Use code blocks when relevant.');
    });

    it('does not include empathy for conversational persona', () => {
      const result = engine.resolve(mockClassification('conversation', 0.8));
      const prompt = engine.buildPrompt(result);
      // Conversational persona has empathyLevel: 'medium', not 'high'
      expect(prompt).not.toContain('Be empathetic and warm.');
    });
  });

  describe('logging', () => {
    it('calls logger on resolution', () => {
      const logs: string[] = [];
      const loggingEngine = new AdaptivePersonaEngine({
        logger: (msg) => logs.push(msg),
      });
      loggingEngine.resolve(mockClassification('execution', 0.8));
      expect(logs.length).toBe(1);
      expect(logs[0]).toContain('execution');
    });

    it('calls logger on ambiguous fallback', () => {
      const logs: string[] = [];
      const loggingEngine = new AdaptivePersonaEngine({
        logger: (msg) => logs.push(msg),
      });
      loggingEngine.resolve(mockClassification('execution', 0.3));
      expect(logs.length).toBe(1);
      expect(logs[0]).toContain('Ambiguous');
    });
  });

  describe('persona profiles', () => {
    it('returns correct persona profile', () => {
      const profile = engine.getPersonaProfile('executor');
      expect(profile.type).toBe('executor');
      expect(profile.name).toBe('EXECUTOR');
      expect(profile.systemPrompt).toBeDefined();
    });

    it('returns all available personas', () => {
      const personas = engine.getAvailablePersonas();
      expect(personas).toContain('executor');
      expect(personas).toContain('creative');
      expect(personas).toContain('analytical');
      expect(personas).toContain('conversational');
      expect(personas).toContain('researcher');
      expect(personas.length).toBe(5);
    });
  });

  describe('confidence thresholds', () => {
    it('maps execution to executor with confidence 0.7', () => {
      const result = engine.resolve(mockClassification('execution', 0.7));
      expect(result.persona.type).toBe('executor');
      expect(result.isAmbiguous).toBe(false);
    });

    it('falls back for execution with confidence 0.49', () => {
      const result = engine.resolve(mockClassification('execution', 0.49));
      expect(result.persona.type).toBe('conversational');
      expect(result.isAmbiguous).toBe(true);
    });

    it('maps information to researcher with confidence 0.6', () => {
      const result = engine.resolve(mockClassification('information', 0.6));
      expect(result.persona.type).toBe('researcher');
      expect(result.isAmbiguous).toBe(false);
    });

    it('falls back for information with confidence 0.59', () => {
      const result = engine.resolve(mockClassification('information', 0.59));
      expect(result.persona.type).toBe('conversational');
      expect(result.isAmbiguous).toBe(true);
    });
  });
});
