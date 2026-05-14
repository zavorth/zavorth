import type { ArtifactRecord } from '../contracts/ArtifactContract.js';
import {
  buildExecutionLifecycleRecord,
  createExecutionCorrelation,
  type ZavorthExecutionEntityKind,
  type ZavorthExecutionCorrelation,
  type ZavorthExecutionLifecycleStatus,
  type ExecutionLifecycleRecord,
} from '../contracts/ExecutionLifecycleContract.js';

type LifecycleLinkContext = {
  traceId?: string | null;
  runId?: string | null;
  sessionId?: string | null;
  approvalId?: string | null;
  artifactId?: string | null;
  surface?: string | null;
  source?: string | null;
  parentId?: string | null;
};

type ReplayStepLike = {
  id?: string | null;
  kind?: string | null;
  label?: string | null;
  detail?: string | null;
  status?: string | null;
  source?: string | null;
  targetId?: string | null;
};

type ContextLinkInput = {
  lifecycle?: unknown;
  traceId?: unknown;
  runId?: unknown;
  sessionId?: unknown;
  approvalId?: unknown;
  artifactId?: unknown;
  workflowRunId?: unknown;
  parentId?: unknown;
  source?: unknown;
  surface?: unknown;
  fallbackId?: unknown;
};

export type ExecutionLifecycleContextLink = {
  traceId: string | null;
  runId: string | null;
  sessionId: string | null;
  approvalId: string | null;
  artifactId: string | null;
  workflowRunId: string | null;
  latestStatus: ZavorthExecutionLifecycleStatus | null;
  latestSummary: string | null;
  parentId: string | null;
  source: string | null;
  surface: string | null;
  lifecycle: ExecutionLifecycleRecord[];
};

export class ExecutionLifecycleLinkService {
  public buildArtifactLifecycle(
    artifacts: Array<Partial<ArtifactRecord>>,
    context: LifecycleLinkContext = {},
  ): ExecutionLifecycleRecord[] {
    return artifacts
      .map((artifact) => this.buildSingleArtifactLifecycle(artifact, context))
      .filter((record): record is ExecutionLifecycleRecord => Boolean(record));
  }

  public buildApprovalLifecycle(
    approvals: Array<Record<string, unknown>>,
    context: LifecycleLinkContext = {},
  ): ExecutionLifecycleRecord[] {
    return approvals
      .map((approval) => {
        const approvalId = this.pickString([
          approval.approvalId,
          approval.approval_id,
          approval.permissionId,
          approval.permission_id,
          context.approvalId,
        ]);
        if (!approvalId) {
          return null;
        }

        const status = String(approval.status || '').trim().toLowerCase();
        return buildExecutionLifecycleRecord({
          kind: 'approval',
          id: approvalId,
          status: status === 'approved'
            ? 'approved'
            : status === 'rejected' || status === 'blocked'
              ? 'blocked'
              : 'approval_required',
          correlation: this.resolveCorrelation({
            ...context,
            approvalId,
            runId: this.pickString([context.runId, approval.runId, approval.run_id, approval.taskId, approval.task_id]),
          }),
          summary: this.pickString([approval.reason, approval.summary, approval.kind, 'Approval linked to execution run.']),
          source: context.source || 'execution-lifecycle-link',
          surface: this.pickString([context.surface, approval.surface, approval.source]),
          parentId: this.pickString([context.parentId, approval.taskId, approval.task_id, approval.runId, approval.run_id]),
          metadata: {
            status: status || null,
            kind: this.pickString([approval.kind]),
            taskId: this.pickString([approval.taskId, approval.task_id]),
          },
        });
      })
      .filter((record): record is ExecutionLifecycleRecord => Boolean(record));
  }

