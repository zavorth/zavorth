import { Context } from 'grammy';
import { ParsedCommand } from '../../../../gateways/channels/telegram/CommandParser.js';
import { Task } from '@zavorth/contracts/TaskContract.js';
import { RouteIntent } from '../../../../orchestrator/IntentRouter.js';
import { RiskClassification } from '../../../../orchestrator/RiskClassifier.js';
import {
  WorkspaceRoutingAdvisor,
  type WorkspaceRoutingAdvice,
} from '@zavorth/runtime/context/WorkspaceRoutingAdvisor.js';
import type {
  WorkflowRunCreateOptions,
  WorkflowWorkspaceContext,
} from '@zavorth/runtime/workflows/WorkflowRunService.js';
import { telegramLegacySurfacePolicyService } from '../../../../gateways/channels/telegram/controllers/TelegramLegacySurfacePolicyService.js';
import { asErrorLike } from '../../../../utils/errorLike.js';

type ExecutionControllerLike = {
  executeImmediate(ctx: Context, task: Task, isDryRun: boolean): Promise<void>;
};

type ZavorthBridgeControllerLike = {
  handleTaskExecution(ctx: Context, task: Task, payload: string): Promise<void>;
};

type NaturalConversationIngressLike = (
  ctx: Context,
  task: Task,
  messageText: string,
  inlineData?: Array<{ mimeType: string; data: string }>,
) => Promise<void>;

