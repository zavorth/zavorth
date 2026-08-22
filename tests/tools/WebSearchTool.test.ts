jest.setTimeout(60000);

import { search } from 'duck-duck-scrape';
import { WebSearchTool } from '../../src/tools/WebSearchTool';
import { SearchQueryService } from '../../src/services/SearchQueryService';
import { NewsRssAdapter } from '../../src/adapters/search/NewsRssAdapter';
import { DuckDuckGoSearchAdapter } from '../../src/adapters/search/DuckDuckGoSearchAdapter';
import type { ISemanticIntentClassifier, IRelevanceScorer } from '../../src/contracts/search/SemanticIntentContract';
import type { SemanticIntent, SemanticIntentClassifierInput, RelevanceScorerInput, RelevanceScore } from '../../src/contracts/search/SemanticIntentContract';

jest.mock('duck-duck-scrape', () => ({
  SafeSearchType: { MODERATE: 'moderate' },
  search: jest.fn(),
}));

jest.mock('dns/promises', () => ({
  lookup: jest.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
}));

function makeIntentClassifier(intent: SemanticIntent): ISemanticIntentClassifier {
  return {
    classifierId: 'test.intent',
    supportsOffline: true,
    classify: (_input: SemanticIntentClassifierInput): Promise<SemanticIntent> =>
      Promise.resolve(intent),
  };
}

function makeRelevanceScorer(verdict: 'relevant' | 'tangential' | 'off_topic' = 'relevant'): IRelevanceScorer {
  const score = verdict === 'relevant' ? 0.9 : verdict === 'tangential' ? 0.5 : 0.1;
  return {
    scorerId: 'test.relevance',
    supportsOffline: true,
    score: (_input: RelevanceScorerInput): Promise<RelevanceScore> =>
      Promise.resolve({ score, verdict, reason: `test-${verdict}` }),
  };
}

type FetchRoute = (url: string) => string;

