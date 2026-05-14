import {
  buildExecutionLifecycleRecord,
  type ZavorthExecutionLifecycleStatus,
  type ExecutionLifecycleRecord,
} from '../../contracts/ExecutionLifecycleContract.js';
import type {
  SystemOverlordActionRecord,
  SystemOverlordActionRequest,
  SystemOverlordApprovalDecision,
} from '../../contracts/SystemOverlordContract.js';

type BuildRecordInput = {
  actionId: string;
  createdAt: string;
  request: SystemOverlordActionRequest;
  status: SystemOverlordActionRecord['status'];
  decision: SystemOverlordActionRecord['decision'];
  command: string | null;
  workspace: string | null;
  stdout?: string | null;
  stderr?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  rollbackAvailable?: boolean;
  metadata?: Record<string, unknown>;
};

type BuildMutationRecordInput = {
  status: SystemOverlordActionRecord['status'];
  requestedBy: string;
  reason: string;
  errorCode: string;
  stdout?: string | null;
  stderr?: string | null;
  metadata?: Record<string, unknown>;
};

export class SupervisedExecutionGatewayRecordBuilder {
  public constructor(private readonly readExistingLifecycle: (actionId: string) => unknown) {}

  public buildRecord(input: BuildRecordInput): SystemOverlordActionRecord {
    const updatedAt = new Date().toISOString();
    const existingLifecycle = this.readExistingLifecycle(input.actionId);
    const nextLifecycle = this.buildActionLifecycleRecord({
      actionId: input.actionId,
      request: input.request,
      status: input.status,
      decision: input.decision,
      command: input.command,
      workspace: input.workspace,
      errorCode: input.errorCode || null,
      errorMessage: input.errorMessage || null,
      createdAt: input.createdAt,
      updatedAt,
    });
    return {
      actionId: input.actionId,
      runId: input.request.runId || null,
      requestedBy: input.request.requestedBy || null,
      surface: input.request.surface || null,
      createdAt: input.createdAt,
      updatedAt,
      status: input.status,
      request: input.request,
      decision: input.decision,
      command: input.command,
      workspace: input.workspace,
      stdout: input.stdout || null,
      stderr: input.stderr || null,
      exitCode: input.status === 'completed' ? 0 : null,
      errorCode: input.errorCode || null,
      errorMessage: input.errorMessage || null,
      rollbackAvailable: Boolean(input.rollbackAvailable),
      metadata: {
        ...(input.metadata || {}),
        execution_lifecycle: this.appendLifecycleRecords(existingLifecycle, nextLifecycle),
      },
    };
  }

  public buildMutationRecord(
    action: SystemOverlordActionRecord,
    input: BuildMutationRecordInput,
  ): SystemOverlordActionRecord {
    const updatedAt = new Date().toISOString();
    return {
      ...action,
      updatedAt,
      requestedBy: input.requestedBy,
      status: input.status,
      stdout: input.stdout !== undefined ? input.stdout : action.stdout,
      stderr: input.stderr !== undefined ? input.stderr : action.stderr,
      errorCode: input.errorCode,
      errorMessage: input.reason,
      metadata: {
        ...(action.metadata || {}),
        ...(input.metadata || {}),
        execution_lifecycle: this.appendLifecycleRecords(
          (action.metadata as Record<string, unknown> | undefined)?.execution_lifecycle,
          this.buildActionLifecycleRecord({
            actionId: action.actionId,
            request: action.request,
            status: input.status,
            decision: action.decision,
            command: action.command,
            workspace: action.workspace,
            errorCode: input.errorCode,
            errorMessage: input.reason,
            createdAt: action.createdAt,
            updatedAt,
          }),
        ),
      },
    };
  }

  public buildApprovalDecisionRecord(input: {
    action: SystemOverlordActionRecord;
    decision: SystemOverlordApprovalDecision;
    requestedBy?: string | null;
    reason?: string | null;
  }): SystemOverlordActionRecord {
    const decidedAt = new Date().toISOString();
    const reason = String(input.reason || '').trim() || (
      input.decision === 'approve'
        ? 'Aprovado pelo operador.'
        : 'Rejeitado pelo operador.'
    );
    const nextLifecycle = this.buildActionLifecycleRecord({
      actionId: input.action.actionId,
      request: input.action.request,
      status: input.action.status,
      decision: input.action.decision,
      command: input.action.command,
      workspace: input.action.workspace,
      errorCode: input.decision === 'reject' ? 'approval_rejected' : input.action.errorCode,
      errorMessage: input.decision === 'reject' ? reason : input.action.errorMessage,
      createdAt: input.action.createdAt,
      updatedAt: decidedAt,
      overrideKind: 'approval',
      overrideStatus: input.decision === 'approve' ? 'approved' : 'blocked',
      overrideSummary: reason,
    });
    return {
      ...input.action,
      updatedAt: decidedAt,
      status: input.decision === 'reject' ? 'rejected' : input.action.status,
      requestedBy: String(input.requestedBy || '').trim() || input.action.requestedBy || input.action.request.requestedBy || null,
      errorCode: input.decision === 'reject' ? 'approval_rejected' : input.action.errorCode,
      errorMessage: input.decision === 'reject' ? reason : input.action.errorMessage,
      metadata: {
        ...(input.action.metadata || {}),
        execution_lifecycle: this.appendLifecycleRecords(
          (input.action.metadata as Record<string, unknown> | undefined)?.execution_lifecycle,
          nextLifecycle,
        ),
        approvalDecision: {
          decision: input.decision,
          decidedAt,
          decidedBy: String(input.requestedBy || '').trim() || null,
          reason,
          previousStatus: input.action.status,
        },
      },
    };
  }

