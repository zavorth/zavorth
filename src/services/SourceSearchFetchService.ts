
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

  public simulateSearch(input: {
    query: string;
    resultCount?: number;
  }): SearchFetchReceipt {
    const query = String(input.query || '').trim();
    const resultCount = Math.max(0, input.resultCount || 0);
    return {
      id: `credential-vault.search.${hashId(`${query}:${this.now().toISOString()}`)}`,
      status: query ? 'simulated' : 'blocked',
      mode: 'search',
      query,
      url: null,
      resultCount: query ? resultCount : 0,
      proxyPolicy: this.buildProxyPolicyReceipt(),
      artifactFirst: true,
      liveNetworkPerformed: false,
      secretValuesSerialized: false,
      reason: query
        ? 'Search behavior is represented as an offline artifact-first receipt; live search remains explicit.'
        : 'Search query is empty.',
    };
  }

  public async fetchUrl(input: {
    url: string;
    confirmLiveNetwork?: boolean;
    timeoutMs?: number;
  }): Promise<SearchFetchReceipt> {
    const url = String(input.url || '').trim();
    if (!/^https?:\/\//i.test(url)) {
      return this.fetchReceipt({
        status: 'blocked',
        url,
        resultCount: 0,
        liveNetworkPerformed: false,
        reason: 'Fetch URL must be http(s).',
      });
    }
    if (input.confirmLiveNetwork !== true) {
      return this.fetchReceipt({
        status: 'blocked',
        url,
        resultCount: 0,
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
      });
      return this.fetchReceipt({
        status: response.ok ? 'fetched' : 'failed',
        url,
        resultCount: response.ok ? 1 : 0,
        liveNetworkPerformed: true,
        reason: `HTTP ${response.status}`,
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Source Search] network request failed', error);
    return this.fetchReceipt({
        status: 'failed',
        url,
        resultCount: 0,
        liveNetworkPerformed: true,
        reason: error instanceof Error ? err.message : String(error),
      });
  } finally {
      clearTimeout(timeout);
    }
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

function hashId(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
}
