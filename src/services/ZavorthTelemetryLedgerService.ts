import fs from 'fs';
import crypto from 'crypto';
import { config } from '../config/index.js';
import { logger } from '../logger.js';

export type ZavorthTelemetryLedgerTopEntry = {
  label: string;
  count: number;
};

export type ZavorthTelemetryTraceSnapshot = {
  traceId: string;
  source: string;
  status: 'running' | 'completed' | 'blocked' | 'failed';
  eventCount: number;
  failureCount: number;
  lastEventType: string;
  startedAt: string;
  lastSeenAt: string;
};

export type ZavorthTelemetryLedgerRetention = {
  windowHours: number;
  maxEvents: number;
  maxTraces: number;
  maxTopEntries: number;
  scannedEvents: number;
  retainedEvents: number;
  truncated: boolean;
};

export type ZavorthTelemetryLedgerRedaction = {
  mode: 'hashed-references';
  traceIdsHashed: boolean;
  payloadsIncluded: false;
  notes: string[];
};

export type ZavorthTelemetryLedgerSnapshot = {
  generatedAt: string;
  file: string;
  windowHours: number;
  available: boolean;
  status: 'active' | 'idle' | 'missing';
  totalEvents: number;
  traceCount: number;
  failureEvents: number;
  blockedEvents: number;
  lastEventAt: string | null;
  topSources: ZavorthTelemetryLedgerTopEntry[];
  topEventTypes: ZavorthTelemetryLedgerTopEntry[];
  traces: ZavorthTelemetryTraceSnapshot[];
  sinks: {
    localJsonl: boolean;
    langfuseConfigured: boolean;
    otelExporterConfigured: boolean;
    otelReady: boolean;
    externalRequired: boolean;
  };
  retention: ZavorthTelemetryLedgerRetention;
  redaction: ZavorthTelemetryLedgerRedaction;
  recommendation: string | null;
};

type TelemetryEventLike = {
  timestamp: string;
  traceId: string;
  source: string;
  eventType: string;
  status?: string;
  payload?: Record<string, unknown>;
};

type MutableTraceSnapshot = ZavorthTelemetryTraceSnapshot & {
  hasBlocked: boolean;
};

type TelemetryEventReadResult = {
  events: TelemetryEventLike[];
  scannedEvents: number;
  truncated: boolean;
};

type ZavorthTelemetryLedgerRuntime = {
  filePath?: string;
  windowHours?: number;
  maxEvents?: number;
  maxTraces?: number;
  maxTopEntries?: number;
  now?: () => Date;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  env?: NodeJS.ProcessEnv;
};

export class ZavorthTelemetryLedgerService {
  private readonly filePath: string;
  private readonly windowHours: number;
  private readonly maxEvents: number;
  private readonly maxTraces: number;
  private readonly maxTopEntries: number;
  private readonly now: () => Date;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly env: NodeJS.ProcessEnv;

  constructor(runtime: ZavorthTelemetryLedgerRuntime = {}) {
    this.filePath = runtime.filePath || config.telemetryEventsFile;
    this.windowHours = Math.max(1, Math.min(runtime.windowHours || 24 * 7, 24 * 30));
    this.maxEvents = Math.max(100, Math.min(runtime.maxEvents || 5_000, 100_000));
    this.maxTraces = Math.max(3, Math.min(runtime.maxTraces || 8, 20));
    this.maxTopEntries = Math.max(3, Math.min(runtime.maxTopEntries || 5, 12));
    this.now = runtime.now || (() => new Date());
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.env = runtime.env || process.env;
  }

