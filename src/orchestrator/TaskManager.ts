import { v4 as uuidv4 } from 'uuid';
import { ApprovalStatus, Task, TaskStatus } from '../contracts/TaskContract.js';
import { TelegramResponse } from '../contracts/TelegramResponse.js';
import { TaskRepository } from '../storage/TaskRepository.js';
import { LogRepository } from '../storage/LogRepository.js';
import { StateMachine } from './StateMachine.js';
import { ArtifactPipelineService } from '../runtime/artifacts/ArtifactPipelineService.js';
import { TaskSecurityPostureService } from '../services/TaskSecurityPostureService.js';

interface MetadataPatch {
  [key: string]: unknown;
}

interface StateHistoryEntry {
  from: string;
  to: string;
  at: string;
  reason: string | null;
  actor: string | null;
}

interface TransitionRecord {
  from: string;
  to: string;
  at: string;
  reason: string | null;
  actor: string | null;
}

interface HistoryEntry {
  action: string;
  [key: string]: unknown;
}

interface TaskMetadata {
  lifecycle?: {
    status?: string;
    updated_at?: string;
    previous_status?: string | null;
    [key: string]: unknown;
  };
  state_history?: StateHistoryEntry[];
  last_transition?: TransitionRecord | null;
  traceId?: string | null;
  trace_id?: string | null;
  runId?: string | null;
  run_id?: string | null;
  sessionId?: string | null;
  session_id?: string | null;
  approval_history?: HistoryEntry[];
  permission_history?: HistoryEntry[];
  auto_route_executor?: string | null;
  workspace_learned_route?: { executor?: string; source?: string; strategy?: string };
  route_executor_preference?: string | null;
  route_capability_id?: string | null;
  workflow_stage_executor?: string | null;
  workflow_name?: string | null;
  workspace_workflow_recommendation?: { workflow?: string };
  workflow_run_id?: string | null;
  route_task_kind?: string | null;
  route_task_subtype?: string | null;
  workflow_source_surface?: string | null;
  surface_platform?: string | null;
  auto_route_source?: string | null;
  workspace_routing_advice?: { source?: string; confidence?: number };
  auto_route_strategy?: string | null;
  route_dispatch_mode?: string | null;
  tenant_id?: string | null;
  tenant_context?: { tenant_id?: string };
  auto_route_confidence?: number;
  workspace_route_outcome?: WorkspaceRouteOutcome | null;
  [key: string]: unknown;
}

interface SecuritySnapshot {
  route_task_kind?: string | null;
  route_task_subtype?: string | null;
  requires_approval?: boolean;
  pending_permission?: boolean;
  high_risk_confirmation_required?: boolean;
  approval_history_count?: number;
  permission_history_count?: number;
  tenant_id?: string | null;
  active_controls?: unknown[];
  [key: string]: unknown;
}

interface WorkspaceRouteOutcome {
  selected_executor?: string | null;
  final_executor?: string | null;
  source?: string | null;
  strategy?: string | null;
  workflow_name?: string | null;
  workflow_run_id?: string | null;
  task_kind?: string | null;
  task_subtype?: string | null;
  source_surface?: string | null;
  tenant_id?: string | null;
  confidence?: number;
  approval_needed?: boolean;
  permission_needed?: boolean;
  requires_high_risk_pin?: boolean;
  approval_status?: string;
  final_status?: string;
  artifact_count?: number;
  approval_history_count?: number;
  permission_history_count?: number;
  approval_granted_count?: number;
  approval_rejected_count?: number;
  permission_granted_count?: number;
  permission_rejected_count?: number;
  gated_completion_count?: number;
  gated_artifactful_count?: number;
  high_risk_count?: number;
  duration_ms?: number;
  active_controls?: unknown[];
  updated_at?: string;
  [key: string]: unknown;
}

type AdvanceStateOptions = {
  reason?: string;
  actor?: string;
  metadataPatch?: MetadataPatch;
};

