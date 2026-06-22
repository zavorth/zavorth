import { Context } from 'grammy';
import { ParsedCommand } from '../CommandParser.js';
import { Task } from '@zavorth/contracts/TaskContract.js';
import { RouteIntent } from '../../orchestrator/IntentRouter.js';
import { RiskClassification } from '../../orchestrator/RiskClassifier.js';
import { WorkspaceRoutingAdvice } from '@zavorth/runtime/context/WorkspaceRoutingAdvisor.js';
import type {
  WorkflowRunCreateOptions,
  WorkflowWorkspaceContext,
} from '@zavorth/runtime/workflows/WorkflowRunService.js';
import { telegramLegacySurfacePolicyService } from './TelegramLegacySurfacePolicyService.js';
import { buildTaskEventSurfaceResponse } from '@zavorth/domain/surface/application/surface-response/index.js';
import { replyWithTelegramSurfaceResponse } from '../TelegramSurfaceResponseSender.js';

type ExecutionControllerLike = {
  handlePlan(ctx: Context, task: Task): Promise<void>;
  executeImmediate(ctx: Context, task: Task, isDryRun: boolean): Promise<void>;
};

type ZavorthBridgeControllerLike = {
  handleTaskExecution(ctx: Context, task: Task, payload: string): Promise<void>;
};

type WorkflowControllerLike = {
  handleNamedWorkflow(
    ctx: Context,
    workflow: string,
    objective: string,
    workspace?: string,
    workspaceContext?: WorkflowWorkspaceContext | null,
    launchOptions?: WorkflowRunCreateOptions,
  ): Promise<void>;
};

type AutoRouteServiceLike = {
  handleTaskOrAutoMessage(input: {
    ctx: Context;
    task: Task;
    text: string;
    inlineData?: Array<{ mimeType: string; data: string }>;
    parsed: ParsedCommand;
    route: RouteIntent;
    classification: RiskClassification;
    learnedRoute: any;
    workflowWorkspaceContext: WorkflowWorkspaceContext | null;
    workspaceRoutingAdvice: WorkspaceRoutingAdvice;
    surfaceForceApproval: boolean;
  }): Promise<void>;
};

type TelegramTaskDispatchServiceDeps = {
  executionController: ExecutionControllerLike;
  zavorthBridgeController: ZavorthBridgeControllerLike;
  workflowController: WorkflowControllerLike;
  autoRouteService: AutoRouteServiceLike;
  maybeHoldForApproval: (
    ctx: Context,
    task: Task,
    classification: RiskClassification,
    executorLabel: string,
    routingReason: string | null,
    forceApproval?: boolean,
  ) => Promise<boolean>;
  describeExecutor: (executor: string) => string;
  extractTaskPayload: (task: Task) => string;
  buildWorkflowLaunchOptions: (task: Task) => WorkflowRunCreateOptions;
};

export class TelegramTaskDispatchService {
  constructor(private readonly deps: TelegramTaskDispatchServiceDeps) {}

  public async dispatchTaskMessage(input: {
    ctx: Context;
    task: Task;
    text: string;
    inlineData?: Array<{ mimeType: string; data: string }>;
    parsed: ParsedCommand;
    route: RouteIntent;
    classification: RiskClassification;
    learnedRoute: any;
    workflowWorkspaceContext: WorkflowWorkspaceContext | null;
    workspaceRoutingAdvice: WorkspaceRoutingAdvice;
    surfaceForceApproval: boolean;
  }): Promise<void> {
    const {
      ctx,
      task,
      text,
      inlineData,
      parsed,
      route,
      classification,
      learnedRoute,
      workflowWorkspaceContext,
      workspaceRoutingAdvice,
      surfaceForceApproval,
    } = input;
    const isDryRun = parsed.command_type === '/dryrun';

    if (parsed.command_type === '/plan') {
      await this.deps.executionController.handlePlan(ctx, task);
      return;
    }

    if (parsed.command_type === '/ag' || parsed.command_type === '/bridge') {
      if (
        await this.deps.maybeHoldForApproval(
          ctx,
          task,
          classification,
          this.deps.describeExecutor('zavorthBridge'),
          null,
          surfaceForceApproval,
        )
      ) {
        return;
      }

      await this.deps.zavorthBridgeController.handleTaskExecution(
        ctx,
        task,
        this.deps.extractTaskPayload(task),
      );
      return;
    }

    const routedExecutor = String(route.executor_preference || parsed.explicit_executor || '').trim();

    if (routedExecutor.startsWith('workflow:') && parsed.command_type !== '/task' && parsed.command_type !== '/auto') {
      const workflowId = routedExecutor.replace(/^workflow:/, '').trim();
      if (
        await this.deps.maybeHoldForApproval(
          ctx,
          task,
          classification,
          this.deps.describeExecutor(routedExecutor),
          route.routing_reason || null,
        )
      ) {
        return;
      }

      await this.deps.workflowController.handleNamedWorkflow(
        ctx,
        workflowId,
        this.deps.extractTaskPayload(task),
        task.workspace || undefined,
        workflowWorkspaceContext,
        this.deps.buildWorkflowLaunchOptions(task),
      );
      return;
    }

    if ((parsed.command_type !== '/task' && parsed.command_type !== '/auto' && Boolean(routedExecutor)) || parsed.command_type === '/run' || isDryRun) {
      if (
        !isDryRun &&
        await this.deps.maybeHoldForApproval(
          ctx,
          task,
          classification,
          this.deps.describeExecutor(
            parsed.command_type === '/run' || isDryRun
              ? 'local'
              : routedExecutor,
          ),
          route.routing_reason || null,
          !isDryRun && surfaceForceApproval,
        )
      ) {
        return;
      }

      await this.deps.executionController.executeImmediate(ctx, task, isDryRun);
      return;
    }

    if (parsed.command_type === '/task' || parsed.command_type === '/auto') {
      await this.deps.autoRouteService.handleTaskOrAutoMessage({
        ctx,
        task,
        text,
        inlineData,
        parsed,
        route,
        classification,
        learnedRoute,
        workflowWorkspaceContext,
        workspaceRoutingAdvice,
        surfaceForceApproval,
      });
      return;
    }

    const fallbackText = telegramLegacySurfacePolicyService.buildTaskDispatchFallbackMessage(task.task_id);
    await replyWithTelegramSurfaceResponse(
      ctx,
      buildTaskEventSurfaceResponse({
        taskId: task.task_id,
        event: 'dispatch_fallback',
        title: 'Unrecognized task route',
        summary: 'Zavorth did not find a safe executable route for this request.',
        text: fallbackText,
        status: 'blocked',
        reason: 'Command has no compatible dispatch route.',
        riskBlocked: true,
        metadata: {
          commandType: task.command_type,
          executor: task.executor_used || null,
        },
      }),
    );
  }
}
