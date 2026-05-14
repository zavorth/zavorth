import type { PermissionRequest } from '../contracts/PermissionRequest.js';
import { SurfaceIdentityService } from './SurfaceIdentityService.js';
import {
  SessionContinuityService,
  type SessionContinuitySnapshot,
} from '../runtime/context/SessionContinuityService.js';
import { mergeWorkflowRunIntoWorkspaceContinuityContext } from '../runtime/context/WorkspaceContinuityContext.js';
import {
  SessionReplayService,
  type SessionReplaySnapshot,
} from '../runtime/context/SessionReplayService.js';
import {
  SessionHandoffService,
  type SessionHandoffSnapshot,
} from '../runtime/context/SessionHandoffService.js';
import {
  ZavorthSessionToolsService,
  type ZavorthSessionToolsSnapshot,
} from '../runtime/sessions/ZavorthSessionToolsService.js';
import {
  WorkflowRunService,
  type WorkflowRunSnapshot,
} from '../runtime/workflows/WorkflowRunService.js';
import {
  GatewaySessionLedgerService,
  type GatewaySessionLedgerMetadata,
  type GatewaySessionTranscriptEntry,
} from './GatewaySessionLedgerService.js';
import {
  ToolRunRecordService,
  type ToolRunRecord,
} from './ToolRunRecordService.js';
import {
  ExecutionLifecycleLinkService,
  type ExecutionLifecycleContextLink,
} from './ExecutionLifecycleLinkService.js';
import { GatewaySessionSnapshotSupport } from './gateway-session/GatewaySessionSnapshotSupport.js';

type TaskManagerLike = {
  getRecentTasks?(limit?: number, userId?: string): any[];
  getRecentTasksByChat(chatId: string, limit?: number): any[];
  getRecentTasksByUsers?(userIds: string[], limit?: number): any[];
};

type PermissionServiceLike = {
  listRequests(
    status?: 'pending' | 'approved' | 'rejected' | 'expired' | 'all',
    limit?: number,
  ): Promise<PermissionRequest[]>;
};

type GatewaySessionRuntime = {
  now?: () => Date;
  taskManager?: TaskManagerLike | null;
  permissionService?: PermissionServiceLike | null;
  surfaceIdentityService?: SurfaceIdentityService;
  sessionContinuityService?: SessionContinuityService;
  sessionReplayService?: SessionReplayService;
  sessionHandoffService?: SessionHandoffService;
  sessionToolsService?: ZavorthSessionToolsService;
  workflowRunService?: Pick<WorkflowRunService, 'getRun' | 'listRuns'>;
  sessionLedgerService?: GatewaySessionLedgerService;
};

export type GatewaySessionTaskSnapshot = {
  task_id: string;
  source: string | null;
  created_at: string | null;
  command_type: string | null;
  raw_message: string | null;
  status: string | null;
  risk_level: number | null;
  requires_approval: boolean;
  approval_status: string | null;
  executor_used: string | null;
  workspace: string | null;
  result_summary: string | null;
  error_summary: string | null;
  stdout_summary: string | null;
  stderr_summary: string | null;
  diff_summary: string | null;
  updated_at: string | null;
  pending_permission_id: string | null;
  actions_executed: any[];
  target_files: string[];
  artifacts: any[];
  metadata: Record<string, any>;
  execution: ExecutionLifecycleContextLink | null;
};

export type GatewaySessionPermissionSnapshot = {
  permission_id: string;
  short_id: string;
  task_id: string | null;
  executor: string | null;
  kind: string | null;
  scope: string | null;
  status: string | null;
  reason: string | null;
  requested_value: string | null;
  resolved_value: string | null;
  workspace: string | null;
  updated_at: string | null;
  metadata: Record<string, any>;
};

export type GatewaySessionSnapshot = {
  generatedAt: string;
  sessionId: string | null;
  chatId: string;
  platform: string;
  runtimeUserId: string;
  sourceUserId: string | null;
  metadata: GatewaySessionLedgerMetadata;
  tasks: GatewaySessionTaskSnapshot[];
  permissions: GatewaySessionPermissionSnapshot[];
  continuity: SessionContinuitySnapshot | null;
  replay: SessionReplaySnapshot | null;
  handoff: SessionHandoffSnapshot | null;
  executionContext: ExecutionLifecycleContextLink | null;
  sessionTools: ZavorthSessionToolsSnapshot;
  workflowRuns: WorkflowRunSnapshot[];
  transcript: GatewaySessionTranscriptEntry[];
  toolRuns: ToolRunRecord[];
  artifacts: Array<Record<string, any>>;
  filesTouched: string[];
  summary: {
    messages: number;
    tasks: number;
    pendingPermissions: number;
    workflowRuns: number;
    toolRuns: number;
    artifacts: number;
    filesTouched: number;
  };
};

