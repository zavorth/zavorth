import {
  buildExecutionLifecycleRecord,
  createExecutionCorrelation,
  type ZavorthExecutionCorrelation,
  type ZavorthExecutionLifecycleStatus,
  type ExecutionLifecycleRecord,
} from '../../contracts/ExecutionLifecycleContract.js';
import type {
  WorkflowRunSnapshot,
  WorkflowRunStageSnapshot,
} from '../WorkflowRunService.js';

function normalizeNullableString(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

export class WorkflowRunLifecycleSupport {
  public static buildRunCorrelation(
    run: WorkflowRunSnapshot,
    input: { approvalId?: string | null; artifactId?: string | null } = {},
  ): ZavorthExecutionCorrelation {
    return createExecutionCorrelation({
      traceId: run.origin.origin_task_id || run.workflow_run_id,
      runId: run.workflow_run_id,
      sessionId: run.origin.parent_chat_id || run.origin.runtime_user_id || null,
      approvalId: input.approvalId || null,
      artifactId: input.artifactId || null,
    });
  }

  public static buildWorkflowLifecycleRecord(
    run: WorkflowRunSnapshot,
    input: {
      kind: 'run' | 'execution' | 'approval';
      status: ZavorthExecutionLifecycleStatus;
      summary: string;
      id?: string | null;
      at?: string | null;
      parentId?: string | null;
      source?: string | null;
      approvalId?: string | null;
      artifactId?: string | null;
      metadata?: Record<string, unknown>;
    },
  ): ExecutionLifecycleRecord {
    return buildExecutionLifecycleRecord({
      kind: input.kind,
      id: input.id || null,
      status: input.status,
      correlation: this.buildRunCorrelation(run, {
        approvalId: input.approvalId || null,
        artifactId: input.artifactId || null,
      }),
      summary: input.summary,
      source: input.source || 'workflow-run',
      surface: run.origin.source_surface || null,
      parentId: input.parentId || (input.kind === 'run' ? null : run.workflow_run_id),
      at: input.at || run.updated_at,
      metadata: {
        workflowRunId: run.workflow_run_id,
        workflowName: run.workflow_name,
        ...(input.metadata || {}),
      },
    });
  }

  public static appendLifecycle(
    run: WorkflowRunSnapshot,
    records: ExecutionLifecycleRecord | ExecutionLifecycleRecord[] | null,
  ): void {
    const next = [
      ...(Array.isArray(run.execution_lifecycle) ? run.execution_lifecycle : []),
      ...(Array.isArray(records) ? records : (records ? [records] : [])),
    ].filter((entry): entry is ExecutionLifecycleRecord => Boolean(entry));
    const deduped = new Map<string, ExecutionLifecycleRecord>();
    for (const entry of next) {
      const key = [
        entry.kind,
        entry.id,
        entry.status,
        entry.updatedAt,
        entry.summary,
        entry.source,
      ].join('|');
      if (!deduped.has(key)) {
        deduped.set(key, entry);
      }
    }
    run.execution_lifecycle = Array.from(deduped.values()).slice(-80);
  }

  public static normalizeLifecycleRecords(value: unknown): ExecutionLifecycleRecord[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        const record = entry as Record<string, any>;
        return buildExecutionLifecycleRecord({
          kind: this.normalizeLifecycleKind(record.kind),
          id: String(record.id || '').trim() || null,
          status: this.normalizeLifecycleStatus(record.status),
          correlation: {
            traceId: normalizeNullableString(record.traceId || record.trace_id) || undefined,
            runId: normalizeNullableString(record.runId || record.run_id) || undefined,
            sessionId: normalizeNullableString(record.sessionId || record.session_id),
            approvalId: normalizeNullableString(record.approvalId || record.approval_id),
            artifactId: normalizeNullableString(record.artifactId || record.artifact_id),
          },
          summary: normalizeNullableString(record.summary) || '',
          source: normalizeNullableString(record.source) || 'workflow-run',
          surface: normalizeNullableString(record.surface),
          parentId: normalizeNullableString(record.parentId || record.parent_id),
          at: normalizeNullableString(record.updatedAt || record.updated_at || record.createdAt || record.created_at),
          metadata: record.metadata || {},
        });
      })
      .filter((entry): entry is ExecutionLifecycleRecord => Boolean(entry));
  }

  public static normalizeLifecycleKind(value: unknown): 'run' | 'execution' | 'approval' {
    const normalized = String(value || '').trim();
    if (normalized === 'run' || normalized === 'approval') {
      return normalized;
    }
    return 'execution';
  }

  public static normalizeLifecycleStatus(value: unknown): ZavorthExecutionLifecycleStatus {
    const normalized = String(value || '').trim();
    switch (normalized) {
      case 'received':
      case 'planned':
      case 'approval_required':
      case 'approved':
      case 'blocked':
      case 'running':
      case 'completed':
      case 'failed':
      case 'noop':
      case 'linked':
      case 'replayed':
        return normalized;
      default:
        return 'linked';
    }
  }

  public static mapWorkflowStatusToLifecycle(
    status: WorkflowRunSnapshot['status'],
  ): ZavorthExecutionLifecycleStatus {
    if (status === 'approval_pending') {
      return 'approval_required';
    }
    if (status === 'blocked') {
      return 'blocked';
    }
    if (status === 'failed') {
      return 'failed';
    }
    if (status === 'completed') {
      return 'completed';
    }
    return 'running';
  }

  public static buildStageExecutionId(
    run: WorkflowRunSnapshot,
    phase: WorkflowRunStageSnapshot,
  ): string {
    const taskId = normalizeNullableString(phase.task_id);
    if (taskId) {
      return taskId;
    }
    return `${run.workflow_run_id}:${phase.id}:attempt:${Math.max(1, Number(phase.attempt_count || 0) || 1)}`;
  }

  public static buildStageApprovalId(
    run: WorkflowRunSnapshot,
    phase: WorkflowRunStageSnapshot,
  ): string {
    const taskId = normalizeNullableString(phase.task_id);
    if (taskId) {
      return `${taskId}:approval`;
    }
    return `approval:${run.workflow_run_id}:${phase.id}:${Math.max(1, Number(phase.attempt_count || 0) || 1)}`;
  }
}
