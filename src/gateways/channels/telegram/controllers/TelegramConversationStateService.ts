import { Task, type TaskStatus } from '../../../../contracts/TaskContract.js';
import { TaskManager } from '../../../../orchestrator/TaskManager.js';
import { buildWorkspaceContinuityContext } from '../../../../runtime/context/WorkspaceContinuityContext.js';
import type { WorkspaceTaskKind, WorkspaceTaskSubtype } from '../../../../services/WorkspaceTaskKind.js';
import { logger } from '../../../../logger.js';

type WorkspaceStrategySnapshotBuilder = (task: Task, taskGoal?: string) => Record<string, unknown>;

type ContinuityContext = ReturnType<typeof buildWorkspaceContinuityContext>;

interface AgentGatewayRunResult {
  run?: {
    id?: string | null;
    traceId?: string | null;
    requestId?: string | null;
    status?: string | null;
    summary?: string | null;
    toolExposure?: { tools?: Array<{ id?: string | null }> | null } | null;
    approvals?: Array<{ id?: string | null; status?: string | null; risk?: string | null }> | null;
    metadata?: { graphRuntimeBackend?: { called?: boolean } | null } | null;
  } | null;
  replies?: Array<{ text?: string }> | null;
  ok?: boolean;
}

interface AutonomousGraphResult {
  finalReply?: string | null;
  criticFeedback?: string | null;
  error?: string | null;
  traceId?: string | null;
  status?: string | null;
  approved?: boolean;
  providerName?: string | null;
  modelName?: string | null;
  iterations?: number | null;
  tokenBudget?: unknown;
  costBudget?: unknown;
  ok?: boolean;
}

export type TelegramConversationStateServiceDeps = {
  taskManager?: TaskManager;
  buildWorkspaceStrategySnapshot: WorkspaceStrategySnapshotBuilder;
};

export class TelegramConversationStateService {
  constructor(private readonly deps: TelegramConversationStateServiceDeps) {}

  public recordDirectResponseOutcome(
    task: Task,
    taskKind: WorkspaceTaskKind,
    taskSubtype: WorkspaceTaskSubtype,
    styleHints: string[],
    llm?: { providerName: string; modelName?: string },
    continuityContext?: ContinuityContext | null,
    responseText?: string | null,
    isContinuationRequest = false,
  ): void {
    const finishedAt = new Date().toISOString();
    const surfaceSummary = this.buildTelegramSurfaceSummary(
      continuityContext,
      responseText || task.result_summary || task.raw_message || null,
      isContinuationRequest,
    );
    task.metadata = {
      ...(task.metadata || {}),
      direct_response_last_run: {
        taskKind,
        taskSubtype,
        providerName: String(llm?.providerName || '').trim() || null,
        modelName: String(llm?.modelName || '').trim() || null,
        styleHints: Array.isArray(styleHints) ? styleHints.slice(0, 6) : [],
        finishedAt,
      },
      telegram_surface_summary: surfaceSummary,
      workspace_route_outcome: task.metadata?.workspace_route_outcome
        ? {
            ...(task.metadata.workspace_route_outcome || {}),
            final_status: 'completed',
            updated_at: finishedAt,
            approval_status:
              String(task.metadata.workspace_route_outcome?.approval_status || task.approval_status || '').trim()
              || task.approval_status,
          }
        : task.metadata?.workspace_route_outcome,
    };
    task.result_summary = responseText || task.result_summary || null;
    task.error_summary = null;

    if (!this.deps.taskManager) {
      return;
    }

    try {
      this.persistDirectTerminalState(task, 'direct_response_completed');
    } catch (err) {
      // best-effort persistence for workspace learning
      logger.warn('[TelegramConversationState] persistDirectTerminalState failed, falling back to saveTask', { error: err instanceof Error ? err.message : String(err) });
      this.deps.taskManager.saveTask(task);
    }
  }

  public markAgentGatewayRunRunning(task: Task, taskGoal: string): void {
    const startedAt = new Date().toISOString();
    task.planner_used = 'zavorth_agent_gateway';
    task.executor_used = 'agent_run_service';
    task.metadata = {
      ...(task.metadata || {}),
      agent_gateway_last_run: {
        ...(task.metadata?.agent_gateway_last_run || {}),
        taskGoal,
        startedAt,
        status: 'running',
        entrypoint: 'ZavorthAgentGateway.handle',
        graphRuntimeServiceCalled: false,
      },
    };

    this.persistAgentGatewayState(task, 'running', 'agent_gateway_start');
  }

