import { safeFetch } from '../security/SafeFetchService.js';

export type MinimalBrowserSidecarClientOptions = {
  baseUrl?: string;
  timeoutMs?: number;
};

export type MinimalBrowserSidecarResponse = {
  ok: boolean;
  [key: string]: unknown;
};

export class MinimalBrowserSidecarClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: MinimalBrowserSidecarClientOptions = {}) {
    this.baseUrl = String(options.baseUrl || 'http://127.0.0.1:20187').replace(/\/+$/, '');
    this.timeoutMs = Math.max(1_000, Math.min(120_000, Number(options.timeoutMs || 30_000)));
  }

  public health(): Promise<MinimalBrowserSidecarResponse> {
    return this.request('GET', '/health');
  }

  public navigate(url: string, options: Record<string, unknown> = {}): Promise<MinimalBrowserSidecarResponse> {
    return this.request('POST', '/navigate', { ...options, url });
  }

  public screenshot(options: Record<string, unknown> = {}): Promise<MinimalBrowserSidecarResponse> {
    return this.request('POST', '/screenshot', options);
  }

  public extractText(options: Record<string, unknown> = {}): Promise<MinimalBrowserSidecarResponse> {
    return this.request('POST', '/extract-text', options);
  }

  public click(selector: string, options: Record<string, unknown> = {}): Promise<MinimalBrowserSidecarResponse> {
    return this.request('POST', '/click', { ...options, selector });
  }

  public type(selector: string, text: string, options: Record<string, unknown> = {}): Promise<MinimalBrowserSidecarResponse> {
    return this.request('POST', '/type', { ...options, selector, text });
  }

  public close(): Promise<MinimalBrowserSidecarResponse> {
    return this.request('POST', '/close', {});
  }

  public shutdown(): Promise<MinimalBrowserSidecarResponse> {
    return this.request('POST', '/shutdown', {});
  }

  private async request(
    method: 'GET' | 'POST',
    route: string,
    body?: Record<string, unknown>,
  ): Promise<MinimalBrowserSidecarResponse> {
    const response = await safeFetch(`${this.baseUrl}${route}`, {
      method,
      headers: method === 'POST' ? { 'content-type': 'application/json' } : undefined,
      body: method === 'POST' ? JSON.stringify(body || {}) : undefined,
      signal: AbortSignal.timeout(this.timeoutMs),
    }, {
      serviceName: 'Browser sidecar client',
      allowLoopback: true,
    });
    const payload = await response.json().catch(() => ({
      ok: false,
      error: `Browser sidecar returned non-JSON status ${response.status}.`,
    })) as MinimalBrowserSidecarResponse;
    if (!response.ok && payload.ok !== false) {
      return { ...payload, ok: false, status: response.status };
    }
    return payload;
  }
}
