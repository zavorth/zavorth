import type { PermissionRequest } from '../../contracts/PermissionRequest.js';
import type { MessageChannel } from '../../contracts/PlatformContract.js';
import type { Task } from '../../contracts/core/TaskContract.js';
import type { SessionContinuitySnapshot } from '../../runtime/context/SessionContinuityService.js';
import { mergeWorkflowRunIntoWorkspaceContinuityContext } from '../../runtime/context/WorkspaceContinuityContext.js';
import type { WorkflowRunSnapshot } from '../../runtime/workflows/WorkflowRunService.js';
import { SurfaceIdentityService } from '../SurfaceIdentityService.js';
import type { ExecutionLifecycleLinkService, ExecutionLifecycleContextLink } from '../ExecutionLifecycleLinkService.js';
import type { ToolRunRecord } from '../ToolRunRecordService.js';
import type {
  GatewaySessionListEntry,
  GatewaySessionListSnapshot,
  GatewaySessionPermissionSnapshot,
  GatewaySessionSnapshot,
  GatewaySessionTaskSnapshot,
} from '../GatewaySessionService.js';

type TaskManagerLike = {
  getRecentTasks?(limit?: number, userId?: string): Task[];
  getRecentTasksByChat(chatId: string, limit?: number): Task[];
  getRecentTasksByUsers?(userIds: string[], limit?: number): Task[];
};

type PermissionServiceLike = {
  listRequests(
    status?: 'pending' | 'approved' | 'rejected' | 'expired' | 'all',
    limit?: number,
  ): Promise<PermissionRequest[]>;
};

type WorkflowRunListInput = {
  workspace?: string | null;
  limit?: number;
  statuses?: WorkflowRunSnapshot['status'][];
};

type WorkflowRunReader = {
  getRun(workflowRunId: string): WorkflowRunSnapshot | null;
  listRuns(input?: WorkflowRunListInput): WorkflowRunSnapshot[];
};

export type GatewaySessionSnapshotSupportDeps = {
  taskManager: TaskManagerLike;
  permissionService: PermissionServiceLike | null;
  surfaceIdentity: SurfaceIdentityService;
  workflowRuns: WorkflowRunReader;
  lifecycleLinks: ExecutionLifecycleLinkService;
};

export class GatewaySessionSnapshotSupport {
  public constructor(private readonly deps: GatewaySessionSnapshotSupportDeps) {}

  public buildSessionListIndex(input: {
    userId: string;
    limit?: number;
  }): {
    runtimeUserId: string;
    grouped: Map<string, Task[]>;
    orderedChatIds: string[];
  } {
    const runtimeUserId = String(input.userId || '').trim();
    const limit = Math.max(1, Math.min(Number(input.limit || 8), 24));
    const tasks = this.getRecentUserTasks(runtimeUserId, limit * 6);
    const grouped = new Map<string, Task[]>();

    for (const task of tasks) {
      const chatId = String(task?.chat_id || '').trim();
      if (!chatId) {
        continue;
      }
      const bucket = grouped.get(chatId) || [];
      bucket.push(task);
      grouped.set(chatId, bucket);
    }

    const orderedChatIds = Array.from(grouped.entries())
      .sort((left, right) => {
        const rightTime = this.getTimestamp(right[1][0]?.updated_at);
        const leftTime = this.getTimestamp(left[1][0]?.updated_at);
        return rightTime - leftTime;
      })
      .slice(0, limit)
      .map(([chatId]) => chatId);

    return {
      runtimeUserId,
      grouped,
      orderedChatIds,
    };
  }

  public buildListEntry(snapshot: GatewaySessionSnapshot): GatewaySessionListEntry {
    const latestTask = snapshot.tasks[0] || null;
    const suggestedEntryKind = snapshot.replay?.recommendedEntry?.kind || 'fresh';
    return {
      id: snapshot.sessionId || snapshot.chatId,
      chatId: snapshot.chatId,
      sessionId: snapshot.sessionId,
      platform: snapshot.platform,
      runtimeUserId: snapshot.runtimeUserId,
      sourceUserId: snapshot.sourceUserId,
      label: this.buildSessionLabel(snapshot),
      pinned: snapshot.metadata.pinned,
      modelProfile: snapshot.metadata.modelProfile,
      latestTaskLabel:
        snapshot.handoff?.canonicalTarget?.label
        || snapshot.replay?.headline
        || 'Sessao sem headline registrada.',
      latestTaskId: latestTask?.task_id || null,
      latestStatus: latestTask?.status || null,
      taskCount: snapshot.tasks.length,
      hasPendingPermissions: snapshot.permissions.some((permission) => permission.status === 'pending'),
      updatedAt: snapshot.metadata.updatedAt || latestTask?.updated_at || null,
      workspace:
        snapshot.metadata.workspaceHint
        || latestTask?.workspace
        || snapshot.continuity?.focusTask?.workspace
        || null,
      suggestedEntryKind,
      handoffCommand: snapshot.handoff?.handoffCommand || '/task',
    };
  }