  public recordAgentGatewayRunOutcome(task: Task, taskGoal: string, result: AgentGatewayRunResult): void {
    const finishedAt = new Date().toISOString();
    const run = result?.run || null;
    const runStatus = String(run?.status || (result?.ok ? 'completed' : 'failed')).trim() || 'failed';
    const replyText = String(result?.replies?.[0]?.text || '').trim();
    const outcomeSummary =
      replyText
      || String(run?.summary || '').trim()
      || (result?.ok ? 'Execucao registrada pelo runtime universal.' : 'A execucao governada falhou.');
    const continuityContext = buildWorkspaceContinuityContext(task, String(task.source || 'telegram').trim());
    const requestedTools = Array.isArray(run?.toolExposure?.tools)
      ? run.toolExposure.tools.map((tool) => String(tool?.id || '').trim()).filter(Boolean)
      : [];

    task.planner_used = 'zavorth_agent_gateway';
    task.executor_used = 'agent_run_service';
    task.metadata = {
      ...(task.metadata || {}),
      agent_gateway_last_run: {
        taskGoal,
        runId: run?.id || null,
        traceId: run?.traceId || null,
        requestId: run?.requestId || null,
        status: runStatus,
        summary: String(run?.summary || outcomeSummary).trim() || null,
        replyText: replyText || null,
        requestedTools,
        approvals: Array.isArray(run?.approvals)
          ? run.approvals.map((approval) => ({
              id: approval?.id || null,
              status: approval?.status || null,
              risk: approval?.risk || null,
            }))
          : [],
        entrypoint: 'ZavorthAgentGateway.handle',
        agentRunServiceUsed: true,
        graphRuntimeServiceCalled: Boolean(run?.metadata?.graphRuntimeBackend?.called),
        graphRuntimeBackend: run?.metadata?.graphRuntimeBackend || null,
        workspaceStrategy: this.deps.buildWorkspaceStrategySnapshot(task, taskGoal),
        finishedAt,
      },
      telegram_surface_summary: this.buildTelegramSurfaceSummary(
        continuityContext,
        outcomeSummary,
        false,
      ),
    };

    if (runStatus === 'waiting_approval') {
      task.requires_approval = true;
      task.approval_status = 'pending';
      task.result_summary = outcomeSummary;
      task.error_summary = null;
      this.persistAgentGatewayState(task, 'waiting_approval', 'agent_gateway_waiting_approval');
      return;
    }

    if (runStatus === 'completed') {
      task.approval_status = task.approval_status === 'pending' ? 'approved' : task.approval_status;
      task.result_summary = outcomeSummary;
      task.error_summary = null;
      this.persistAgentGatewayState(task, 'completed', 'agent_gateway_completed');
      return;
    }

    if (runStatus === 'queued' || runStatus === 'running' || runStatus === 'thinking') {
      task.result_summary = outcomeSummary;
      task.error_summary = null;
      this.persistAgentGatewayState(task, 'running', 'agent_gateway_running');
      return;
    }

    task.result_summary = null;
    task.error_summary = outcomeSummary;
    this.persistAgentGatewayState(
      task,
      runStatus === 'cancelled' ? 'cancelled' : 'failed',
      'agent_gateway_failed',
    );
  }

  public recordAgentGatewayRunException(task: Task, taskGoal: string, error: unknown): void {
    const message = error instanceof Error
      ? error.message
      : String(error || 'Unexpected failure in the universal runtime.');
    const continuityContext = buildWorkspaceContinuityContext(task, String(task.source || 'telegram').trim());
    task.planner_used = 'zavorth_agent_gateway';
    task.executor_used = 'agent_run_service';
    task.result_summary = null;
    task.error_summary = message;
    task.metadata = {
      ...(task.metadata || {}),
      agent_gateway_last_run: {
        taskGoal,
        status: 'failed',
        entrypoint: 'ZavorthAgentGateway.handle',
        agentRunServiceUsed: true,
        graphRuntimeServiceCalled: false,
        workspaceStrategy: this.deps.buildWorkspaceStrategySnapshot(task, taskGoal),
        finishedAt: new Date().toISOString(),
      },
      telegram_surface_summary: this.buildTelegramSurfaceSummary(
        continuityContext,
        message,
        false,
      ),
    };
    this.persistAgentGatewayState(task, 'failed', 'agent_gateway_exception');
  }

  public markAutonomousTaskRunning(task: Task, taskGoal: string): void {
    if (!this.deps.taskManager) {
      return;
    }

    task.planner_used = 'supervisor_graph';
    task.executor_used = 'god_mode';
    task.metadata = {
      ...(task.metadata || {}),
      autonomous_graph_last_run: {
        ...(task.metadata?.autonomous_graph_last_run || {}),
        taskGoal,
        startedAt: new Date().toISOString(),
        status: 'running',
      },
    };

    try {
      if (task.status === 'pending') {
        this.deps.taskManager.advanceState(task, 'parsed', {
          reason: 'autonomous_graph_start',
          actor: 'telegram-conversation',
        });
      }
      if (task.status === 'parsed' || task.status === 'planned' || task.status === 'approved' || task.status === 'waiting_approval') {
        this.deps.taskManager.advanceState(task, 'running', {
          reason: 'autonomous_graph_start',
          actor: 'telegram-conversation',
        });
      }
      this.deps.taskManager.saveTask(task);
    } catch (err) {
      logger.warn('[TelegramConversationState] advanceState failed, falling back to saveTask', { error: err instanceof Error ? err.message : String(err) });
      this.deps.taskManager.saveTask(task);
    }
  }

