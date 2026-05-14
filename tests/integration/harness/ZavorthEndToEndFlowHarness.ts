import { CommandParser, type ParsedCommand } from '../../../src/telegram/CommandParser';
import { GatewayPermissionBroker } from '../../../src/telegram/bot-gateway/GatewayPermissionBroker';
import {
  processTextMessage,
} from '../../../src/telegram/bot-gateway/support/BotGatewayMessageProcessing';
import { TelegramChannelContractService } from '../../../src/telegram/TelegramChannelContractService';
import { SurfaceTaskDispatchService } from '../../../src/services/SurfaceTaskDispatchService';
import type { PermissionRequest } from '../../../src/contracts/PermissionRequest';
import type { Task } from '../../../src/contracts/TaskContract';

export const PHASE33_FLOW_FIXTURES = {
  telegramCommand: '/task gerar resumo operacional',
  permissionRequest: '/task deploy production --needs-approval',
  externalExecutorWorkspaceMismatch: '/task external_executor aplicar patch no workspace errado',
  zavorthBridgeTimeout: '/task zavorthBridge revisar tela de checkout',
  webApproval: '/task publicar release web --needs-approval',
};

type FlowReply = {
  surface: 'telegram' | 'web' | 'control';
  chatId: string;
  sessionId: string | null;
  text: string;
};

type FlowTelemetryEvent = {
  traceId: string;
  eventType: string;
  status: string;
  payload: Record<string, any>;
};

type ExecutorCall = {
  taskId: string;
  executor: string;
  attempt: number;
  status: string;
  traceId: string;
};

type WebSessionState = {
  sessionId: string;
  chatId: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string; traceId?: string | null }>;
  approvals: string[];
};

export class ZavorthEndToEndFlowHarness {
  public readonly parser = new CommandParser();
  public readonly replies: FlowReply[] = [];
  public readonly telemetryEvents: FlowTelemetryEvent[] = [];
  public readonly executorCalls: ExecutorCall[] = [];
  public readonly tasks = new Map<string, Task>();
  public readonly permissions = new Map<string, PermissionRequest>();
  public readonly webSessions = new Map<string, WebSessionState>();

  private taskSequence = 0;
  private permissionSequence = 0;
  private traceSequence = 0;
  private readonly taskContexts = new Map<string, any>();
  private readonly permissionBroker: GatewayPermissionBroker;
  private readonly surfaceTaskDispatcher: SurfaceTaskDispatchService;

  constructor() {
    this.permissionBroker = new GatewayPermissionBroker({
      permissionController: {
        handlePermissionCommand: async (ctx, args) => this.replyWithPendingPermissions(ctx, args),
        handlePermissionAllowCommand: async (ctx, args) => {
          await ctx.reply(`Politica persistente simulada para ${args || 'entrada vazia'}.`);
        },
        handlePermissionRevokeCommand: async (ctx, args) => {
          await ctx.reply(`Politica simulada revogada para ${args || 'entrada vazia'}.`);
        },
        handleApproval: async (ctx, args) => this.resolvePermission(ctx, args, 'approved', 'telegram-operator'),
        handleRejection: async (ctx, args) => this.resolvePermission(ctx, args, 'rejected', 'telegram-operator'),
      },
      echoApprovalController: {
        handleEchoCommand: async (ctx, args) => {
          await ctx.reply(`Echo approvals simulados: ${args || 'list'}.`);
        },
      },
    });

    this.surfaceTaskDispatcher = new SurfaceTaskDispatchService({
      parser: this.parser,
      taskOrchestrationController: {
        handleTaskMessage: async (ctx, input) => this.handleTaskMessage(ctx, input),
      },
      surfaceIdentityService: {
        resolveRuntimeUserId: ({ sourceUserId, fallbackRuntimeUserId }: any) =>
          String(sourceUserId || fallbackRuntimeUserId || 'operator'),
        linkIdentity: () => undefined,
      } as any,
    });
  }

