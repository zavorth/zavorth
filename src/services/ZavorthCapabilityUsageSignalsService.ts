import { ZavorthCapabilityActionSurfaceService } from './ZavorthCapabilityActionSurfaceService.js';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_CAPABILITY_USAGE_SIGNALS_CONTRACT_VERSION,
  type ZavorthCapabilityUsageActionSummary,
  type ZavorthCapabilityUsageEvent,
  type ZavorthCapabilityUsageEventKind,
  type ZavorthCapabilityUsageRecordInput,
  type ZavorthCapabilityUsageSignalsSnapshot,
  type ZavorthCapabilityUsageSurface,
} from '../contracts/ZavorthCapabilityUsageSignalsContract.js';

import { ZavorthHomePathService } from './ZavorthHomePathService.js';
import { logger } from '../logger.js';

type Runtime = {
  projectRoot?: string;
  env?: Record<string, string | undefined>;
  now?: () => Date;
  storeFile?: string;
  actionSurface?: Pick<ZavorthCapabilityActionSurfaceService, 'buildSnapshot'>;
};

type Store = {
  contractVersion: typeof ZAVORTH_CAPABILITY_USAGE_SIGNALS_CONTRACT_VERSION;
  updatedAt: string;
  events: ZavorthCapabilityUsageEvent[];
};

const MAX_STORE_BYTES = 8 * 1024 * 1024;
const MAX_EVENTS = 2_000;
const RECENT_EVENTS = 25;

const COUNTER_KEYS = {
  shown: 'shown',
  looked_up: 'lookedUp',
  previewed: 'previewed',
  approved: 'approved',
  rejected: 'rejected',
  applied: 'applied',
  succeeded: 'succeeded',
  failed: 'failed',
  blocked: 'blocked',
  abandoned: 'abandoned',
  receipt_read: 'receiptRead',
} as const satisfies Record<ZavorthCapabilityUsageEventKind, keyof ZavorthCapabilityUsageActionSummary['counters']>;

export class ZavorthCapabilityUsageSignalsService {
  private readonly env: Record<string, string | undefined>;
  private readonly now: () => Date;
  private readonly storeFile: string;
  private readonly actionSurface: Pick<ZavorthCapabilityActionSurfaceService, 'buildSnapshot'>;

  public constructor(runtime: Runtime = {}) {
    const projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.env = runtime.env || process.env;
    this.now = runtime.now || (() => new Date());
    const paths = new ZavorthHomePathService({ projectRoot, env: this.env }).resolvePaths();
    this.storeFile = path.resolve(runtime.storeFile || path.join(paths.runtimeDir, 'capability-usage-signals.json'));
    this.actionSurface = runtime.actionSurface || new ZavorthCapabilityActionSurfaceService({
      projectRoot,
      env: this.env,
      now: this.now,
    });
  }

  public snapshot(): ZavorthCapabilityUsageSignalsSnapshot {
    return this.buildSnapshot(this.readStore());
  }

  public record(input: ZavorthCapabilityUsageRecordInput): ZavorthCapabilityUsageSignalsSnapshot {
    const event = this.normalizeInput(input);
    const store = this.readStore();
    store.events.push(event);
    this.writeStore(store);
    return this.buildSnapshot(this.readStore());
  }

  public renderText(snapshot = this.snapshot()): string {
    const lines = [
      'Zavorth Capability Usage Signals',
      '',
      `status=${snapshot.status}`,
      `actions=${snapshot.summary.actions} events=${snapshot.summary.events}`,
      `promoteCandidates=${snapshot.summary.promoteCandidates} archiveCandidates=${snapshot.summary.archiveCandidates}`,
      '',
      'Capability adoption:',
    ];
    if (snapshot.actions.length === 0) lines.push('- none yet');
    for (const action of snapshot.actions) {
      lines.push(`- ${action.actionId} [${action.status}] ${action.title}`);
      lines.push(
        `  previewRate=${pct(action.rates.previewRate)} approvalRate=${pct(action.rates.approvalRate)} successRate=${pct(action.rates.successRate)} p95=${action.performance.p95Ms ?? 'n/a'}ms`,
      );
      lines.push(`  recommendation=${action.recommendation} next=${action.nextSafeAction}`);
    }
    lines.push('', 'Safety: local aggregated signals only; no prompt content, secrets or network export.');
    return lines.join('\n');
  }