  public buildReplayLifecycle(
    steps: ReplayStepLike[],
    context: LifecycleLinkContext = {},
  ): ExecutionLifecycleRecord[] {
    return steps
      .map((step) => {
        const kind = String(step.kind || '').trim();
        const targetId = String(step.targetId || '').trim();
        const stepId = String(step.id || targetId || '').trim();
        if (!kind || !stepId) {
          return null;
        }

        const recordKind = kind === 'artifact'
          ? 'artifact'
          : kind === 'permission'
            ? 'approval'
            : kind === 'workflow'
              ? 'run'
              : kind === 'task'
                ? 'execution'
                : 'replay';
        const approvalId = recordKind === 'approval'
          ? stepId.replace(/^permission:/, '')
          : context.approvalId || null;
        const artifactId = recordKind === 'artifact'
          ? stepId.replace(/^artifact:/, '')
          : context.artifactId || null;

        return buildExecutionLifecycleRecord({
          kind: recordKind,
          id: targetId || stepId,
          status: recordKind === 'replay'
            ? 'replayed'
            : this.mapStepStatus(String(step.status || '')),
          correlation: this.resolveCorrelation({
            ...context,
            approvalId,
            artifactId,
            runId: context.runId || targetId || stepId,
          }),
          summary: this.pickString([step.detail, step.label, 'Replay step linked to execution lifecycle.']),
          source: context.source || 'session-replay',
          surface: this.pickString([step.source, context.surface]),
          parentId: context.parentId || null,
          metadata: {
            replayStepId: stepId,
            replayKind: kind,
            targetId: targetId || null,
          },
        });
      })
      .filter((record): record is ExecutionLifecycleRecord => Boolean(record));
  }

  public buildTaskContextLink(task: Record<string, unknown> | null | undefined): ExecutionLifecycleContextLink | null {
    if (!task || typeof task !== 'object') {
      return null;
    }

    const record = task as Record<string, any>;
    const metadata = record.metadata && typeof record.metadata === 'object'
      ? record.metadata as Record<string, any>
      : {};
    return this.buildContextLink({
      lifecycle: [
        ...this.readLifecycleArray(metadata.execution_lifecycle),
        ...this.readLifecycleArray(metadata.artifacts_manifest?.lifecycle),
        ...this.readLifecycleArray(metadata.artifact_manifest?.lifecycle),
      ],
      traceId: metadata.traceId || metadata.trace_id,
      runId: metadata.runId || metadata.run_id || metadata.workflow_run_id || record.task_id || record.taskId,
      sessionId:
        metadata.sessionId
        || metadata.session_id
        || metadata.surface_identity?.sessionId
        || metadata.surface_identity?.session_id,
      approvalId:
        metadata.pendingPermissionId
        || metadata.pending_permission_id
        || metadata.approvalId
        || metadata.approval_id,
      artifactId: metadata.artifactId || metadata.artifact_id,
      workflowRunId: metadata.workflow_run_id,
      parentId: record.task_id || record.taskId,
      source: record.source || metadata.source,
      surface: record.source || metadata.surface,
      fallbackId: record.task_id || record.taskId,
    });
  }

  public buildWorkflowContextLink(run: Record<string, unknown> | null | undefined): ExecutionLifecycleContextLink | null {
    if (!run || typeof run !== 'object') {
      return null;
    }

    const record = run as Record<string, any>;
    const origin = record.origin && typeof record.origin === 'object'
      ? record.origin as Record<string, any>
      : {};
    return this.buildContextLink({
      lifecycle: [
        ...this.readLifecycleArray(record.execution_lifecycle),
        ...this.readLifecycleArray(record.artifacts_manifest?.lifecycle),
      ],
      traceId: record.traceId || record.trace_id,
      runId: record.workflow_run_id || record.runId || record.run_id,
      sessionId: record.sessionId || record.session_id || origin.parent_session_id || null,
      approvalId: record.approvalId || record.approval_id || null,
      artifactId: record.artifactId || record.artifact_id || null,
      workflowRunId: record.workflow_run_id || record.runId || record.run_id,
      parentId:
        record.resume_stage?.task_id
        || origin.origin_task_id
        || record.workflow_run_id
        || record.runId
        || null,
      source: origin.source_surface || record.source || 'workflow-run',
      surface: origin.source_surface || record.surface || null,
      fallbackId: record.workflow_run_id || record.runId || record.run_id,
    });
  }

