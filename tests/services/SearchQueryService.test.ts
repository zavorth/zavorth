import type {
  AdapterSearchOutput,
  ISearchQueryAdapter,
  SearchQueryMode,
  SearchQueryRequest,
} from '../../src/contracts/SearchQueryContract';
import { SearchQueryService } from '../../src/services/SearchQueryService';

describe('SearchQueryService', () => {
  function createAdapter(
    adapterId: string,
    supportedModes: SearchQueryMode[],
    search: jest.Mock<Promise<AdapterSearchOutput>, [SearchQueryRequest]>,
  ): ISearchQueryAdapter {
    return { adapterId, supportedModes, search };
  }

  it('rejects an empty query before calling providers', async () => {
    const adapter = createAdapter('fake-search', ['quick', 'deep'], jest.fn());
    const service = new SearchQueryService({ adapters: [adapter] });

    const result = await service.search({ query: '   ', mode: 'quick' });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('INVALID_REQUEST');
    expect(adapter.search).not.toHaveBeenCalled();
  });

  it('normalizes provider results and keeps provider evidence separate', async () => {
    const adapter = createAdapter('fake-search', ['quick', 'deep'], jest.fn(async (request) => ({
      providerId: 'fake-search',
      items: [
        {
          title: 'Official OpenAI release',
          url: 'https://openai.com/index/example',
          description: 'OpenAI published a model release note.',
          originalRank: 1,
          sourceQuery: request.query,
        },
      ],
    })));
    const service = new SearchQueryService({ adapters: [adapter] });

    const result = await service.search({
      query: 'open eye model release',
      mode: 'quick',
      evidenceDomain: 'ai_news',
      extractPages: false,
    });

    expect(result.ok).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].host).toBe('openai.com');
    expect(result.items[0].providerEvidence.providerId).toBe('fake-search');
    expect(result.items[0].providerEvidence.effectiveQuery).toBe('OpenAI model release');
    expect(result.policyDecision.queryModified).toBe(true);
    expect(adapter.search).toHaveBeenCalledWith(expect.objectContaining({ query: 'OpenAI model release' }));
  });

  it('falls back from grounded search to a regular search adapter', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const grounded = createAdapter('fake-grounding', ['grounded'], jest.fn(async () => {
      throw new Error('grounding unavailable');
    }));
    const fallback = createAdapter('fake-search', ['quick', 'deep'], jest.fn(async () => ({
      providerId: 'fake-search',
      items: [
        {
          title: 'Fallback result',
          url: 'https://example.com/fallback',
          description: 'Fallback snippet.',
          originalRank: 1,
          sourceQuery: 'fallback query',
        },
      ],
    })));
    const service = new SearchQueryService({ adapters: [grounded, fallback] });

    const result = await service.search({
      query: 'fallback query',
      mode: 'grounded',
      extractPages: false,
    });

    expect(result.ok).toBe(true);
    expect(grounded.search).toHaveBeenCalledTimes(1);
    expect(fallback.search).toHaveBeenCalledTimes(1);
    expect(result.groundedSynthesis).toBeNull();
    expect(result.items[0].title).toBe('Fallback result');
  });
});