  private normalizeInput(input: ZavorthCapabilityUsageRecordInput): ZavorthCapabilityUsageEvent {
    const actionId = safeId(input.actionId);
    if (!actionId) throw new Error('Capability usage signal requires an action id.');
    const kind = isEventKind(input.kind) ? input.kind : 'shown';
    const surface = isSurface(input.surface) ? input.surface : 'cli';
    const durationMs = typeof input.durationMs === 'number' && Number.isFinite(input.durationMs)
      ? Math.max(0, Math.round(input.durationMs))
      : null;
    return {
      id: `capability-usage-event:${randomUUID()}`,
      at: this.timestamp(),
      actionId,
      capabilityId: safeId(input.capabilityId || actionId),
      kind,
      surface,
      actor: clean(input.actor || 'operator'),
      status: input.status === 'blocked' ? 'blocked' : input.status === 'attention' ? 'attention' : 'ok',
      durationMs,
      receiptId: input.receiptId ? clean(input.receiptId) : null,
      metadata: sanitizeMetadata(input.metadata),
    };
  }

  private buildSnapshot(store: Store): ZavorthCapabilityUsageSignalsSnapshot {
    const surface = this.actionSurface.buildSnapshot();
    const knownTitles = new Map(surface.items.map((item) => [item.actionId, item.title]));
    const groups = new Map<string, ZavorthCapabilityUsageEvent[]>();
    for (const event of store.events) {
      const key = event.actionId;
      const list = groups.get(key) || [];
      list.push(event);
      groups.set(key, list);
    }
    const actions = Array.from(groups.entries())
      .map(([actionId, events]) => this.summarizeAction(actionId, events, knownTitles.get(actionId)))
      .sort((left, right) => {
        if (left.recommendation !== right.recommendation) return recommendationRank(left.recommendation) - recommendationRank(right.recommendation);
        return (right.lastSeenAt || '').localeCompare(left.lastSeenAt || '');
      });
    const status = actions.some((action) => action.status === 'blocked' || action.status === 'attention')
      ? 'attention'
      : actions.length > 0
        ? 'ready'
        : 'available';
    return {
      contractVersion: ZAVORTH_CAPABILITY_USAGE_SIGNALS_CONTRACT_VERSION,
      generatedAt: this.timestamp(),
      surface: 'capability-usage-signals',
      status,
      storeFile: this.storeFile,
      summary: {
        actions: actions.length,
        events: store.events.length,
        activeActions: actions.filter((action) => action.status === 'active').length,
        attentionActions: actions.filter((action) => action.status === 'attention' || action.status === 'blocked').length,
        promoteCandidates: actions.filter((action) => action.recommendation === 'promote_candidate').length,
        archiveCandidates: actions.filter((action) => action.recommendation === 'archive_candidate').length,
      },
      actions,
      recentEvents: clone(store.events).slice(-RECENT_EVENTS).reverse(),
      safety: {
        localOnly: true,
        noPromptContent: true,
        noSecrets: true,
        noNetworkUsed: true,
        aggregatedForPromotion: true,
      },
      commands: {
        list: 'zavorth actions usage',
        record: 'zavorth actions usage --record --action <action-id> --event previewed',
        json: 'zavorth actions usage --json',
        nextStage: 'Use adoption and performance signals to promote or archive capability candidates automatically.',
      },
    };
  }

