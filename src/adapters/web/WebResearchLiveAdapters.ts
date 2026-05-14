import type {
  AdapterSearchItem,
  AdapterSearchOutput,
  ISearchQueryAdapter,
  SearchQueryMode,
  SearchQueryRequest,
} from '../../contracts/SearchQueryContract.js';
import type {
  WebExtractLiveAdapterInput,
  WebExtractLiveAdapterOutput,
  IWebExtractLiveAdapter,
} from '../../services/WebExtractService.js';

type FetchRuntime = {
  fetchImpl?: typeof fetch;
};

export type SearchProviderRequestStyle =
  | 'brave'
  | 'exa'
  | 'searxng'
  | 'tavily'
  | 'generic-get'
  | 'generic-post';

export type SearchProviderLiveAdapterConfig = {
  adapterId: string;
  providerId: string;
  searchUrl: string;
  apiKey?: string | null;
  requestStyle: SearchProviderRequestStyle;
  authHeaderName?: string;
  authScheme?: string | null;
  queryParamName?: string;
};

export type FirecrawlWebExtractLiveAdapterConfig = {
  adapterId: string;
  providerId: string;
  scrapeUrl: string;
  crawlUrl?: string | null;
  apiKey?: string | null;
};

export type ReadabilityWebExtractLiveAdapterConfig = {
  adapterId: string;
  providerId: string;
  userAgent?: string;
  maxBytes?: number;
};

export type BrowserCaptureRunner = (input: WebExtractLiveAdapterInput) => Promise<WebExtractLiveAdapterOutput>;

export type BrowserCaptureWebExtractLiveAdapterConfig = {
  adapterId: string;
  providerId: string;
  headless?: boolean;
  timeoutMs?: number;
};

export class SearchProviderLiveAdapter implements ISearchQueryAdapter {
  public readonly adapterId: string;
  public readonly supportedModes: SearchQueryMode[] = ['quick', 'deep'];

  private readonly config: Required<Omit<SearchProviderLiveAdapterConfig, 'apiKey' | 'authScheme'>> & {
    apiKey?: string | null;
    authScheme?: string | null;
  };
  private readonly fetchImpl: typeof fetch | null;

  constructor(config: SearchProviderLiveAdapterConfig, runtime: FetchRuntime = {}) {
    this.adapterId = config.adapterId;
    this.config = {
      ...config,
      authHeaderName: config.authHeaderName || 'Authorization',
      authScheme: config.authScheme === undefined ? 'Bearer' : config.authScheme,
      queryParamName: config.queryParamName || 'q',
    };
    this.fetchImpl = runtime.fetchImpl || globalThis.fetch || null;
  }

  public async search(request: SearchQueryRequest): Promise<AdapterSearchOutput> {
    if (!this.fetchImpl) {
      throw new Error(`${this.adapterId} requires fetch in the runtime.`);
    }
    const limit = Math.min(request.limit || 5, 10);
    const response = await this.fetchImpl(this.buildUrl(request, limit), {
      method: this.usesPost() ? 'POST' : 'GET',
      headers: this.headers(),
      body: this.usesPost() ? JSON.stringify(this.body(request, limit)) : undefined,
    });
    const payload = await readJson(response);
    if (!response.ok) {
      throw new Error(`${this.adapterId} search failed: ${readError(payload, response.status)}`);
    }

    return {
      providerId: this.config.providerId,
      items: this.normalizeItems(payload, request.query, limit),
    };
  }

  private buildUrl(request: SearchQueryRequest, limit: number): string {
    if (this.usesPost()) {
      return this.config.searchUrl;
    }
    const url = new URL(this.config.searchUrl);
    url.searchParams.set(this.config.queryParamName, request.query);
    if (this.config.requestStyle === 'brave') {
      url.searchParams.set('count', String(limit));
    } else if (this.config.requestStyle === 'searxng') {
      url.searchParams.set('format', 'json');
      url.searchParams.set('language', 'auto');
    } else {
      url.searchParams.set('limit', String(limit));
    }
    return url.toString();
  }

  private usesPost(): boolean {
    return this.config.requestStyle === 'exa'
      || this.config.requestStyle === 'tavily'
      || this.config.requestStyle === 'generic-post';
  }

