import { config } from '../../../src/config/index';

const { mockGetGenerativeModel, MockGoogleGenerativeAI } = (() => {
  const mockGetGenerativeModel = jest.fn();
  const MockGoogleGenerativeAI = jest.fn(function (this: { getGenerativeModel: jest.Mock }) {
    this.getGenerativeModel = mockGetGenerativeModel;
  });
  return { mockGetGenerativeModel, MockGoogleGenerativeAI };
})();

jest.mock('@google/generative-ai', () => ({
  __esModule: true,
  GoogleGenerativeAI: MockGoogleGenerativeAI,
}));

import {
  GeminiGroundingSearchAdapter,
  GroundingAdapterError,
} from '../../../src/adapters/search/GeminiGroundingSearchAdapter';
import { logger } from '../../../src/logger';
import type { SearchQueryRequest } from '../../../src/contracts/SearchQueryContract';
import type { SemanticIntent } from '../../../src/contracts/search/SemanticIntentContract';

type CitationFixture = { uri: string; title?: string };

function groundedResponse(text: string, citations: CitationFixture[]): Record<string, unknown> {
  return {
    response: {
      text: () => text,
      candidates: [
        {
          groundingMetadata: {
            groundingChunks: citations.map((citation) => ({
              web: { uri: citation.uri, title: citation.title },
            })),
          },
        },
      ],
    },
  };
}

function modelStub(response: unknown): { generateContent: jest.Mock } {
  return { generateContent: jest.fn().mockResolvedValue(response) };
}

const intent: SemanticIntent = {
  topic: 'general',
  freshness: 'realtime',
  scope: 'global',
  sourceAuthority: 'any',
  language: 'en',
  confidence: 1,
};

function groundedRequest(): SearchQueryRequest {
  return { query: 'zavorth release notes', mode: 'grounded' };
}

describe('GeminiGroundingSearchAdapter key rotation', () => {
  const originalGeminiApiKey = config.geminiApiKey;
  const originalGeminiApiKeys = [...config.geminiApiKeys];
  const originalGeminiModel = config.geminiModel;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    mockGetGenerativeModel.mockReset();
    MockGoogleGenerativeAI.mockClear();
    warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    (config as { geminiModel: string }).geminiModel = 'gemini-test-model';
  });

  afterEach(() => {
    (config as { geminiApiKey: string }).geminiApiKey = originalGeminiApiKey;
    (config as { geminiApiKeys: string[] }).geminiApiKeys = [...originalGeminiApiKeys];
    (config as { geminiModel: string }).geminiModel = originalGeminiModel;
    jest.restoreAllMocks();
  });

  function configureKeys(keys: string[]): void {
    (config as { geminiApiKey: string }).geminiApiKey = keys[0] || '';
    (config as { geminiApiKeys: string[] }).geminiApiKeys = keys;
  }

  it('returns citation items and grounded synthesis built from the first key', async () => {
    configureKeys(['gk-1']);
    const model = modelStub(
      groundedResponse('Answer.', [
        { uri: 'https://example.com/a', title: 'Source A' },
        { uri: 'https://example.com/b' },
      ]),
    );
    mockGetGenerativeModel.mockReturnValue(model);

    const adapter = new GeminiGroundingSearchAdapter();
    const output = await adapter.search(groundedRequest(), intent);

    expect(MockGoogleGenerativeAI).toHaveBeenCalledWith('gk-1');
    expect(mockGetGenerativeModel).toHaveBeenCalledWith({
      model: 'gemini-test-model',
      tools: [{ googleSearch: {} }],
    });
    expect(output.providerId).toBe('gemini-grounding');
    expect(output.items).toEqual([
      {
        title: 'Source A',
        url: 'https://example.com/a',
        description: '',
        originalRank: 1,
        sourceQuery: 'zavorth release notes',
      },
      {
        title: 'https://example.com/b',
        url: 'https://example.com/b',
        description: '',
        originalRank: 2,
        sourceQuery: 'zavorth release notes',
      },
    ]);
    expect(output.groundedSynthesis).toEqual({
      synthesizedText: 'Answer.',
      citations: [
        { title: 'Source A', url: 'https://example.com/a' },
        { title: 'https://example.com/b', url: 'https://example.com/b' },
      ],
      modelId: 'gemini-test-model',
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('fails over to the second key and stays sticky across subsequent searches', async () => {
    configureKeys(['gk-1', 'gk-2']);
    const failingGenerateContent = jest.fn().mockRejectedValue(new Error('quota exceeded'));
    mockGetGenerativeModel
      .mockImplementationOnce(() => ({ generateContent: failingGenerateContent }))
      .mockImplementationOnce(() =>
        modelStub(groundedResponse('recovered.', [{ uri: 'https://example.com/r', title: 'Recovered' }])),
      )
      .mockImplementation(() => modelStub(groundedResponse('sticky answer.', [])));

    const adapter = new GeminiGroundingSearchAdapter();
    const output = await adapter.search(groundedRequest(), intent);

    expect(output.groundedSynthesis?.synthesizedText).toBe('recovered.');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[GeminiGroundingSearchAdapter] Key failed:'),
    );
    expect(MockGoogleGenerativeAI.mock.calls).toEqual([['gk-1'], ['gk-2']]);
    expect(failingGenerateContent).toHaveBeenCalledTimes(1);

    await adapter.search(groundedRequest(), intent);

    expect(MockGoogleGenerativeAI.mock.calls).toEqual([['gk-1'], ['gk-2'], ['gk-2']]);
    expect(failingGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('throws a GroundingAdapterError with the exact message when all keys fail', async () => {
    configureKeys(['gk-1', 'gk-2']);
    mockGetGenerativeModel.mockImplementation(() => ({
      generateContent: jest.fn().mockRejectedValue(new Error('down')),
    }));

    const adapter = new GeminiGroundingSearchAdapter();

    const outcome = adapter.search(groundedRequest(), intent);
    await expect(outcome).rejects.toThrow(
      '[gemini-grounding] Grounding error: All Gemini keys failed during grounding search.',
    );
    await expect(outcome).rejects.toBeInstanceOf(GroundingAdapterError);
    expect(MockGoogleGenerativeAI.mock.calls).toEqual([['gk-1'], ['gk-2']]);
  });
});
