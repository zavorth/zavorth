import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config/index.js';
import { logger } from '../logger.js';

export type ZavorthEvalHistoryTrendEntry = {
  generatedAt: string;
  posture: 'healthy' | 'attention' | 'critical' | 'unknown';
  scorecards: number;
  datasets: number;
  regressions: number;
  telemetrySignals: number;
  traceCount: number;
  failureEvents: number;
  headline: string | null;
  windowHours: number;
  manifestHash: string;
};

export type ZavorthEvalHistorySnapshot = {
  file: string;
  available: boolean;
  entries: number;
  lastCapturedAt: string | null;
  latestPosture: 'healthy' | 'attention' | 'critical' | 'unknown';
  delta: {
    scorecards: number;
    datasets: number;
    regressions: number;
    telemetrySignals: number;
    traceCount: number;
    failureEvents: number;
  };
  trend: ZavorthEvalHistoryTrendEntry[];
  baseline: {
    available: boolean;
    generatedAt: string | null;
    posture: ZavorthEvalHistoryTrendEntry['posture'];
    manifestHash: string | null;
    comparableWindows: number;
    summary: string;
  };
  retention: {
    maxEntries: number;
    trendWindow: number;
    captureIntervalMs: number;
    compacted: boolean;
  };
  recommendation: string | null;
};

type EvalSnapshotLike = {
  generatedAt?: string;
  summary?: {
    posture?: string;
    scorecards?: number;
    datasets?: number;
    regressions?: number;
    telemetrySignals?: number;
  };
  narrative?: {
    headline?: string;
  };
  telemetry?: {
    traceCount?: number;
    failureEvents?: number;
  };
  windowHours?: number;
  datasets?: Array<{
    manifest?: {
      manifestHash?: string;
    };
  }>;
};

type StoredEvalHistoryEntry = ZavorthEvalHistoryTrendEntry & {
  capturedAt: string;
};

type ZavorthEvalHistoryFileRuntime = {
  filePath?: string;
  now?: () => Date;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
  maxEntries?: number;
  captureIntervalMs?: number;
};

export class ZavorthEvalHistoryFileService {
  private readonly filePath: string;
  private readonly now: () => Date;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly maxEntries: number;
  private readonly captureIntervalMs: number;

  constructor(runtime: ZavorthEvalHistoryFileRuntime = {}) {
    this.filePath = runtime.filePath || config.evalHistoryFile;
    this.now = runtime.now || (() => new Date());
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.maxEntries = Math.max(12, Math.min(runtime.maxEntries || 120, 400));
    this.captureIntervalMs = Math.max(60_000, Math.min(runtime.captureIntervalMs || 15 * 60_000, 24 * 60 * 60_000));
  }

  public capture(snapshot: EvalSnapshotLike): ZavorthEvalHistorySnapshot {
    const entries = this.readEntries();
    const candidate = this.toStoredEntry(snapshot);
    const lastEntry = entries[entries.length - 1] || null;
    if (!lastEntry) {
      entries.push(candidate);
    } else {
      const lastMs = Date.parse(lastEntry.generatedAt);
      const candidateMs = Date.parse(candidate.generatedAt);
      const shouldAppend =
        !Number.isFinite(lastMs)
        || !Number.isFinite(candidateMs)
        || candidateMs - lastMs >= this.captureIntervalMs
        || lastEntry.posture !== candidate.posture
        || lastEntry.scorecards !== candidate.scorecards
        || lastEntry.datasets !== candidate.datasets
        || lastEntry.regressions !== candidate.regressions
        || lastEntry.telemetrySignals !== candidate.telemetrySignals
        || lastEntry.traceCount !== candidate.traceCount
        || lastEntry.failureEvents !== candidate.failureEvents;
      if (shouldAppend) {
        entries.push(candidate);
      } else {
        entries[entries.length - 1] = candidate;
      }
    }

    const compacted = entries.length > this.maxEntries;
    const normalizedEntries = entries.slice(-this.maxEntries);
    this.writeEntries(normalizedEntries);
    return this.buildSnapshot(normalizedEntries, compacted);
  }