  private body(request: SearchQueryRequest, limit: number): Record<string, unknown> {
    if (this.config.requestStyle === 'exa') {
      return {
        query: request.query,
        numResults: limit,
        contents: {
          text: false,
        },
      };
    }
    if (this.config.requestStyle === 'tavily') {
      return {
        query: request.query,
        max_results: limit,
        search_depth: request.mode === 'deep' ? 'advanced' : 'basic',
        include_answer: false,
      };
    }
    return {
      query: request.query,
      limit,
    };
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers[this.config.authHeaderName] = this.config.authScheme
        ? `${this.config.authScheme} ${this.config.apiKey}`
        : this.config.apiKey;
    }
    return headers;
  }

  private normalizeItems(payload: unknown, sourceQuery: string, limit: number): AdapterSearchItem[] {
    const rawItems = this.readItems(payload);
    return rawItems
      .map((item, index) => this.toSearchItem(item, index, sourceQuery))
      .filter((item): item is AdapterSearchItem => Boolean(item?.url && item.title))
      .slice(0, limit);
  }

  private readItems(payload: unknown): unknown[] {
    if (this.config.requestStyle === 'brave') {
      return arrayOrEmpty(readPath(payload, 'web.results'));
    }
    if (this.config.requestStyle === 'exa') {
      return arrayOrEmpty(readPath(payload, 'results'));
    }
    if (this.config.requestStyle === 'tavily') {
      return arrayOrEmpty(readPath(payload, 'results'));
    }
    if (this.config.requestStyle === 'searxng') {
      return arrayOrEmpty(readPath(payload, 'results'));
    }
    return arrayOrEmpty(readPath(payload, 'items') || readPath(payload, 'results') || readPath(payload, 'data'));
  }

  private toSearchItem(item: unknown, index: number, sourceQuery: string): AdapterSearchItem | null {
    const title = stringOrEmpty(
      readPath(item, 'title')
      || readPath(item, 'name')
      || readPath(item, 'heading'),
    );
    const url = stringOrEmpty(
      readPath(item, 'url')
      || readPath(item, 'link')
      || readPath(item, 'href'),
    );
    const description = stringOrEmpty(
      readPath(item, 'description')
      || readPath(item, 'snippet')
      || readPath(item, 'content')
      || readPath(item, 'text'),
    );
    if (!title || !url) {
      return null;
    }
    return {
      title,
      url,
      description,
      originalRank: index + 1,
      sourceQuery,
      metadata: {
        providerId: this.config.providerId,
        requestStyle: this.config.requestStyle,
        score: readPath(item, 'score') || null,
      },
    };
  }
}

export class FirecrawlWebExtractLiveAdapter implements IWebExtractLiveAdapter {
  public readonly adapterId: string;
  public readonly providerId: string;
  public readonly supportedModes = ['fetch', 'readability', 'crawl'] as const;

  private readonly config: FirecrawlWebExtractLiveAdapterConfig;
  private readonly fetchImpl: typeof fetch | null;

  constructor(config: FirecrawlWebExtractLiveAdapterConfig, runtime: FetchRuntime = {}) {
    this.adapterId = config.adapterId;
    this.providerId = config.providerId;
    this.config = config;
    this.fetchImpl = runtime.fetchImpl || globalThis.fetch || null;
  }

  public async extract(input: WebExtractLiveAdapterInput): Promise<WebExtractLiveAdapterOutput> {
    if (!this.fetchImpl) {
      throw new Error(`${this.adapterId} requires fetch in the runtime.`);
    }
    const crawl = input.mode === 'crawl';
    const endpoint = crawl
      ? this.config.crawlUrl || this.config.scrapeUrl.replace(/\/scrape\/?$/i, '/crawl')
      : this.config.scrapeUrl;
    const response = await this.fetchImpl(endpoint, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        url: input.target,
        limit: input.limits.maxPages,
        scrapeOptions: {
          formats: ['markdown', 'html'],
        },
      }),
    });
    const payload = await readJson(response);
    if (!response.ok) {
      throw new Error(`${this.adapterId} extraction failed: ${readError(payload, response.status)}`);
    }
    const text = stringOrEmpty(
      readPath(payload, 'data.markdown')
      || readPath(payload, 'markdown')
      || readPath(payload, 'data.0.markdown')
      || readPath(payload, 'data.content')
      || readPath(payload, 'content'),
    );
    const html = stringOrEmpty(readPath(payload, 'data.html') || readPath(payload, 'html'));
    const title = stringOrEmpty(readPath(payload, 'data.metadata.title') || readPath(payload, 'metadata.title'));
    const links = arrayOrEmpty(readPath(payload, 'data.links') || readPath(payload, 'links'))
      .map((link) => stringOrEmpty(link))
      .filter(Boolean)
      .slice(0, input.limits.maxLinks);

    return {
      title: title || extractHtmlTitle(html) || input.target,
      text: text || htmlToText(html),
      html: html || null,
      links,
      contentType: 'application/json',
      providerEvidence: {
        providerId: this.providerId,
        mode: input.mode,
        target: input.target,
        metadata: {
          firecrawl: true,
          crawl,
          secretValuesSerialized: false,
        },
      },
    };
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }
    return headers;
  }
}

export class ReadabilityWebExtractLiveAdapter implements IWebExtractLiveAdapter {
  public readonly adapterId: string;
  public readonly providerId: string;
  public readonly supportedModes = ['fetch', 'readability'] as const;

  private readonly config: Required<ReadabilityWebExtractLiveAdapterConfig>;
  private readonly fetchImpl: typeof fetch | null;

  constructor(config: ReadabilityWebExtractLiveAdapterConfig, runtime: FetchRuntime = {}) {
    this.adapterId = config.adapterId;
    this.providerId = config.providerId;
    this.config = {
      userAgent: config.userAgent || 'Zavorth/1.0 (+local assistant; governed web extraction)',
      maxBytes: config.maxBytes || 1_500_000,
      adapterId: config.adapterId,
      providerId: config.providerId,
    };
    this.fetchImpl = runtime.fetchImpl || globalThis.fetch || null;
  }

