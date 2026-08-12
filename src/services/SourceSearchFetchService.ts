
import crypto from 'node:crypto';
import { logger } from '../logger.js';
import type {
ProxyRoutingPolicyReceipt,
  SearchFetchReceipt,
} from '../contracts/SourceMemoryDocumentTerminalPackContract.js';
import { asErrorLike } from '../utils/errorLike.js';

type Runtime = {
  now?: () => Date;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
};

export class SourceSearchFetchService {
  private readonly now: () => Date;
  private readonly env: NodeJS.ProcessEnv;
  private readonly fetchImpl: typeof fetch;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.env = runtime.env || process.env;
    this.fetchImpl = runtime.fetchImpl || fetch;
  }

  public previewSearchArtifact(input: {
    query: string;
    resultCount?: number;
  }): SearchFetchReceipt {
    const query = String(input.query || '').trim();
    const resultCount = Math.max(0, input.resultCount || 0);
    return {
      id: `credential-vault.search.${hashId(`${query}:${this.now().toISOString()}`)}`,
      status: query ? 'dryRun' : 'blocked',
      mode: 'search',
      query,
      url: null,
      resultCount: query ? resultCount : 0,
      proxyPolicy: this.buildProxyPolicyReceipt(),
      artifactFirst: true,
      liveNetworkPerformed: false,
      secretValuesSerialized: false,
      reason: query ? 'Search behavior is represented as an offline artifact-first receipt; live search remains explicit.'
        : 'Search query is empty.',
    };
  }

  public async fetchUrl(input: {
    url: string;
    confirmLiveNetwork?: boolean;
    timeoutMs?: number;
  }): Promise<SearchFetchReceipt> {
    const extracted = await this.fetchAndExtract(input);
    return extracted.receipt;
  }

  /**
   * Live fetch that also extracts title + plain text body (size-capped).
   * Requires confirmLiveNetwork; blocks non-http(s) and obvious SSRF targets.
   */
  public async fetchAndExtract(input: {
    url: string;
    confirmLiveNetwork?: boolean;
    timeoutMs?: number;
    maxContentChars?: number;
  }): Promise<SourceFetchExtractResult> {
    const url = String(input.url || '').trim();
    const maxContentChars = Math.max(1_000, Math.min(input.maxContentChars || 60_000, 200_000));

    if (!/^https?:\/\//i.test(url)) {
      return this.extractResult({
        status: 'blocked',
        url,
        liveNetworkPerformed: false,
        reason: 'Fetch URL must be http(s).',
      });
    }
    if (isBlockedPrivateUrl(url)) {
      return this.extractResult({
        status: 'blocked',
        url,
        liveNetworkPerformed: false,
        reason: 'Refusing fetch to localhost/private/link-local addresses.',
      });
    }
    if (input.confirmLiveNetwork !== true) {
      return this.extractResult({
        status: 'blocked',
        url,
        liveNetworkPerformed: false,
        reason: 'Live network fetch requires --confirm-live-network.',
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(1000, Math.min(input.timeoutMs || 8000, 60_000)));
    try {
      const response = await this.fetchImpl(url, {
        signal: controller.signal,
        headers: {
          'accept': 'text/html,text/plain,application/json;q=0.8,*/*;q=0.2',
          'user-agent': 'Zavorth-Source-Stage5/1.0',
        },
        redirect: 'follow',
      });
      if (!response.ok) {
        return this.extractResult({
          status: 'failed',
          url,
          liveNetworkPerformed: true,
          reason: `HTTP ${response.status}`,
        });
      }

      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      const raw = (await response.text()).slice(0, maxContentChars + 4_000);
      const extracted = extractTitleAndText(raw, contentType, maxContentChars);
      return {
        receipt: this.fetchReceipt({
          status: 'fetched',
          url,
          resultCount: extracted.contentChars > 0 ? 1 : 0,
          liveNetworkPerformed: true,
          reason: `HTTP ${response.status}; extracted ${extracted.contentChars} chars`,
        }),
        title: extracted.title,
        content: extracted.content,
        contentChars: extracted.contentChars,
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Source Search] network request failed', error);
      return this.extractResult({
        status: 'failed',
        url,
        liveNetworkPerformed: true,
        reason: error instanceof Error ? err.message : String(error),
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractResult(input: {
    status: SearchFetchReceipt['status'];
    url: string;
    liveNetworkPerformed: boolean;
    reason: string;
  }): SourceFetchExtractResult {
    return {
      receipt: this.fetchReceipt({
        status: input.status,
        url: input.url,
        resultCount: 0,
        liveNetworkPerformed: input.liveNetworkPerformed,
        reason: input.reason,
      }),
      title: null,
      content: null,
      contentChars: 0,
    };
  }

  public buildProxyPolicyReceipt(): ProxyRoutingPolicyReceipt {
    const proxyRefs = [
      'HTTPS_PROXY',
      'HTTP_PROXY',
      'ALL_PROXY',
      'ZAVORTH_PROVIDER_PROXY_URL',
    ].filter((name) => Boolean(String(this.env[name] || '').trim()));
    return {
      status: proxyRefs.length > 0 ? 'configured' : 'not-configured',
      proxyRefs,
      noProxyRefPresent: Boolean(String(this.env.NO_PROXY || this.env.no_proxy || '').trim()),
      rawProxyValuesSerialized: false,
    };
  }

  private fetchReceipt(input: {
    status: SearchFetchReceipt['status'];
    url: string;
    resultCount: number;
    liveNetworkPerformed: boolean;
    reason: string;
  }): SearchFetchReceipt {
    return {
      id: `credential-vault.fetch.${hashId(`${input.url}:${this.now().toISOString()}`)}`,
      status: input.status,
      mode: 'fetch',
      query: null,
      url: input.url,
      resultCount: input.resultCount,
      proxyPolicy: this.buildProxyPolicyReceipt(),
      artifactFirst: true,
      liveNetworkPerformed: input.liveNetworkPerformed,
      secretValuesSerialized: false,
      reason: input.reason,
    };
  }
}

export type SourceFetchExtractResult = {
  receipt: SearchFetchReceipt;
  title: string | null;
  content: string | null;
  contentChars: number;
};

function hashId(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function isBlockedPrivateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '::1' || host === '0.0.0.0') return true;
    if (host.endsWith('.local')) return true;
    if (/^127\./.test(host)) return true;
    if (/^10\./.test(host)) return true;
    if (/^192\.168\./.test(host)) return true;
    if (/^169\.254\./.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
    return false;
  } catch {
    return true;
  }
}

function extractTitleAndText(
  raw: string,
  contentType: string,
  maxContentChars: number,
): { title: string | null; content: string | null; contentChars: number } {
  if (!raw) {
    return { title: null, content: null, contentChars: 0 };
  }

  if (contentType.includes('application/json') || looksLikeJson(raw)) {
    const content = raw.slice(0, maxContentChars);
    return { title: 'json-document', content, contentChars: content.length };
  }

  if (contentType.includes('text/plain') || (!contentType.includes('html') && !/<html[\s>]/i.test(raw))) {
    const content = stripControlNoise(raw).slice(0, maxContentChars);
    const title = content.split(/\r?\n/).map((line) => line.trim()).find(Boolean)?.slice(0, 120) || null;
    return { title, content, contentChars: content.length };
  }

  const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch
    ? decodeBasicEntities(stripTags(titleMatch[1])).trim().slice(0, 200) || null
    : null;

  let body = raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  body = stripTags(body);
  body = decodeBasicEntities(body);
  body = stripControlNoise(body).slice(0, maxContentChars);

  return {
    title,
    content: body || null,
    contentChars: body.length,
  };
}

function looksLikeJson(raw: string): boolean {
  const trimmed = raw.trim();
  return (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'));
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ');
}

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripControlNoise(value: string): string {
  return value
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