export type GatewaySessionListEntry = {
  id: string;
  chatId: string;
  sessionId: string | null;
  platform: string;
  runtimeUserId: string;
  sourceUserId: string | null;
  label: string;
  pinned: boolean;
  modelProfile: string | null;
  latestTaskLabel: string;
  latestTaskId: string | null;
  latestStatus: string | null;
  taskCount: number;
  hasPendingPermissions: boolean;
  updatedAt: string | null;
  workspace: string | null;
  suggestedEntryKind: 'task' | 'workflow' | 'fresh';
  handoffCommand: string;
};

export type GatewaySessionListSnapshot = {
  generatedAt: string;
  runtimeUserId: string;
  total: number;
  entries: GatewaySessionListEntry[];
};

export type GatewaySessionListSummarySnapshot = {
  generatedAt: string;
  runtimeUserId: string;
  total: number;
  visible: number;
};

export class GatewaySessionService {
  private readonly now: () => Date;
  private readonly taskManager: TaskManagerLike;
  private readonly permissionService: PermissionServiceLike | null;
  private readonly surfaceIdentity: SurfaceIdentityService;
  private readonly continuity: SessionContinuityService | null;
  private readonly replay: SessionReplayService;
  private readonly handoff: SessionHandoffService;
  private readonly sessionTools: ZavorthSessionToolsService;
  private readonly workflowRuns: Pick<WorkflowRunService, 'getRun' | 'listRuns'>;
  private readonly sessionLedger: GatewaySessionLedgerService;
  private readonly toolRuns = new ToolRunRecordService();
  private readonly lifecycleLinks = new ExecutionLifecycleLinkService();
  private readonly snapshotSupport: GatewaySessionSnapshotSupport;

  constructor(taskManagerOrRuntime: TaskManagerLike | GatewaySessionRuntime = {}, runtime: GatewaySessionRuntime = {}) {
    const resolvedRuntime = this.resolveRuntime(taskManagerOrRuntime, runtime);
    this.now = resolvedRuntime.now || (() => new Date());
    this.taskManager = resolvedRuntime.taskManager || {
      getRecentTasksByChat: () => [],
    };
    this.permissionService = resolvedRuntime.permissionService || null;
    this.surfaceIdentity = resolvedRuntime.surfaceIdentityService || new SurfaceIdentityService();
    this.continuity =
      resolvedRuntime.sessionContinuityService ||
      (this.taskManager
        ? new SessionContinuityService(this.taskManager as any, {
            surfaceIdentityService: this.surfaceIdentity,
          })
        : null);
    this.replay = resolvedRuntime.sessionReplayService || new SessionReplayService();
    this.handoff = resolvedRuntime.sessionHandoffService || new SessionHandoffService();
    this.workflowRuns = resolvedRuntime.workflowRunService || new WorkflowRunService({ persist: true });
    this.sessionLedger = resolvedRuntime.sessionLedgerService || new GatewaySessionLedgerService();
    this.sessionTools =
      resolvedRuntime.sessionToolsService ||
      new ZavorthSessionToolsService({
        now: this.now,
        taskManager: this.taskManager as any,
        surfaceIdentityService: this.surfaceIdentity,
        workflowRunService: this.workflowRuns,
      });
    this.snapshotSupport = new GatewaySessionSnapshotSupport({
      taskManager: this.taskManager,
      permissionService: this.permissionService,
      surfaceIdentity: this.surfaceIdentity,
      workflowRuns: this.workflowRuns,
      lifecycleLinks: this.lifecycleLinks,
    });
  }

  public async buildSnapshot(input: {
    userId: string;
    chatId?: string | null;
    sessionId?: string | null;
  }): Promise<GatewaySessionSnapshot | null> {
    return this.buildSessionSnapshot(input);
  }

  public readSessionMetadata(input: {
    userId?: string | null;
    chatId?: string | null;
    sessionId?: string | null;
    platform?: string | null;
    sourceUserId?: string | null;
  }): GatewaySessionLedgerMetadata | null {
    const chatId = this.snapshotSupport.resolveChatId(input.chatId, input.sessionId);
    if (!chatId) {
      return null;
    }
    const sessionId = this.snapshotSupport.resolveSessionId(chatId, input.sessionId);
    const platform = this.snapshotSupport.resolvePlatform(input.platform, chatId, []);
    const sourceUserId = this.snapshotSupport.resolveSourceUserId(chatId, sessionId, input.sourceUserId);
    return this.sessionLedger.readSessionMetadataSync({
      platform,
      chatId,
      sessionId,
      runtimeUserId: String(input.userId || '').trim() || null,
      sourceUserId,
    });
  }