  public buildContextLink(input: ContextLinkInput = {}): ExecutionLifecycleContextLink | null {
    const lifecycle = this.normalizeLifecycleRecords(input.lifecycle);
    const latest = lifecycle
      .slice()
      .sort((left, right) => this.getTimestamp(right.updatedAt || right.createdAt) - this.getTimestamp(left.updatedAt || left.createdAt))[0]
      || null;
    const fallbackId = this.pickString([input.fallbackId]);
    const traceId = this.pickString([
      input.traceId,
      latest?.traceId,
      latest?.runId,
      input.runId,
      input.sessionId,
      latest?.sessionId,
      fallbackId,
    ]);
    const runId = this.pickString([
      latest?.runId,
      input.runId,
      input.workflowRunId,
      input.traceId,
      latest?.traceId,
      fallbackId,
    ]);
    const sessionId = this.pickString([input.sessionId, latest?.sessionId]);
    const approvalId = this.pickString([input.approvalId, latest?.approvalId]);
    const artifactId = this.pickString([input.artifactId, latest?.artifactId]);
    const workflowRunId = this.pickString([input.workflowRunId, input.runId, latest?.runId]);
    const parentId = this.pickString([input.parentId, latest?.parentId, fallbackId]);
    const source = this.pickString([input.source, latest?.source]);
    const surface = this.pickString([input.surface, latest?.surface]);

    if (!traceId && !runId && !sessionId && !workflowRunId && lifecycle.length === 0) {
      return null;
    }

    return {
      traceId,
      runId,
      sessionId,
      approvalId,
      artifactId,
      workflowRunId,
      latestStatus: latest?.status || null,
      latestSummary: latest?.summary || null,
      parentId,
      source,
      surface,
      lifecycle,
    };
  }

  private buildSingleArtifactLifecycle(
    artifact: Partial<ArtifactRecord> | null | undefined,
    context: LifecycleLinkContext,
  ): ExecutionLifecycleRecord | null {
    if (!artifact) {
      return null;
    }

    const artifactId = this.pickString([artifact.id, artifact.key, artifact.path, artifact.url, artifact.name, context.artifactId]);
    if (!artifactId) {
      return null;
    }

    return buildExecutionLifecycleRecord({
      kind: 'artifact',
      id: artifactId,
      status: 'linked',
      correlation: this.resolveCorrelation({
        ...context,
        artifactId,
      }),
      summary: this.pickString([artifact.summary, artifact.description, artifact.name, 'Artifact linked to execution run.']),
      source: context.source || artifact.source || 'artifact-pipeline',
      surface: context.surface || null,
      parentId: context.parentId || null,
      metadata: {
        name: artifact.name || null,
        kind: artifact.kind || artifact.type || null,
        deliveryChannel: artifact.deliveryChannel || null,
        path: artifact.path || null,
        url: artifact.url || null,
      },
    });
  }

  private resolveCorrelation(context: LifecycleLinkContext): ZavorthExecutionCorrelation {
    return createExecutionCorrelation({
      traceId: this.pickString([context.traceId, context.runId, context.sessionId]) ?? undefined,
      runId: this.pickString([context.runId, context.traceId, context.sessionId]) ?? undefined,
      sessionId: context.sessionId || null,
      approvalId: context.approvalId || null,
      artifactId: context.artifactId || null,
    });
  }

