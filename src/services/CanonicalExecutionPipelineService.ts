import {
  buildCanonicalRunContext,
  buildExecutionLifecycleRecord,
  createExecutionCorrelation,
  type ZavorthExecutionCorrelation,
  type ZavorthExecutionEntityKind,
  type ZavorthExecutionLifecycleStatus,
  type CanonicalRunContext,
  type ExecutionLifecycleRecord,
} from '../contracts/ExecutionLifecycleContract.js';

export type CanonicalExecutionEngine =
  | 'automation'
  | 'node-invoke'
  | 'swarm'
  | 'selfmod'
  | 'host-action'
  | 'workflow'
  | 'execution-gateway'
  | 'internal-execution-api';

export type CanonicalExecutionPipelineEvent = {
  engine: CanonicalExecutionEngine;
  kind: ZavorthExecutionEntityKind;
  status: ZavorthExecutionLifecycleStatus;
  id?: string | null;
  objective?: string | null;
  summary?: string | null;
  requestedBy?: string | null;
  surface?: string | null;
  profile?: string | null;
  traceId?: string | null;
  runId?: string | null;
  sessionId?: string | null;
  approvalId?: string | null;
  artifactId?: string | null;
  parentId?: string | null;
  at?: Date | string | null;
  metadata?: Record<string, unknown> | null;
};

export type CanonicalExecutionPipelineLink = ZavorthExecutionCorrelation & {
  runContext: CanonicalRunContext;
  lifecycle: ExecutionLifecycleRecord[];
  latestStatus: ZavorthExecutionLifecycleStatus | null;
  latestSummary: string | null;
  sourceEngine: CanonicalExecutionEngine;
};

export class CanonicalExecutionPipelineService {
  public buildLink(
    eventOrEvents: CanonicalExecutionPipelineEvent | CanonicalExecutionPipelineEvent[],
  ): CanonicalExecutionPipelineLink {
    const events = (Array.isArray(eventOrEvents) ? eventOrEvents : [eventOrEvents])
      .filter((event): event is CanonicalExecutionPipelineEvent => Boolean(event));
    const first = events[0];
    if (!first) {
      const correlation = createExecutionCorrelation();
      return {
        ...correlation,
        runContext: buildCanonicalRunContext({
          correlation,
          surface: 'unknown',
          requestedBy: 'anonymous',
        }),
        lifecycle: [],
        latestStatus: null,
        latestSummary: null,
        sourceEngine: 'internal-execution-api',
      };
    }

    const baseCorrelation = this.resolveCorrelation(first);
    const runContext = buildCanonicalRunContext({
      correlation: baseCorrelation,
      surface: first.surface || first.engine,
      requestedBy: first.requestedBy || 'operator',
      profile: first.profile || null,
      sessionId: first.sessionId || baseCorrelation.sessionId,
    });
    const lifecycle = events.map((event) => {
      const eventCorrelation = createExecutionCorrelation({
        traceId: event.traceId || baseCorrelation.traceId,
        runId: event.runId || baseCorrelation.runId,
        sessionId: event.sessionId || baseCorrelation.sessionId,
        approvalId: event.approvalId || baseCorrelation.approvalId,
        artifactId: event.artifactId || baseCorrelation.artifactId,
      });
      return buildExecutionLifecycleRecord({
        kind: event.kind,
        id: event.id || null,
        status: event.status,
        correlation: eventCorrelation,
        summary: event.summary || event.objective || `${event.engine} ${event.status}`,
        source: event.engine,
        surface: event.surface || first.surface || event.engine,
        parentId: event.parentId || eventCorrelation.runId,
        at: event.at || null,
        metadata: {
          engine: event.engine,
          objective: event.objective || null,
          requestedBy: event.requestedBy || first.requestedBy || null,
          ...(event.metadata || {}),
        },
      });
    });
    const latest = lifecycle[lifecycle.length - 1] || null;

    return {
      ...baseCorrelation,
      runContext,
      lifecycle,
      latestStatus: latest?.status || null,
      latestSummary: latest?.summary || null,
      sourceEngine: first.engine,
    };
  }

  public mergeLifecycle(
    existing: unknown,
    next: unknown,
    limit = 50,
  ): ExecutionLifecycleRecord[] {
    const records = [
      ...this.readLifecycleArray(existing),
      ...this.readLifecycleArray(next),
    ];
    const deduped = new Map<string, ExecutionLifecycleRecord>();
    for (const record of records) {
      const key = [
        record.kind,
        record.id,
        record.traceId,
        record.runId,
        record.status,
        record.updatedAt || record.createdAt,
      ].join('|');
      deduped.set(key, record);
    }
    return Array.from(deduped.values()).slice(-Math.max(1, limit));
  }

  public mergeMetadata(
    metadata: Record<string, unknown> | null | undefined,
    link: CanonicalExecutionPipelineLink,
  ): Record<string, unknown> {
    return {
      ...(metadata || {}),
      traceId: link.traceId,
      runId: link.runId,
      sessionId: link.sessionId,
      approvalId: link.approvalId,
      artifactId: link.artifactId,
      runContext: link.runContext,
      execution_lifecycle: this.mergeLifecycle((metadata || {}).execution_lifecycle, link.lifecycle),
    };
  }

  public mapAutomationStatus(status: 'completed' | 'blocked' | 'waiting_approval'): ZavorthExecutionLifecycleStatus {
    if (status === 'waiting_approval') {
      return 'approval_required';
    }
    if (status === 'blocked') {
      return 'blocked';
    }
    return 'completed';
  }

  public mapNodeInvocationStatus(status: string): ZavorthExecutionLifecycleStatus {
    if (status === 'queued' || status === 'pending') {
      return 'planned';
    }
    if (status === 'claimed') {
      return 'running';
    }
    if (status === 'completed') {
      return 'completed';
    }
    if (status === 'failed' || status === 'cancelled') {
      return 'failed';
    }
    if (status === 'blocked' || status === 'unavailable') {
      return 'blocked';
    }
    return 'received';
  }

  public mapSwarmStatus(status: string): ZavorthExecutionLifecycleStatus {
    if (status === 'running') {
      return 'running';
    }
    if (status === 'completed') {
      return 'completed';
    }
    if (status === 'cancelled' || status === 'failed' || status === 'timed_out') {
      return 'failed';
    }
    return 'planned';
  }

  public mapSelfModificationStatus(success: boolean, operation: 'preview' | 'apply' | 'rollback'): ZavorthExecutionLifecycleStatus {
    if (!success) {
      return operation === 'preview' ? 'blocked' : 'failed';
    }
    return operation === 'preview' ? 'planned' : 'completed';
  }

  private resolveCorrelation(event: CanonicalExecutionPipelineEvent): ZavorthExecutionCorrelation {
    const primaryId = this.pickString([
      event.traceId,
      event.runId,
      event.id,
      event.sessionId,
      event.approvalId,
      event.artifactId,
    ]);
    return createExecutionCorrelation({
      traceId: event.traceId || primaryId || undefined,
      runId: event.runId || event.id || primaryId || undefined,
      sessionId: event.sessionId || null,
      approvalId: event.approvalId || null,
      artifactId: event.artifactId || null,
    });
  }

  private readLifecycleArray(value: unknown): ExecutionLifecycleRecord[] {
    return Array.isArray(value)
      ? value.filter((entry): entry is ExecutionLifecycleRecord => Boolean(entry && typeof entry === 'object'))
      : [];
  }

  private pickString(values: unknown[]): string | null {
    for (const value of values) {
      const normalized = String(value || '').trim();
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }
}
