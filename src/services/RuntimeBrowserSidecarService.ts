
import { SidecarExecutionReceiptService } from './SidecarExecutionReceiptService.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

export type RuntimeBrowserSidecarAction =
  | 'browser_navigate'
  | 'browser_search'
  | 'inspect_dom_element'
  | 'evaluate_js'
  | 'browser_screenshot'
  | 'browser_click'
  | 'browser_type'
  | 'browser_extract';

export type RuntimeBrowserSidecarRequest = {
  action: RuntimeBrowserSidecarAction;
  args: Record<string, unknown>;
  timeoutMs?: number;
};

export type RuntimeBrowserSidecarResponse = {
  ok: boolean;
  action: RuntimeBrowserSidecarAction;
  payload: unknown;
  runtime: 'browser-sidecar';
  isolated: true;
  error?: string;
};

type RuntimeBrowserSidecarFetch = typeof fetch;
type RuntimeBrowserSidecarReceiptRecorder = Pick<
  SidecarExecutionReceiptService,
  'createAuditId' | 'hashSensitiveValue' | 'record'
>;

export class RuntimeBrowserSidecarService {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly fetchImpl: RuntimeBrowserSidecarFetch;
  private readonly receipts: RuntimeBrowserSidecarReceiptRecorder | null;

  constructor(options: {
    baseUrl?: string;
    token?: string;
    fetchImpl?: RuntimeBrowserSidecarFetch;
    receiptService?: RuntimeBrowserSidecarReceiptRecorder | null;
  } = {}) {
    this.baseUrl = String(options.baseUrl || process.env.ZAVORTH_BROWSER_SIDECAR_URL || '').trim().replace(/\/+$/u, '');
    this.token = String(options.token || process.env.ZAVORTH_BROWSER_SIDECAR_TOKEN || '').trim();
    this.fetchImpl = options.fetchImpl || fetch;
    this.receipts = options.receiptService === undefined
      ? new SidecarExecutionReceiptService()
      : options.receiptService;
  }

  public isConfigured(): boolean {
    return this.baseUrl.length > 0;
  }

  public async execute(request: RuntimeBrowserSidecarRequest): Promise<RuntimeBrowserSidecarResponse> {
    const auditId = this.createAuditId(`${request.action}:${this.hashArgs(request.args)}`);
    const startedAt = Date.now();

    if (!this.isConfigured()) {
      this.recordBrowserReceipt({
        action: request.action,
        args: request.args,
        auditId,
        status: 'blocked',
        durationMs: Date.now() - startedAt,
        summary: 'Remote browser sidecar not configured.',
      });
      throw new Error('Remote browser sidecar not configured. set ZAVORTH_BROWSER_SIDECAR_URL.');
    }

    const controller = new AbortController();
    const timeoutMs = Number.isFinite(request.timeoutMs) && Number(request.timeoutMs) > 0
      ? Number(request.timeoutMs)
      : 30_000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/mcp/browser`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: JSON.stringify({
          action: request.action,
          args: request.args,
        }),
        signal: controller.signal,
      });
      const rawText = await response.text();
      const parsed = this.parseJson(rawText);
      if (!response.ok) {
        const message = this.extractError(parsed) || rawText || `HTTP ${response.status}`;
        throw new Error(`Browser sidecar rejected ${request.action}: ${message}`);
      }

      const output: RuntimeBrowserSidecarResponse = {
        ok: true,
        action: request.action,
        payload: parsed,
        runtime: 'browser-sidecar',
        isolated: true,
      };
      this.recordBrowserReceipt({
        action: request.action,
        args: request.args,
        auditId,
        status: 'succeeded',
        durationMs: Date.now() - startedAt,
        summary: `Browser sidecar executou ${request.action}.`,
      });
      return output;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      this.recordBrowserReceipt({
        action: request.action,
        args: request.args,
        auditId,
        status: 'failed',
        durationMs: Date.now() - startedAt,
        summary: error instanceof Error ? err.message : String(error),
      });
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  private createAuditId(seed: string): string {
    if (this.receipts) {
      return this.receipts.createAuditId(seed);
    }
    return this.hashArgs(seed);
  }

  private hashArgs(value: unknown): string {
    if (this.receipts) {
      return this.receipts.hashSensitiveValue(value);
    }
    return String(value ?? '').slice(0, 16);
  }

  private recordBrowserReceipt(input: {
    action: RuntimeBrowserSidecarAction;
    args: Record<string, unknown>;
    auditId: string;
    status: 'succeeded' | 'failed' | 'blocked';
    durationMs: number;
    summary: string;
  }): void {
    if (!this.receipts) {
      return;
    }
    try {
      this.receipts.record({
        sidecarId: 'browser-sidecar',
        kind: 'browser',
        action: input.action,
        status: input.status,
        auditId: input.auditId,
        runtime: 'browser-sidecar',
        isolationLevel: 'browser-sidecar',
        durationMs: input.durationMs,
        exitCode: null,
        summary: input.summary,
        metadata: {
          argsHash: this.hashArgs(input.args),
          origin: this.safeOrigin(),
        },
      });
    } catch (error: unknown) {// Receipts cannot bring down or mask a remote sidecar call.
      logger.warn('[Runtime Browser Sidecar] operation failed', error);
    }
  }

  private safeOrigin(): string | null {
    try {
      return new URL(this.baseUrl).origin;
    } catch (error: unknown) {logger.warn('[Runtime Browser Sidecar] operation failed', error); return null; }
  }

  private parseJson(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch (error: unknown) {logger.warn('[Runtime Browser Sidecar] JSON parse failed', error); return value; }
  }

  private extractError(value: unknown): string | null {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      return typeof record.error === 'string' ? record.error : null;
    }
    return null;
  }
}
