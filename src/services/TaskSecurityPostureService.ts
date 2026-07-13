import { Task } from '../contracts/TaskContract.js';

type ApprovalDecisionEntry = {
  action: 'approve' | 'reject';
  actor: string | null;
  at: string;
  reason?: string | null;
  required_high_risk_pin?: boolean;
  source?: string | null;
  permissionChoice?: string | null;
  permissionScope?: string | null;
};

type PermissionDecisionEntry = {
  permission_id: string;
  action: 'approve' | 'reject' | 'grant' | 'revoke';
  actor: string | null;
  at: string;
  executor: string;
  kind: string;
  scope: string | null;
  value: string | null;
  source?: string | null;
};

export type TaskSecurityPosture = {
  current_status: string;
  lifecycle_stage: string | null;
  risk_level: number;
  risk_band: 'low' | 'moderate' | 'high';
  requires_approval: boolean;
  approval_status: string;
  high_risk_confirmation_required: boolean;
  pending_permission: boolean;
  pending_permission_id: string | null;
  route_task_kind: string | null;
  route_task_subtype: string | null;
  route_executor: string | null;
  learned_executor: string | null;
  learned_strategy: string | null;
  tenant_id: string | null;
  tenant_isolation_mode: string | null;
  tenant_policy_profile: string | null;
  allowed_path_policy_count: number;
  allowed_command_policy_count: number;
  approval_history_count: number;
  permission_history_count: number;
  active_controls: string[];
};

export class TaskSecurityPostureService {
  public buildSnapshot(task: Task): TaskSecurityPosture {
    const metadata = task.metadata || {};
    const allowedPathPolicies = Array.isArray(metadata.extra_allowed_path_policies)
      ? metadata.extra_allowed_path_policies
      : [];
    const allowedCommandPolicies = Array.isArray(metadata.extra_allowed_command_policies)
      ? metadata.extra_allowed_command_policies
      : [];
    const approvalHistory = Array.isArray(metadata.approval_history)
      ? metadata.approval_history
      : [];
    const permissionHistory = Array.isArray(metadata.permission_history)
      ? metadata.permission_history
      : [];

    const activeControls: string[] = [];
    if (Number(task.risk_level || 0) >= 3) {
      activeControls.push('high_risk_gate');
    }
    if (Boolean(task.requires_approval) || String(task.approval_status || '') === 'pending') {
      activeControls.push('manual_approval');
    }
    if (Boolean(metadata.pendingPermissionId)) {
      activeControls.push('permission_request');
    }
    if (allowedPathPolicies.length > 0) {
      activeControls.push('scoped_path_access');
    }
    if (allowedCommandPolicies.length > 0) {
      activeControls.push('scoped_command_access');
    }
    if (Boolean(metadata.requiresHighRiskPin)) {
      activeControls.push('pin_or_totp');
    }
    if (String(metadata.tenant_context?.isolation_mode || metadata.tenant_isolation_mode || '').trim() === 'tenant') {
      activeControls.push('tenant_isolation');
    }

    return {
      current_status: task.status,
      lifecycle_stage: String(metadata?.lifecycle?.phase || '').trim() || null,
      risk_level: Number(task.risk_level || 0),
      risk_band: this.resolveRiskBand(task.risk_level),
      requires_approval: Boolean(task.requires_approval),
      approval_status: String(task.approval_status || 'not_required'),
      high_risk_confirmation_required: Boolean(metadata.requiresHighRiskPin) || Number(task.risk_level || 0) >= 3,
      pending_permission: Boolean(metadata.pendingPermissionId),
      pending_permission_id: String(metadata.pendingPermissionId || '').trim() || null,
      route_task_kind: String(metadata.route_task_kind || '').trim() || null,
      route_task_subtype: String(metadata.route_task_subtype || '').trim() || null,
      route_executor: String(metadata.route_executor_preference || metadata.route_capability_id || '').trim() || null,
      learned_executor: String(metadata.auto_route_executor || metadata.workspace_learned_route?.executor || '').trim() || null,
      learned_strategy: String(metadata.auto_route_strategy || metadata.workspace_learned_route?.strategy || '').trim() || null,
      tenant_id: String(metadata.tenant_id || metadata.tenant_context?.tenant_id || '').trim() || null,
      tenant_isolation_mode: String(metadata.tenant_context?.isolation_mode || '').trim() || null,
      tenant_policy_profile: String(metadata.tenant_context?.policy_profile || '').trim() || null,
      allowed_path_policy_count: allowedPathPolicies.length,
      allowed_command_policy_count: allowedCommandPolicies.length,
      approval_history_count: approvalHistory.length,
      permission_history_count: permissionHistory.length,
      active_controls: activeControls,
    };
  }

  public buildSummary(snapshot: TaskSecurityPosture): string {
    const parts = [
      `risco ${snapshot.risk_band} (${snapshot.risk_level})`,
      snapshot.requires_approval || snapshot.approval_status === 'pending'
        ? `aprovacao ${snapshot.approval_status}`
        : 'sem aprovacao pendente',
      snapshot.pending_permission ? 'com permissao pendente' : null,
      snapshot.learned_executor ? `executor sugerido ${snapshot.learned_executor}` : null,
      snapshot.allowed_path_policy_count > 0 ? `${snapshot.allowed_path_policy_count} regra(s) de caminho` : null,
      snapshot.allowed_command_policy_count > 0 ? `${snapshot.allowed_command_policy_count} regra(s) de comando` : null,
    ].filter(Boolean);

    return parts.join(' | ');
  }

  public appendApprovalDecision(metadata: Record<string, any> | undefined, entry: ApprovalDecisionEntry): Record<string, any> {
    const nextMetadata = { ...(metadata || {}) };
    const history = Array.isArray(nextMetadata.approval_history)
      ? nextMetadata.approval_history.filter((value: unknown) => Boolean(value))
      : [];

    nextMetadata.approval_history = [...history, entry].slice(-20);
    nextMetadata.last_approval_decision = entry;
    return nextMetadata;
  }

  public appendPermissionDecision(metadata: Record<string, any> | undefined, entry: PermissionDecisionEntry): Record<string, any> {
    const nextMetadata = { ...(metadata || {}) };
    const history = Array.isArray(nextMetadata.permission_history)
      ? nextMetadata.permission_history.filter((value: unknown) => Boolean(value))
      : [];

    nextMetadata.permission_history = [...history, entry].slice(-30);
    nextMetadata.last_permission_decision = entry;
    return nextMetadata;
  }

  private resolveRiskBand(riskLevel: number): 'low' | 'moderate' | 'high' {
    if (Number(riskLevel || 0) >= 3) {
      return 'high';
    }
    if (Number(riskLevel || 0) >= 2) {
      return 'moderate';
    }
    return 'low';
  }
}
