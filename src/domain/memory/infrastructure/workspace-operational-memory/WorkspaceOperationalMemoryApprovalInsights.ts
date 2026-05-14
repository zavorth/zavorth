import type { Task } from '../../../../contracts/TaskContract.js';
import type {
  ApprovalFrictionAggregate,
  MutableApprovalFrictionAggregate,
} from './WorkspaceOperationalMemoryTypes.js';
import {
  computeWorkspaceApprovalWaitMs,
  computeWorkspacePostApprovalRecoveryMs,
  formatWorkspaceMemoryDurationMs,
  getWorkspaceMemoryLearningExecutor,
  toWorkspaceMemoryRecord,
} from './WorkspaceOperationalMemoryTaskUtilities.js';
import { classifyWorkspaceMemoryTaskProfile } from './WorkspaceOperationalMemoryTaskUtilities.js';

function computeApprovalFrictionWeight(aggregate: Pick<
  ApprovalFrictionAggregate,
  | 'rejected_count'
  | 'high_risk_count'
  | 'permission_count'
  | 'pending_count'
  | 'granted_count'
  | 'delivered_after_approval_count'
>): number {
  return (
    aggregate.rejected_count * 3
    + aggregate.high_risk_count * 2
    + aggregate.permission_count
    + aggregate.pending_count
    - aggregate.granted_count
    - aggregate.delivered_after_approval_count * 2
  );
}

function buildApprovalFrictionRationale(bucket: MutableApprovalFrictionAggregate): string {
  const averageWaitMs = bucket.wait_samples > 0
    ? Math.round(bucket.wait_total_ms / bucket.wait_samples)
    : 0;
  const averageRecoveryMs = bucket.recovery_samples > 0
    ? Math.round(bucket.recovery_total_ms / bucket.recovery_samples)
    : 0;

  return [
    bucket.rejected_count ? `${bucket.rejected_count} rejeicao(oes)` : null,
    bucket.pending_count ? `${bucket.pending_count} espera(s) de confirmacao` : null,
    bucket.high_risk_count ? `${bucket.high_risk_count} gate(s) de alto risco` : null,
    bucket.permission_count ? `${bucket.permission_count} pedido(s) de permissao` : null,
    bucket.granted_count ? `${bucket.granted_count} liberacao(oes) concluida(s)` : null,
    bucket.delivered_after_approval_count ? `${bucket.delivered_after_approval_count} entrega(s) apos aprovacao` : null,
    averageWaitMs > 0 ? `espera media ${formatWorkspaceMemoryDurationMs(averageWaitMs)}` : null,
    averageRecoveryMs > 0 ? `retomada media ${formatWorkspaceMemoryDurationMs(averageRecoveryMs)}` : null,
  ].filter(Boolean).join(', ');
}

function buildApprovalFrictionAggregate(bucket: MutableApprovalFrictionAggregate): ApprovalFrictionAggregate {
  const weight = computeApprovalFrictionWeight(bucket);
  return {
    executor: bucket.executor,
    kind: bucket.kind,
    subtype: bucket.subtype,
    pending_count: bucket.pending_count,
    rejected_count: bucket.rejected_count,
    high_risk_count: bucket.high_risk_count,
    permission_count: bucket.permission_count,
    granted_count: bucket.granted_count,
    delivered_after_approval_count: bucket.delivered_after_approval_count,
    average_wait_ms: bucket.wait_samples > 0 ? Math.round(bucket.wait_total_ms / bucket.wait_samples) : 0,
    average_recovery_ms: bucket.recovery_samples > 0 ? Math.round(bucket.recovery_total_ms / bucket.recovery_samples) : 0,
    last_seen_at: bucket.last_seen_at,
    confidence: weight >= 5 ? 'high' : weight >= 3 ? 'medium' : 'low',
    rationale: buildApprovalFrictionRationale(bucket),
  };
}