  public recordAutonomousTaskOutcome(task: Task, taskGoal: string, result: AutonomousGraphResult): void {
    const finishedAt = new Date().toISOString();
    const outcomeSummary = String(result?.finalReply || result?.criticFeedback || result?.error || '').trim() || null;
    const continuityContext = buildWorkspaceContinuityContext(task, String(task.source || 'telegram').trim());
    task.planner_used = 'supervisor_graph';
    task.executor_used = 'god_mode';
    task.metadata = {
      ...(task.metadata || {}),
      autonomous_graph_last_run: {
        taskGoal,
        traceId: result?.traceId || null,
        status: result?.status || 'failed',
        approved: result?.approved === true,
        providerName: String(result?.providerName || '').trim() || null,
        modelName: String(result?.modelName || '').trim() || null,
        iterations: Number(result?.iterations || 0),
        criticFeedback: result?.criticFeedback || null,
        tokenBudget: result?.tokenBudget || null,
        costBudget: result?.costBudget || null,
        workspaceStrategy: this.deps.buildWorkspaceStrategySnapshot(task, taskGoal),
        finishedAt,
      },
      telegram_surface_summary: this.buildTelegramSurfaceSummary(
        continuityContext,
        outcomeSummary,
        false,
      ),
    };

    if (result?.ok) {
      task.result_summary = outcomeSummary || 'Autonomous task completed by God Mode.';
      task.error_summary = null;
      this.persistAutonomousTerminalState(task, 'completed', 'autonomous_graph_completed');
      return;
    }

    if (result?.status === 'max_iterations') {
      task.result_summary = null;
      task.error_summary = outcomeSummary || 'The autonomous task reached the iteration limit.';
      this.persistAutonomousTerminalState(task, 'failed', 'autonomous_graph_max_iterations');
      return;
    }

    task.result_summary = null;
    task.error_summary = outcomeSummary || 'Autonomous orchestration failed.';
    this.persistAutonomousTerminalState(task, 'failed', 'autonomous_graph_failed');
  }

  public recordAutonomousTaskException(task: Task, taskGoal: string, error: unknown): void {
    const continuityContext = buildWorkspaceContinuityContext(task, String(task.source || 'telegram').trim());
    task.planner_used = 'supervisor_graph';
    task.executor_used = 'god_mode';
    task.result_summary = null;
    task.error_summary = error instanceof Error
      ? error.message
      : String(error || 'Unexpected failure in autonomous orchestration.');
    task.metadata = {
      ...(task.metadata || {}),
      autonomous_graph_last_run: {
        taskGoal,
        status: 'failed',
        approved: false,
        providerName: null,
        modelName: null,
        iterations: 0,
        criticFeedback: null,
        workspaceStrategy: this.deps.buildWorkspaceStrategySnapshot(task, taskGoal),
        finishedAt: new Date().toISOString(),
      },
      telegram_surface_summary: this.buildTelegramSurfaceSummary(
        continuityContext,
        task.error_summary,
        false,
      ),
    };
    this.persistAutonomousTerminalState(task, 'failed', 'autonomous_graph_exception');
  }

  public decorateReplyWithContinuation(
    text: string,
    continuityContext: ContinuityContext | null | undefined,
    isContinuationRequest: boolean,
  ): string {
    const body = String(text || '').trim();
    const title = String(continuityContext?.titleHint || '').trim();
    if (!body || !title || !isContinuationRequest) {
      return body;
    }

    const base = body.toLowerCase().includes(title.toLowerCase())
      ? body
      : `Retomando ${title}.\n\n${body}`;
    const nextActions = Array.isArray(continuityContext?.nextActions)
      ? continuityContext.nextActions.filter((entry) => entry?.command).slice(0, 2)
      : [];
    if (nextActions.length === 0) {
      return base;
    }

    return `${base}\n\nAtalhos agora:\n${nextActions
      .map((entry) => `- ${entry.label}: ${entry.command}`)
      .join('\n')}`;
  }

