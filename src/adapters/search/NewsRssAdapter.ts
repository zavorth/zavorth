import { logger } from '../../logger.js';
import { wrapUntrustedContent } from '../../security/UntrustedContent.js';
import type {
  ISearchAdapter,
  SearchAdapterCapability,
} from '../../contracts/search/SearchAdapterContract.js';
import type {
  SearchQueryMode,
  SearchQueryRequest,
  AdapterSearchOutput,
  AdapterSearchItem,
} from '../../contracts/core/SearchQueryContract.js';
import type {
  SemanticIntent,
  SemanticFreshness,
} from '../../contracts/search/SemanticIntentContract.js';
import type { IRelevanceScorer } from '../../contracts/search/SemanticIntentContract.js';

export const NEWS_RSS_ADAPTER_ID = 'news-rss';

export type NewsRssTimeWindow = '24h' | '7d' | 'all';

export interface NewsRssFeed {
  readonly id: string;
  readonly url: string;
  readonly label: string;
  readonly topics: ReadonlyArray<string>;
}

const NEWS_RSS_FEEDS: ReadonlyArray<NewsRssFeed> = [
  {
    id: 'google-news-generic',
    url: 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en',
    label: 'Google News RSS (generic briefing)',
    topics: ['general', 'news'],
  },
  {
    id: 'google-news-pt',
    url: 'https://news.google.com/rss?hl=pt-BR&gl=BR&ceid=BR:pt-419',
    label: 'Google News BR RSS (generic briefing)',
    topics: ['general', 'news'],
  },
  {
    id: 'reuters-world',
    url: 'https://feeds.reuters.com/Reuters/worldNews',
    label: 'Reuters World RSS',
    topics: ['news', 'public_policy'],
  },
  {
    id: 'ap-top',
    url: 'https://feeds.apnews.com/rss/apf-topnews',
    label: 'AP Top News RSS',
    topics: ['news', 'public_policy'],
  },
  {
    id: 'bbc-world',
    url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    label: 'BBC World RSS',
    topics: ['news', 'public_policy'],
  },
  {
    id: 'guardian-world',
    url: 'https://www.theguardian.com/world/rss',
    label: 'The Guardian World RSS',
    topics: ['news', 'public_policy'],
  },
  {
    id: 'politics-multisource',
    url: 'https://news.google.com/rss/headlines/section/topic/WORLD?q=global%20politics%20international%20relations%20elections%20diplomacy%20conflict%20summit%20government%20when%3A7d',
    label: 'Google News RSS (global politics multi-query)',
    topics: ['public_policy', 'news'],
  },
  {
    id: 'ai-press',
    url: 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?q=artificial%20intelligence%20machine%20learning%20when%3A7d',
    label: 'Google News RSS (technology/AI briefing)',
    topics: ['ai_news', 'technical', 'news'],
  },
];

const PRIVATE_HOSTS: ReadonlySet<string> = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
]);

export interface NewsRssAdapterOptions {
  readonly relevanceScorer?: IRelevanceScorer | null;
  readonly httpFetch?: typeof fetch;
}

export function createDefaultNewsRssAdapters(options?: NewsRssAdapterOptions): NewsRssAdapter {
  return new NewsRssAdapter(options);
}

export interface NewsRssRoutingPlan {
  readonly feeds: ReadonlyArray<NewsRssFeed>;
  readonly timeWindow: NewsRssTimeWindow;
  readonly requiresRelevanceFilter: boolean;
}

export function planNewsRssRouting(intent: SemanticIntent): NewsRssRoutingPlan {
  const topicFeeds = NEWS_RSS_FEEDS.filter((feed) => feed.topics.includes(intent.topic));
  const feeds = topicFeeds.length > 0 ? topicFeeds : NEWS_RSS_FEEDS.filter((f) => f.id === 'google-news-generic');
  const timeWindow = resolveTimeWindow(intent.freshness);
  const requiresRelevanceFilter = intent.topic !== 'news';
  const maxFeeds = timeWindow === '24h' ? 1 : 4;
  return { feeds: feeds.slice(0, maxFeeds), timeWindow, requiresRelevanceFilter };
}

function resolveTimeWindow(freshness: SemanticFreshness): NewsRssTimeWindow {
  if (freshness === 'realtime') return '24h';
  if (freshness === 'recent') return '7d';
  return 'all';
}

type RssItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
};

export class NewsRssAdapter implements ISearchAdapter {
  public readonly adapterId = NEWS_RSS_ADAPTER_ID;
  public readonly displayName = 'News RSS aggregator';
  public readonly supportedModes: ReadonlyArray<SearchQueryMode> = ['quick', 'deep'];
  public readonly capabilities: ReadonlyArray<SearchAdapterCapability> = ['news_rss'];

  private readonly relevanceScorer: IRelevanceScorer | null;
  private readonly httpFetchOverride: typeof fetch | null;

  constructor(options: NewsRssAdapterOptions = {}) {
    this.relevanceScorer = options.relevanceScorer ?? null;
    this.httpFetchOverride = options.httpFetch ?? null;
  }

  private get httpFetch(): typeof fetch {
    return this.httpFetchOverride ?? fetch;
  }

  public async isAvailable(): Promise<boolean> {
    return true;
  }