export function buildApprovalFrictionRecommendations(tasks: Task[]): ApprovalFrictionAggregate[] {
  const buckets = new Map<string, MutableApprovalFrictionAggregate>();

  for (const task of tasks) {
    const metadata = toWorkspaceMemoryRecord(task.metadata);
    const posture = toWorkspaceMemoryRecord(metadata.security_posture);
    const approvalHistory = Array.isArray(metadata.approval_history) ? metadata.approval_history : [];
    const permissionHistory = Array.isArray(metadata.permission_history) ? metadata.permission_history : [];
    const profile = classifyWorkspaceMemoryTaskProfile(task);
    const executor = getWorkspaceMemoryLearningExecutor(task);

    const pendingCount =
      task.approval_status === 'pending' || task.status === 'waiting_approval'
        ? 1
        : 0;
    const rejectedCount = approvalHistory.filter((entry: any) => String(entry?.action || '').trim() === 'reject').length
      + (task.approval_status === 'rejected' ? 1 : 0);
    const approvalGrantedCount = approvalHistory.filter((entry: any) => {
      return String(entry?.action || '').trim().toLowerCase() === 'approve';
    }).length;
    const permissionGrantedCount = permissionHistory.filter((entry: any) => {
      const action = String(entry?.action || '').trim().toLowerCase();
      return action === 'grant' || action === 'approve';
    }).length;
    const highRiskCount =
      posture.high_risk_confirmation_required === true
      || approvalHistory.some((entry: any) => entry?.required_high_risk_pin === true)
        ? 1
        : 0;
    const permissionCount =
      Number(posture.permission_history_count || 0) > 0
      || posture.pending_permission === true
      || permissionHistory.length > 0
        ? Math.max(1, Number(posture.permission_history_count || permissionHistory.length || 0))
        : 0;
    const grantedCount = approvalGrantedCount + permissionGrantedCount;
    const deliveredAfterApprovalCount =
      grantedCount > 0
      && String(task.status || '').trim().toLowerCase() === 'completed'
      && (Array.isArray(task.artifacts) ? task.artifacts.length : 0) > 0
        ? 1
        : 0;
    const approvalWaitMs = computeWorkspaceApprovalWaitMs(task, approvalHistory, permissionHistory);
    const recoveryMs = computeWorkspacePostApprovalRecoveryMs(task, approvalHistory, permissionHistory);

    if (pendingCount + rejectedCount + highRiskCount + permissionCount + grantedCount + deliveredAfterApprovalCount <= 0) {
      continue;
    }

    const key = `${executor}::${profile.kind}::${profile.subtype}`;
    const bucket = buckets.get(key) || {
      executor,
      kind: profile.kind,
      subtype: profile.subtype,
      pending_count: 0,
      rejected_count: 0,
      high_risk_count: 0,
      permission_count: 0,
      granted_count: 0,
      delivered_after_approval_count: 0,
      average_wait_ms: 0,
      average_recovery_ms: 0,
      last_seen_at: task.updated_at,
      wait_total_ms: 0,
      wait_samples: 0,
      recovery_total_ms: 0,
      recovery_samples: 0,
      confidence: 'low',
      rationale: '',
    } satisfies MutableApprovalFrictionAggregate;

    bucket.pending_count += pendingCount;
    bucket.rejected_count += rejectedCount;
    bucket.high_risk_count += highRiskCount;
    bucket.permission_count += permissionCount;
    bucket.granted_count += grantedCount;
    bucket.delivered_after_approval_count += deliveredAfterApprovalCount;
    if (approvalWaitMs > 0) {
      bucket.wait_total_ms += approvalWaitMs;
      bucket.wait_samples += 1;
    }
    if (recoveryMs > 0) {
      bucket.recovery_total_ms += recoveryMs;
      bucket.recovery_samples += 1;
    }
    if (task.updated_at > bucket.last_seen_at) {
      bucket.last_seen_at = task.updated_at;
    }

    buckets.set(key, bucket);
  }

  return Array.from(buckets.values())
    .map((bucket) => buildApprovalFrictionAggregate(bucket))
    .sort((left, right) => {
      return (
        computeApprovalFrictionWeight(right) - computeApprovalFrictionWeight(left)
        || right.last_seen_at.localeCompare(left.last_seen_at)
      );
    })
    .slice(0, 8);
}
