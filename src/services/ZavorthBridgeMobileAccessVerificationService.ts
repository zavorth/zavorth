import { logger } from '../logger.js';
export type ZavorthBridgeMobileAccessVerification = {
  checkedAt: string;
  targetUrl: string | null;
  route: 'root' | 'health' | 'none';
  ok: boolean;
  httpStatus: number | null;
  summary: string;
  error: string | null;
};

type FetchLike = typeof fetch;

type VerificationOptions = {
  fetchImpl?: FetchLike;
  now?: () => Date;
  timeoutMs?: number;
};

export class ZavorthBridgeMobileAccessVerificationService {
  private readonly fetchImpl: FetchLike;
  private readonly now: () => Date;
  private readonly timeoutMs: number;

  constructor(options: VerificationOptions = {}) {
    this.fetchImpl = options.fetchImpl || fetch;
    this.now = options.now || (() => new Date());
    this.timeoutMs = options.timeoutMs || 7_000;
  }

  public async verify(input: {
    accessUrl: string | null;
    mode: 'public' | 'lan' | 'none';
  }): Promise<ZavorthBridgeMobileAccessVerification> {
    const accessUrl = String(input.accessUrl || '').trim() || null;
    if (!accessUrl || input.mode === 'none') {
      return this.buildResult({
        targetUrl: accessUrl,
        route: 'none',
        ok: false,
        httpStatus: null,
        summary: 'Nenhuma URL final foi publicada para validar o acesso movel.',
        error: null,
      });
    }

    const attempts = [
      { route: 'root' as const, url: accessUrl },
      { route: 'health' as const, url: this.buildHealthUrl(accessUrl) },
    ];

    let lastError: string | null = null;
    for (const attempt of attempts) {
      try {
        const response = await this.fetchWithTimeout(attempt.url);
        if (response.ok) {
          return this.buildResult({
            targetUrl: attempt.url,
            route: attempt.route,
            ok: true,
            httpStatus: response.status,
            summary: attempt.route === 'root'
              ? `URL final validada com HTTP ${response.status} na rota principal.`
              : `URL final validada com HTTP ${response.status} na rota /health.`,
            error: null,
          });
        }

        lastError = `HTTP ${response.status}`;
      } catch (error) {
    logger.warn('[Zavorth Bridge Mobile Access Verification] network request failed', error);
    lastError = error?.message || String(error);
  }
    }

    return this.buildResult({
      targetUrl: accessUrl,
      route: 'root',
      ok: false,
      httpStatus: null,
      summary: 'A URL final ainda nao confirmou resposta externa do ZavorthBridge.',
      error: lastError,
    });
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(url, {
        method: 'GET',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private buildHealthUrl(accessUrl: string): string {
    const normalized = accessUrl.endsWith('/') ? accessUrl : `${accessUrl}/`;
    return new URL('health', normalized).toString();
  }

  private buildResult(input: {
    targetUrl: string | null;
    route: ZavorthBridgeMobileAccessVerification['route'];
    ok: boolean;
    httpStatus: number | null;
    summary: string;
    error: string | null;
  }): ZavorthBridgeMobileAccessVerification {
    return {
      checkedAt: this.now().toISOString(),
      targetUrl: input.targetUrl,
      route: input.route,
      ok: input.ok,
      httpStatus: input.httpStatus,
      summary: input.summary,
      error: input.error,
    };
  }
}