  private summarizeAction(
    actionId: string,
    events: ZavorthCapabilityUsageEvent[],
    knownTitle?: string,
  ): ZavorthCapabilityUsageActionSummary {
    const counters = {
      shown: 0,
      lookedUp: 0,
      previewed: 0,
      approved: 0,
      rejected: 0,
      applied: 0,
      succeeded: 0,
      failed: 0,
      blocked: 0,
      abandoned: 0,
      receiptRead: 0,
    };
    const durations: number[] = [];
    for (const event of events) {
      counters[COUNTER_KEYS[event.kind]] += 1;
      if (event.durationMs !== null) durations.push(event.durationMs);
    }
    durations.sort((left, right) => left - right);
    const shownOrLookup = Math.max(1, counters.shown + counters.lookedUp);
    const attempted = Math.max(1, counters.previewed + counters.applied + counters.succeeded + counters.failed + counters.blocked);
    const approvals = Math.max(1, counters.approved + counters.rejected);
    const terminal = Math.max(1, counters.succeeded + counters.failed + counters.blocked);
    const title = knownTitle || titleFromEvents(events) || actionId;
    const rates = {
      previewRate: roundRate(counters.previewed / shownOrLookup),
      approvalRate: roundRate(counters.approved / approvals),
      successRate: roundRate(counters.succeeded / terminal),
      abandonmentRate: roundRate(counters.abandoned / attempted),
      blockRate: roundRate(counters.blocked / terminal),
    };
    const performance = {
      samples: durations.length,
      p50Ms: percentile(durations, 0.5),
      p95Ms: percentile(durations, 0.95),
      maxMs: durations.length > 0 ? durations[durations.length - 1] : null,
    };
    const status = counters.blocked > 0 && counters.succeeded === 0
      ? 'blocked'
      : counters.failed + counters.blocked > counters.succeeded
        ? 'attention'
        : events.length >= 3
          ? 'active'
          : 'quiet';
    const recommendation = recommend(counters, rates, performance.samples);
    return {
      actionId,
      capabilityId: events[0]?.capabilityId || actionId,
      title,
      status,
      counters,
      rates,
      performance,
      lastSeenAt: events.map((event) => event.at).sort().at(-1) || null,
      recommendation,
      nextSafeAction: nextSafeAction(recommendation),
    };
  }

  private readStore(): Store {
    try {
      const stats = fs.statSync(this.storeFile);
      if (!stats.isFile() || stats.size > MAX_STORE_BYTES) return this.emptyStore();
      const parsed = JSON.parse(fs.readFileSync(this.storeFile, 'utf8')) as Partial<Store>;
      return {
        contractVersion: ZAVORTH_CAPABILITY_USAGE_SIGNALS_CONTRACT_VERSION,
        updatedAt: normalizeDate(parsed.updatedAt || this.timestamp()),
        events: Array.isArray(parsed.events) ? parsed.events.map(normalizeEvent).filter(isEvent).slice(-MAX_EVENTS) : [],
      };
    } catch (error: unknown) {logger.warn('[Zavorth Capability Usage Signals] JSON parse failed', error);
    return this.emptyStore();
  }
  }

  private writeStore(store: Store): void {
    const normalized: Store = {
      contractVersion: ZAVORTH_CAPABILITY_USAGE_SIGNALS_CONTRACT_VERSION,
      updatedAt: this.timestamp(),
      events: store.events.slice(-MAX_EVENTS),
    };
    fs.mkdirSync(path.dirname(this.storeFile), { recursive: true });
    const tempFile = `${this.storeFile}.${process.pid}.${randomUUID()}.tmp`;
    fs.writeFileSync(tempFile, `${JSON.stringify(redactSecrets(normalized), null, 2)}\n`, 'utf8');
    fs.renameSync(tempFile, this.storeFile);
  }

  private emptyStore(): Store {
    return {
      contractVersion: ZAVORTH_CAPABILITY_USAGE_SIGNALS_CONTRACT_VERSION,
      updatedAt: this.timestamp(),
      events: [],
    };
  }

  private timestamp(): string {
    return this.now().toISOString();
  }
}

function recommend(
  counters: ZavorthCapabilityUsageActionSummary['counters'],
  rates: ZavorthCapabilityUsageActionSummary['rates'],
  samples: number,
): ZavorthCapabilityUsageActionSummary['recommendation'] {
  if (counters.blocked > 0 || counters.failed > counters.succeeded + counters.applied) return 'needs_attention';
  if (samples >= 2 && counters.succeeded >= 2 && rates.successRate >= 0.75 && rates.blockRate === 0) return 'promote_candidate';
  if (counters.abandoned >= 2 && counters.previewed === 0 && counters.approved === 0) return 'archive_candidate';
  return 'keep_learning';
}

function nextSafeAction(recommendation: ZavorthCapabilityUsageActionSummary['recommendation']): string {
  if (recommendation === 'promote_candidate') return 'Prepare a promotion preview with usage receipts and operator approval.';
  if (recommendation === 'archive_candidate') return 'Prepare an archive preview; do not remove anything silently.';
  if (recommendation === 'needs_attention') return 'Inspect failures, blocked events and setup before promoting this capability.';
  return 'Keep collecting local usage signals until the pattern is clear.';
}