export class TaskManager {
  private taskRepo: TaskRepository;
  private logRepo: LogRepository;
  private artifactPipeline: ArtifactPipelineService;
  private taskSecurityPosture: TaskSecurityPostureService;

  constructor(taskRepo: TaskRepository, logRepo: LogRepository) {
    this.taskRepo = taskRepo;
    this.logRepo = logRepo;
    this.artifactPipeline = new ArtifactPipelineService();
    this.taskSecurityPosture = new TaskSecurityPostureService();
  }

  public createPendingTask(
    chat_id: string,
    user_id: string,
    raw_message: string,
    normalized_message: string,
    command_type: string,
    source: Task['source'] = 'telegram',
    metadataPatch: MetadataPatch = {},
  ): Task {
    const task: Task = {
      task_id: uuidv4(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      source,
      chat_id,
      user_id,
      raw_message,
      normalized_message,
      command_type,
      intent: 'unknown',
      target: null,
      workspace: null,
      risk_level: 0,
      status: 'pending',
      requires_planning: false,
      requires_approval: false,
      approval_status: 'not_required',
      planner_used: null,
      executor_used: null,
      fallback_used: false,
      parent_task_id: null,
      actions_planned: [],
      actions_executed: [],
      target_files: [],
      artifacts: [],
      stdout_summary: null,
      stderr_summary: null,
      diff_summary: null,
      result_summary: null,
      error_summary: null,
      rollback_available: false,
      metadata: {
        lifecycle: StateMachine.buildLifecycleSnapshot('pending', new Date().toISOString()),
        ...(metadataPatch || {}),
      }
    };

    this.saveTask(task);
    this.logRepo.log('info', 'TaskManager', `Tarefa criada: ${task.task_id}`);
    return task;
  }

  public advanceState(task: Task, nextStatus: TaskStatus, options: AdvanceStateOptions = {}): void {
    const oldStatus = task.status;
    const resolvedStatus = StateMachine.transition(oldStatus, nextStatus);
    const changed = oldStatus !== resolvedStatus;
    const now = new Date().toISOString();
    task.status = resolvedStatus;
    task.updated_at = now;
    task.approval_status = this.resolveApprovalStatus(task, oldStatus, resolvedStatus);
    task.metadata = this.buildLifecycleMetadata(task, oldStatus, resolvedStatus, now, changed, options);
    this.saveTask(task);
    const reasonSuffix = options.reason ? ` | motivo: ${options.reason}` : '';
    this.logRepo.log('info', 'StateMachine', `Task ${task.task_id} transitioned: ${oldStatus} -> ${task.status}${reasonSuffix}`);
  }

  public processStatusQuery(): TelegramResponse {
    return {
      response_id: uuidv4(),
      task_id: null,
      chat_id: '',
      response_type: 'status',
      title: 'Status do Sistema',
      message: 'Zavorth V2 Online.\\nMódulos Core Operacionais.',
      short_summary: 'Online',
      attachments: [],
      requires_user_action: false,
      suggested_commands: []
    };
  }

  public getTask(taskId: string): Task | undefined {
    return this.taskRepo.getById(taskId);
  }

  public getPendingTasks(): Task[] {
    return this.taskRepo.getPendingTasks();
  }

  public claimNextTaskByCommands(
    commandTypes: string[],
    statuses: TaskStatus[],
    workerId: string,
    staleAfterMs: number,
  ): Task | undefined {
    return this.taskRepo.claimNextTaskByCommands(commandTypes, statuses, workerId, staleAfterMs);
  }

  public getRecentTasks(limit: number = 10, userId?: string): Task[] {
    return this.taskRepo.getRecentTasks(limit, userId);
  }

  public getRecentTasksByUsers(userIds: string[], limit: number = 10): Task[] {
    return this.taskRepo.getRecentTasksByUsers(userIds, limit);
  }

  public getRecentTasksByUsersAndTenant(userIds: string[], tenantId: string, limit: number = 10): Task[] {
    return this.taskRepo.getRecentTasksByUsersAndTenant(userIds, tenantId, limit);
  }

  public getRecentTasksByChat(chatId: string, limit: number = 20): Task[] {
    return this.taskRepo.getRecentTasksByChat(chatId, limit);
  }

  public getLatestTaskForUser(userId: string, excludeTaskId?: string): Task | undefined {
    return this.taskRepo.getLatestTaskForUser(userId, excludeTaskId);
  }

  public getLatestTaskForUsers(userIds: string[], excludeTaskId?: string): Task | undefined {
    return this.taskRepo.getLatestTaskForUsers(userIds, excludeTaskId);
  }

  public getLatestTaskForUsersAndTenant(
    userIds: string[],
    tenantId: string,
    excludeTaskId?: string,
  ): Task | undefined {
    return this.taskRepo.getLatestTaskForUsersAndTenant(userIds, tenantId, excludeTaskId);
  }

  public saveTask(task: Task): void {
    const prepared = this.prepareTaskForPersistence(task);
    Object.assign(task, prepared);
    this.taskRepo.save(prepared);
  }

  private resolveApprovalStatus(task: Task, oldStatus: TaskStatus, nextStatus: TaskStatus): ApprovalStatus {
    if (nextStatus === 'waiting_approval') {
      task.requires_approval = true;
      return 'pending';
    }

    if (nextStatus === 'approved') {
      return 'approved';
    }

    if (nextStatus === 'rejected') {
      task.requires_approval = false;
      return 'rejected';
    }

    if (oldStatus === 'waiting_approval' && nextStatus === 'running') {
      task.requires_approval = false;
      return 'approved';
    }

    if (
      oldStatus === 'waiting_approval' &&
      ['failed', 'cancelled'].includes(nextStatus) &&
      task.approval_status === 'pending'
    ) {
      task.requires_approval = false;
      return 'expired';
    }

    return task.approval_status;
  }

  private buildLifecycleMetadata(
    task: Task,
    oldStatus: TaskStatus,
    nextStatus: TaskStatus,
    changedAt: string,
    changed: boolean,
    options: AdvanceStateOptions,
  ): TaskMetadata {
    const previousMetadata = (task.metadata || {}) as TaskMetadata;
    const currentHistory = Array.isArray(previousMetadata.state_history)
      ? previousMetadata.state_history.filter((entry: StateHistoryEntry | null) => Boolean(entry))
      : [];

    const nextHistory = changed
      ? [
          ...currentHistory,
          {
            from: oldStatus,
            to: nextStatus,
            at: changedAt,
            reason: options.reason || null,
            actor: options.actor || null,
          },
        ].slice(-30)
      : currentHistory;

    return {
      ...previousMetadata,
      ...(options.metadataPatch || {}),
      lifecycle: {
        ...StateMachine.buildLifecycleSnapshot(nextStatus, changedAt),
        previous_status: oldStatus,
      },
      last_transition: changed
        ? {
            from: oldStatus,
            to: nextStatus,
            at: changedAt,
            reason: options.reason || null,
            actor: options.actor || null,
          }
        : previousMetadata.last_transition || null,
      state_history: nextHistory,
    };
  }

  private prepareTaskForPersistence(task: Task): Task {
    const artifacts = this.artifactPipeline.normalizeArtifacts(
      Array.isArray(task.artifacts) ? task.artifacts : [],
      task.executor_used || task.planner_used || 'task',
    );
    const metadata = task.metadata || {};
    const lifecycleUpdatedAt = String(
      metadata?.lifecycle?.updated_at ||
      task.updated_at ||
      task.created_at ||
      new Date().toISOString(),
    );
    const securitySnapshot = this.taskSecurityPosture.buildSnapshot({
      ...task,
      artifacts,
      metadata,
    });
    const workspaceRouteOutcome = this.normalizeWorkspaceRouteOutcome(task, metadata, artifacts, securitySnapshot);

    return {
      ...task,
      artifacts,
      metadata: {
        ...metadata,
        lifecycle: {
          ...StateMachine.buildLifecycleSnapshot(task.status, lifecycleUpdatedAt),
          previous_status: metadata?.lifecycle?.previous_status || null,
        },
        artifacts_manifest: this.artifactPipeline.buildManifest(artifacts, {
          traceId: metadata.traceId || metadata.trace_id || null,
          runId: metadata.runId || metadata.run_id || task.task_id,
          sessionId: metadata.sessionId || metadata.session_id || task.chat_id || null,
          taskId: task.task_id,
          surface: task.source,
          source: task.executor_used || task.planner_used || 'task',
        }),
        artifact_paths: this.artifactPipeline.extractLocalPaths(artifacts),
        security_posture: securitySnapshot,
        security_summary: this.taskSecurityPosture.buildSummary(securitySnapshot),
        workspace_route_outcome: workspaceRouteOutcome,
      },
    };
  }

  private normalizeWorkspaceRouteOutcome(
    task: Task,
    metadata: TaskMetadata,
    artifacts: Task['artifacts'],
    securitySnapshot: SecuritySnapshot,
  ): WorkspaceRouteOutcome | null {
    const previous = this.toRecord(metadata.workspace_route_outcome) as WorkspaceRouteOutcome;
    const approvalHistory = Array.isArray(metadata.approval_history) ? metadata.approval_history : [];
    const permissionHistory = Array.isArray(metadata.permission_history) ? metadata.permission_history : [];
    const selectedExecutor = this.normalizeNullableString(
      previous.selected_executor
      || metadata.auto_route_executor
      || metadata.workspace_learned_route?.executor
      || metadata.route_executor_preference
      || metadata.route_capability_id,
    );
    const finalExecutor = this.normalizeNullableString(
      task.executor_used
      || metadata.workflow_stage_executor
      || previous.final_executor
      || selectedExecutor,
    );
    const workflowName = this.normalizeNullableString(
      previous.workflow_name
      || metadata.workflow_name
      || metadata.workspace_workflow_recommendation?.workflow
      || (selectedExecutor && selectedExecutor.startsWith('workflow:')
        ? selectedExecutor.replace(/^workflow:/, '').trim()
        : ''),
    );
    const workflowRunId = this.normalizeNullableString(previous.workflow_run_id || metadata.workflow_run_id);
    const taskKind = this.normalizeNullableString(previous.task_kind || securitySnapshot.route_task_kind || metadata.route_task_kind);
    const taskSubtype = this.normalizeNullableString(previous.task_subtype || securitySnapshot.route_task_subtype || metadata.route_task_subtype);
    const sourceSurface = this.normalizeNullableString(
      previous.source_surface
      || metadata.workflow_source_surface
      || metadata.surface_platform
      || task.source,
    );
    const source = this.normalizeNullableString(
      previous.source
      || metadata.auto_route_source
      || metadata.workspace_learned_route?.source
      || metadata.workspace_routing_advice?.source
      || (workflowRunId ? 'workflow_run' : task.source),
    );
    const strategy = this.normalizeNullableString(
      previous.strategy
      || metadata.auto_route_strategy
      || metadata.workspace_learned_route?.strategy
      || metadata.route_dispatch_mode
      || (workflowRunId ? 'workflow_resume' : null),
    );
    const tenantId = this.normalizeNullableString(
      previous.tenant_id
      || securitySnapshot.tenant_id
      || metadata.tenant_id
      || metadata.tenant_context?.tenant_id,
    );
    const createdAt = Date.parse(String(task.created_at || ''));
    const updatedAt = Date.parse(String(task.updated_at || task.created_at || ''));
    const durationMs = Number.isFinite(createdAt) && Number.isFinite(updatedAt)
      ? Math.max(0, updatedAt - createdAt)
      : Math.max(0, Number(previous.duration_ms || 0));
    const approvalRejectedCount = approvalHistory.filter((entry: HistoryEntry) => String(entry?.action || '').trim() === 'reject').length;
    const approvalGrantedCount = approvalHistory.filter((entry: HistoryEntry) => String(entry?.action || '').trim().toLowerCase() === 'approve').length;
    const permissionGrantedCount = permissionHistory.filter((entry: HistoryEntry) => {
      const action = String(entry?.action || '').trim().toLowerCase();
      return action === 'grant' || action === 'approve';
    }).length;
    const permissionRejectedCount = permissionHistory.filter((entry: HistoryEntry) => {
      const action = String(entry?.action || '').trim().toLowerCase();
      return action === 'reject' || action === 'deny';
    }).length;
    const highRiskCount = securitySnapshot.high_risk_confirmation_required === true
      ? Math.max(1, Number(previous.high_risk_count || 0))
      : Math.max(0, Number(previous.high_risk_count || 0));
    const finalStatus = String(task.status || previous.final_status || 'pending').trim().toLowerCase();
    const artifactCount = Array.isArray(artifacts) ? artifacts.length : 0;
    const gatedFlow =
      Boolean(previous.approval_needed ?? securitySnapshot.requires_approval ?? task.requires_approval)
      || Boolean(previous.permission_needed ?? securitySnapshot.pending_permission)
      || approvalGrantedCount > 0
      || permissionGrantedCount > 0;
    const gatedCompletionCount = gatedFlow && finalStatus === 'completed'
      ? 1
      : Math.max(0, Number(previous.gated_completion_count || 0));
    const gatedArtifactfulCount = gatedCompletionCount > 0 && artifactCount > 0
      ? 1
      : Math.max(0, Number(previous.gated_artifactful_count || 0));

    if (!selectedExecutor && !finalExecutor && !workflowRunId && !taskKind && !taskSubtype) {
      return Object.keys(previous).length > 0 ? previous : null;
    }

    return {
      ...previous,
      selected_executor: selectedExecutor,
      final_executor: finalExecutor,
      source,
      strategy,
      workflow_name: workflowName,
      workflow_run_id: workflowRunId,
      task_kind: taskKind,
      task_subtype: taskSubtype,
      source_surface: sourceSurface,
      tenant_id: tenantId,
      confidence: Number(previous.confidence || metadata.auto_route_confidence || metadata.workspace_routing_advice?.confidence || 0),
      approval_needed: Boolean(previous.approval_needed ?? securitySnapshot.requires_approval ?? task.requires_approval),
      permission_needed: Boolean(previous.permission_needed ?? securitySnapshot.pending_permission),
      requires_high_risk_pin: Boolean(
        previous.requires_high_risk_pin ?? securitySnapshot.high_risk_confirmation_required,
      ),
      approval_status: String(task.approval_status || previous.approval_status || 'not_required'),
      final_status: finalStatus,
      artifact_count: artifactCount,
      approval_history_count: Math.max(0, Number(securitySnapshot.approval_history_count || previous.approval_history_count || 0)),
      permission_history_count: Math.max(0, Number(securitySnapshot.permission_history_count || previous.permission_history_count || 0)),
      approval_granted_count: Math.max(approvalGrantedCount, Number(previous.approval_granted_count || 0)),
      approval_rejected_count: Math.max(approvalRejectedCount, Number(previous.approval_rejected_count || 0)),
      permission_granted_count: Math.max(permissionGrantedCount, Number(previous.permission_granted_count || 0)),
      permission_rejected_count: Math.max(permissionRejectedCount, Number(previous.permission_rejected_count || 0)),
      gated_completion_count: gatedCompletionCount,
      gated_artifactful_count: gatedArtifactfulCount,
      high_risk_count: highRiskCount,
      duration_ms: durationMs,
      active_controls: Array.isArray(securitySnapshot.active_controls) ? securitySnapshot.active_controls : [],
      updated_at: task.updated_at || task.created_at || new Date().toISOString(),
    };
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private normalizeNullableString(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
  }
}
