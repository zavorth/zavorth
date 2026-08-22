
import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';
import { asErrorLike } from '../../utils/errorLike.js';

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export interface RetryAttempt {
  id: string;
  operation: string;
  attempt: number;
  max_attempts: number;
  error: string;
  delay_ms: number;
  timestamp: string;
  success: boolean;
}

export class RetryService {
  private readonly storageDir: string;
  private attempts: RetryAttempt[] = [];
  private configs: Map<string, RetryConfig> = new Map();
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'retry');
    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
    this.loadData();
    this.initDefaults();
  }

  private loadData(): void {
    try {
      const p = path.join(this.storageDir, 'attempts.json');
      if (fs.existsSync(p)) this.attempts = JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch (error: unknown) {/* ignore */ logger.warn('[Retry] JSON parse failed', error); }
  }

  private scheduleFlush(): void {
    this.dirty = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (!this.dirty) return;
      this.dirty = false;
      try {
        if (!fs.existsSync(this.storageDir)) {
          fs.mkdirSync(this.storageDir, { recursive: true });
        }
        fs.writeFileSync(path.join(this.storageDir, 'attempts.json'), JSON.stringify(this.attempts.slice(-1000), null, 2), 'utf-8');
      } catch (error: unknown) {
        logger.warn('[DeferredFlush] deferred flush failed', error);
      }
    }, 2000);
    if (this.flushTimer && typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      (this.flushTimer as NodeJS.Timeout).unref();
    }
  }

  private initDefaults(): void {
    this.configs.set('default', { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30000, backoffMultiplier: 2, retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'rate_limit', '529', '503'] });
    this.configs.set('api_call', { maxRetries: 5, baseDelayMs: 500, maxDelayMs: 60000, backoffMultiplier: 2, retryableErrors: ['rate_limit', '429', '500', '502', '503', '504'] });
    this.configs.set('file_operation', { maxRetries: 3, baseDelayMs: 100, maxDelayMs: 5000, backoffMultiplier: 1.5, retryableErrors: ['EBUSY', 'EPERM', 'EACCES'] });
  }

  public getConfig(operationType: string): RetryConfig {
    return this.configs.get(operationType) || this.configs.get('default')!;
  }

  public calculateDelay(attempt: number, config: RetryConfig): number {
    const delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt);
    return Math.min(delay, config.maxDelayMs);
  }

  public shouldRetry(error: string, config: RetryConfig): boolean {
    return config.retryableErrors.some((e) => error.includes(e));
  }

  public async executeWithRetry<T>(
    operation: string,
    fn: () => Promise<T>,
    operationType: string = 'default',
  ): Promise<T> {
    const config = this.getConfig(operationType);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        const result = await fn();
        if (attempt > 0) {
          this.recordAttempt(operation, attempt, config.maxRetries, '', 0, true);
        }
        return result;
      } catch (error: unknown) {
        asErrorLike(error);
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorMsg = lastError.message;

        if (!this.shouldRetry(errorMsg, config) || attempt === config.maxRetries) {
          this.recordAttempt(operation, attempt, config.maxRetries, errorMsg, 0, false);
          throw lastError;
        }

        const delay = this.calculateDelay(attempt, config);
        this.recordAttempt(operation, attempt, config.maxRetries, errorMsg, delay, false);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  private recordAttempt(operation: string, attempt: number, maxAttempts: number, error: string, delayMs: number, success: boolean): void {
    this.attempts.push({
      id: `retry_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      operation, attempt, max_attempts: maxAttempts,
      error, delay_ms: delayMs, timestamp: new Date().toISOString(), success,
    });
    this.scheduleFlush();
  }

  public getStats(): string {
    if (this.attempts.length === 0) return 'No retry attempts recorded.';
    const total = this.attempts.length;
    const successful = this.attempts.filter((a) => a.success).length;
    const failed = total - successful;
    const avgDelay = this.attempts.reduce((s, a) => s + a.delay_ms, 0) / total;
    return [
      'Retry Stats:',
      `  Total attempts: ${total}`,
      `  Successful: ${successful}`,
      `  Failed: ${failed}`,
      `  Avg delay: ${avgDelay.toFixed(0)}ms`,
    ].join('\n');
  }

  public getRecentAttempts(limit: number = 10): string {
    const recent = this.attempts.slice(-limit);
    return ['Recent Retry Attempts:', ...recent.map((a) => `  ${a.operation}: attempt ${a.attempt}/${a.max_attempts} ${a.success ? '✅' : '❌'} ${a.error || ''}`)].join('\n');
  }
}