  public async search(request: SearchQueryRequest, intent: SemanticIntent): Promise<AdapterSearchOutput> {
    if (!this.canServeIntent(intent)) {
      return { items: [], providerId: this.adapterId };
    }
    const plan = planNewsRssRouting(intent);
    if (plan.feeds.length === 0) {
      return { items: [], providerId: this.adapterId };
    }

    logger.info(
      `[NewsRssAdapter] Fetching ${plan.feeds.length} RSS feed(s) (topic=${intent.topic}, freshness=${intent.freshness}, window=${plan.timeWindow})`,
    );

    const cutoffMs = this.resolveCutoffMs(plan.timeWindow);
    const fetchPromises = plan.feeds.map((feed) =>
      this.fetchAndParse(feed, cutoffMs).then((items) => ({ feed, items })),
    );
    const settled = await Promise.allSettled(fetchPromises);
    const items: AdapterSearchItem[] = [];
    let originalRank = 1;

    for (const result of settled) {
      if (result.status !== 'fulfilled') continue;
      const { feed, items: feedItems } = result.value;
      for (const rssItem of feedItems) {
        items.push({
          title: rssItem.title,
          url: rssItem.link,
          description: rssItem.description,
          originalRank: originalRank++,
          sourceQuery: request.query,
          metadata: {
            providerId: feed.id,
            feedLabel: feed.label,
            publishedAt: rssItem.pubDate,
            sourceType: 'news-rss',
          },
        });
      }
    }

    let filtered = items;
    if (plan.requiresRelevanceFilter && this.relevanceScorer) {
      filtered = await this.applyRelevanceFilter(items, request, intent);
    }

    return { items: filtered.slice(0, Math.min(request.limit || 5, 10)), providerId: this.adapterId };
  }

  private canServeIntent(intent: SemanticIntent): boolean {
    return intent.topic === 'news'
      || intent.topic === 'public_policy'
      || intent.topic === 'ai_news'
      || intent.topic === 'general';
  }

  private async applyRelevanceFilter(
    items: AdapterSearchItem[],
    request: SearchQueryRequest,
    intent: SemanticIntent,
  ): Promise<AdapterSearchItem[]> {
    const scorer = this.relevanceScorer;
    if (!scorer) return items;

    const scored = await Promise.all(
      items.map(async (item) => {
        const result = await scorer.score({
          itemTitle: item.title,
          itemSnippet: item.description,
          itemUrl: item.url,
          query: request.query,
          intent,
        });
        return { item, result };
      }),
    );
    return scored
      .filter((entry) => entry.result.verdict !== 'off_topic')
      .map((entry) => entry.item);
  }

  private resolveCutoffMs(window: NewsRssTimeWindow): number {
    const now = Date.now();
    if (window === '24h') return now - 24 * 60 * 60 * 1000;
    if (window === '7d') return now - 7 * 24 * 60 * 60 * 1000;
    return 0;
  }

  private async fetchAndParse(feed: NewsRssFeed, cutoffMs: number): Promise<RssItem[]> {
    try {
      const response = await this.httpFetch(feed.url, {
        headers: {
          'user-agent': 'Zavorth/1.0 (+local assistant; news RSS aggregator)',
          accept: 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.5',
        },
        signal: AbortSignal.timeout(8_000),
      });

      if (!response.ok) return [];
      const xml = await response.text();
      const items = this.parseRss(xml);
      return items.filter((item) => this.isFresh(item, cutoffMs));
    } catch (error: unknown) {
      logger.warn(`[NewsRssAdapter] feed ${feed.id} failed: ${(error as Error)?.message || String(error)}`);
      return [];
    }
  }

  private parseRss(xml: string): RssItem[] {
    return Array.from(String(xml || '').matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi))
      .map((match) => {
        const block = match[1] || '';
        const title = this.extractTag(block, 'title');
        const link = this.extractTag(block, 'link');
        const description = this.extractCdata(this.extractTag(block, 'description'));
        const pubDate = this.extractTag(block, 'pubDate');
        if (!title || !link) return null;
        if (!this.isSafeUrl(link)) return null;
        return { title, link, description, pubDate };
      })
      .filter((item): item is RssItem => Boolean(item));
  }

  private isSafeUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      if (PRIVATE_HOSTS.has(host)) return false;
      if (host.endsWith('.local') || host.endsWith('.internal')) return false;
      if (!/^https?:$/i.test(parsed.protocol)) return false;
      return true;
    } catch {
      return false;
    }
  }

  private extractTag(block: string, tag: string): string {
    const match = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    return match?.[1] ? this.decodeEntities(match[1]).trim() : '';
  }

  private extractCdata(text: string): string {
    return String(text || '')
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private decodeEntities(text: string): string {
    const s = String(text || '');
    const entities: ReadonlyArray<[string, string]> = [
      [String.fromCharCode(38) + 'amp;', String.fromCharCode(38)],
      [String.fromCharCode(38) + 'lt;', String.fromCharCode(60)],
      [String.fromCharCode(38) + 'gt;', String.fromCharCode(62)],
      [String.fromCharCode(38) + 'quot;', String.fromCharCode(34)],
      [String.fromCharCode(38) + '#39;', String.fromCharCode(39)],
      [String.fromCharCode(38) + 'nbsp;', String.fromCharCode(32)],
    ];
    let out = s;
    for (const [entity, replacement] of entities) {
      out = out.split(entity).join(replacement);
    }
    return out.trim();
  }

  private isFresh(item: RssItem, cutoffMs: number): boolean {
    if (cutoffMs <= 0) return true;
    const ts = Date.parse(item.pubDate);
    if (!Number.isFinite(ts)) return true;
    return ts >= cutoffMs;
  }
}

export function wrapNewsRssSnippet(content: string, sourceUrl: string): string {
  return wrapUntrustedContent('untrusted_web_evidence', content, {
    source_url: sourceUrl,
    kind: 'news_rss_snippet',
  });
}