  private buildActionLifecycleRecord(input: {
    actionId: string;
    request: SystemOverlordActionRequest;
    status: SystemOverlordActionRecord['status'];
    decision: SystemOverlordActionRecord['decision'];
    command: string | null;
    workspace: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    createdAt: string;
    updatedAt: string;
    overrideStatus?: ZavorthExecutionLifecycleStatus;
    overrideKind?: 'approval' | 'execution';
    overrideSummary?: string | null;
  }): ExecutionLifecycleRecord {
    const metadata = input.request.metadata && typeof input.request.metadata === 'object'
      ? input.request.metadata as Record<string, unknown>
      : {};
    const kind = input.overrideKind || (this.isApprovalStatus(input.status) ? 'approval' : 'execution');
    const lifecycleStatus = input.overrideStatus || this.mapActionStatusToLifecycle(input.status);
    const sessionIdentity = metadata.surface_identity && typeof metadata.surface_identity === 'object'
      ? metadata.surface_identity as Record<string, unknown>
      : {};
    const summary = this.pickString([
      input.overrideSummary,
      input.errorMessage,
      input.decision.reason,
      input.command,
      `${kind} ${lifecycleStatus}`,
    ]) || `${kind} ${lifecycleStatus}`;
    const record = buildExecutionLifecycleRecord({
      kind,
      id: input.actionId,
      status: lifecycleStatus,
      correlation: {
        traceId: this.pickString([
          metadata.traceId,
          metadata.trace_id,
          metadata.runId,
          metadata.run_id,
          input.request.runId,
          input.actionId,
        ]) ?? undefined,
        runId: this.pickString([
          metadata.runId,
          metadata.run_id,
          input.request.runId,
          input.actionId,
        ]) ?? undefined,
        sessionId: this.pickString([
          metadata.sessionId,
          metadata.session_id,
          sessionIdentity.sessionId,
          sessionIdentity.session_id,
          null,
        ]) || null,
        approvalId: kind === 'approval'
          ? input.actionId
          : this.pickString([metadata.approvalId, metadata.approval_id]) || null,
        artifactId: this.pickString([metadata.artifactId, metadata.artifact_id]) || null,
      },
      summary,
      source: 'supervised-execution-gateway',
      surface: input.request.surface || null,
      parentId: input.request.runId || null,
      at: input.updatedAt,
      metadata: {
        actionStatus: input.status,
        capability: input.request.capability,
        runtimeTarget: input.decision.runtimeTarget,
        command: input.command,
        workspace: input.workspace,
        errorCode: input.errorCode,
      },
    });
    record.createdAt = input.createdAt;
    record.updatedAt = input.updatedAt;
    return record;
  }

  private appendLifecycleRecords(
    existing: unknown,
    nextRecord: ExecutionLifecycleRecord | null,
  ): ExecutionLifecycleRecord[] {
    const all = [
      ...(Array.isArray(existing) ? existing : []),
      ...(nextRecord ? [nextRecord] : []),
    ];
    const deduped = new Map<string, ExecutionLifecycleRecord>();
    for (const entry of all) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }
      const record = entry as ExecutionLifecycleRecord;
      const key = [
        record.kind,
        record.id,
        record.status,
        record.updatedAt || record.createdAt,
      ].join(':');
      deduped.set(key, record);
    }
    return Array.from(deduped.values()).slice(-20);
  }

  private isApprovalStatus(status: SystemOverlordActionRecord['status']): boolean {
    return status === 'pending_approval' || status === 'rejected';
  }

  private mapActionStatusToLifecycle(status: SystemOverlordActionRecord['status']): ZavorthExecutionLifecycleStatus {
    if (status === 'pending_approval') {
      return 'approval_required';
    }
    if (status === 'rejected' || status === 'blocked') {
      return 'blocked';
    }
    if (status === 'running') {
      return 'running';
    }
    if (status === 'completed') {
      return 'completed';
    }
    if (status === 'dry_run') {
      return 'planned';
    }
    if (status === 'cancelled' || status === 'failed' || status === 'timed_out') {
      return 'failed';
    }
    return 'received';
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
