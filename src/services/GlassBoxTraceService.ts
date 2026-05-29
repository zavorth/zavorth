import { randomUUID } from 'node:crypto';
import type {
  ExecutionEngineId,
  GlassBoxTraceEvent,
  GlassBoxTraceEventKind,
} from '../contracts/ExecutionEngineContract';

export type GlassBoxTraceInput = {
  kind: GlassBoxTraceEventKind;
  title: string;
  detail: string;
  engineId: ExecutionEngineId;
  status?: GlassBoxTraceEvent['status'];
  metadata?: Record<string, unknown>;
};

export class GlassBoxTraceService {
  private readonly events: GlassBoxTraceEvent[] = [];

  public append(input: GlassBoxTraceInput): GlassBoxTraceEvent {
    const event: GlassBoxTraceEvent = {
      id: `trace:${randomUUID()}`,
      kind: input.kind,
      title: input.title,
      detail: input.detail,
      engineId: input.engineId,
      status: input.status ?? 'info',
      createdAt: new Date().toISOString(),
      metadata: input.metadata,
    };
    this.events.unshift(event);
    if (this.events.length > 250) this.events.length = 250;
    return event;
  }

  public list(limit = 50): GlassBoxTraceEvent[] {
    return this.events.slice(0, Math.max(0, limit));
  }

  public clear(): void {
    this.events.length = 0;
  }
}
