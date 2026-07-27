import {
  classifyFreeTextSemanticIntent,
  parseFreeTextSemanticDecision,
} from '../../../src/services/llm/FreeTextSemanticIntentHop.js';
import type { ILlmProvider, LlmResponse } from '../../../src/providers/ILlmProvider.js';

function mockProvider(content: string): ILlmProvider {
  return {
    name: 'mock-free-text-semantic',
    chat: async (): Promise<LlmResponse> => ({
      content,
      toolCalls: [],
      finishReason: 'stop',
    }),
  };
}

describe('parseFreeTextSemanticDecision', () => {
  it('parses valid JSON kind decision', () => {
    const decision = parseFreeTextSemanticDecision(
      JSON.stringify({
        kind: 'work',
        confidence: 0.88,
        reason: 'asks for analysis',
      }),
    );
    expect(decision).not.toBeNull();
    expect(decision!.kind).toBe('work');
    expect(decision!.confidence).toBeCloseTo(0.88);
    expect(decision!.source).toBe('llm');
  });

  it('accepts fenced JSON and risk aliases', () => {
    const decision = parseFreeTextSemanticDecision(
      '```json\n{"kind":"danger","confidence":0.91,"reason":"shell request"}\n```',
    );
    expect(decision?.kind).toBe('risk');
    expect(decision?.confidence).toBeGreaterThan(0.8);
  });

  it('returns null for empty or unusable content', () => {
    expect(parseFreeTextSemanticDecision('')).toBeNull();
    expect(parseFreeTextSemanticDecision('not json at all')).toBeNull();
  });

  it('rejects non-strict output', () => {
    expect(parseFreeTextSemanticDecision('kind: conversation (maybe)')).toBeNull();
  });
});

describe('classifyFreeTextSemanticIntent', () => {
  it('classifies with mock provider', async () => {
    const result = await classifyFreeTextSemanticIntent({
      userMessage: 'Please review this architecture carefully',
      allowLlm: true,
      provider: mockProvider(
        JSON.stringify({
          kind: 'work',
          confidence: 0.9,
          reason: 'analysis request',
        }),
      ),
    });
    expect(result.source).toBe('llm');
    expect(result.kind).toBe('work');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('kill switch ZAVORTH_FREE_TEXT_SEMANTIC=0 -> unknown fallback', async () => {
    const prev = process.env.ZAVORTH_FREE_TEXT_SEMANTIC;
    process.env.ZAVORTH_FREE_TEXT_SEMANTIC = '0';
    try {
      const killed = await classifyFreeTextSemanticIntent({
        userMessage: 'anything',
        allowLlm: true,
        provider: mockProvider(
          JSON.stringify({
            kind: 'risk',
            confidence: 1,
            reason: 'x',
          }),
        ),
      });
      expect(killed.source).toBe('fallback');
      expect(killed.kind).toBe('unknown');
    } finally {
      if (prev === undefined) delete process.env.ZAVORTH_FREE_TEXT_SEMANTIC;
      else process.env.ZAVORTH_FREE_TEXT_SEMANTIC = prev;
    }
  });

  it('empty message -> empty source unknown', async () => {
    const result = await classifyFreeTextSemanticIntent({
      userMessage: '   ',
      allowLlm: true,
      provider: mockProvider('{"kind":"work","confidence":1,"reason":"x"}'),
    });
    expect(result.source).toBe('empty');
    expect(result.kind).toBe('unknown');
  });

  it('structured risk hints skip LLM', async () => {
    let called = false;
    const provider: ILlmProvider = {
      name: 'should-not-call',
      chat: async (): Promise<LlmResponse> => {
        called = true;
        return { content: '', toolCalls: [], finishReason: 'stop' };
      },
    };
    const result = await classifyFreeTextSemanticIntent({
      userMessage: 'please help',
      structuredHints: { shell: true },
      allowLlm: true,
      provider,
    });
    expect(called).toBe(false);
    expect(result.source).toBe('structured');
    expect(result.kind).toBe('risk');
  });

  it('no provider -> fallback unknown', async () => {
    const result = await classifyFreeTextSemanticIntent({
      userMessage: 'hello there',
      allowLlm: true,
      provider: null,
    });
    expect(result.source).toBe('fallback');
    expect(result.kind).toBe('unknown');
  });
});
