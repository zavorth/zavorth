export type LlmRuntimeTelemetryAttemptStatus = 'skipped_unavailable' | 'failed' | 'succeeded';

export type LlmRuntimeTelemetryAttemptInput = {
  runId?: string | null;
  traceId?: string | null;
  sessionId?: string | null;
  surface?: string | null;
  requestedProviderName: string;
  primaryProviderName: string;
  providerName: string;
  modelName: string | null;
  status: LlmRuntimeTelemetryAttemptStatus;
  fallback: boolean;
  fallbackAllowed: boolean;
  durationMs: number;
  error?: string;
};

export type LlmRuntimeTelemetryAttempt = LlmRuntimeTelemetryAttemptInput & {
  id: string;
  recordedAt: string;
};

export type LlmRuntimeProviderTelemetry = {
  providerName: string;
  attempts: number;
  succeeded: number;
  failed: number;
  skippedUnavailable: number;
  fallbackAttempts: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  lastStatus: LlmRuntimeTelemetryAttemptStatus;
  lastError?: string;
  lastAttemptAt: string;
  models: string[];
};

export type LlmRuntimeSurfaceTelemetry = {
  surface: string;
  attempts: number;
  fallbackAttempts: number;
  fallbackRate: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
};

export type LlmRuntimeTelemetrySnapshot = {
  contractVersion: 'llm-runtime-telemetry/v1';
  generatedAt: string;
  summary: {
    totalAttempts: number;
    succeeded: number;
    failed: number;
    skippedUnavailable: number;
    fallbackAttempts: number;
    fallbackRate: number;
    averageLatencyMs: number;
    p95LatencyMs: number;
    providerCount: number;
    surfaceCount: number;
  };
  providers: LlmRuntimeProviderTelemetry[];
  surfaces: LlmRuntimeSurfaceTelemetry[];
  recentAttempts: LlmRuntimeTelemetryAttempt[];
  receipts: string[];
};

type SnapshotOptions = {
  recentLimit?: number;
};

const DEFAULT_MAX_ATTEMPTS = 500;

export class LlmRuntimeTelemetryService {
  private readonly attempts: LlmRuntimeTelemetryAttempt[] = [];
  private sequence = 0;

  constructor(private readonly maxAttempts = DEFAULT_MAX_ATTEMPTS) {}

  public recordAttempt(input: LlmRuntimeTelemetryAttemptInput): LlmRuntimeTelemetryAttempt {
    const attempt: LlmRuntimeTelemetryAttempt = {
      ...input,
      id: `llm-attempt:${Date.now()}:${++this.sequence}`,
      recordedAt: new Date().toISOString(),
      runId: this.cleanOptional(input.runId),
      traceId: this.cleanOptional(input.traceId),
      sessionId: this.cleanOptional(input.sessionId),
      surface: this.cleanText(input.surface, 'unknown'),
      requestedProviderName: this.cleanText(input.requestedProviderName, 'unknown'),
      primaryProviderName: this.cleanText(input.primaryProviderName, 'unknown'),
      providerName: this.cleanText(input.providerName, 'unknown'),
      modelName: this.cleanOptional(input.modelName),
      durationMs: this.normalizeDuration(input.durationMs),
      error: input.error ? this.truncate(this.redactSensitive(this.cleanText(input.error, 'unknown error')), 240) : undefined,
    };
    this.attempts.push(attempt);
    while (this.attempts.length > this.maxAttempts) {
      this.attempts.shift();
    }
    return { ...attempt };
  }

  public buildSnapshot(options: SnapshotOptions = {}): LlmRuntimeTelemetrySnapshot {
    const generatedAt = new Date().toISOString();
    const attempts = this.attempts.slice();
    const providers = this.groupProviders(attempts);
    const surfaces = this.groupSurfaces(attempts);
    const fallbackAttempts = attempts.filter((attempt) => attempt.fallback).length;

    return {
      contractVersion: 'llm-runtime-telemetry/v1',
      generatedAt,
      summary: {
        totalAttempts: attempts.length,
        succeeded: attempts.filter((attempt) => attempt.status === 'succeeded').length,
        failed: attempts.filter((attempt) => attempt.status === 'failed').length,
        skippedUnavailable: attempts.filter((attempt) => attempt.status === 'skipped_unavailable').length,
        fallbackAttempts,
        fallbackRate: this.ratio(fallbackAttempts, attempts.length),
        averageLatencyMs: this.average(attempts.map((attempt) => attempt.durationMs)),
        p95LatencyMs: this.percentile(attempts.map((attempt) => attempt.durationMs), 0.95),
        providerCount: providers.length,
        surfaceCount: surfaces.length,
      },
      providers,
      surfaces,
      recentAttempts: attempts.slice(-(options.recentLimit ?? 20)).reverse().map((attempt) => ({ ...attempt })),
      receipts: ['llm-runtime-telemetry:sanitized:no-prompts'],
    };
  }