  public buildSnapshot(
    input: Date | Partial<{ referenceDate: Date; windowHours: number }> = {},
  ): ZavorthTelemetryLedgerSnapshot {
    const normalizedInput = input instanceof Date ? { referenceDate: input } : (input || {});
    const referenceDate = normalizedInput.referenceDate || this.now();
    const windowHours = Math.max(1, Math.min(Number(normalizedInput.windowHours || this.windowHours), 24 * 30));
    const generatedAt = referenceDate.toISOString();
    const sinks = this.buildSinksSnapshot();
    const redaction = this.buildRedactionSnapshot();

    if (!this.filePath || !this.existsSync(this.filePath)) {
      return {
        generatedAt,
        file: this.filePath,
        windowHours,
        available: false,
        status: 'missing',
        totalEvents: 0,
        traceCount: 0,
        failureEvents: 0,
        blockedEvents: 0,
        lastEventAt: null,
        topSources: [],
        topEventTypes: [],
        traces: [],
        sinks,
        retention: this.buildRetentionSnapshot({
          windowHours,
          scannedEvents: 0,
          retainedEvents: 0,
          truncated: false,
        }),
        redaction,
        recommendation: 'Local telemetry has not been generated on this host yet.',
      };
    }

    const sinceMs = referenceDate.getTime() - windowHours * 60 * 60 * 1000;
    const readResult = this.readEvents();
    const parsedEvents = readResult.events
      .filter((event) => Number.isFinite(Date.parse(String(event.timestamp || ''))))
      .filter((event) => Date.parse(event.timestamp) >= sinceMs);
    const traces = this.buildTraceSnapshots(parsedEvents);
    const failureEvents = parsedEvents.filter((event) => this.isFailureEvent(event)).length;
    const blockedEvents = parsedEvents.filter((event) => this.isBlockedEvent(event)).length;
    const lastEventAt = parsedEvents.length > 0
      ? parsedEvents
        .map((event) => event.timestamp)
        .sort()
        .slice(-1)[0]
      : null;
    const topSources = this.buildTopEntries(parsedEvents.map((event) => this.normalizeText(event.source) || 'unknown'));
    const topEventTypes = this.buildTopEntries(
      parsedEvents.map((event) => this.normalizeText(event.eventType) || 'unknown'),
    );
    const status: ZavorthTelemetryLedgerSnapshot['status'] =
      parsedEvents.length === 0
        ? 'idle'
        : failureEvents > 0 || blockedEvents > 0
          ? 'active'
          : 'active';

    return {
      generatedAt,
      file: this.filePath,
      windowHours,
      available: true,
      status,
      totalEvents: parsedEvents.length,
      traceCount: traces.length,
      failureEvents,
      blockedEvents,
      lastEventAt,
      topSources,
      topEventTypes,
      traces,
      sinks,
      retention: this.buildRetentionSnapshot({
        windowHours,
        scannedEvents: readResult.scannedEvents,
        retainedEvents: parsedEvents.length,
        truncated: readResult.truncated,
      }),
      redaction,
      recommendation: this.buildRecommendation({
        totalEvents: parsedEvents.length,
        traceCount: traces.length,
        failureEvents,
        blockedEvents,
        otelReady: sinks.otelReady,
      }),
    };
  }

  private readEvents(): TelemetryEventReadResult {
    try {
      const raw = this.readFileSync(this.filePath, 'utf8');
      const lines = raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const scannedEvents = lines.length;
      const candidateLines = lines.slice(-this.maxEvents);
      return {
        scannedEvents,
        truncated: scannedEvents > candidateLines.length,
        events: candidateLines
        .map((line) => {
          try {
            return JSON.parse(line) as TelemetryEventLike;
          } catch (error) { logger.warn('[Zavorth Telemetry Ledger] JSON parse failed', error); return null; }
        })
          .filter((entry): entry is TelemetryEventLike => Boolean(entry?.traceId)),
      };
    } catch (error) {
    logger.warn('[Zavorth Telemetry Ledger] JSON parse failed', error);
    return {
        events: [],
        scannedEvents: 0,
        truncated: false,
      };
  }
  }

  private buildTraceSnapshots(events: TelemetryEventLike[]): ZavorthTelemetryTraceSnapshot[] {
    const traces = new Map<string, MutableTraceSnapshot>();

    for (const event of events) {
      const traceId = this.normalizeText(event.traceId);
      if (!traceId) {
        continue;
      }
      const timestamp = this.normalizeText(event.timestamp) || this.now().toISOString();
      const existing = traces.get(traceId) || {
        traceId: this.hashReference('trace', traceId),
        source: this.normalizeText(event.source) || 'unknown',
        status: 'running',
        eventCount: 0,
        failureCount: 0,
        lastEventType: this.normalizeText(event.eventType) || 'unknown',
        startedAt: timestamp,
        lastSeenAt: timestamp,
        hasBlocked: false,
      };
      existing.eventCount += 1;
      existing.source = existing.source || this.normalizeText(event.source) || 'unknown';
      if (timestamp < existing.startedAt) {
        existing.startedAt = timestamp;
      }
      if (timestamp >= existing.lastSeenAt) {
        existing.lastSeenAt = timestamp;
        existing.lastEventType = this.normalizeText(event.eventType) || existing.lastEventType;
      }
      if (this.isFailureEvent(event)) {
        existing.failureCount += 1;
      }
      if (this.isBlockedEvent(event)) {
        existing.hasBlocked = true;
      }
      existing.status = this.resolveTraceStatus(existing, event);
      traces.set(traceId, existing);
    }

    return Array.from(traces.values())
      .sort((left, right) => {
        const leftWeight = left.failureCount * 5 + (left.status === 'blocked' ? 3 : 0) + left.eventCount;
        const rightWeight = right.failureCount * 5 + (right.status === 'blocked' ? 3 : 0) + right.eventCount;
        return rightWeight - leftWeight || right.lastSeenAt.localeCompare(left.lastSeenAt);
      })
      .slice(0, this.maxTraces)
      .map(({ hasBlocked: _hasBlocked, ...entry }) => entry);
  }