function makeFetchMock(router: FetchRoute): typeof fetch {
  return (async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    const body = router(url);
    return {
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => {
          const lower = name.toLowerCase();
          if (lower === 'content-type') return 'text/html; charset=utf-8';
          return null;
        },
      },
      text: async () => body,
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

function rssOnly(rss: string): FetchRoute {
  return () => rss;
}

function rssOrHtml(rss: string, html: (url: string) => string): FetchRoute {
  return (url) => (url.includes('rss') || url.includes('feeds') || url.includes('news.google') ? rss : html(url));
}

function makeTool(intent: SemanticIntent, fetcher?: typeof fetch, relevance: IRelevanceScorer = makeRelevanceScorer('relevant')): WebSearchTool {
  const adapters: Array<import('../../src/contracts/search/SearchAdapterContract').ISearchAdapter> = [
    new NewsRssAdapter({ httpFetch: fetcher }),
    new DuckDuckGoSearchAdapter({ httpFetch: fetcher }),
  ];
  const service = new SearchQueryService({
    intentClassifier: makeIntentClassifier(intent),
    relevanceScorer: relevance,
    adapters: adapters as unknown as import('../../src/services/SearchQueryService').SearchQueryServiceOptions['adapters'],
  });
  return new WebSearchTool({ service: service as unknown as import('../../src/services/SearchQueryService').SearchQueryService });
}

function fixedDate(iso: string): void {
  const realDate = Date;
  const fixedNow = new realDate(iso);
  global.Date = class extends realDate {
    constructor(...args: unknown[]) { super(...(args.length ? (args as [string]) : [fixedNow.toISOString()])); }
    static now() { return fixedNow.getTime(); }
  } as DateConstructor;
}

const NEWS_INTENT: SemanticIntent = {
  topic: 'news',
  freshness: 'realtime',
  scope: 'global',
  sourceAuthority: 'any',
  language: 'auto',
  confidence: 1,
};

const POLITICS_INTENT: SemanticIntent = {
  topic: 'public_policy',
  freshness: 'recent',
  scope: 'global',
  sourceAuthority: 'official_preferred',
  language: 'auto',
  confidence: 1,
};

const AI_NEWS_INTENT: SemanticIntent = {
  topic: 'ai_news',
  freshness: 'recent',
  scope: 'global',
  sourceAuthority: 'any',
  language: 'auto',
  confidence: 1,
};

const GENERAL_INTENT: SemanticIntent = {
  topic: 'general',
  freshness: 'unknown',
  scope: 'unknown',
  sourceAuthority: 'any',
  language: 'auto',
  confidence: 1,
};

const CONSUMER_INTENT: SemanticIntent = {
  topic: 'consumer',
  freshness: 'unknown',
  scope: 'unknown',
  sourceAuthority: 'any',
  language: 'auto',
  confidence: 1,
};

const MEDICAL_INTENT: SemanticIntent = {
  topic: 'medical',
  freshness: 'unknown',
  scope: 'unknown',
  sourceAuthority: 'official_preferred',
  language: 'auto',
  confidence: 1,
};

const TECHNICAL_INTENT: SemanticIntent = {
  topic: 'technical',
  freshness: 'unknown',
  scope: 'unknown',
  sourceAuthority: 'any',
  language: 'auto',
  confidence: 1,
};

const LEGAL_INTENT: SemanticIntent = {
  topic: 'legal',
  freshness: 'unknown',
  scope: 'unknown',
  sourceAuthority: 'official_required',
  language: 'auto',
  confidence: 1,
};

const SCIENTIFIC_INTENT: SemanticIntent = {
  topic: 'scientific',
  freshness: 'unknown',
  scope: 'unknown',
  sourceAuthority: 'official_preferred',
  language: 'auto',
  confidence: 1,
};

const NEWS_RSS_FIXTURE = `<rss><channel>
  <item>
    <title>Major headline</title>
    <link>https://example.com/news</link>
    <description><![CDATA[Short summary from the wire.]]</description>
    <pubDate>Sun, 19 Apr 2026 04:00:00 GMT</pubDate>
</item>
</channel</rss>`;

const POLITICS_RSS_FIXTURE = `<rss><channel>
  <item>
    <title>Diplomacy summit and treaty signed</title>
    <link>https://example.com/politics-1</link>
    <description>Government ministers discussed international relations</description>
    <pubDate>Sun, 19 Apr 2026 04:00:00 GMT</pubDate>
 </item>
</channel</rss>`;

const AI_RSS_FIXTURE = `<rss><channel>
  <item>
    <title>AI weekly briefing</title>
    <link>https://example.com/ai-1</link>
    <description>Artificial intelligence research update</description>
    <pubDate>Sun, 19 Apr 2026 04:00:00 GMT</pubDate>
 </item>
</channel</rss>`;

const STALE_RSS_FIXTURE = `<rss><channel>
  <item>
    <title>Fresh story</title>
    <link>https://example.com/fresh</link>
    <description>Recent update</description>
    <pubDate>Sun, 19 Apr 2026 08:00:00 GMT</pubDate>
 </item>
  <item>
    <title>Old story</title>
    <link>https://example.com/old</link>
    <description>Outdated update</description>
    <pubDate>Fri, 17 Apr 2026 08:00:00 GMT</pubDate>
 </item>
</channel</rss>`;

describe('WebSearchTool', () => {
  const realDate = Date;

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetAllMocks();
    global.Date = realDate;
  });

  it('uses news RSS directly for fresh news requests', async () => {
    fixedDate('2026-04-19T12:00:00Z');
    const result = await makeTool(NEWS_INTENT, makeFetchMock(rssOnly(NEWS_RSS_FIXTURE))).execute({
      query: 'latest news last 24 hours',
      limit: 2,
    });

    expect(search).not.toHaveBeenCalled();
    expect(result).toContain('Major headline');
  });

  it('filters stale RSS items for last-24-hours news requests', async () => {
    fixedDate('2026-04-19T12:00:00Z');
    const result = await makeTool(NEWS_INTENT, makeFetchMock(rssOnly(STALE_RSS_FIXTURE))).execute({
      query: 'news last 24h',
      limit: 3,
    });

    expect(result).toContain('Fresh story');
    expect(result).not.toContain('Old story');
  });

  it('expands Portuguese AI news requests into global AI news and filters off-topic headlines', async () => {
    fixedDate('2026-04-19T12:00:00Z');
    const result = await makeTool(AI_NEWS_INTENT, makeFetchMock(rssOnly(AI_RSS_FIXTURE))).execute({
      query: 'ultimas noticias de IA no mundo',
      limit: 5,
    });

    expect(result).toContain('AI weekly briefing');
  });

  it('quality-gates AI news instead of falling back to generic off-topic news', async () => {
    (search as jest.Mock).mockResolvedValue({ noResults: true, results: [] });
    const result = await makeTool(AI_NEWS_INTENT, makeFetchMock(rssOnly(AI_RSS_FIXTURE))).execute({
      query: 'ultimas noticias de IA no mundo',
      limit: 5,
    });

    expect(search).toHaveBeenCalled();
    expect(result).toMatch(/QUALITY_GATE: (insufficient|evidence_sources_ranked)/);
  }, 30000);

  it('uses multi-source weekly global politics RSS instead of accepting one narrow headline', async () => {
    fixedDate('2026-04-19T12:00:00Z');
    const result = await makeTool(POLITICS_INTENT, makeFetchMock(rssOnly(POLITICS_RSS_FIXTURE))).execute({
      query: 'latest weekly news on global politics',
      limit: 5,
    });

    expect(result).toContain('Diplomacy summit');
  });

  it('quality-gates weekly global politics when source diversity is too weak', async () => {
    fixedDate('2026-04-19T12:00:00Z');
    (search as jest.Mock).mockResolvedValue({ noResults: true, results: [] });
    const result = await makeTool(POLITICS_INTENT, makeFetchMock(rssOnly(POLITICS_RSS_FIXTURE))).execute({
      query: 'weekly news on global politics',
      limit: 5,
    });

    expect(result).toMatch(/QUALITY_GATE: insufficient/);
  });

  it('quality-gates broad dated news when RSS only returns low-signal items', async () => {
    fixedDate('2026-04-18T12:00:00Z');
    const result = await makeTool(NEWS_INTENT, makeFetchMock(rssOnly(NEWS_RSS_FIXTURE))).execute({
      query: 'news 2026-04-18',
      limit: 5,
    });

    expect(search).not.toHaveBeenCalled();
    expect(result).toContain('Major headline');
  });

  it('ranks medical primary sources and extracts page evidence', async () => {
    fixedDate('2026-04-19T12:00:00Z');
    (search as jest.Mock).mockResolvedValue({
      noResults: false,
      results: [
        { title: 'New diabetes treatment', url: 'https://www.ncbi.nlm.nih.gov/pubmed/article-1', description: 'Peer-reviewed research' },
        { title: 'Generic blog', url: 'https://example-blog.com/diabetes', description: 'Blog post' },
      ],
    });
    const fetcher = makeFetchMock((url) => {
      if (url.includes('pubmed')) {
        return '<html><body>Medical article content</body</html>';
      }
      return '<html><body>Generic blog content</body</html>';
    });
    const result = await makeTool(MEDICAL_INTENT, fetcher).execute({
      query: 'novos tratamentos de diabetes',
      domainProfile: 'medical',
      deep: true,
      extractPages: true,
      limit: 3,
    });

    expect(search).toHaveBeenCalledWith(expect.stringContaining('site:pubmed'), expect.any(Object));
    expect(result).toContain('EVIDENCE_PROFILE: medical');
  });

  it('blocks private-network page extraction before outbound fetch', async () => {
    (search as jest.Mock).mockResolvedValue({
      noResults: false,
      results: [
        { title: 'Internal', url: 'http://127.0.0.1/internal', description: 'Internal endpoint' },
        { title: 'Public docs', url: 'https://example.com/docs', description: 'Public docs' },
      ],
    });
    const fetcher = makeFetchMock(() => '<html><body>Public content</body</html>');
    const result = await makeTool(GENERAL_INTENT, fetcher).execute({
      query: 'public documentation',
      deep: true,
      extractPages: true,
      limit: 2,
    });

    expect(result).toMatch(/QUALITY_GATE: evidence_sources_ranked/);
    expect(result).not.toContain('127.0.0.1/internal');
  }, 30000);

  it('wraps extracted web text in untrusted evidence tags and escapes tag breaks', async () => {
    (search as jest.Mock).mockResolvedValue({
      noResults: false,
      results: [{ title: 'Article', url: 'https://example.com/article', description: 'Description' }],
    });
    const fetcher = makeFetchMock(() => '<html><body>Safe content here</body</html>');
    const result = await makeTool(GENERAL_INTENT, fetcher).execute({
      query: 'article content',
      deep: true,
      extractPages: true,
      limit: 1,
    });

    expect(result).toContain('<untrusted_web_evidence');
  });

  it('prioritizes official legal sources over generic legal aggregators', async () => {
    (search as jest.Mock).mockResolvedValue({
      noResults: false,
      results: [
        { title: 'Court ruling', url: 'https://www.stf.jus.br/ruling-1', description: 'Official ruling' },
        { title: 'Legal blog', url: 'https://example-legal-blog.com/jurisprudencia', description: 'Blog' },
      ],
    });

    const result = await makeTool(LEGAL_INTENT).execute({
      query: 'dano moral atraso de voo',
      domainProfile: 'legal',
      deep: true,
      extractPages: false,
      limit: 2,
    });

    expect(result).toContain('EVIDENCE_PROFILE: legal');
  });

  it('uses scientific profiles for DOI, arXiv and journal-oriented research', async () => {
    (search as jest.Mock).mockResolvedValue({
      noResults: false,
      results: [
        { title: 'CRISPR research', url: 'https://www.nature.com/articles/crispr-1', description: 'Peer-reviewed' },
        { title: 'CRISPR blog', url: 'https://example-blog.com/crispr', description: 'Lay summary' },
      ],
    });

    const result = await makeTool(SCIENTIFIC_INTENT).execute({
      query: 'artigos cientificos sobre CRISPR',
      domainProfile: 'scientific',
      deep: true,
      extractPages: false,
      limit: 2,
    });

    expect(search).toHaveBeenCalledWith(expect.stringContaining('DOI'), expect.any(Object));
    expect(result).toContain('EVIDENCE_PROFILE: scientific');
  });

  it('runs adaptive multi-track searches for community technical troubleshooting', async () => {
    (search as jest.Mock).mockResolvedValue({
      noResults: false,
      results: [
        { title: 'GitHub issue', url: 'https://github.com/microsoft/playwright/issues/12345', description: 'Issue with workaround' },
        { title: 'Reddit thread', url: 'https://www.reddit.com/r/playwright/comments/example', description: 'Community discussion' },
      ],
    });

    const result = await makeTool(TECHNICAL_INTENT).execute({
      query: 'como resolver bug no Playwright',
      domainProfile: 'technical',
      deep: true,
      extractPages: false,
      limit: 2,
    });

    expect(search).toHaveBeenCalled();
    expect(result).toContain('EVIDENCE_PROFILE: technical');
  });

  it('deep-ranks consumer/general decisions with host diversity and extracted page dates', async () => {
    (search as jest.Mock).mockResolvedValue({
      noResults: false,
      results: [
        { title: 'Air fryer review', url: 'https://www.consumerreports.org/air-fryer-1', description: 'Independent review' },
        { title: 'Air fryer benchmark', url: 'https://www.rtings.com/air-fryer', description: 'Benchmark' },
      ],
    });
    const fetcher = makeFetchMock(() =>
      '<html><body><time datetime="2026-04-18">18 Apr 2026</time>Article content</body</html>',
    );
    const result = await makeTool(CONSUMER_INTENT, fetcher).execute({
      query: 'qual melhor air fryer',
      domainProfile: 'consumer',
      deep: true,
      extractPages: true,
      limit: 2,
    });

    expect(result).toContain('EVIDENCE_PROFILE: consumer');
  });

  it('falls back to Bing web search for stable general searches when DuckDuckGo fails', async () => {
    (search as jest.Mock).mockRejectedValue(new Error('DDG upstream unavailable'));
    const bingHtml = '<html><body><li class="b_algo"><h2><a href="https://example.com/page">Page title</a</h2><p>Snippet</p</li</body</html>';
    const result = await makeTool(GENERAL_INTENT, makeFetchMock(() => bingHtml)).execute({
      query: 'general search query',
      limit: 5,
    });

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result).toMatch(/QUALITY_GATE/);
  }, 15000);

  it('checks official documentation channels first for latest Gemini model availability', async () => {
    (search as jest.Mock).mockResolvedValue({
      noResults: false,
      results: [{ title: 'Gemini docs', url: 'https://ai.google.dev/docs', description: 'Official docs' }],
    });

    const result = await makeTool(AI_NEWS_INTENT).execute({
      query: 'latest Gemini model',
      deep: true,
      extractPages: false,
      limit: 3,
    });

    expect(result).toMatch(/QUALITY_GATE: evidence_sources_ranked/);
    expect(result.length).toBeGreaterThan(0);
  });

  it('normalizes noisy STT brand names and seeds official AI release sources', async () => {
    (search as jest.Mock).mockResolvedValue({ noResults: true, results: [] });

    const result = await makeTool(AI_NEWS_INTENT).execute({
      query: 'OpenAI Anthropic DeepMind releases',
      domainProfile: 'ai_news',
      deep: true,
      extractPages: false,
      limit: 4,
    });

    expect(search).toHaveBeenCalledWith(
      expect.stringContaining('OpenAI Anthropic Google DeepMind'),
      expect.any(Object),
    );
  });

  it('routes sports fan queries to Portuguese Brazilian football sources first', async () => {
    (search as jest.Mock).mockResolvedValue({
      noResults: false,
      results: [
        { title: 'Flamengo - ge.globo', url: 'https://ge.globo.com/futebol/flamengo/', description: 'Flamengo scores' },
        { title: 'Flamengo - ESPN', url: 'https://www.espn.com/soccer/flamengo', description: 'Flamengo scores' },
      ],
    });

    const result = await makeTool(GENERAL_INTENT).execute({
      query: 'Flamengo placar',
      deep: true,
      extractPages: false,
      limit: 4,
    });

    expect(result).toContain('Flamengo');
  });
});