  public readHistory(limit = 12): ZavorthEvalHistorySnapshot {
    const entries = this.readEntries();
    if (limit > 0 && entries.length > limit) {
      return this.buildSnapshot(entries.slice(-limit), true);
    }
    return this.buildSnapshot(entries, false);
  }

  private buildSnapshot(
    entries: StoredEvalHistoryEntry[],
    compacted: boolean,
  ): ZavorthEvalHistorySnapshot {
    const latest = entries[entries.length - 1] || null;
    const previous = entries.length > 1 ? entries[entries.length - 2] : null;
    const baseline = this.buildBaselineSnapshot(entries, latest);

    return {
      file: this.filePath,
      available: entries.length > 0,
      entries: entries.length,
      lastCapturedAt: latest?.capturedAt || null,
      latestPosture: latest?.posture || 'unknown',
      delta: {
        scorecards: Number(latest?.scorecards || 0) - Number(previous?.scorecards || 0),
        datasets: Number(latest?.datasets || 0) - Number(previous?.datasets || 0),
        regressions: Number(latest?.regressions || 0) - Number(previous?.regressions || 0),
        telemetrySignals: Number(latest?.telemetrySignals || 0) - Number(previous?.telemetrySignals || 0),
        traceCount: Number(latest?.traceCount || 0) - Number(previous?.traceCount || 0),
        failureEvents: Number(latest?.failureEvents || 0) - Number(previous?.failureEvents || 0),
      },
      trend: entries.slice(-12).map((entry) => ({
        generatedAt: entry.generatedAt,
        posture: entry.posture,
        scorecards: entry.scorecards,
        datasets: entry.datasets,
        regressions: entry.regressions,
        telemetrySignals: entry.telemetrySignals,
        traceCount: entry.traceCount,
        failureEvents: entry.failureEvents,
        headline: entry.headline,
        windowHours: entry.windowHours,
        manifestHash: entry.manifestHash,
      })),
      baseline,
      retention: {
        maxEntries: this.maxEntries,
        trendWindow: 12,
        captureIntervalMs: this.captureIntervalMs,
        compacted,
      },
      recommendation: this.buildRecommendation(entries, latest, previous),
    };
  }

  private buildRecommendation(
    entries: StoredEvalHistoryEntry[],
    latest: StoredEvalHistoryEntry | null,
    previous: StoredEvalHistoryEntry | null,
  ): string | null {
    if (!latest) {
      return 'Ainda nao existe baseline historico de evals neste host.';
    }
    if (latest.posture === 'critical') {
      return 'A posture atual esta critica; use replay e doctor antes de promover novas mudancas.';
    }
    if (Number(latest.failureEvents || 0) > 0) {
      return 'Existem traces falhas recentes; cruze a tendencia com scorecards e approvals.';
    }
    if (!previous) {
      return 'Baseline inicial capturado. Gere mais janelas para ter tendencia comparavel.';
    }
    if (latest.regressions > previous.regressions) {
      return 'As regressions aumentaram nesta janela; revise o delta antes do proximo rollout.';
    }
    if (latest.posture === 'healthy' && latest.regressions <= previous.regressions) {
      return 'A tendencia esta estavel ou melhorando; este host ja tem baseline reutilizavel.';
    }
    return 'Historia de evals atualizada; acompanhe as proximas janelas para confirmar a tendencia.';
  }

  private buildBaselineSnapshot(
    entries: StoredEvalHistoryEntry[],
    latest: StoredEvalHistoryEntry | null,
  ): ZavorthEvalHistorySnapshot['baseline'] {
    if (!latest || entries.length === 0) {
      return {
        available: false,
        generatedAt: null,
        posture: 'unknown',
        manifestHash: null,
        comparableWindows: 0,
        summary: 'Sem baseline historico comparavel neste host.',
      };
    }
    const baseline = entries[0];
    const comparableWindows = entries.filter((entry) => {
      return entry.windowHours === latest.windowHours && Boolean(entry.manifestHash);
    }).length;
    return {
      available: true,
      generatedAt: baseline.generatedAt,
      posture: baseline.posture,
      manifestHash: baseline.manifestHash,
      comparableWindows,
      summary:
        comparableWindows > 1
          ? `${comparableWindows} janela(s) comparaveis para window=${latest.windowHours}h.`
          : 'Baseline inicial capturado; ainda falta mais uma janela comparavel.',
    };
  }

