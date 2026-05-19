import { randomUUID } from 'crypto';
import type { PermissionRequest } from '../contracts/PermissionRequest.js';
import type { Task } from '../contracts/TaskContract.js';
import type { WebComposerMention } from '../contracts/WebComposer.js';
import { TaskManager } from '../orchestrator/TaskManager.js';
import { PermissionService } from './PermissionService.js';
import type { SessionContinuitySnapshot } from '../runtime/context/SessionContinuityService.js';
import type { SessionReplaySnapshot } from '../runtime/context/SessionReplayService.js';
import type { SessionHandoffSnapshot } from '../runtime/context/SessionHandoffService.js';
import { WorkflowRunService, type WorkflowRunSnapshot } from '../runtime/workflows/WorkflowRunService.js';
import {
  GatewaySessionService,
  type GatewaySessionPermissionSnapshot,
  type GatewaySessionTaskSnapshot,
  type GatewaySessionSnapshot,
} from '../runtime/sessions/GatewaySessionService.js';
import { GatewaySessionReadModelService } from '../runtime/sessions/GatewaySessionReadModelService.js';
import { GatewaySessionStoreService } from '../runtime/sessions/GatewaySessionStoreService.js';
import { GatewaySessionLedgerService } from './GatewaySessionLedgerService.js';

type MessageRole = 'user' | 'assistant' | 'system';

export type WebChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  taskId?: string | null;
  kind?: string | null;
  mentions?: WebComposerMention[];
};

export type WebRealtimeEvent =
  | { id: string; type: 'snapshot'; createdAt: string; payload: WebSessionSnapshot }
  | { id: string; type: 'message'; createdAt: string; payload: WebChatMessage }
  | { id: string; type: 'task'; createdAt: string; payload: ReturnType<WebRealtimeService['serializeTask']> }
  | { id: string; type: 'tool'; createdAt: string; payload: GatewaySessionSnapshot['toolRuns'][number] }
  | { id: string; type: 'workflow'; createdAt: string; payload: ReturnType<WebRealtimeService['serializeWorkflow']> }
  | { id: string; type: 'permission'; createdAt: string; payload: ReturnType<WebRealtimeService['serializePermission']> }
  | { id: string; type: 'ping'; createdAt: string; payload: { sessionId: string } };

type SessionState = {
  messages: WebChatMessage[];
  listeners: Set<(event: WebRealtimeEvent) => void>;
  taskHashes: Map<string, string>;
  toolRunHashes: Map<string, string>;
  workflowHashes: Map<string, string>;
  permissionHashes: Map<string, string>;
  terminalTaskMessages: Map<string, string>;
  permissionMessages: Set<string>;
  lastSnapshot: WebSessionSnapshot | null;
};

export type WebSessionSnapshot = {
  sessionId: string;
  chatId: string;
  messages: WebChatMessage[];
  tasks: GatewaySessionTaskSnapshot[];
  permissions: GatewaySessionPermissionSnapshot[];
  continuity: SessionContinuitySnapshot | null;
  replay: SessionReplaySnapshot | null;
  handoff: SessionHandoffSnapshot | null;
  workflowRuns: WorkflowRunSnapshot[];
  toolRuns: GatewaySessionSnapshot['toolRuns'];
};

export type WebRealtimeBusSnapshot = {
  transport: 'sse';
  pollIntervalMs: number;
  sessionsTracked: number;
  listenersAttached: number;
  activeSessionIds: string[];
};

type WebRealtimeRuntime = {
  sessionReadModelService?: GatewaySessionReadModelService | null;
  workflowRunService?: WorkflowRunService | null;
  sessionLedgerService?: GatewaySessionLedgerService | null;
};

export class WebRealtimeService {
  private readonly sessions = new Map<string, SessionState>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly pollIntervalMs = 2_000;
  private readonly sessionReadModel: GatewaySessionReadModelService;
  private readonly sessionLedger: GatewaySessionLedgerService;