  public clear(): void {
    this.attempts.length = 0;
    this.sequence = 0;
  }

  private groupProviders(attempts: LlmRuntimeTelemetryAttempt[]): LlmRuntimeProviderTelemetry[] {
    const groups = new Map<string, LlmRuntimeTelemetryAttempt[]>();
    for (const attempt of attempts) {
      const list = groups.get(attempt.providerName) || [];
      list.push(attempt);
      groups.set(attempt.providerName, list);
    }

    return Array.from(groups.entries())
      .map(([providerName, entries]) => {
        const latest = entries[entries.length - 1];
        const fallbackAttempts = entries.filter((entry) => entry.fallback).length;
        return {
          providerName,
          attempts: entries.length,
          succeeded: entries.filter((entry) => entry.status === 'succeeded').length,
          failed: entries.filter((entry) => entry.status === 'failed').length,
          skippedUnavailable: entries.filter((entry) => entry.status === 'skipped_unavailable').length,
          fallbackAttempts,
          averageLatencyMs: this.average(entries.map((entry) => entry.durationMs)),
          p95LatencyMs: this.percentile(entries.map((entry) => entry.durationMs), 0.95),
          lastStatus: latest.status,
          ...(latest.error ? { lastError: latest.error } : {}),
          lastAttemptAt: latest.recordedAt,
          models: Array.from(new Set(entries.map((entry) => entry.modelName).filter(Boolean) as string[])).sort(),
        };
      })
      .sort((a, b) => b.attempts - a.attempts || a.providerName.localeCompare(b.providerName));
  }

  private groupSurfaces(attempts: LlmRuntimeTelemetryAttempt[]): LlmRuntimeSurfaceTelemetry[] {
    const groups = new Map<string, LlmRuntimeTelemetryAttempt[]>();
    for (const attempt of attempts) {
      const surface = this.cleanText(attempt.surface, 'unknown');
      const list = groups.get(surface) || [];
      list.push(attempt);
      groups.set(surface, list);
    }

    return Array.from(groups.entries())
      .map(([surface, entries]) => {
        const fallbackAttempts = entries.filter((entry) => entry.fallback).length;
        return {
          surface,
          attempts: entries.length,
          fallbackAttempts,
          fallbackRate: this.ratio(fallbackAttempts, entries.length),
          averageLatencyMs: this.average(entries.map((entry) => entry.durationMs)),
          p95LatencyMs: this.percentile(entries.map((entry) => entry.durationMs), 0.95),
        };
      })
      .sort((a, b) => b.attempts - a.attempts || a.surface.localeCompare(b.surface));
  }

  private cleanOptional(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized || null;
  }

  private cleanText(value: unknown, fallback: string): string {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
  }

  private truncate(value: string, maxLength: number): string {
    return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
  }

  private redactSensitive(value: string): string {
    return value
      .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[redacted-secret]')
      .replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, '[redacted-secret]')
      .replace(/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g, '[redacted-secret]')
      .replace(/\b[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{20,}\b/g, '[redacted-token]');
  }

  private normalizeDuration(value: number): number {
    return Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
  }

  private average(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }
    return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
  }

  private percentile(values: number[], percentile: number): number {
    if (values.length === 0) {
      return 0;
    }
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * percentile) - 1));
    return Math.round(sorted[index]);
  }

  private ratio(value: number, total: number): number {
    return total > 0 ? Number((value / total).toFixed(4)) : 0;
  }
}

export const defaultLlmRuntimeTelemetryService = new LlmRuntimeTelemetryService();
