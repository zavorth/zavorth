import fs from 'node:fs';
import path from 'node:path';

import { logger } from '../logger.js';
import {
ZAVORTH_AGENT_KERNEL_SNAPSHOT_VERSION,
  type ZavorthPerformanceMemoryRouteStats,
  type ZavorthPerformanceMemorySnapshot,
} from '../contracts/ZavorthAgentKernelSnapshotContract.js';

type StateDbLike = {
  getMeta<T = unknown>(key: string): T | null;
  setMeta(key: string, value: unknown): void;
};

export type ZavorthPerformanceMemorySample = {
  routeId: string;
  providerId: string;
  taskKind: string;
  status: 'success' | 'failure';
  latencyMs?: number | null;
  tokens?: number | null;
  costUsd?: number | null;
  occurredAt?: string | null;
};

type StoredSample = Required<Pick<ZavorthPerformanceMemorySample, 'routeId' | 'providerId' | 'taskKind' | 'status'>>
  & {
    latencyMs: number;
    tokens: number;
    costUsd: number;
    occurredAt: string;
  };

type StoredPerformanceMemory = {
  samples: StoredSample[];
};

export type ZavorthPerformanceMemoryRuntime = {
  now?: () => Date;
  stateDb?: StateDbLike | null;
  storePath?: string | null;
  maxSamples?: number;
};

const META_KEY = 'agentKernel.performanceMemory.v1';

export class ZavorthPerformanceMemoryService {
  private readonly now: () => Date;
  private readonly stateDb: StateDbLike | null;
  private readonly storePath: string;
  private readonly maxSamples: number;

  constructor(runtime: ZavorthPerformanceMemoryRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.stateDb = runtime.stateDb || null;
    this.storePath = path.resolve(runtime.storePath || path.join(process.cwd(), '.zavorth', 'performance-memory.json'));
    this.maxSamples = clamp(Number(runtime.maxSamples || 500), 10, 5000);
  }

  public record(sample: ZavorthPerformanceMemorySample): ZavorthPerformanceMemorySnapshot {
    const normalized = normalizeSample(sample, this.now);
    const state = this.loadState();
    state.samples.push(normalized);
    state.samples = state.samples.slice(-this.maxSamples);
    this.saveState(state);
    return this.buildSnapshot();
  }

  public buildSnapshot(): ZavorthPerformanceMemorySnapshot {
    const state = this.loadState();
    const topRoutes = summarizeSamples(state.samples);
    return {
      contractVersion: ZAVORTH_AGENT_KERNEL_SNAPSHOT_VERSION,
      generatedAt: this.now().toISOString(),
      store: this.stateDb ? 'state-db' : 'json',
      sampleCount: state.samples.length,
      taskKinds: Array.from(new Set(state.samples.map((sample) => sample.taskKind))).sort(),
      topRoutes,
      recommendations: buildRecommendations(topRoutes),
      safety: {
        noPromptBodiesStored: true,
        noSecretsStored: true,
        aggregateOnlyInLlmContext: true,
      },
    };
  }

  private loadState(): StoredPerformanceMemory {
    if (this.stateDb) {
      const stored = this.stateDb.getMeta<StoredPerformanceMemory>(META_KEY);
      return normalizeState(stored);
    }
    if (!fs.existsSync(this.storePath)) {
      return { samples: [] };
    }
    return normalizeState(parseJson(fs.readFileSync(this.storePath, 'utf8'), { samples: [] }));
  }