  constructor(
    private taskManager: TaskManager,
    private permissionService: PermissionService,
    private formatPermissionMessage: (permission: PermissionRequest) => string,
    private readonly webUserId: string,
    runtime: WebRealtimeRuntime = {},
  ) {
    const workflowRuns = runtime.workflowRunService || new WorkflowRunService();
    this.sessionReadModel =
      runtime.sessionReadModelService ||
      new GatewaySessionReadModelService(
        new GatewaySessionService({
          taskManager: this.taskManager as any,
          permissionService: this.permissionService as any,
          workflowRunService: workflowRuns,
        }),
        {
          sessionStoreService: new GatewaySessionStoreService(),
        },
      );
    this.sessionLedger = runtime.sessionLedgerService || new GatewaySessionLedgerService();
  }

  public start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.tick();
    }, this.pollIntervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    for (const session of this.sessions.values()) {
      session.listeners.clear();
    }
  }

  public createSession(): string {
    const sessionId = randomUUID();
    this.ensureSession(sessionId);
    return sessionId;
  }

  public ensureSession(sessionId: string): void {
    if (this.sessions.has(sessionId)) {
      return;
    }

    this.sessions.set(sessionId, {
      messages: this.sessionLedger.readTranscriptSync({
        platform: 'web',
        chatId: this.getChatId(sessionId),
        sessionId,
        runtimeUserId: this.webUserId,
        sourceUserId: sessionId,
      }).map((entry) => ({
        id: entry.id,
        role: entry.role,
        content: entry.content,
        createdAt: entry.createdAt,
        taskId: entry.taskId || null,
        kind: entry.kind || null,
        mentions: Array.isArray(entry.mentions) && entry.mentions.length > 0 ? entry.mentions : undefined,
      })),
      listeners: new Set(),
      taskHashes: new Map(),
      toolRunHashes: new Map(),
      workflowHashes: new Map(),
      permissionHashes: new Map(),
      terminalTaskMessages: new Map(),
      permissionMessages: new Set(),
      lastSnapshot: null,
    });
  }

  public getChatId(sessionId: string): string {
    return `web:${sessionId}`;
  }

  public buildBusSnapshot(): WebRealtimeBusSnapshot {
    let listenersAttached = 0;
    for (const session of this.sessions.values()) {
      listenersAttached += session.listeners.size;
    }

    return {
      transport: 'sse',
      pollIntervalMs: this.pollIntervalMs,
      sessionsTracked: this.sessions.size,
      listenersAttached,
      activeSessionIds: Array.from(this.sessions.keys()),
    };
  }

  public recordUserMessage(
    sessionId: string,
    content: string,
    taskId?: string | null,
    mentions?: WebComposerMention[],
  ): WebChatMessage {
    return this.recordMessage(
      sessionId,
      'user',
      content,
      taskId || null,
      'input',
      mentions,
    );
  }

  public recordAssistantMessage(
    sessionId: string,
    content: string,
    taskId?: string | null,
    kind?: string | null,
    mentions?: WebComposerMention[],
  ): WebChatMessage {
    return this.recordMessage(
      sessionId,
      'assistant',
      content,
      taskId || null,
      kind || 'reply',
      mentions,
    );
  }

  public subscribe(sessionId: string, listener: (event: WebRealtimeEvent) => void): () => void {
    const session = this.getSession(sessionId);
    session.listeners.add(listener);

    listener({
      id: randomUUID(),
      type: 'snapshot',
      createdAt: new Date().toISOString(),
      payload: this.getSnapshot(sessionId),
    });

    if (!session.lastSnapshot) {
      void this.getResolvedSnapshot(sessionId)
        .then((snapshot) => {
          listener({
            id: randomUUID(),
            type: 'snapshot',
            createdAt: new Date().toISOString(),
            payload: snapshot,
          });
        })
        .catch(() => undefined);
    }

    return () => {
      session.listeners.delete(listener);
    };
  }

  public getSnapshot(sessionId: string): WebSessionSnapshot {
    const session = this.getSession(sessionId);
    if (session.lastSnapshot) {
      return {
        ...session.lastSnapshot,
        messages: [...session.messages],
      };
    }

    const gatewaySnapshot = this.sessionReadModel.buildSnapshotFast({
      userId: this.webUserId,
      sessionId,
      chatId: this.getChatId(sessionId),
      sourceUserId: sessionId,
      platform: 'web',
    });

    return {
      sessionId,
      chatId: this.getChatId(sessionId),
      messages: [...session.messages],
      tasks: gatewaySnapshot?.tasks || [],
      permissions: gatewaySnapshot?.permissions || [],
      continuity: gatewaySnapshot?.continuity || null,
      replay: gatewaySnapshot?.replay || null,
      handoff: gatewaySnapshot?.handoff || null,
      workflowRuns: gatewaySnapshot?.workflowRuns || [],
      toolRuns: gatewaySnapshot?.toolRuns || [],
    };
  }

  public async getResolvedSnapshot(sessionId: string): Promise<WebSessionSnapshot> {
    const session = this.getSession(sessionId);
    const gatewaySnapshot = await this.sessionReadModel.buildSnapshot({
      userId: this.webUserId,
      sessionId,
      chatId: this.getChatId(sessionId),
      sourceUserId: sessionId,
      platform: 'web',
    });
    const snapshot = {
      sessionId,
      chatId: this.getChatId(sessionId),
      messages: [...session.messages],
      tasks: gatewaySnapshot?.tasks || [],
      permissions: gatewaySnapshot?.permissions || [],
      continuity: gatewaySnapshot?.continuity || null,
      replay: gatewaySnapshot?.replay || null,
      handoff: gatewaySnapshot?.handoff || null,
      workflowRuns: gatewaySnapshot?.workflowRuns || [],
      toolRuns: gatewaySnapshot?.toolRuns || [],
    };
    session.lastSnapshot = snapshot;
    return snapshot;
  }

  public async captureBaseline(sessionId: string): Promise<void> {
    await this.getResolvedSnapshot(sessionId);
    await this.refreshSession(sessionId, true);
  }

  private async tick(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());
    for (const sessionId of sessionIds) {
      const session = this.getSession(sessionId);
      if (session.listeners.size === 0) {
        continue;
      }
      await this.refreshSession(sessionId, false);
      this.emit(sessionId, {
        id: randomUUID(),
        type: 'ping',
        createdAt: new Date().toISOString(),
        payload: { sessionId },
      });
    }
  }

  private async refreshSession(sessionId: string, baselineOnly: boolean): Promise<void> {
    const session = this.getSession(sessionId);
    const tasks = this.taskManager.getRecentTasksByChat(this.getChatId(sessionId), 25);
    const taskIds = new Set(tasks.map((task) => task.task_id));
    const pendingPermissions = (await this.permissionService.listRequests('pending', 100)).filter((permission) => {
      return Boolean(permission.task_id && taskIds.has(permission.task_id));
    });
    let shouldRefreshSnapshot = baselineOnly;

    const liveTaskIds = new Set<string>();
    for (const task of tasks) {
      liveTaskIds.add(task.task_id);
      const serializedTask = this.serializeTask(task);
      const nextHash = JSON.stringify(serializedTask);
      const previousHash = session.taskHashes.get(task.task_id);
      session.taskHashes.set(task.task_id, nextHash);

      if (!baselineOnly && previousHash !== nextHash) {
        shouldRefreshSnapshot = true;
        this.emit(sessionId, {
          id: randomUUID(),
          type: 'task',
          createdAt: new Date().toISOString(),
          payload: serializedTask,
        });
      }

      const terminalSignature = this.getTerminalSignature(task);
      if (terminalSignature && session.terminalTaskMessages.get(task.task_id) !== terminalSignature) {
        session.terminalTaskMessages.set(task.task_id, terminalSignature);
        shouldRefreshSnapshot = true;
        if (!baselineOnly) {
          this.recordAssistantMessage(sessionId, this.formatTerminalTaskMessage(task), task.task_id, 'task-result');
        }
      }
    }

    for (const existingTaskId of Array.from(session.taskHashes.keys())) {
      if (!liveTaskIds.has(existingTaskId)) {
        session.taskHashes.delete(existingTaskId);
        shouldRefreshSnapshot = true;
      }
    }

    const livePermissionIds = new Set<string>();
    for (const permission of pendingPermissions) {
      livePermissionIds.add(permission.permission_id);
      const serializedPermission = this.serializePermission(permission);
      const nextHash = JSON.stringify(serializedPermission);
      const previousHash = session.permissionHashes.get(permission.permission_id);
      session.permissionHashes.set(permission.permission_id, nextHash);

      if (!baselineOnly && previousHash !== nextHash) {
        shouldRefreshSnapshot = true;
        this.emit(sessionId, {
          id: randomUUID(),
          type: 'permission',
          createdAt: new Date().toISOString(),
          payload: serializedPermission,
        });
      }

      if (!session.permissionMessages.has(permission.permission_id)) {
        session.permissionMessages.add(permission.permission_id);
        shouldRefreshSnapshot = true;
        if (!baselineOnly) {
          this.recordAssistantMessage(
            sessionId,
            this.formatPermissionMessage(permission),
            permission.task_id,
            'permission-request',
          );
        }
      }
    }

    for (const existingPermissionId of Array.from(session.permissionHashes.keys())) {
      if (!livePermissionIds.has(existingPermissionId)) {
        session.permissionHashes.delete(existingPermissionId);
        shouldRefreshSnapshot = true;
      }
    }

    const fastSnapshot = this.sessionReadModel.buildSnapshotFast({
      userId: this.webUserId,
      sessionId,
      chatId: this.getChatId(sessionId),
      sourceUserId: sessionId,
      platform: 'web',
    });
    const workflowRuns = Array.isArray(fastSnapshot?.workflowRuns) ? fastSnapshot.workflowRuns : [];
    const toolRuns = Array.isArray(fastSnapshot?.toolRuns) ? fastSnapshot.toolRuns : [];
    const liveToolRunIds = new Set<string>();
    for (const toolRun of toolRuns) {
      const toolRunId = String(toolRun?.runId || '').trim();
      if (!toolRunId) {
        continue;
      }
      liveToolRunIds.add(toolRunId);
      const nextHash = JSON.stringify(toolRun);
      const previousHash = session.toolRunHashes.get(toolRunId);
      session.toolRunHashes.set(toolRunId, nextHash);
      if (!baselineOnly && previousHash !== nextHash) {
        shouldRefreshSnapshot = true;
        this.emit(sessionId, {
          id: randomUUID(),
          type: 'tool',
          createdAt: new Date().toISOString(),
          payload: toolRun,
        });
      }
    }

    for (const existingToolRunId of Array.from(session.toolRunHashes.keys())) {
      if (!liveToolRunIds.has(existingToolRunId)) {
        session.toolRunHashes.delete(existingToolRunId);
        shouldRefreshSnapshot = true;
      }
    }

    const liveWorkflowIds = new Set<string>();
    for (const run of workflowRuns) {
      const serializedWorkflow = this.serializeWorkflow(run);
      const workflowRunId = String(serializedWorkflow.workflow_run_id || '').trim();
      if (!workflowRunId) {
        continue;
      }
      liveWorkflowIds.add(workflowRunId);
      const nextHash = JSON.stringify(serializedWorkflow);
      const previousHash = session.workflowHashes.get(workflowRunId);
      session.workflowHashes.set(workflowRunId, nextHash);
      if (!baselineOnly && previousHash !== nextHash) {
        shouldRefreshSnapshot = true;
        this.emit(sessionId, {
          id: randomUUID(),
          type: 'workflow',
          createdAt: new Date().toISOString(),
          payload: serializedWorkflow,
        });
      }
    }

    for (const existingWorkflowId of Array.from(session.workflowHashes.keys())) {
      if (!liveWorkflowIds.has(existingWorkflowId)) {
        session.workflowHashes.delete(existingWorkflowId);
        shouldRefreshSnapshot = true;
      }
    }

    if (shouldRefreshSnapshot) {
      const snapshot = await this.getResolvedSnapshot(sessionId);
      if (!baselineOnly) {
        this.emit(sessionId, {
          id: randomUUID(),
          type: 'snapshot',
          createdAt: new Date().toISOString(),
          payload: snapshot,
        });
      }
    }
  }

  private recordMessage(
    sessionId: string,
    role: MessageRole,
    content: string,
    taskId: string | null,
    kind: string | null,
    mentions?: WebComposerMention[],
  ): WebChatMessage {
    const session = this.getSession(sessionId);
    const message: WebChatMessage = {
      id: randomUUID(),
      role,
      content: String(content || '').trim(),
      createdAt: new Date().toISOString(),
      taskId,
      kind,
      mentions: Array.isArray(mentions) && mentions.length > 0 ? mentions : undefined,
    };

    if (!message.content) {
      return message;
    }

    session.messages.push(message);
    if (session.messages.length > 200) {
      session.messages.splice(0, session.messages.length - 200);
    }
    this.sessionLedger.appendMessage(
      {
        platform: 'web',
        chatId: this.getChatId(sessionId),
        sessionId,
        runtimeUserId: this.webUserId,
        sourceUserId: sessionId,
      },
      {
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
        taskId: message.taskId || null,
        kind: message.kind || null,
        mentions: message.mentions,
        surface: 'web',
      },
    );

    this.emit(sessionId, {
      id: randomUUID(),
      type: 'message',
      createdAt: message.createdAt,
      payload: message,
    });

    return message;
  }

  private emit(sessionId: string, event: WebRealtimeEvent): void {
    const session = this.getSession(sessionId);
    for (const listener of session.listeners) {
      listener(event);
    }
  }

  private getSession(sessionId: string): SessionState {
    this.ensureSession(sessionId);
    return this.sessions.get(sessionId)!;
  }

  private getTerminalSignature(task: Task): string | null {
    if (!['completed', 'failed', 'rejected', 'cancelled', 'reverted'].includes(task.status)) {
      return null;
    }

    return JSON.stringify({
      status: task.status,
      result: task.result_summary || null,
      error: task.error_summary || null,
      updated_at: task.updated_at,
    });
  }

  private formatTerminalTaskMessage(task: Task): string {
    if (task.status === 'completed') {
      return task.result_summary || `Tarefa ${task.task_id.substring(0, 8)} concluida.`;
    }

    const title =
      task.status === 'rejected'
        ? 'Tarefa rejeitada.'
        : task.status === 'cancelled'
          ? 'Tarefa cancelada.'
          : task.status === 'reverted'
            ? 'Tarefa revertida.'
            : 'Tarefa falhou.';

    return [
      title,
      `Referencia curta: ${task.task_id.substring(0, 8)}`,
      '',
      `Motivo: ${task.error_summary || 'Sem detalhes adicionais.'}`,
    ].join('\n');
  }

  private serializeTask(task: Task) {
    return {
      task_id: task.task_id,
      created_at: task.created_at,
      command_type: task.command_type,
      raw_message: task.raw_message,
      status: task.status,
      risk_level: task.risk_level,
      requires_approval: task.requires_approval,
      approval_status: task.approval_status,
      executor_used: task.executor_used,
      workspace: task.workspace,
      result_summary: task.result_summary,
      error_summary: task.error_summary,
      updated_at: task.updated_at,
      pending_permission_id: task.metadata?.pendingPermissionId || null,
      target_files: Array.isArray(task.target_files) ? task.target_files : [],
      artifacts: Array.isArray(task.artifacts) ? task.artifacts : [],
      metadata: task.metadata || {},
    };
  }

  private serializePermission(permission: PermissionRequest) {
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

  private serializeWorkflow(run: WorkflowRunSnapshot) {
    return {
      workflow_run_id: run.workflow_run_id,
      workflow_name: run.workflow_name,
      objective: run.objective,
      workspace: run.workspace,
      origin: run.origin,
      trigger: run.trigger,
      workspace_context: run.workspace_context || null,
      created_at: run.created_at,
      updated_at: run.updated_at,
      status: run.status,
      phases: Array.isArray(run.phases) ? run.phases : [],
      resume_stage: run.resume_stage || null,
      actionable_stages: Array.isArray((run as any).actionable_stages) ? (run as any).actionable_stages : [],
      resume_prompt: run.resume_prompt || null,
      artifacts: Array.isArray(run.artifacts) ? run.artifacts : [],
      artifacts_manifest: run.artifacts_manifest || null,
      externalized_state: run.externalized_state || null,
    };
  }

}