type VideoHandlerLike = {
  containsSupportedVideoUrl(text: string): boolean;
  prepareFromText(
    text: string,
  ): Promise<{ messageText: string; inlineData?: Array<{ mimeType: string; data: string }> } | null>;
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

type LearnedRoute = {
  executor: string;
  reason: string;
  source: 'workspace_learning';
  strategy: WorkspaceRoutingAdvice['source'] | 'workflow_recommendation';
  dispatchMode: 'execution';
  confidence: number;
} | null;

export type TelegramTaskAutoRouteServiceDeps = {
  zavorthBridgeController: ZavorthBridgeControllerLike;
  naturalConversationIngress: NaturalConversationIngressLike;
  executionController: ExecutionControllerLike;
  videoHandler: VideoHandlerLike;
  workflowController: WorkflowControllerLike;
  persistTask: (task: Task) => void;
  maybeHoldForApproval: (
    ctx: Context,
    task: Task,
    classification: RiskClassification,
    executorLabel: string,
    routingReason: string | null,
    forceApproval?: boolean,
  ) => Promise<boolean>;
  describeExecutor: (executor: string) => string;
  buildWorkflowLaunchOptions: (task: Task) => WorkflowRunCreateOptions;
  buildWorkspaceRouteOutcome: (
    task: Task,
    route: RouteIntent,
    advice: WorkspaceRoutingAdvice,
    learnedRoute: LearnedRoute,
  ) => Record<string, any>;
};

export type TelegramTaskAutoRouteServiceParams = {
  ctx: Context;
  task: Task;
  text: string;
  inlineData?: Array<{ mimeType: string; data: string }>;
  parsed: ParsedCommand;
  route: RouteIntent;
  classification: RiskClassification;
  learnedRoute: LearnedRoute;
  workflowWorkspaceContext: WorkflowWorkspaceContext | null;
  workspaceRoutingAdvice: WorkspaceRoutingAdvice;
  surfaceForceApproval: boolean;
};

export class TelegramTaskAutoRouteService {
  constructor(private readonly deps: TelegramTaskAutoRouteServiceDeps) {}

  public async handleTaskOrAutoMessage(params: TelegramTaskAutoRouteServiceParams): Promise<void> {
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
    } = params;

    const messageText = parsed.command_args || (!text.startsWith('/') ? text : '');
    if (!messageText.trim()) {
      await ctx.reply(
        telegramLegacySurfacePolicyService.buildCompatibilityTaskPrompt(parsed.command_type),
      );
      return;
    }

    const autoRoutedExecutor =
      route.dispatch_mode === 'execution' && route.executor_preference
        ? String(route.executor_preference).trim()
        : (learnedRoute?.executor || '');
    const autoRouteReason =
      route.dispatch_mode === 'execution' && route.routing_reason
        ? route.routing_reason
        : (learnedRoute?.reason || route.routing_reason || null);
    const autoRouteConfidence =
      route.dispatch_mode === 'execution' && route.executor_preference
        ? (route.routing_confidence ?? null)
        : (learnedRoute?.confidence ?? route.routing_confidence ?? null);

    if (autoRoutedExecutor) {
      task.metadata = {
        ...(task.metadata || {}),
        auto_route_executor: autoRoutedExecutor,
        auto_route_reason: autoRouteReason,
        auto_route_confidence: autoRouteConfidence,
        auto_route_dispatch_mode:
          route.dispatch_mode === 'execution' ? route.dispatch_mode : (learnedRoute?.dispatchMode || 'execution'),
        auto_route_source:
          route.dispatch_mode === 'execution' && route.executor_preference ? 'capability' : (learnedRoute?.source || 'workspace_learning'),
        auto_route_strategy:
          route.dispatch_mode === 'execution' && route.executor_preference ? 'capability' : (learnedRoute?.strategy || null),
        workspace_route_outcome: this.deps.buildWorkspaceRouteOutcome(
          {
            ...task,
            metadata: {
              ...(task.metadata || {}),
              auto_route_executor: autoRoutedExecutor,
              auto_route_reason: autoRouteReason,
              auto_route_confidence: autoRouteConfidence,
              auto_route_dispatch_mode:
                route.dispatch_mode === 'execution' ? route.dispatch_mode : (learnedRoute?.dispatchMode || 'execution'),
              auto_route_source:
                route.dispatch_mode === 'execution' && route.executor_preference ? 'capability' : (learnedRoute?.source || 'workspace_learning'),
              auto_route_strategy:
                route.dispatch_mode === 'execution' && route.executor_preference ? 'capability' : (learnedRoute?.strategy || null),
            },
          },
          route,
          workspaceRoutingAdvice,
          learnedRoute,
        ),
      };
      this.deps.persistTask(task);

      if (
        await this.deps.maybeHoldForApproval(
          ctx,
          task,
          classification,
          this.deps.describeExecutor(autoRoutedExecutor),
          autoRouteReason,
          surfaceForceApproval,
        )
      ) {
        return;
      }

      if (autoRoutedExecutor === 'zavorthBridge') {
        await this.deps.zavorthBridgeController.handleTaskExecution(ctx, task, messageText);
        return;
      }

      if (autoRoutedExecutor.startsWith('workflow:')) {
        await this.deps.workflowController.handleNamedWorkflow(
          ctx,
          autoRoutedExecutor.replace(/^workflow:/, '').trim(),
          messageText,
          task.workspace || undefined,
          workflowWorkspaceContext,
          this.deps.buildWorkflowLaunchOptions(task),
        );
        return;
      }

      await this.deps.executionController.executeImmediate(ctx, task, false);
      return;
    }

    if (this.deps.videoHandler.containsSupportedVideoUrl(messageText)) {
      if (ctx.chat?.id) {
        await ctx.api.sendChatAction(ctx.chat.id, 'typing');
      }
      try {
        const prepared = await this.deps.videoHandler.prepareFromText(messageText);
        if (prepared) {
          await this.handleNaturalConversation(
            ctx,
            task,
            prepared.messageText,
            prepared.inlineData,
          );
          return;
        }
      } catch (error: unknown) {
        const err = asErrorLike(error);
        const message = error instanceof Error ? err.message : String(error || 'unknown error');
        await ctx.reply(`Could not prepare this video link right now.\n\nReason: ${message}`);
        return;
      }
    }

    if (inlineData?.length) {
      await this.handleNaturalConversation(ctx, task, messageText, inlineData);
      return;
    }

    await this.handleNaturalConversation(ctx, task, messageText);
  }

  private async handleNaturalConversation(
    ctx: Context,
    task: Task,
    messageText: string,
    inlineData?: Array<{ mimeType: string; data: string }>,
  ): Promise<void> {
    if (inlineData?.length) {
      await this.deps.naturalConversationIngress(ctx, task, messageText, inlineData);
    } else {
      await this.deps.naturalConversationIngress(ctx, task, messageText);
    }
  }
}