  public patchSessionMetadata(input: {
    userId?: string | null;
    chatId?: string | null;
    sessionId?: string | null;
    platform?: string | null;
    sourceUserId?: string | null;
    label?: string | null;
    workspaceHint?: string | null;
    pinned?: boolean;
    modelProfile?: string | null;
  }): GatewaySessionLedgerMetadata | null {
    const chatId = this.snapshotSupport.resolveChatId(input.chatId, input.sessionId);
    if (!chatId) {
      return null;
    }
    const sessionId = this.snapshotSupport.resolveSessionId(chatId, input.sessionId);
    const platform = this.snapshotSupport.resolvePlatform(input.platform, chatId, []);
    const sourceUserId = this.snapshotSupport.resolveSourceUserId(chatId, sessionId, input.sourceUserId);
    return this.sessionLedger.saveSessionMetadata(
      {
        platform,
        chatId,
        sessionId,
        runtimeUserId: String(input.userId || '').trim() || null,
        sourceUserId,
      },
      {
        label: input.label,
        workspaceHint: input.workspaceHint,
        pinned: input.pinned,
        modelProfile: input.modelProfile,
      },
    );
  }

  public buildSessionSnapshotFast(input: {
    userId: string;
    chatId?: string | null;
    sessionId?: string | null;
    platform?: string | null;
    sourceUserId?: string | null;
  }): GatewaySessionSnapshot | null {
    return this.buildSessionSnapshotCore(input, [], undefined, false);
  }

  public async buildSessionSnapshot(input: {
    userId: string;
    chatId?: string | null;
    sessionId?: string | null;
    platform?: string | null;
    sourceUserId?: string | null;
  }): Promise<GatewaySessionSnapshot | null> {
    const runtimeUserId = String(input.userId || '').trim();
    const chatId = this.snapshotSupport.resolveChatId(input.chatId, input.sessionId);
    if (!runtimeUserId || !chatId || !this.continuity) {
      return null;
    }

    const tasks = (this.taskManager.getRecentTasksByChat?.(chatId, 25) || []).map((task) => this.snapshotSupport.serializeTask(task));
    const permissions = await this.snapshotSupport.resolvePermissions(tasks);
    return this.buildSessionSnapshotCore(input, permissions, tasks, true);
  }