  private readEntries(): StoredEvalHistoryEntry[] {
    try {
      if (!this.filePath || !this.existsSync(this.filePath)) {
        return [];
      }
      const parsed = JSON.parse(this.readFileSync(this.filePath, 'utf8'));
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => {
          const record = entry as Record<string, unknown>;
          return {
            generatedAt: this.normalizeTimestamp(record.generatedAt),
            capturedAt: this.normalizeTimestamp(record.capturedAt),
            posture: this.normalizePosture(record.posture),
            scorecards: this.toCount(record.scorecards),
            datasets: this.toCount(record.datasets),
            regressions: this.toCount(record.regressions),
            telemetrySignals: this.toCount(record.telemetrySignals),
            traceCount: this.toCount(record.traceCount),
            failureEvents: this.toCount(record.failureEvents),
            headline: this.normalizeText(record.headline) || null,
            windowHours: this.toCount(record.windowHours),
            manifestHash: this.normalizeText(record.manifestHash) || this.hashEntry(record),
          } as StoredEvalHistoryEntry;
        })
        .filter((entry) => Boolean(entry.generatedAt));
    } catch (error: unknown) {logger.warn('[Zavorth Eval History File] creation failed', error); return []; }
  }

  private writeEntries(entries: StoredEvalHistoryEntry[]): void {
    try {
      this.mkdirSync(path.dirname(this.filePath), { recursive: true });
      this.writeFileSync(this.filePath, JSON.stringify(entries, null, 2), 'utf8');
    } catch (error: unknown) {// Keep history best-effort only.
      logger.warn('[Zavorth Eval History File] filesystem operation failed', error);
    }
  }

  private toStoredEntry(snapshot: EvalSnapshotLike): StoredEvalHistoryEntry {
    const generatedAt = this.normalizeTimestamp(snapshot.generatedAt) || this.now().toISOString();
    const manifestHash = this.normalizeText(snapshot.datasets?.[0]?.manifest?.manifestHash)
      || this.hashEntry({
        generatedAt,
        windowHours: snapshot.windowHours,
        summary: snapshot.summary,
        headline: snapshot.narrative?.headline,
      });
    return {
      generatedAt,
      capturedAt: this.now().toISOString(),
      posture: this.normalizePosture(snapshot.summary?.posture),
      scorecards: this.toCount(snapshot.summary?.scorecards),
      datasets: this.toCount(snapshot.summary?.datasets),
      regressions: this.toCount(snapshot.summary?.regressions),
      telemetrySignals: this.toCount(snapshot.summary?.telemetrySignals),
      traceCount: this.toCount(snapshot.telemetry?.traceCount),
      failureEvents: this.toCount(snapshot.telemetry?.failureEvents),
      headline: this.normalizeText(snapshot.narrative?.headline) || null,
      windowHours: this.toCount(snapshot.windowHours),
      manifestHash,
    };
  }

  private normalizePosture(value: unknown): StoredEvalHistoryEntry['posture'] {
    const normalized = this.normalizeText(value).toLowerCase();
    if (normalized === 'healthy' || normalized === 'attention' || normalized === 'critical') {
      return normalized;
    }
    return 'unknown';
  }

  private normalizeTimestamp(value: unknown): string {
    const normalized = this.normalizeText(value);
    return Number.isFinite(Date.parse(normalized)) ? normalized : '';
  }

  private toCount(value: unknown): number {
    const numeric = Number(value || 0);
    return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : 0;
  }

  private normalizeText(value: unknown): string {
    return String(value || '').trim();
  }

  private hashEntry(value: unknown): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(this.sortForHash(value)))
      .digest('hex');
  }

  private sortForHash(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((entry) => this.sortForHash(entry));
    }
    if (value && typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((accumulator, key) => {
          accumulator[key] = this.sortForHash((value as Record<string, unknown>)[key]);
          return accumulator;
        }, {});
    }
    return value;
  }
}