function recommendationRank(recommendation: ZavorthCapabilityUsageActionSummary['recommendation']): number {
  return {
    needs_attention: 0,
    promote_candidate: 1,
    keep_learning: 2,
    archive_candidate: 3,
  }[recommendation];
}

function percentile(values: number[], rate: number): number | null {
  if (values.length === 0) return null;
  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * rate) - 1));
  return values[index];
}

function roundRate(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000;
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function titleFromEvents(events: ZavorthCapabilityUsageEvent[]): string | null {
  for (const event of events) {
    if (event.metadata.title) return event.metadata.title;
  }
  return null;
}

function normalizeEvent(input: unknown): ZavorthCapabilityUsageEvent | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Partial<ZavorthCapabilityUsageEvent>;
  const actionId = safeId(value.actionId);
  if (!actionId) return null;
  return {
    id: clean(value.id || `capability-usage-event:${randomUUID()}`),
    at: normalizeDate(value.at),
    actionId,
    capabilityId: safeId(value.capabilityId || actionId),
    kind: isEventKind(value.kind) ? value.kind : 'shown',
    surface: isSurface(value.surface) ? value.surface : 'cli',
    actor: clean(value.actor || 'operator'),
    status: value.status === 'blocked' ? 'blocked' : value.status === 'attention' ? 'attention' : 'ok',
    durationMs: typeof value.durationMs === 'number' && Number.isFinite(value.durationMs)
      ? Math.max(0, Math.round(value.durationMs))
      : null,
    receiptId: value.receiptId ? clean(value.receiptId) : null,
    metadata: sanitizeMetadata(value.metadata),
  };
}

function isEvent(value: ZavorthCapabilityUsageEvent | null): value is ZavorthCapabilityUsageEvent {
  return Boolean(value);
}

function isEventKind(value: unknown): value is ZavorthCapabilityUsageEventKind {
  return typeof value === 'string' && [
    'shown',
    'looked_up',
    'previewed',
    'approved',
    'rejected',
    'applied',
    'succeeded',
    'failed',
    'blocked',
    'abandoned',
    'receipt_read',
  ].includes(value);
}

function isSurface(value: unknown): value is ZavorthCapabilityUsageSurface {
  return typeof value === 'string' && ['cli', 'zavorthControl', 'tui', 'setup', 'api', 'channel', 'llm'].includes(value);
}

function sanitizeMetadata(input: unknown): Record<string, string> {
  if (!input || typeof input !== 'object') return {};
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>).slice(0, 16)) {
    const safeKey = safeId(key).replace(/[:.]/gu, '_').slice(0, 80);
    if (!safeKey || /(token|secret|password|prompt|content|message|api[_-]?key|credential)/iu.test(safeKey)) continue;
    const safeValue = clean(value).slice(0, 240);
    if (safeValue) output[safeKey] = safeValue;
  }
  return output;
}

function normalizeDate(value: unknown): string {
  const date = new Date(String(value || ''));
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date(0).toISOString();
}

function redact(value: unknown): string {
  return String(value || '')
    .replace(/\bsk-[A-Za-z0-9_-]{6,}\b/g, '[REDACTED]')
    .replace(/\bxox[baprs]-[A-Za-z0-9-]{6,}\b/g, '[REDACTED]')
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{6,}\b/g, '[REDACTED]')
    .replace(/\bAIza[0-9A-Za-z_-]{8,}\b/g, '[REDACTED]')
    .replace(/\b(token|secret|password|api[_ -]?key|credential)\s*[:=]\s*[^\s,;]+/giu, '$1=[REDACTED]')
    .trim()
    .slice(0, 1_000);
}

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        /(token|secret|password|pass|api[_-]?key|credential|prompt|content|message)/iu.test(key) ? '***' : redactSecrets(entry),
      ]),
    );
  }
  return typeof value === 'string' ? redact(value) : value;
}

function safeId(value: unknown): string {
  return clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-z0-9._:-]+/gu, '-').replace(/^-+|-+$/gu, '').slice(0, 200);
}

function clean(value: unknown): string {
  return redact(value).replace(/\s+/gu, ' ').trim();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