  public async sendTelegram(text: string, options: { chatId?: string; userId?: string } = {}) {
    const ctx = this.createTelegramContext(options.chatId || 'telegram-chat-1', options.userId || '42');
    const beforeReplyCount = this.replies.length;
    const beforeTaskCount = this.tasks.size;

    await processTextMessage(this.createTelegramRuntime(), ctx, text);

    return {
      replies: this.replies.slice(beforeReplyCount),
      task: this.latestTaskAfter(beforeTaskCount),
      ctx,
    };
  }

  public async sendWeb(sessionId: string, text: string, userId = 'web-user') {
    const session = this.getWebSession(sessionId);
    session.messages.push({ role: 'user', content: text });
    const ctx = this.createWebContext(session);
    const beforeTaskCount = this.tasks.size;

    await this.surfaceTaskDispatcher.dispatchTaskMessage({
      ctx,
      platform: 'web',
      chatId: session.chatId,
      text,
      sourceUserId: userId,
      fallbackRuntimeUserId: userId,
      source: 'web',
      sessionId,
      threadId: sessionId,
      identity: {
        linkedBy: 'web-session',
        verificationMethod: 'dashboard-auth',
      },
      surfacePolicy: {
        publicServerMode: false,
        forceApprovalForExecution: false,
        transport: 'text',
      },
    });

    return {
      session,
      task: this.latestTaskAfter(beforeTaskCount),
    };
  }

  public getControlSnapshot(sessionId: string) {
    const session = this.getWebSession(sessionId);
    const approvals = [...this.permissions.values()].filter((permission) =>
      session.approvals.includes(permission.permission_id),
    );
    return {
      sessionId,
      session,
      approvalPlane: {
        pending: approvals.filter((permission) => permission.status === 'pending'),
        recent: approvals,
      },
    };
  }

  public async resolveControlApproval(sessionId: string, approvalId: string, decision: 'approve' | 'reject') {
    const session = this.getWebSession(sessionId);
    const ctx = this.createWebContext(session, 'control');
    const permission = await this.resolvePermission(
      ctx,
      approvalId,
      decision === 'approve' ? 'approved' : 'rejected',
      'control-operator',
    );
    return {
      permission,
      session,
      task: permission.task_id ? this.tasks.get(permission.task_id) || null : null,
    };
  }

  public eventsForTask(task: Task | null | undefined): FlowTelemetryEvent[] {
    const traceId = task?.metadata?.correlation?.traceId;
    return this.telemetryEvents.filter((event) => event.traceId === traceId);
  }

  private createTelegramRuntime() {
    return {
      telegramChannelContractService: new TelegramChannelContractService(),
      surfaceIdentityService: {
        linkIdentity: () => undefined,
      },
      logRepo: {
        log: () => undefined,
      },
      telemetryRuntime: {
        record: async (event: any) => {
          this.telemetryEvents.push({
            traceId: String(event.traceId || 'telegram-ingress'),
            eventType: String(event.eventType || 'unknown'),
            status: String(event.status || 'unknown'),
            payload: event.payload || {},
          });
        },
      },
      priorityCommandService: {
        handle: async () => false,
      },
      parser: this.parser,
      workspaceProfileService: {
        getProfile: async () => null,
      },
      workspaceCommandService: {
        resolveInvocation: () => null,
      },
      securityLock: {
        isLocked: () => false,
        isCommandAllowedWhenLocked: () => true,
      },
      chainController: {
        handleCommandChain: async () => undefined,
      },
      hubController: {
        handleStartCommand: async (ctx: any) => ctx.reply('Zavorth pronto.'),
      },
      opsController: {
        handleStatus: async (ctx: any) => ctx.reply('Status operacional: ok.'),
      },
      capabilityController: {
        handleCommand: async () => false,
      },
      commandRoutingService: {
        dispatchPrivateCommand: async (ctx: any, parsed: ParsedCommand) =>
          this.permissionBroker.dispatchPrivateCommand(ctx, parsed),
        dispatchGroupCommand: async () => false,
      },
      getSharedSurfaceCommandService: () => null,
      legacyUnifiedGateway: null,
      surfaceTaskDispatcher: this.surfaceTaskDispatcher,
    } as any;
  }