  private mapStepStatus(value: string): ZavorthExecutionLifecycleStatus {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'completed' || normalized === 'available') {
      return 'completed';
    }
    if (normalized === 'failed' || normalized === 'rejected') {
      return 'failed';
    }
    if (normalized === 'waiting_approval' || normalized === 'approval_pending' || normalized === 'pending') {
      return 'approval_required';
    }
    return 'linked';
  }

  private readLifecycleArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private normalizeLifecycleRecords(value: unknown): ExecutionLifecycleRecord[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const deduped = new Map<string, ExecutionLifecycleRecord>();
    for (const record of value) {
      const normalized = this.normalizeLifecycleRecord(record);
      if (!normalized) {
        continue;
      }
      const key = [
        normalized.kind,
        normalized.id,
        normalized.status,
        normalized.updatedAt || normalized.createdAt,
      ].join(':');
      deduped.set(key, normalized);
    }
    return Array.from(deduped.values()).slice(-20);
  }

  private normalizeLifecycleRecord(record: unknown): ExecutionLifecycleRecord | null {
    if (!record || typeof record !== 'object') {
      return null;
    }

    const raw = record as Record<string, any>;
    const kind = this.normalizeLifecycleKind(raw.kind);
    const status = this.normalizeLifecycleStatus(raw.status);
    if (!kind || !status) {
      return null;
    }

    const correlation = createExecutionCorrelation({
      traceId: this.pickString([raw.traceId, raw.trace_id, raw.runId, raw.run_id]) ?? undefined,
      runId: this.pickString([raw.runId, raw.run_id, raw.traceId, raw.trace_id]) ?? undefined,
      sessionId: this.pickString([raw.sessionId, raw.session_id]) || null,
      approvalId: this.pickString([raw.approvalId, raw.approval_id]) || null,
      artifactId: this.pickString([raw.artifactId, raw.artifact_id]) || null,
    });

    const normalized = buildExecutionLifecycleRecord({
      kind,
      id: this.pickString([
        raw.id,
        raw.approvalId,
        raw.approval_id,
        raw.artifactId,
        raw.artifact_id,
        raw.runId,
        raw.run_id,
        raw.traceId,
        raw.trace_id,
        raw.parentId,
        raw.parent_id,
      ]) || `${kind}:${correlation.runId}`,
      status,
      correlation,
      summary: this.pickString([raw.summary, raw.label, `${kind} ${status}`]),
      source: this.pickString([raw.source, 'execution-lifecycle-link'])!,
      surface: this.pickString([raw.surface]),
      parentId: this.pickString([raw.parentId, raw.parent_id]),
      metadata: raw.metadata && typeof raw.metadata === 'object'
        ? { ...raw.metadata }
        : {},
    });
    const createdAt = this.pickString([raw.createdAt, raw.created_at]);
    const updatedAt = this.pickString([raw.updatedAt, raw.updated_at]);
    if (createdAt) {
      normalized.createdAt = createdAt;
    }
    if (updatedAt) {
      normalized.updatedAt = updatedAt;
    }
    return normalized;
  }

  private normalizeLifecycleKind(value: unknown): ZavorthExecutionEntityKind | null {
    const normalized = String(value || '').trim().toLowerCase();
    if (
      normalized === 'intent'
      || normalized === 'plan'
      || normalized === 'execution'
      || normalized === 'approval'
      || normalized === 'run'
      || normalized === 'session'
      || normalized === 'artifact'
      || normalized === 'replay'
    ) {
      return normalized;
    }
    return null;
  }

  private normalizeLifecycleStatus(value: unknown): ZavorthExecutionLifecycleStatus | null {
    const normalized = String(value || '').trim().toLowerCase();
    if (
      normalized === 'received'
      || normalized === 'planned'
      || normalized === 'approval_required'
      || normalized === 'approved'
      || normalized === 'blocked'
      || normalized === 'running'
      || normalized === 'completed'
      || normalized === 'failed'
      || normalized === 'noop'
      || normalized === 'linked'
      || normalized === 'replayed'
    ) {
      return normalized;
    }
    if (normalized === 'approval_pending' || normalized === 'waiting_approval' || normalized === 'pending') {
      return 'approval_required';
    }
    if (normalized === 'available') {
      return 'completed';
    }
    if (normalized === 'rejected' || normalized === 'cancelled' || normalized === 'timed_out') {
      return 'failed';
    }
    return null;
  }

  private getTimestamp(value: string | null | undefined): number {
    const parsed = Date.parse(String(value || '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
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