  public buildListSnapshot(input: {
    generatedAt: string;
    runtimeUserId: string;
    grouped: Map<string, Task[]>;
    entries: GatewaySessionListEntry[];
  }): GatewaySessionListSnapshot {
    return {
      generatedAt: input.generatedAt,
      runtimeUserId: input.runtimeUserId,
      total: input.grouped.size,
      entries: input.entries,
    };
  }

  public async resolvePermissions(
    tasks: GatewaySessionTaskSnapshot[],
  ): Promise<GatewaySessionPermissionSnapshot[]> {
    if (!this.deps.permissionService || tasks.length === 0) {
      return [];
    }

    const taskIds = new Set(tasks.map((task) => task.task_id).filter(Boolean));
    const permissions = await this.deps.permissionService
      .listRequests('pending', 100)
      .catch(() => [] as PermissionRequest[]);

    return permissions
      .filter((permission) => permission.task_id && taskIds.has(permission.task_id))
      .map((permission) => this.serializePermission(permission))
      .sort((left, right) => this.getTimestamp(right.updated_at) - this.getTimestamp(left.updated_at));
  }

  public resolveWorkflowRuns(
    tasks: GatewaySessionTaskSnapshot[],
    continuity: SessionContinuitySnapshot | null,
  ): WorkflowRunSnapshot[] {
    const byId = new Map<string, WorkflowRunSnapshot>();
    const taskRunIds = tasks
      .map((task) => String(task?.metadata?.workflow_run_id || '').trim())
      .filter(Boolean);

    for (const workflowRunId of taskRunIds) {
      const run = this.deps.workflowRuns.getRun(workflowRunId);
      if (run) {
        byId.set(run.workflow_run_id, run);
      }
    }

    const workspaceHint = String(
      continuity?.focusTask?.workspace
      || continuity?.currentSurfaceTask?.workspace
      || continuity?.latestTelegramTask?.workspace
      || continuity?.latestWebTask?.workspace
      || continuity?.latestDiscordTask?.workspace
      || continuity?.latestWhatsAppTask?.workspace
      || '',
    ).trim();
    if (workspaceHint) {
      for (const run of this.deps.workflowRuns.listRuns({ workspace: workspaceHint, limit: 5 })) {
        if (!byId.has(run.workflow_run_id)) {
          byId.set(run.workflow_run_id, run);
        }
      }
    }

    return Array.from(byId.values())
      .sort((left, right) => this.getTimestamp(right.updated_at) - this.getTimestamp(left.updated_at))
      .slice(0, 5);
  }

  public enrichContinuityWithWorkflowRuns(
    continuity: SessionContinuitySnapshot | null,
    workflowRuns: WorkflowRunSnapshot[],
  ): SessionContinuitySnapshot | null {
    if (!continuity) {
      return continuity;
    }

    const preferredRun = workflowRuns.find((run) => Boolean(run?.resume_stage))
      || workflowRuns[0]
      || null;
    if (!preferredRun) {
      return continuity;
    }

    const nextWorkspaceContext = mergeWorkflowRunIntoWorkspaceContinuityContext(
      continuity.workspaceContext,
      preferredRun,
    );

    return {
      ...continuity,
      suggestedAction: this.syncSuggestedActionWithWorkspaceContext(continuity, nextWorkspaceContext),
      workspaceContext: nextWorkspaceContext,
    };
  }

  public resolveChatId(chatId?: string | null, sessionId?: string | null): string | null {
    const normalizedChatId = String(chatId || '').trim();
    if (normalizedChatId) {
      return normalizedChatId;
    }
    const normalizedSessionId = String(sessionId || '').trim();
    return normalizedSessionId ? `web:${normalizedSessionId}` : null;
  }

  public resolveSessionId(chatId: string, explicitSessionId?: string | null): string | null {
    const normalizedSessionId = String(explicitSessionId || '').trim();
    if (normalizedSessionId) {
      return normalizedSessionId;
    }
    return chatId.startsWith('web:') ? chatId.substring(4) : null;
  }