  private resolveTraceStatus(
    trace: MutableTraceSnapshot,
    event: TelemetryEventLike,
  ): ZavorthTelemetryTraceSnapshot['status'] {
    if (this.isFailureEvent(event)) {
      return 'failed';
    }
    if (this.isBlockedEvent(event)) {
      return 'blocked';
    }
    if (
      /(?:completed|success|dry_run)$/i.test(this.normalizeText(event.eventType))
      || /^(?:success|dry_run|completed)$/i.test(this.normalizeText(event.status))
    ) {
      return trace.failureCount > 0 ? 'failed' : 'completed';
    }
    if (trace.hasBlocked) {
      return 'blocked';
    }
    if (trace.failureCount > 0) {
      return 'failed';
    }
    return 'running';
  }

  private buildTopEntries(values: string[]): ZavorthTelemetryLedgerTopEntry[] {
    const counts = new Map<string, number>();
    for (const value of values) {
      const normalized = this.normalizeText(value) || 'unknown';
      counts.set(normalized, Number(counts.get(normalized) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
      .slice(0, this.maxTopEntries);
  }

  private buildSinksSnapshot(): ZavorthTelemetryLedgerSnapshot['sinks'] {
    const langfuseConfigured = Boolean(
      this.normalizeText(this.env.LANGFUSE_PUBLIC_KEY) && this.normalizeText(this.env.LANGFUSE_SECRET_KEY),
    );
    const otelExporterConfigured = Boolean(
      this.normalizeText(this.env.OTEL_EXPORTER_OTLP_ENDPOINT)
      || this.normalizeText(this.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT)
      || langfuseConfigured,
    );

    return {
      localJsonl: Boolean(this.normalizeText(this.filePath)),
      langfuseConfigured,
      otelExporterConfigured,
      otelReady: otelExporterConfigured,
      externalRequired: false,
    };
  }

  private buildRetentionSnapshot(input: {
    windowHours: number;
    scannedEvents: number;
    retainedEvents: number;
    truncated: boolean;
  }): ZavorthTelemetryLedgerRetention {
    return {
      windowHours: input.windowHours,
      maxEvents: this.maxEvents,
      maxTraces: this.maxTraces,
      maxTopEntries: this.maxTopEntries,
      scannedEvents: input.scannedEvents,
      retainedEvents: input.retainedEvents,
      truncated: input.truncated,
    };
  }

  private buildRedactionSnapshot(): ZavorthTelemetryLedgerRedaction {
    return {
      mode: 'hashed-references',
      traceIdsHashed: true,
      payloadsIncluded: false,
      notes: [
        'Trace IDs are short hashes for correlation without exposing raw identifiers.',
        'Event payloads do not enter the operational snapshot.',
        'External sinks remain optional and dormant by default.',
      ],
    };
  }

  private buildRecommendation(input: {
    totalEvents: number;
    traceCount: number;
    failureEvents: number;
    blockedEvents: number;
    otelReady: boolean;
  }): string | null {
    if (input.totalEvents === 0) {
      return 'Run real supervised flows to form a baseline and reusable traces.';
    }
    if (input.failureEvents > 0 || input.blockedEvents > 0) {
      return 'Cross-check failed traces with scorecards and replay before the next rollout.';
    }
    if (!input.otelReady) {
      return 'Local JSONL is active; configure OTEL/Langfuse only if you want optional external export.';
    }
    if (input.traceCount < 3) {
      return 'The trace baseline is still short; generate more comparable executions to consolidate delivery.';
    }
    return 'Operational telemetry is active and ready for per-flow comparison.';
  }

  private isFailureEvent(event: TelemetryEventLike): boolean {
    const eventType = this.normalizeText(event.eventType).toLowerCase();
    const status = this.normalizeText(event.status).toLowerCase();
    return eventType.endsWith('.failed')
      || ['failed', 'exception', 'tool_missing', 'executor_missing'].includes(status)
      || status.includes('failed')
      || status.includes('exception');
  }

  private isBlockedEvent(event: TelemetryEventLike): boolean {
    const eventType = this.normalizeText(event.eventType).toLowerCase();
    const status = this.normalizeText(event.status).toLowerCase();
    return eventType.endsWith('.blocked')
      || status.includes('blocked')
      || status.includes('approval_required')
      || status.includes('policy_blocked')
      || status.includes('host_unauthorized')
      || status.includes('workspace_invalid')
      || status.includes('mode_insufficient');
  }

  private normalizeText(value: unknown): string {
    return String(value || '').trim();
  }

  private hashReference(prefix: string, value: string): string {
    const normalized = this.normalizeText(value);
    if (!normalized) {
      return `${prefix}:unknown`;
    }
    return `${prefix}:${crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 12)}`;
  }
}