  public async extract(input: WebExtractLiveAdapterInput): Promise<WebExtractLiveAdapterOutput> {
    if (!this.fetchImpl) {
      throw new Error(`${this.adapterId} requires fetch in the runtime.`);
    }
    const response = await this.fetchImpl(input.target, {
      method: 'GET',
      headers: {
        'user-agent': this.config.userAgent,
        accept: 'text/html,text/plain,application/xhtml+xml;q=0.9,*/*;q=0.2',
      },
      signal: AbortSignal.timeout(input.limits.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`${this.adapterId} HTTP ${response.status}`);
    }
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (Number.isFinite(contentLength) && contentLength > this.config.maxBytes) {
      throw new Error(`${this.adapterId} target exceeds maxBytes ${this.config.maxBytes}.`);
    }
    const contentType = response.headers.get('content-type') || 'text/html';
    const raw = await response.text();
    const html = contentType.includes('html') ? raw : null;
    const text = contentType.includes('html') ? htmlToText(raw) : raw;
    return {
      title: html ? extractHtmlTitle(html) : input.target,
      text: text.slice(0, input.limits.maxChars),
      html,
      links: html ? extractLinks(html, input.target).slice(0, input.limits.maxLinks) : [],
      contentType,
      providerEvidence: {
        providerId: this.providerId,
        mode: input.mode,
        target: input.target,
        metadata: {
          readability: input.mode === 'readability',
          secretValuesSerialized: false,
        },
      },
    };
  }
}

export class BrowserCaptureWebExtractLiveAdapter implements IWebExtractLiveAdapter {
  public readonly adapterId: string;
  public readonly providerId: string;
  public readonly supportedModes = ['browser-capture'] as const;

  private readonly config: Required<BrowserCaptureWebExtractLiveAdapterConfig>;
  private readonly runner: BrowserCaptureRunner | null;

  constructor(config: BrowserCaptureWebExtractLiveAdapterConfig, runner: BrowserCaptureRunner | null = null) {
    this.adapterId = config.adapterId;
    this.providerId = config.providerId;
    this.config = {
      adapterId: config.adapterId,
      providerId: config.providerId,
      headless: config.headless !== false,
      timeoutMs: config.timeoutMs || 30_000,
    };
    this.runner = runner;
  }

  public async extract(input: WebExtractLiveAdapterInput): Promise<WebExtractLiveAdapterOutput> {
    if (this.runner) {
      return this.runner(input);
    }

    const playwright = await import('playwright');
    const browser = await playwright.chromium.launch({ headless: this.config.headless });
    try {
      const page = await browser.newPage();
      await page.goto(input.target, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.timeoutMs,
      });
      const title = await page.title();
      const text = await page.locator('body').innerText({ timeout: this.config.timeoutMs }).catch(() => '');
      const html = await page.content();
      const screenshot = await page.screenshot({ fullPage: true, type: 'png' });
      return {
        title: title || input.target,
        text: text.slice(0, input.limits.maxChars),
        html,
        links: extractLinks(html, input.target).slice(0, input.limits.maxLinks),
        screenshot,
        contentType: 'text/html',
        providerEvidence: {
          providerId: this.providerId,
          mode: input.mode,
          target: input.target,
          metadata: {
            browserCapture: true,
            headless: this.config.headless,
            secretValuesSerialized: false,
          },
        },
      };
    } finally {
      await browser.close();
    }
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function readError(payload: unknown, status: number): string {
  return String(readPath(payload, 'error.message') || readPath(payload, 'message') || readPath(payload, 'error') || `HTTP ${status}`);
}

function readPath(payload: unknown, pathExpression: string): unknown {
  return String(pathExpression || '')
    .split('.')
    .filter(Boolean)
    .reduce<unknown>((current, part) => {
      if (current === null || current === undefined) return undefined;
      if (Array.isArray(current) && /^\d+$/.test(part)) return current[Number(part)];
      if (typeof current === 'object') return (current as Record<string, unknown>)[part];
      return undefined;
    }, payload);
}

function arrayOrEmpty(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringOrEmpty(value: unknown): string {
  return String(value || '').trim();
}

function extractHtmlTitle(raw: string): string {
  const match = String(raw || '').match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? stripHtml(match[1]).slice(0, 180) : '';
}

function htmlToText(raw: string): string {
  return stripHtml(
    String(raw || '')
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<nav\b[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<footer\b[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<header\b[\s\S]*?<\/header>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|li|h1|h2|h3|section|article|div)>/gi, '\n'),
  )
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function stripHtml(text: string): string {
  return String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractLinks(html: string, baseUrl: string): string[] {
  return Array.from(String(html || '').matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi))
    .map((match) => {
      try {
        return new URL(match[1] || '', baseUrl).toString();
      } catch {
        return '';
      }
    })
    .filter(Boolean)
    .filter((link, index, all) => all.indexOf(link) === index);
}
