import { Task } from '../../../../contracts/TaskContract.js';
import { WorkspaceResolver } from '../../../../security/WorkspaceResolver.js';
import {
  classifyWorkspaceTaskProfile,
  type WorkspaceTaskKind,
  type WorkspaceTaskSubtype,
} from '../../../../services/WorkspaceTaskKind.js';

interface GateDecisionEntry {
  action?: string;
  at?: string;
}

interface WorkspaceMemoryRecord {
  [key: string]: unknown;
}

export function workspaceMemoryTaskBelongsToWorkspace(task: Task, workspace: string): boolean {
  const taskWorkspace = String(task.workspace || '').trim();
  if (!taskWorkspace) {
    return false;
  }

  return WorkspaceResolver.resolve(taskWorkspace) === workspace;
}

export function classifyWorkspaceMemoryTaskProfile(task: Task): {
  kind: WorkspaceTaskKind;
  subtype: WorkspaceTaskSubtype;
} {
  const graphRun = toWorkspaceMemoryRecord(task.metadata?.autonomous_graph_last_run);
  const directRun = toWorkspaceMemoryRecord(task.metadata?.direct_response_last_run);
  const explicitKind = String(directRun.taskKind || graphRun.taskKind || '').trim().toLowerCase();
  const explicitSubtype = String(directRun.taskSubtype || graphRun.taskSubtype || '').trim().toLowerCase();
  if (explicitKind === 'code' || explicitKind === 'research' || explicitKind === 'design' || explicitKind === 'automation') {
    return {
      kind: explicitKind as WorkspaceTaskKind,
      subtype: explicitSubtype ? (explicitSubtype as WorkspaceTaskSubtype) : 'general',
    };
  }

  return classifyWorkspaceTaskProfile({
    commandType: task.command_type,
    text: graphRun.taskGoal || task.normalized_message || task.raw_message,
    intent: task.intent,
    executor: task.executor_used || task.command_type,
  });
}

export function getWorkspaceMemoryLearningExecutor(task: Task): string {
  const graphRun = toWorkspaceMemoryRecord(task.metadata?.autonomous_graph_last_run);
  const workspaceStrategy = toWorkspaceMemoryRecord(graphRun.workspaceStrategy);
  const preferredExecutor = String(
    workspaceStrategy.taskSubtypePreferredExecutor
    || workspaceStrategy.taskKindPreferredExecutor
    || workspaceStrategy.preferredExecutor
    || task.executor_used
    || task.command_type
    || 'unknown',
  ).trim().toLowerCase();

  return preferredExecutor || 'unknown';
}

export function isActiveWorkspaceMemoryTask(task: Task): boolean {
  return ['pending', 'parsed', 'planned', 'waiting_approval', 'approved', 'running', 'validating', 'delivery_pending']
    .includes(String(task.status || '').trim());
}

export function getWorkspaceMemoryLlmExecutionProfile(task: Task): {
  provider: string | null;
  model: string | null;
} {
  const directRun = toWorkspaceMemoryRecord(task.metadata?.direct_response_last_run);
  const graphRun = toWorkspaceMemoryRecord(task.metadata?.autonomous_graph_last_run);

  const provider = String(
    directRun.providerName
    || graphRun.providerName
    || '',
  ).trim();
  const model = String(
    directRun.modelName
    || graphRun.modelName
    || '',
  ).trim();

  const normalizedProvider = provider.toLowerCase() === 'aigateway'
    ? 'AIGateway'
    : provider.toLowerCase();

  return {
    provider: normalizedProvider || null,
    model: model || null,
  };
}

export function computeWorkspaceApprovalWaitMs(
  task: Task,
  approvalHistory: GateDecisionEntry[],
  permissionHistory: GateDecisionEntry[],
): number {
  const createdAtMs = Date.parse(String(task.created_at || ''));
  if (!Number.isFinite(createdAtMs)) {
    return 0;
  }

  const gateTimes = collectWorkspaceGateDecisionTimes(approvalHistory, permissionHistory);
  const pending =
    String(task.approval_status || '').trim().toLowerCase() === 'pending'
    || String(task.status || '').trim().toLowerCase() === 'waiting_approval'
    || Boolean(toWorkspaceMemoryRecord(task.metadata?.security_posture).pending_permission);
  const referenceMs = gateTimes[0]
    || (pending ? Date.parse(String(task.updated_at || '')) : NaN);
  if (!Number.isFinite(referenceMs)) {
    return 0;
  }

  return Math.max(0, Math.round(referenceMs - createdAtMs));
}