  private async handleTaskMessage(ctx: any, input: any): Promise<Task> {
    const task = this.createTask(input);
    this.tasks.set(task.task_id, task);
    this.taskContexts.set(task.task_id, ctx);
    this.recordTaskEvent(task, 'task.created', 'created', {
      commandType: input.parsed.command_type,
      surface: input.surfaceMetadata?.platform || input.source,
    });

    const normalized = String(input.text || '').toLowerCase();
    if (normalized.includes('needs-approval') || normalized.includes('deploy production')) {
      return this.requestApproval(ctx, task);
    }
    if (normalized.includes('external_executor')) {
      return this.executeExternalExecutorWithWorkspaceRepair(ctx, task);
    }
    if (normalized.includes('zavorthBridge')) {
      return this.executeZavorthBridgeWithFallback(ctx, task);
    }

    return this.executeLocal(ctx, task, 'local_executor', 'Tarefa concluida pelo executor deterministico.');
  }

  private createTask(input: any): Task {
    const now = new Date('2026-04-24T12:00:00.000Z').toISOString();
    const taskId = `phase33-task-${String(++this.taskSequence).padStart(3, '0')}`;
    const traceId = `phase33-trace-${String(++this.traceSequence).padStart(3, '0')}`;
    const parsed = input.parsed || this.parser.parse(input.text);
    return {
      task_id: taskId,
      created_at: now,
      updated_at: now,
      source: input.source || input.surfaceMetadata?.platform || 'telegram',
      chat_id: input.chatId,
      user_id: input.userId,
      raw_message: input.text,
      normalized_message: parsed.normalized_message || String(input.text || '').toLowerCase(),
      command_type: parsed.command_type,
      intent: 'phase33_flow',
      target: null,
      workspace: input.surfaceMetadata?.tenant?.workspace || '<repo>',
      risk_level: 1,
      status: 'parsed',
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
        correlation: {
          traceId,
          sessionId: input.surfaceMetadata?.sessionId || input.surfaceMetadata?.threadId || input.chatId,
          surface: input.surfaceMetadata?.platform || input.source,
        },
        surface: input.surfaceMetadata || {},
      },
    };
  }

  private async executeLocal(
    ctx: any,
    task: Task,
    executor: string,
    summary: string,
  ): Promise<Task> {
    task.status = 'running';
    task.executor_used = executor;
    this.recordTaskEvent(task, 'executor.started', 'running', { executor });
    const result = this.runExecutor(task, executor, 'completed');
    task.status = 'completed';
    task.stdout_summary = result.status;
    task.result_summary = summary;
    task.actions_executed.push(summary);
    this.recordTaskEvent(task, 'task.completed', 'completed', { executor, summary });
    await ctx.reply(`Concluido: ${summary} [trace:${task.metadata.correlation.traceId}]`);
    return task;
  }

  private async requestApproval(ctx: any, task: Task): Promise<Task> {
    const permission = this.createPermission(task);
    task.status = 'waiting_approval';
    task.requires_approval = true;
    task.approval_status = 'pending';
    task.metadata.pendingPermissionId = permission.permission_id;
    this.recordTaskEvent(task, 'permission.requested', 'pending', {
      permissionId: permission.permission_id,
      reason: permission.reason,
    });
    this.attachPermissionToWebSession(task, permission);
    await ctx.reply(
      `Aprovacao necessaria: ${permission.permission_id}. Use /approve ${permission.permission_id} ou /reject ${permission.permission_id}.`,
    );
    return task;
  }

  private async resolvePermission(
    ctx: any,
    ref: string,
    status: 'approved' | 'rejected',
    decidedBy: string,
  ): Promise<PermissionRequest> {
    const permission = this.findPermission(ref);
    if (!permission) {
      await ctx.reply(`Permissao nao encontrada: ${ref || 'vazia'}.`);
      throw new Error(`Permission not found: ${ref}`);
    }

    permission.status = status;
    permission.updated_at = new Date('2026-04-24T12:00:01.000Z').toISOString();
    permission.decided_by = decidedBy;
    permission.decision_note = status === 'approved' ? 'Approved by phase 33 harness.' : 'Rejected by phase 33 harness.';
    const task = permission.task_id ? this.tasks.get(permission.task_id) || null : null;
    if (!task) {
      await ctx.reply(`Permissao ${permission.permission_id} resolvida sem task vinculada.`);
      return permission;
    }

    task.approval_status = status;
    this.recordTaskEvent(task, `permission.${status}`, status, {
      permissionId: permission.permission_id,
      decidedBy,
    });

    if (status === 'rejected') {
      task.status = 'rejected';
      task.error_summary = 'Operador rejeitou a permissao solicitada.';
      await ctx.reply(`Permissao rejeitada: ${permission.permission_id}. Tarefa ${task.task_id} parada.`);
      return permission;
    }

    task.status = 'approved';
    const taskCtx = this.taskContexts.get(task.task_id) || ctx;
    await this.executeLocal(
      taskCtx,
      task,
      'approved_executor',
      `Permissao ${permission.permission_id} aprovada; execucao retomada.`,
    );
    return permission;
  }

  private async executeExternalExecutorWithWorkspaceRepair(ctx: any, task: Task): Promise<Task> {
    task.executor_used = 'external_executor';
    task.status = 'running';
    const mismatch = this.runExecutor(task, 'external_executor', 'workspace_mismatch');
    this.recordTaskEvent(task, 'external_executor.workspace_mismatch', 'retrying', {
      expectedWorkspace: task.workspace,
      actualWorkspace: 'C:/tmp/outside-workspace',
    });
    task.metadata.externalExecutorWorkspaceRepair = {
      detected: true,
      from: 'C:/tmp/outside-workspace',
      to: task.workspace,
      firstAttemptStatus: mismatch.status,
    };
    task.actions_executed.push(`Workspace ExternalExecutor ajustado para ${task.workspace}.`);

    const repaired = this.runExecutor(task, 'external_executor', 'completed');
    task.status = 'completed';
    task.result_summary = 'ExternalExecutor reexecutou no workspace correto.';
    task.stdout_summary = repaired.status;
    this.recordTaskEvent(task, 'task.completed', 'completed', {
      executor: 'external_executor',
      repairedWorkspace: task.workspace,
    });
    await ctx.reply(`Workspace corrigido e ExternalExecutor reexecutado. [trace:${task.metadata.correlation.traceId}]`);
    return task;
  }

  private async executeZavorthBridgeWithFallback(ctx: any, task: Task): Promise<Task> {
    task.executor_used = 'zavorthBridge';
    task.status = 'running';
    this.runExecutor(task, 'zavorthBridge', 'timeout');
    this.recordTaskEvent(task, 'zavorthBridge.timeout', 'retrying', { attempt: 1 });
    this.runExecutor(task, 'zavorthBridge', 'timeout');
    this.recordTaskEvent(task, 'zavorthBridge.timeout', 'fallback', { attempt: 2 });

    task.fallback_used = true;
    task.executor_used = 'local_executor';
    task.error_summary = 'ZavorthBridge excedeu timeout duas vezes; fallback local usado.';
    const fallback = this.runExecutor(task, 'local_executor', 'completed');
    task.status = 'completed';
    task.stdout_summary = fallback.status;
    task.result_summary = 'Fallback local concluiu a tarefa apos timeout do ZavorthBridge.';
    task.actions_executed.push('Retry ZavorthBridge executado em dry-run.');
    task.actions_executed.push('Fallback local aplicado sem host externo.');
    this.recordTaskEvent(task, 'task.completed', 'completed', {
      executor: 'local_executor',
      fallbackUsed: true,
    });
    await ctx.reply(`ZavorthBridge sem resposta; fallback local concluido. [trace:${task.metadata.correlation.traceId}]`);
    return task;
  }

  private runExecutor(task: Task, executor: string, status: string) {
    const attempt =
      this.executorCalls.filter((call) => call.taskId === task.task_id && call.executor === executor).length + 1;
    const call = {
      taskId: task.task_id,
      executor,
      attempt,
      status,
      traceId: task.metadata.correlation.traceId,
    };
    this.executorCalls.push(call);
    this.recordTaskEvent(task, 'executor.result', status, { executor, attempt });
    return call;
  }

  private createPermission(task: Task): PermissionRequest {
    const now = new Date('2026-04-24T12:00:00.000Z').toISOString();
    const permission: PermissionRequest = {
      permission_id: `phase33-perm-${String(++this.permissionSequence).padStart(3, '0')}`,
      created_at: now,
      updated_at: now,
      task_id: task.task_id,
      executor: 'approved_executor',
      kind: 'command',
      status: 'pending',
      scope: 'once',
      workspace: task.workspace,
      requested_value: task.raw_message,
      resolved_value: null,
      reason: 'Fluxo sensivel exige aprovacao do operador.',
      requested_by: task.user_id,
      decided_by: null,
      decision_note: null,
      metadata: {
        traceId: task.metadata.correlation.traceId,
        surface: task.metadata.correlation.surface,
      },
    };
    this.permissions.set(permission.permission_id, permission);
    return permission;
  }

  private attachPermissionToWebSession(task: Task, permission: PermissionRequest): void {
    const sessionId = task.metadata?.correlation?.sessionId;
    const session = sessionId ? this.webSessions.get(sessionId) : null;
    if (session && !session.approvals.includes(permission.permission_id)) {
      session.approvals.push(permission.permission_id);
    }
  }

  private async replyWithPendingPermissions(ctx: any, _args: string): Promise<void> {
    const pending = [...this.permissions.values()].filter((permission) => permission.status === 'pending');
    const summary = pending.length
      ? pending.map((permission) => permission.permission_id).join(', ')
      : 'nenhuma permissao pendente';
    await ctx.reply(`Permissoes pendentes: ${summary}.`);
  }

  private findPermission(ref: string): PermissionRequest | null {
    const token = String(ref || '').trim().split(/\s+/)[0] || '';
    if (!token) {
      return null;
    }
    return (
      this.permissions.get(token) ||
      [...this.permissions.values()].find((permission) => permission.permission_id.endsWith(token)) ||
      null
    );
  }

  private recordTaskEvent(task: Task, eventType: string, status: string, payload: Record<string, any>): void {
    this.telemetryEvents.push({
      traceId: task.metadata.correlation.traceId,
      eventType,
      status,
      payload: {
        taskId: task.task_id,
        ...payload,
      },
    });
  }

  private createTelegramContext(chatId: string, userId: string) {
    return {
      chat: { id: chatId, type: 'private' },
      from: { id: userId },
      msg: { message_id: this.replies.length + 1 },
      api: {
        editMessageText: async () => undefined,
        sendChatAction: async () => undefined,
      },
      reply: async (text: string) => {
        this.replies.push({
          surface: 'telegram',
          chatId,
          sessionId: null,
          text,
        });
        return { message_id: this.replies.length };
      },
    } as any;
  }

  private createWebContext(session: WebSessionState, surface: 'web' | 'control' = 'web') {
    return {
      chat: { id: session.chatId, type: 'private' },
      from: { id: 'web-user' },
      reply: async (text: string) => {
        this.replies.push({
          surface,
          chatId: session.chatId,
          sessionId: session.sessionId,
          text,
        });
        session.messages.push({ role: 'assistant', content: text, traceId: this.extractTrace(text) });
        return { message_id: this.replies.length };
      },
    } as any;
  }

  private getWebSession(sessionId: string): WebSessionState {
    const existing = this.webSessions.get(sessionId);
    if (existing) {
      return existing;
    }
    const created = {
      sessionId,
      chatId: `web:${sessionId}`,
      messages: [],
      approvals: [],
    };
    this.webSessions.set(sessionId, created);
    return created;
  }

  private latestTaskAfter(previousSize: number): Task | null {
    const values = [...this.tasks.values()];
    return values.length > previousSize ? values[values.length - 1] : null;
  }

  private extractTrace(text: string): string | null {
    const match = String(text || '').match(/\[trace:([^\]]+)\]/);
    return match?.[1] || null;
  }
}
