import crypto from 'crypto';

import {
  createExecutionCorrelation,
  type ZavorthExecutionCorrelation,
} from '../contracts/ExecutionLifecycleContract.js';

export type ZavorthCorrelationTraceTaskLike = {
  task_id?: unknown;
  taskId?: unknown;
  chat_id?: unknown;
  chatId?: unknown;
  metadata?: Record<string, unknown> | null;
};

export type ZavorthCorrelationTraceLinkLike = {
  id?: unknown;
  traceId?: unknown;
  trace_id?: unknown;
  taskId?: unknown;
  task_id?: unknown;
  source?: unknown;
  eventType?: unknown;
  status?: unknown;
  metadata?: Record<string, unknown> | null;
};

export type ZavorthCorrelationTraceSnapshot = {
  traceId: string;
  runId: string;
  taskId: string | null;
  sessionId: string | null;
  links: {
    task: boolean;
    permissions: number;
    executors: number;
    replies: number;
    telemetryEvents: number;
  };
  references: {
    permissions: string[];
    executors: string[];
    replies: string[];
    telemetryEvents: string[];
  };
};

export class ZavorthCorrelationTraceService {
  public resolveTaskTraceId(task: ZavorthCorrelationTraceTaskLike | null | undefined): string {
    const metadata = task?.metadata || {};
    const explicit = this.firstText(
      metadata.traceId,
      metadata.trace_id,
      metadata.correlationId,
      metadata.correlation_id,
    );
    if (explicit) {
      return explicit;
    }

    const taskId = this.firstText(task?.task_id, task?.taskId);
    if (taskId) {
      return taskId.startsWith('task:') ? taskId : `task:${taskId}`;
    }

    const sessionId = this.firstText(task?.chat_id, task?.chatId, metadata.sessionId, metadata.session_id);
    return sessionId ? this.hashReference('session', sessionId) : 'task:unknown';
  }

  public decorateTask<T extends ZavorthCorrelationTraceTaskLike>(task: T): T {
    const traceId = this.resolveTaskTraceId(task);
    const metadata = task.metadata || {};
    metadata.traceId = this.firstText(metadata.traceId, metadata.trace_id) || traceId;
    metadata.runId = this.firstText(metadata.runId, metadata.run_id) || traceId;
    task.metadata = metadata;
    return task;
  }

  public buildTaskCorrelation(task: ZavorthCorrelationTraceTaskLike): ZavorthExecutionCorrelation {
    const decoratedTask = this.decorateTask(task);
    const metadata = decoratedTask.metadata || {};
    const traceId = this.resolveTaskTraceId(decoratedTask);
    return createExecutionCorrelation({
      traceId,
      runId: this.firstText(metadata.runId, metadata.run_id) || traceId,
      sessionId: this.firstText(metadata.sessionId, metadata.session_id, decoratedTask.chat_id, decoratedTask.chatId) || null,
      approvalId: this.firstText(metadata.approvalId, metadata.approval_id, metadata.pendingPermissionId) || null,
      artifactId: this.firstText(metadata.artifactId, metadata.artifact_id) || null,
    });
  }

  public buildSnapshot(input: {
    task?: ZavorthCorrelationTraceTaskLike | null;
    permissions?: ZavorthCorrelationTraceLinkLike[];
    executors?: ZavorthCorrelationTraceLinkLike[];
    replies?: ZavorthCorrelationTraceLinkLike[];
    telemetryEvents?: ZavorthCorrelationTraceLinkLike[];
  }): ZavorthCorrelationTraceSnapshot {
    const correlation = this.buildTaskCorrelation(input.task || {});
    const traceId = correlation.traceId;
    const taskId = this.firstText(input.task?.task_id, input.task?.taskId) || null;
    const permissions = this.matchLinks(traceId, taskId, input.permissions || []);
    const executors = this.matchLinks(traceId, taskId, input.executors || []);
    const replies = this.matchLinks(traceId, taskId, input.replies || []);
    const telemetryEvents = this.matchLinks(traceId, taskId, input.telemetryEvents || []);

    return {
      traceId,
      runId: correlation.runId,
      taskId,
      sessionId: correlation.sessionId,
      links: {
        task: Boolean(input.task),
        permissions: permissions.length,
        executors: executors.length,
        replies: replies.length,
        telemetryEvents: telemetryEvents.length,
      },
      references: {
        permissions: this.referenceIds('permission', permissions),
        executors: this.referenceIds('executor', executors),
        replies: this.referenceIds('reply', replies),
        telemetryEvents: this.referenceIds('telemetry', telemetryEvents),
      },
    };
  }

  private matchLinks(
    traceId: string,
    taskId: string | null,
    links: ZavorthCorrelationTraceLinkLike[],
  ): ZavorthCorrelationTraceLinkLike[] {
    return links.filter((link) => {
      const metadata = link.metadata || {};
      const linkTraceId = this.firstText(link.traceId, link.trace_id, metadata.traceId, metadata.trace_id);
      if (linkTraceId && linkTraceId === traceId) {
        return true;
      }
      const linkTaskId = this.firstText(link.task_id, link.taskId, metadata.task_id, metadata.taskId);
      return Boolean(taskId && linkTaskId === taskId);
    });
  }

  private referenceIds(prefix: string, links: ZavorthCorrelationTraceLinkLike[]): string[] {
    return links.map((link, index) => {
      const id = this.firstText(link.id, link.eventType, link.source, link.status);
      return id ? this.hashReference(prefix, id) : `${prefix}:${index + 1}`;
    });
  }

  private firstText(...values: unknown[]): string {
    for (const value of values) {
      const normalized = String(value || '').trim();
      if (normalized) {
        return normalized;
      }
    }
    return '';
  }

  private hashReference(prefix: string, value: string): string {
    return `${prefix}:${crypto.createHash('sha256').update(value).digest('hex').slice(0, 12)}`;
  }
}