  private saveState(state: StoredPerformanceMemory): void {
    if (this.stateDb) {
      this.stateDb.setMeta(META_KEY, state);
      return;
    }
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    fs.writeFileSync(this.storePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  }
}

function normalizeSample(sample: ZavorthPerformanceMemorySample, now: () => Date): StoredSample {
  return {
    routeId: normalize(sample.routeId, 'unknown-route'),
    providerId: normalize(sample.providerId, 'unknown-provider'),
    taskKind: normalize(sample.taskKind, 'general'),
    status: sample.status === 'failure' ? 'failure' : 'success',
    latencyMs: nonNegative(sample.latencyMs),
    tokens: nonNegative(sample.tokens),
    costUsd: nonNegative(sample.costUsd),
    occurredAt: normalize(sample.occurredAt) || now().toISOString(),
  };
}

function normalizeState(value: unknown): StoredPerformanceMemory {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as { samples?: unknown }
    : {};
  const samples = Array.isArray(record.samples)
    ? record.samples.map(normalizeStoredSample).filter((sample): sample is StoredSample => Boolean(sample))
    : [];
  return { samples };
}

function normalizeStoredSample(value: unknown): StoredSample | null {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
  if (!record) return null;
  return normalizeSample({
    routeId: record.routeId as string,
    providerId: record.providerId as string,
    taskKind: record.taskKind as string,
    status: record.status === 'failure' ? 'failure' : 'success',
    latencyMs: record.latencyMs as number,
    tokens: record.tokens as number,
    costUsd: record.costUsd as number,
    occurredAt: record.occurredAt as string,
  }, () => new Date());
}

function summarizeSamples(samples: StoredSample[]): ZavorthPerformanceMemoryRouteStats[] {
  const groups = new Map<string, StoredSample[]>();
  for (const sample of samples) {
    const key = `${sample.taskKind}\u0000${sample.providerId}\u0000${sample.routeId}`;
    groups.set(key, [...(groups.get(key) || []), sample]);
  }
  return Array.from(groups.values()).map((entries) => {
    const first = entries[0];
    const successes = entries.filter((entry) => entry.status === 'success').length;
    const failures = entries.length - successes;
    const averageLatencyMs = average(entries.map((entry) => entry.latencyMs));
    const averageTokens = average(entries.map((entry) => entry.tokens));
    const averageCostUsd = average(entries.map((entry) => entry.costUsd));
    const successRate = successes / Math.max(1, entries.length);
    const latencyPenalty = averageLatencyMs > 0 ? Math.min(0.35, averageLatencyMs / 120000) : 0;
    const costPenalty = averageCostUsd > 0 ? Math.min(0.2, averageCostUsd / 2) : 0;
    return {
      routeId: first.routeId,
      providerId: first.providerId,
      taskKind: first.taskKind,
      attempts: entries.length,
      successes,
      failures,
      averageLatencyMs,
      averageTokens,
      averageCostUsd,
      score: round(Math.max(0, successRate - latencyPenalty - costPenalty)),
      lastUsedAt: entries.map((entry) => entry.occurredAt).sort().at(-1) || first.occurredAt,
    };
  }).sort((left, right) => right.score - left.score || right.attempts - left.attempts).slice(0, 20);
}

function buildRecommendations(
  routes: ZavorthPerformanceMemoryRouteStats[],
): ZavorthPerformanceMemorySnapshot['recommendations'] {
  const byTask = new Map<string, ZavorthPerformanceMemoryRouteStats>();
  for (const route of routes) {
    const current = byTask.get(route.taskKind);
    if (!current || route.score > current.score) {
      byTask.set(route.taskKind, route);
    }
  }
  return Array.from(byTask.values()).map((route) => ({
    taskKind: route.taskKind,
    routeId: route.routeId,
    providerId: route.providerId,
    reason: `Best observed route for ${route.taskKind}: score ${route.score}, ${route.successes}/${route.attempts} successful attempt(s).`,
  }));
}

function average(values: number[]): number {
  const usable = values.filter((value) => Number.isFinite(value) && value > 0);
  if (usable.length === 0) return 0;
  return round(usable.reduce((total, value) => total + value, 0) / usable.length);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function nonNegative(value: unknown): number {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? round(number) : 0;
}

function normalize(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function parseJson<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch (error: any) { logger.warn('[Zavorth Performance Memory] JSON parse failed', error); return fallback; }
}
