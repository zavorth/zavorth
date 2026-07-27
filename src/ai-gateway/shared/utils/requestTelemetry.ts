import { asErrorLike } from '../../../utils/errorLike.js';

/**
 * Request telemetry for lifecycle timing, percentile calculation, and monitoring.
 *
 * The `phases` field is kept for compatibility with existing API consumers.
 */

interface StageTiming {
  stage: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  [key: string]: unknown;
}

const STAGES = ['parse', 'validate', 'policy', 'resolve', 'connect', 'stream', 'finalize'] as const;

interface TelemetrySummary {
  requestId: string;
  totalMs: number;
  phases: StageTiming[];
  recordedAt?: number;
}

export class RequestTelemetry {
  requestId: string;
  startTime: number;
  phases: StageTiming[];
  private currentStage: string | null;
  private stageStart: number | null;

  constructor(requestId: string) {
    this.requestId = requestId;
    this.startTime = Date.now();
    this.phases = [];
    this.currentStage = null;
    this.stageStart = null;
  }

  startPhase(stage: string): void {
    if (this.currentStage) {
      this.endPhase();
    }
    this.currentStage = stage;
    this.stageStart = Date.now();
  }

  endPhase(metadata: Record<string, unknown> = {}): void {
    if (!this.currentStage || this.stageStart === null) return;

    const now = Date.now();
    this.phases.push({
      stage: this.currentStage,
      startMs: this.stageStart - this.startTime,
      endMs: now - this.startTime,
      durationMs: now - this.stageStart,
      ...metadata,
    });

    this.currentStage = null;
    this.stageStart = null;
  }

  async measure<T>(stage: string, fn: () => Promise<T>): Promise<T> {
    this.startPhase(stage);
    try {
      const result = await fn();
      this.endPhase();
      return result;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      this.endPhase({ error: err.message });
      throw error;
    }
  }

  getSummary(): TelemetrySummary {
    if (this.currentStage) {
      this.endPhase();
    }

    return {
      requestId: this.requestId,
      totalMs: Date.now() - this.startTime,
      phases: [...this.phases],
    };
  }
}

const MAX_HISTORY = 1000;
const history: TelemetrySummary[] = [];

export function recordTelemetry(telemetry: RequestTelemetry): void {
  const summary = telemetry.getSummary();
  summary.recordedAt = Date.now();
  history.push(summary);
  while (history.length > MAX_HISTORY) {
    history.shift();
  }
}

function percentile(sorted: number[], percentileValue: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
}

export function getTelemetrySummary(windowMs = 300000) {
  const cutoff = Date.now() - windowMs;
  const recent = history.filter((entry) => {
    return (entry.recordedAt || 0) >= cutoff;
  });

  if (recent.length === 0) {
    return { count: 0, p50: 0, p95: 0, p99: 0, phaseBreakdown: {} };
  }

  const totals = recent.map((entry) => entry.totalMs).sort((left, right) => left - right);
  const phaseBreakdown: Record<string, { count: number; p50: number; p95: number; avg: number }> = {};

  for (const stage of STAGES) {
    const durations = recent
      .flatMap((entry) => entry.phases.filter((item) => item.stage === stage).map((item) => item.durationMs))
      .sort((left, right) => left - right);

    if (durations.length > 0) {
      phaseBreakdown[stage] = {
        count: durations.length,
        p50: percentile(durations, 50),
        p95: percentile(durations, 95),
        avg: Math.round(durations.reduce((left, right) => left + right, 0) / durations.length),
      };
    }
  }

  return {
    count: recent.length,
    p50: percentile(totals, 50),
    p95: percentile(totals, 95),
    p99: percentile(totals, 99),
    phaseBreakdown,
  };
}

export { STAGES };
