import type {
  SalesEventKind,
  SalesPackLedgerEvent,
} from '../../../../contracts/core/SalesPackContract.js';
import { SALES_EVENT_KINDS } from '../../../../contracts/core/SalesPackContract.js';

type SalesPackEventLedgerRuntime = {
  now?: () => Date;
  idFactory?: (prefix: string) => string;
};

export type AppendSalesPackEventInput = {
  kind: SalesEventKind;
  traceId: string;
  runId?: string | null;
  sessionId: string;
  tenantId: string;
  channelAccountId: string;
  actorId: string;
  payload?: Record<string, unknown> | null;
};

export class SalesPackEventLedgerService {
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string) => string;
  private readonly events: SalesPackLedgerEvent[] = [];

  constructor(runtime: SalesPackEventLedgerRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.idFactory = runtime.idFactory || defaultIdFactory;
  }

  public append(input: AppendSalesPackEventInput): SalesPackLedgerEvent {
    const event: SalesPackLedgerEvent = {
      id: this.idFactory('sales-event'),
      kind: input.kind,
      createdAt: this.now().toISOString(),
      traceId: clean(input.traceId, 'trace-unknown'),
      runId: cleanNullable(input.runId),
      sessionId: clean(input.sessionId, 'session-unknown'),
      tenantId: clean(input.tenantId, 'tenant-unknown'),
      channelAccountId: clean(input.channelAccountId, 'channel-unknown'),
      actorId: clean(input.actorId, 'actor-unknown'),
      payload: sanitizePayload(input.payload),
    };
    this.events.push(event);
    return cloneEvent(event);
  }

  public list(input: {
    traceId?: string | null;
    sessionId?: string | null;
    tenantId?: string | null;
    kind?: SalesEventKind | null;
  } = {}): SalesPackLedgerEvent[] {
    const traceId = cleanNullable(input.traceId);
    const sessionId = cleanNullable(input.sessionId);
    const tenantId = cleanNullable(input.tenantId);
    const kind = input.kind || null;
    return this.events
      .filter((event) => !traceId || event.traceId === traceId)
      .filter((event) => !sessionId || event.sessionId === sessionId)
      .filter((event) => !tenantId || event.tenantId === tenantId)
      .filter((event) => !kind || event.kind === kind)
      .map(cloneEvent);
  }

  public buildSummary(): {
    totalEvents: number;
    byKind: Record<SalesEventKind, number>;
  } {
    const byKind = SALES_EVENT_KINDS.reduce<Record<SalesEventKind, number>>((acc, kind) => {
      acc[kind] = 0;
      return acc;
    }, {} as Record<SalesEventKind, number>);
    for (const event of this.events) {
      byKind[event.kind] += 1;
    }
    return {
      totalEvents: this.events.length,
      byKind,
    };
  }
}

function defaultIdFactory(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clean(value: unknown, fallback: string): string {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function cleanNullable(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function sanitizePayload(input: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input || {})) {
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey || value === undefined) {
      continue;
    }
    output[normalizedKey] = value;
  }
  return output;
}

function cloneEvent(event: SalesPackLedgerEvent): SalesPackLedgerEvent {
  return {
    ...event,
    payload: { ...event.payload },
  };
}