  public resolveSourceUserId(
    chatId: string,
    sessionId: string | null,
    explicitSourceUserId?: string | null,
  ): string | null {
    const normalizedSourceUserId = String(explicitSourceUserId || '').trim();
    if (normalizedSourceUserId) {
      return normalizedSourceUserId;
    }
    if (sessionId) {
      return sessionId;
    }
    const normalized = String(chatId || '').trim();
    const parts = normalized.split(':');
    return parts.length > 1 ? parts[parts.length - 1] : null;
  }

  public resolvePlatform(
    explicitPlatform: string | null | undefined,
    chatId: string,
    tasks: GatewaySessionTaskSnapshot[],
  ): MessageChannel | string {
    const normalizedExplicit = String(explicitPlatform || '').trim().toLowerCase();
    if (normalizedExplicit) {
      return normalizedExplicit;
    }

    const inferredFromChatId = this.inferPlatformFromChatId(chatId);
    if (inferredFromChatId !== 'cli') {
      return inferredFromChatId;
    }

    for (const task of tasks) {
      const normalizedSource = String(task.source || '').trim().toLowerCase();
      if (normalizedSource) {
        return normalizedSource;
      }
    }

    return inferredFromChatId;
  }

  public serializeTask(task: Task): GatewaySessionTaskSnapshot {
    return {
      task_id: String(task?.task_id || '').trim(),
      source: String(task?.source || '').trim() || null,
      created_at: task?.created_at || null,
      command_type: task?.command_type || null,
      raw_message: task?.raw_message || null,
      status: task?.status || null,
      risk_level: Number.isFinite(task?.risk_level) ? Number(task.risk_level) : null,
      requires_approval: task?.requires_approval === true,
      approval_status: task?.approval_status || null,
      executor_used: task?.executor_used || null,
      workspace: task?.workspace || null,
      result_summary: task?.result_summary || null,
      error_summary: task?.error_summary || null,
      stdout_summary: task?.stdout_summary || null,
      stderr_summary: task?.stderr_summary || null,
      diff_summary: task?.diff_summary || null,
      updated_at: task?.updated_at || null,
      pending_permission_id: task?.metadata?.pendingPermissionId || null,
      actions_executed: Array.isArray(task?.actions_executed) ? task.actions_executed : [],
      target_files: Array.isArray(task?.target_files) ? task.target_files : [],
      artifacts: Array.isArray(task?.artifacts) ? task.artifacts : [],
      metadata: task?.metadata && typeof task.metadata === 'object' ? { ...task.metadata } : {},
      execution: this.deps.lifecycleLinks.buildTaskContextLink(task as Record<string, unknown>),
    };
  }

  public serializePermission(permission: PermissionRequest): GatewaySessionPermissionSnapshot {
    return {
      permission_id: permission.permission_id,
      short_id: permission.permission_id.substring(0, 8),
      task_id: permission.task_id,
      executor: permission.executor,
      kind: permission.kind,
      scope: permission.scope,
      status: permission.status,
      reason: permission.reason,
      requested_value: permission.requested_value,
      resolved_value: permission.resolved_value,
      workspace: permission.workspace,
      updated_at: permission.updated_at,
      metadata: permission.metadata || {},
    };
  }

  public collectArtifacts(
    tasks: GatewaySessionTaskSnapshot[],
    workflowRuns: WorkflowRunSnapshot[],
  ): Array<Record<string, unknown>> {
    const entries = new Map<string, Record<string, unknown>>();

    for (const task of tasks) {
      for (const artifact of Array.isArray(task.artifacts) ? task.artifacts : []) {
        const key = String(artifact?.id || artifact?.key || `${task.task_id}:${artifact?.path || artifact?.name || 'artifact'}`).trim();
        if (!key) {
          continue;
        }
        entries.set(key, {
          ...artifact,
          sourceTaskId: task.task_id,
          workflowRunId: task.metadata?.workflow_run_id || null,
        });
      }
    }

    for (const run of workflowRuns) {
      for (const artifact of Array.isArray(run.artifacts) ? run.artifacts : []) {
        const key = String(artifact?.id || artifact?.key || `${run.workflow_run_id}:${artifact?.path || artifact?.name || 'artifact'}`).trim();
        if (!key || entries.has(key)) {
          continue;
        }
        entries.set(key, {
          ...artifact,
          sourceTaskId: null,
          workflowRunId: run.workflow_run_id,
        });
      }
    }

    return Array.from(entries.values()).slice(0, 50);
  }