export function computeWorkspacePostApprovalRecoveryMs(
  task: Task,
  approvalHistory: GateDecisionEntry[],
  permissionHistory: GateDecisionEntry[],
): number {
  const gateTimes = collectWorkspaceGateDecisionTimes(approvalHistory, permissionHistory);
  const finalGateAt = gateTimes.length > 0 ? gateTimes[gateTimes.length - 1] : NaN;
  const finishedAtMs = Date.parse(String(task.updated_at || ''));
  const finalStatus = String(task.status || '').trim().toLowerCase();
  if (!Number.isFinite(finalGateAt) || !Number.isFinite(finishedAtMs) || finalStatus !== 'completed') {
    return 0;
  }

  return Math.max(0, Math.round(finishedAtMs - finalGateAt));
}

export function computeWorkspaceArtifactDeliveryAfterApprovalMs(
  task: Task,
  approvalHistory: GateDecisionEntry[],
  permissionHistory: GateDecisionEntry[],
): number {
  const gateTimes = collectWorkspaceGateDecisionTimes(approvalHistory, permissionHistory);
  const finalGateAt = gateTimes.length > 0 ? gateTimes[gateTimes.length - 1] : NaN;
  if (!Number.isFinite(finalGateAt)) {
    return 0;
  }

  const artifactTimes = collectWorkspaceArtifactTimes(task)
    .filter((value) => Number.isFinite(value) && value >= finalGateAt)
    .sort((left, right) => left - right);
  if (artifactTimes.length > 0) {
    return Math.max(0, Math.round(artifactTimes[0] - finalGateAt));
  }

  return 0;
}

export function collectWorkspaceGateDecisionTimes(approvalHistory: GateDecisionEntry[], permissionHistory: GateDecisionEntry[]): number[] {
  const timestamps = [
    ...approvalHistory
      .filter((entry) => String(entry?.action || '').trim().toLowerCase() === 'approve')
      .map((entry) => Date.parse(String(entry?.at || ''))),
    ...permissionHistory
      .filter((entry) => {
        const action = String(entry?.action || '').trim().toLowerCase();
        return action === 'grant' || action === 'approve';
      })
      .map((entry) => Date.parse(String(entry?.at || ''))),
  ]
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);

  return timestamps;
}

export function collectWorkspaceArtifactTimes(task: Task): number[] {
  return (Array.isArray(task.artifacts) ? task.artifacts : [])
    .map((artifact) => {
      const legacyCreatedAt = (artifact as { created_at?: unknown } | null | undefined)?.created_at;
      return Date.parse(String(legacyCreatedAt || artifact?.createdAt || ''));
    })
    .filter((value) => Number.isFinite(value));
}

export function formatWorkspaceMemoryDurationMs(value: number): string {
  const totalMs = Math.max(0, Math.round(Number(value || 0)));
  if (!totalMs) {
    return '0s';
  }
  const totalMinutes = Math.round(totalMs / 60000);
  if (totalMinutes < 1) {
    return `${Math.max(1, Math.round(totalMs / 1000))}s`;
  }
  if (totalMinutes < 60) {
    return `${totalMinutes}min`;
  }
  const hours = totalMinutes / 60;
  if (hours < 24) {
    return `${hours.toFixed(hours >= 10 ? 0 : 1)}h`;
  }
  const days = hours / 24;
  return `${days.toFixed(days >= 10 ? 0 : 1)}d`;
}

export function normalizeWorkspaceMemoryFailure(value: string): string {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 180) || 'falha sem resumo';
}

export function normalizeWorkspaceMemoryOutcomeSummary(value: string): string {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 220) || 'ciclo autonomo sem resumo';
}

export function toWorkspaceMemoryRecord(value: unknown): WorkspaceMemoryRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as WorkspaceMemoryRecord;
}

export function slugifyWorkspaceMemoryValue(value: string): string {
  return String(value || 'workspace')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'workspace';
}
