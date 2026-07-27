import {
  parseDayPathRankResponse,
  rankDayPathCommands,
} from '../../../src/services/DayPathSemanticRanker.js';
import type { ILlmProvider, LlmResponse } from '../../../src/providers/ILlmProvider.js';

function mockProvider(content: string): ILlmProvider {
  return {
    name: 'mock-ranker',
    chat: async (): Promise<LlmResponse> => ({
      content,
      toolCalls: [],
      finishReason: 'stop',
    }),
  };
}

describe('parseDayPathRankResponse', () => {
  it('parses valid JSON ranked list', () => {
    const result = parseDayPathRankResponse(
      JSON.stringify({
        ranked: [
          { id: 'import-home', score: 0.9, why: 'migrate' },
          { id: 'link-find', score: 0.4, why: 'peer' },
        ],
        confidence: 0.85,
      }),
    );
    expect(result.ranked.map((r) => r.id)).toEqual(['import-home', 'link-find']);
    expect(result.ranked[0].score).toBe(0.9);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('drops unknown ids when sanitized via rankDayPathCommands', async () => {
    const provider = mockProvider(
      JSON.stringify({
        ranked: [
          { id: 'invented-xyz', score: 1, why: 'nope' },
          { id: 'import-home', score: 0.9, why: 'yes' },
          { id: 'not-in-catalog', score: 0.8, why: 'nope' },
        ],
        confidence: 0.7,
      }),
    );
    const result = await rankDayPathCommands({
      userIntent: 'migrate agent',
      candidates: [
        {
          id: 'import-home',
          command: 'zavorth import home',
          summary: 'Import',
          whenToUse: 'Migrate',
          group: 'import-link',
          readOnly: false,
          onboarding: true,
        },
        {
          id: 'doctor',
          command: 'zavorth doctor',
          summary: 'Doctor',
          whenToUse: 'Health',
          group: 'start',
          readOnly: true,
          onboarding: true,
        },
      ],
      provider,
      allowLlm: true,
    });
    expect(result.ranked.map((r) => r.id)).toEqual(['import-home']);
    expect(result.source).toBe('semantic');
  });

  it('parse alone keeps ids (filter is sanitize step)', () => {
    const result = parseDayPathRankResponse(
      JSON.stringify({
        ranked: [
          { id: 'invented-xyz', score: 1, why: 'x' },
          { id: 'import-home', score: 0.5, why: 'y' },
        ],
        confidence: 0.5,
      }),
    );
    // Parser returns raw ranked; closed-list drop there isppens in rankDayPathCommands sanitize
    expect(result.ranked.some((r) => r.id === 'import-home')).toBe(true);
  });
});

describe('rankDayPathCommands', () => {
  const candidates = [
    {
      id: 'import-home',
      command: 'zavorth import home',
      summary: 'Import agent home',
      whenToUse: 'Migrating',
      group: 'import-link',
      readOnly: false,
      onboarding: true,
    },
    {
      id: 'doctor',
      command: 'zavorth doctor',
      summary: 'Diagnose',
      whenToUse: 'Health',
      group: 'start',
      readOnly: true,
      onboarding: true,
    },
  ];

  it('ranks with mock provider', async () => {
    const result = await rankDayPathCommands({
      userIntent: 'migrate my agent',
      candidates,
      allowLlm: true,
      provider: mockProvider(
        JSON.stringify({
          ranked: [{ id: 'import-home', score: 1, why: 'migrate' }],
          confidence: 0.95,
        }),
      ),
    });
    expect(result.source).toBe('semantic');
    expect(result.ranked[0]?.id).toBe('import-home');
  });

  it('kill switch / no provider → empty ranked fallback', async () => {
    const empty = await rankDayPathCommands({
      userIntent: 'anything',
      candidates,
      allowLlm: true,
      provider: null,
    });
    expect(empty.source).toBe('fallback');
    expect(empty.ranked).toEqual([]);

    const prev = process.env.ZAVORTH_DAYPATH_SEMANTIC;
    process.env.ZAVORTH_DAYPATH_SEMANTIC = '0';
    try {
      const killed = await rankDayPathCommands({
        userIntent: 'migrate',
        candidates,
        allowLlm: true,
        provider: mockProvider(
          JSON.stringify({
            ranked: [{ id: 'import-home', score: 1, why: 'x' }],
            confidence: 1,
          }),
        ),
      });
      expect(killed.source).toBe('fallback');
      expect(killed.ranked).toEqual([]);
    } finally {
      if (prev === undefined) delete process.env.ZAVORTH_DAYPATH_SEMANTIC;
      else process.env.ZAVORTH_DAYPATH_SEMANTIC = prev;
    }
  });
});