  private buildSessionSnapshotCore(
    input: {
      userId: string;
      chatId?: string | null;
      sessionId?: string | null;
      platform?: string | null;
      sourceUserId?: string | null;
    },
    permissions: GatewaySessionPermissionSnapshot[],
    preloadedTasks?: GatewaySessionTaskSnapshot[],
    persist = false,
  ): GatewaySessionSnapshot | null {
    const runtimeUserId = String(input.userId || '').trim();
    const chatId = this.snapshotSupport.resolveChatId(input.chatId, input.sessionId);
    if (!runtimeUserId || !chatId || !this.continuity) {
      return null;
    }

    const tasks = preloadedTasks || (this.taskManager.getRecentTasksByChat?.(chatId, 25) || []).map((task) => this.snapshotSupport.serializeTask(task));
    const platform = this.snapshotSupport.resolvePlatform(input.platform, chatId, tasks);
    const sessionId = this.snapshotSupport.resolveSessionId(chatId, input.sessionId);
    const sourceUserId = this.snapshotSupport.resolveSourceUserId(chatId, sessionId, input.sourceUserId);
    const metadata = this.sessionLedger.readSessionMetadataSync({
      platform,
      chatId,
      sessionId,
      runtimeUserId,
      sourceUserId,
    });
    const continuity = this.continuity.buildSnapshot(sessionId || chatId, chatId, runtimeUserId);
    const workflowRuns = this.snapshotSupport.resolveWorkflowRuns(tasks, continuity);
    const enrichedContinuity = this.snapshotSupport.enrichContinuityWithWorkflowRuns(continuity, workflowRuns);
    const replay = this.replay.buildSnapshot({
      continuity: enrichedContinuity,
      tasks,
      permissions,
      workflowRuns,
    });
    const handoff = this.handoff.buildSnapshot({
      continuity: enrichedContinuity,
      replay,
      workflowRuns,
    });
    const transcript = this.sessionLedger.readTranscriptSync({
      platform,
      chatId,
      sessionId,
      runtimeUserId,
      sourceUserId,
    });
    const artifacts = this.snapshotSupport.collectArtifacts(tasks, workflowRuns);
    const toolRuns = this.toolRuns.buildToolRuns({ tasks, workflowRuns });
    const filesTouched = this.snapshotSupport.collectFilesTouched(tasks, toolRuns);
    const sessionTools = this.sessionTools.buildSnapshot({
      sessionId: sessionId || chatId,
      chatId,
      userId: runtimeUserId,
    });

    const snapshot = {
      generatedAt: this.now().toISOString(),
      sessionId,
      chatId,
      platform,
      runtimeUserId,
      sourceUserId,
      metadata,
      tasks,
      permissions,
      continuity: enrichedContinuity,
      replay,
      handoff,
      executionContext:
        replay?.executionContext
        || enrichedContinuity?.focusTask?.execution
        || workflowRuns
          .map((run) => this.lifecycleLinks.buildWorkflowContextLink(run as Record<string, unknown>))
          .find((entry) => Boolean(entry?.traceId || entry?.runId))
        || null,
      sessionTools,
      workflowRuns,
      transcript,
      toolRuns,
      artifacts,
      filesTouched,
      summary: {
        messages: transcript.length,
        tasks: tasks.length,
        pendingPermissions: permissions.filter((permission) => permission.status === 'pending').length,
        workflowRuns: workflowRuns.length,
        toolRuns: toolRuns.length,
        artifacts: artifacts.length,
        filesTouched: filesTouched.length,
      },
    };
    if (persist) {
      this.sessionLedger.saveSnapshot(
        {
          platform,
          chatId,
          sessionId,
          runtimeUserId,
          sourceUserId,
        },
        {
          generatedAt: snapshot.generatedAt,
          sessionId: snapshot.sessionId,
          chatId: snapshot.chatId,
          platform: String(snapshot.platform || '').trim(),
          runtimeUserId: snapshot.runtimeUserId,
          sourceUserId: snapshot.sourceUserId,
          headline: replay?.headline || null,
          operatorSummary: handoff?.operatorSummary || replay?.operatorSummary || null,
          latestTaskId: tasks[0]?.task_id || null,
          workflowRunIds: workflowRuns.map((run) => String(run.workflow_run_id || '').trim()).filter(Boolean),
          filesTouched,
          toolRunCount: toolRuns.length,
          artifactCount: artifacts.length,
          pendingPermissions: permissions.filter((permission) => permission.status === 'pending').length,
          transcriptCount: transcript.length,
          label: metadata.label,
          workspaceHint: metadata.workspaceHint,
          pinned: metadata.pinned,
          modelProfile: metadata.modelProfile,
        },
      );
    }

    return snapshot;
  }

  public async listSessions(input: {
    userId: string;
    limit?: number;
  }): Promise<GatewaySessionListSnapshot> {
    const { runtimeUserId, grouped, orderedChatIds } = this.snapshotSupport.buildSessionListIndex(input);

    const entries: GatewaySessionListEntry[] = [];
    for (const chatId of orderedChatIds) {
      const snapshot = await this.buildSessionSnapshot({ userId: runtimeUserId, chatId });
      if (!snapshot) {
        continue;
      }
      entries.push(this.snapshotSupport.buildListEntry(snapshot));
    }

    return {
      generatedAt: this.now().toISOString(),
      runtimeUserId,
      total: grouped.size,
      entries,
    };
  }

  public listSessionsSummary(input: {
    userId: string;
    limit?: number;
  }): GatewaySessionListSummarySnapshot {
    const { runtimeUserId, grouped, orderedChatIds } = this.snapshotSupport.buildSessionListIndex(input);

    return {
      generatedAt: this.now().toISOString(),
      runtimeUserId,
      total: grouped.size,
      visible: orderedChatIds.length,
    };
  }

  private resolveRuntime(
    taskManagerOrRuntime: TaskManagerLike | GatewaySessionRuntime,
    runtime: GatewaySessionRuntime,
  ): GatewaySessionRuntime {
    if ('taskManager' in (taskManagerOrRuntime as GatewaySessionRuntime) || 'permissionService' in (taskManagerOrRuntime as GatewaySessionRuntime)) {
      return taskManagerOrRuntime as GatewaySessionRuntime;
    }

    return {
      ...runtime,
      taskManager: taskManagerOrRuntime as TaskManagerLike,
    };
  }
}