  public collectFilesTouched(tasks: GatewaySessionTaskSnapshot[], toolRuns: ToolRunRecord[] = []): string[] {
    const files = new Set<string>();
    for (const task of tasks) {
      for (const target of Array.isArray(task.target_files) ? task.target_files : []) {
        const normalized = String(target || '').trim();
        if (normalized) {
          files.add(normalized);
        }
      }
    }
    for (const toolRun of toolRuns) {
      for (const target of Array.isArray(toolRun.filesTouched) ? toolRun.filesTouched : []) {
        const normalized = String(target || '').trim();
        if (normalized) {
          files.add(normalized);
        }
      }
    }
    return Array.from(files).slice(0, 100);
  }

  private syncSuggestedActionWithWorkspaceContext(
    continuity: SessionContinuitySnapshot,
    workspaceContext: SessionContinuitySnapshot['workspaceContext'],
  ): SessionContinuitySnapshot['suggestedAction'] {
    const current = continuity.suggestedAction;
    const prompt = workspaceContext?.followupPrompt || current?.prompt || null;
    const workflowRun = workspaceContext?.workflowRun || null;
    if (workflowRun?.operatorState === 'closed') {
      const titleHint = String(workspaceContext?.titleHint || '').trim();
      const reason = String(workflowRun.operatorCloseReason || '').trim();
      return {
        kind: 'review-latest',
        label: titleHint ? `Continuar ${titleHint}` : 'Continuar contexto',
        reason: reason
          ? `O workflow anterior foi encerrado pelo operador: ${reason}.`
          : 'O workflow anterior foi encerrado pelo operador.',
        prompt,
      };
    }

    return {
      ...current,
      prompt,
    };
  }

  private getRecentUserTasks(runtimeUserId: string, limit: number): Task[] {
    const principalIds = this.deps.surfaceIdentity.listPrincipalUserIds(runtimeUserId);
    const direct = this.deps.taskManager.getRecentTasksByUsers?.(principalIds, limit);
    if (Array.isArray(direct) && direct.length > 0) {
      return direct
        .slice()
        .sort((left, right) => this.getTimestamp(right?.updated_at) - this.getTimestamp(left?.updated_at));
    }

    const fallback = this.deps.taskManager.getRecentTasks?.(limit * 2, runtimeUserId) || [];
    return fallback
      .filter((task) => {
        const taskUserId = this.resolveTaskRuntimeUserId(task);
        return principalIds.includes(taskUserId);
      })
      .sort((left, right) => this.getTimestamp(right?.updated_at) - this.getTimestamp(left?.updated_at))
      .slice(0, limit);
  }

  private resolveTaskRuntimeUserId(task: Task): string {
    return String(
      task?.metadata?.runtime_user_id
      || task?.metadata?.surface_identity?.runtime_user_id
      || task?.user_id
      || '',
    ).trim();
  }

  private inferPlatformFromChatId(chatId: string): MessageChannel | string {
    const normalized = String(chatId || '').trim().toLowerCase();
    if (normalized.startsWith('telegram:')) {
      return 'telegram';
    }
    if (normalized.startsWith('discord:')) {
      return 'discord';
    }
    if (normalized.startsWith('whatsapp:')) {
      return 'whatsapp';
    }
    if (normalized.startsWith('web:')) {
      return 'web';
    }
    return 'cli';
  }

  private buildSessionLabel(snapshot: GatewaySessionSnapshot): string {
    const explicitLabel = String(snapshot.metadata?.label || '').trim();
    if (explicitLabel) {
      return explicitLabel;
    }
    const platformLabel = String(snapshot.platform || 'surface').trim();
    const workspace = String(snapshot.metadata?.workspaceHint || snapshot.continuity?.focusTask?.workspace || '').trim();
    const taskId = snapshot.continuity?.focusTask?.shortId || snapshot.tasks[0]?.task_id || null;
    if (workspace && taskId) {
      return `${platformLabel}:${workspace}:${taskId}`;
    }
    if (workspace) {
      return `${platformLabel}:${workspace}`;
    }
    if (taskId) {
      return `${platformLabel}:${taskId}`;
    }
    return `${platformLabel}:${snapshot.sessionId || snapshot.chatId}`;
  }

  private getTimestamp(value: string | null | undefined): number {
    const parsed = value ? Date.parse(String(value)) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