  private buildTelegramSurfaceSummary(
    continuityContext: ContinuityContext | null | undefined,
    body: string | null,
    isContinuationRequest: boolean,
  ): Record<string, unknown> | null {
    const summary = String(body || '').trim();
    const titleHint = String(continuityContext?.titleHint || '').trim() || null;
    const followupPrompt = String(continuityContext?.followupPrompt || '').trim() || null;
    if (!summary && !titleHint && !followupPrompt) {
      return null;
    }

    return {
      titleHint,
      summary,
      operationalInsight: String(continuityContext?.operationalInsight || '').trim() || null,
      followupPrompt,
      workflowLabel: continuityContext?.workflowRecommendation?.label || null,
      recentArtifact: continuityContext?.recentArtifact?.name || null,
      activeFocus: continuityContext?.activeFocus?.label || null,
      nextActions: Array.isArray(continuityContext?.nextActions)
        ? continuityContext?.nextActions.slice(0, 3).map((entry) => ({
            kind: entry.kind,
            label: entry.label,
            command: entry.command,
          }))
        : [],
      isContinuationRequest,
      updatedAt: new Date().toISOString(),
    };
  }

  private persistAutonomousTerminalState(task: Task, status: 'completed' | 'failed', reason: string): void {
    if (!this.deps.taskManager) {
      return;
    }

    try {
      if (task.status === 'pending') {
        this.deps.taskManager.advanceState(task, 'parsed', {
          reason,
          actor: 'telegram-conversation',
        });
      }
      if (task.status === 'parsed' || task.status === 'planned' || task.status === 'approved' || task.status === 'waiting_approval') {
        this.deps.taskManager.advanceState(task, 'running', {
          reason,
          actor: 'telegram-conversation',
        });
      }
      if (task.status === 'running' || task.status === 'validating' || task.status === 'delivery_pending') {
        this.deps.taskManager.advanceState(task, status, {
          reason,
          actor: 'telegram-conversation',
        });
      }
      this.deps.taskManager.saveTask(task);
    } catch (err) {
      logger.warn('[TelegramConversationState] advanceState failed, falling back to saveTask', { error: err instanceof Error ? err.message : String(err) });
      this.deps.taskManager.saveTask(task);
    }
  }

  private persistDirectTerminalState(task: Task, reason: string): void {
    if (!this.deps.taskManager) {
      return;
    }

    try {
      if (task.status === 'pending') {
        this.deps.taskManager.advanceState(task, 'parsed', {
          reason,
          actor: 'telegram-conversation',
        });
      }
      if (task.status === 'parsed' || task.status === 'planned' || task.status === 'approved' || task.status === 'waiting_approval') {
        this.deps.taskManager.advanceState(task, 'running', {
          reason,
          actor: 'telegram-conversation',
        });
      }
      if (task.status === 'running' || task.status === 'validating' || task.status === 'delivery_pending') {
        this.deps.taskManager.advanceState(task, 'completed', {
          reason,
          actor: 'telegram-conversation',
        });
      }
      this.deps.taskManager.saveTask(task);
    } catch (err) {
      logger.warn('[TelegramConversationState] advanceState to completed failed, falling back to saveTask', { error: err instanceof Error ? err.message : String(err) });
      this.deps.taskManager.saveTask(task);
    }
  }

  private persistAgentGatewayState(task: Task, status: TaskStatus, reason: string): void {
    if (!this.deps.taskManager) {
      return;
    }

    try {
      if (task.status === 'pending') {
        this.deps.taskManager.advanceState(task, 'parsed', {
          reason,
          actor: 'telegram-conversation',
        });
      }
      if (
        status === 'running'
        && (task.status === 'parsed' || task.status === 'planned' || task.status === 'approved' || task.status === 'waiting_approval')
      ) {
        this.deps.taskManager.advanceState(task, 'running', {
          reason,
          actor: 'telegram-conversation',
        });
      }
      if (status === 'waiting_approval' && task.status !== 'waiting_approval') {
        this.deps.taskManager.advanceState(task, 'waiting_approval', {
          reason,
          actor: 'telegram-conversation',
        });
      }
      if (
        (status === 'completed' || status === 'failed' || status === 'cancelled')
        && (task.status === 'parsed' || task.status === 'planned' || task.status === 'approved' || task.status === 'waiting_approval')
      ) {
        this.deps.taskManager.advanceState(task, 'running', {
          reason,
          actor: 'telegram-conversation',
        });
      }
      if (
        (status === 'completed' || status === 'failed' || status === 'cancelled')
        && (task.status === 'running' || task.status === 'validating' || task.status === 'delivery_pending')
      ) {
        this.deps.taskManager.advanceState(task, status, {
          reason,
          actor: 'telegram-conversation',
        });
      }
      this.deps.taskManager.saveTask(task);
    } catch (err) {
      logger.warn('[TelegramConversationState] advanceState failed, falling back to saveTask', { error: err instanceof Error ? err.message : String(err) });
      this.deps.taskManager.saveTask(task);
    }
  }
}
