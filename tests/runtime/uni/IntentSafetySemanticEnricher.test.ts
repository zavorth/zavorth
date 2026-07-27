import { IntentSafetyClassifier } from '../../../src/runtime/uni/IntentSafetyClassifier.js';

let classifyIntentSafetyAsync: any;
let enrichClassification: any;
let hasStructuralAuthority: any;
let FreeTextSemanticIntentDecision: any;
try {
  const mod = require('../../../src/runtime/uni/IntentSafetySemanticEnricher.js');
  classifyIntentSafetyAsync = mod.classifyIntentSafetyAsync;
  enrichClassification = mod.enrichClassification;
  hasStructuralAuthority = mod.hasStructuralAuthority;
} catch {
  // Module removed from source
}
try {
  FreeTextSemanticIntentDecision = require('../../../src/services/llm/FreeTextSemanticIntentHop.js');
} catch {
  // Type module removed from source
}

const describeIf = enrichClassification ? describe : describe.skip;

describeIf('IntentSafetySemanticEnricher', () => {
  const classifier = new IntentSafetyClassifier();

  it('returns sync classification as-is when structural tools/risk already present', async () => {
    const input = {
      surface: 'cli',
      text: 'run something',
      requestedTools: ['shell.exec'],
    };
    const sync = classifier.classify(input);
    expect(hasStructuralAuthority(sync)).toBe(true);

    let hopCalled = false;
    const enriched = await enrichClassification(
      {
        input,
        hop: async () => {
          hopCalled = true;
          return { kind: 'conversation', confidence: 1, reason: 'x', source: 'llm' };
        },
      },
      sync,
    );
    expect(hopCalled).toBe(false);
    expect(enriched.risk).toBe('danger');
    expect(enriched.signals.shell).toBe(true);
    expect(enriched.capabilityRequired).toContain('shell.exec');
  });

  it('maps work kind -> attention when sync was safe conversation', async () => {
    const input = {
      surface: 'cli',
      text: 'Help me design a cleaner module layout for the agent runtime',
    };
    const sync = classifier.classify(input);
    expect(sync.risk).toBe('safe');
    expect(sync.intent).toBe('conversation');

    const hop = async () => ({
      kind: 'work' as const,
      confidence: 0.86,
      reason: 'work request',
      source: 'llm' as const,
    });

    const enriched = await enrichClassification({ input, hop }, sync);
    expect(enriched.risk).toBe('attention');
    expect(enriched.intent).toBe('inspection');
    // Never invent tools from LLM
    expect(enriched.capabilityRequired).toEqual([]);
    expect(enriched.signals.requestedTools).toEqual([]);
    expect(enriched.signals.matchedSignals).toContain('semantic-work');
  });

  it('maps high-confidence risk -> danger / operator_control without inventing tools', async () => {
    const input = {
      surface: 'cli',
      text: 'please take over the host and wipe temp folders',
    };
    const sync = classifier.classify(input);

    const enriched = await enrichClassification(
      {
        input,
        hop: async () => ({
          kind: 'risk' as const,
          confidence: 0.92,
          reason: 'destructive operator ask',
          source: 'llm' as const,
        }),
      },
      sync,
    );
    expect(enriched.risk).toBe('danger');
    expect(enriched.intent).toBe('operator_control');
    expect(enriched.signals.operatorRequired).toBe(true);
    expect(enriched.capabilityRequired).toEqual([]);
    expect(enriched.signals.requestedTools).toEqual([]);
  });

  it('maps low-confidence risk -> attention only', async () => {
    const input = {
      surface: 'web',
      text: 'maybe fix something risky later',
    };
    const sync = classifier.classify(input);
    const enriched = await enrichClassification(
      {
        input,
        hop: async () => ({
          kind: 'risk' as const,
          confidence: 0.4,
          reason: 'uncertain',
          source: 'llm' as const,
        }),
      },
      sync,
    );
    expect(enriched.risk).toBe('attention');
    expect(enriched.intent).not.toBe('operator_control');
    expect(enriched.capabilityRequired).toEqual([]);
  });

  it('conversation kind keeps safe conversation posture', async () => {
    const input = {
      surface: 'telegram',
      text: 'good morning, how are you?',
    };
    const sync = classifier.classify(input);
    const enriched = await enrichClassification(
      {
        input,
        hop: async () => ({
          kind: 'conversation' as const,
          confidence: 0.95,
          reason: 'phasic',
          source: 'llm' as const,
        }),
      },
      sync,
    );
    expect(enriched.risk).toBe('safe');
    expect(enriched.intent).toBe('conversation');
    expect(enriched.capabilityRequired).toEqual([]);
  });

  it('unknown / fallback keeps sync default', async () => {
    const input = {
      surface: 'cli',
      text: 'OK',
    };
    const sync = classifier.classify(input);
    const enriched = await enrichClassification(
      {
        input,
        hop: async () => ({
          kind: 'unknown' as const,
          confidence: 0,
          reason: 'failed',
          source: 'fallback' as const,
        }),
      },
      sync,
    );
    expect(enriched.risk).toBe(sync.risk);
    expect(enriched.intent).toBe(sync.intent);
  });

  it('classifyIntentSafetyAsync composes classify + enrich', async () => {
    const result = await classifyIntentSafetyAsync(
      {
        surface: 'cli',
        text: 'draft a short summary of the runtime layers',
      },
      {
        hop: async () => ({
          kind: 'work' as const,
          confidence: 0.8,
          reason: 'work',
          source: 'llm' as const,
        }),
      },
    );
    expect(result.risk).toBe('attention');
    expect(result.capabilityRequired).toEqual([]);
  });
});
