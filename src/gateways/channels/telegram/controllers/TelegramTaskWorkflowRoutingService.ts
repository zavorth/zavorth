import { ParsedCommand } from '../../../../gateways/channels/telegram/CommandParser.js';
import { Task } from '../../../../contracts/TaskContract.js';
import { RouteIntent } from '../../../../orchestrator/IntentRouter.js';
import type { WorkspaceRoutingAdvice } from '../../../../runtime/context/WorkspaceRoutingAdvisor.js';
import type {
  WorkflowRunCreateOptions,
  WorkflowWorkspaceContext,
} from '../../../../runtime/workflows/WorkflowRunService.js';
import { TelegramTaskWorkflowRouteOutcomeService } from '../../../../gateways/channels/telegram/controllers/TelegramTaskWorkflowRouteOutcomeService.js';

import { TelegramTaskWorkflowWorkspaceContextBuilder } from '../../../../gateways/channels/telegram/controllers/TelegramTaskWorkflowWorkspaceContextBuilder.js';

export type TelegramWorkspaceLearnedRoute = {
  executor: string;
  reason: string;
  source: 'workspace_learning';
  strategy: WorkspaceRoutingAdvice['source'] | 'workflow_recommendation';
  dispatchMode: 'execution';
  confidence: number;
} | null;

export class TelegramTaskWorkflowRoutingService {
  private readonly workspaceContextBuilder = new TelegramTaskWorkflowWorkspaceContextBuilder();
  private readonly routeOutcomeBuilder = new TelegramTaskWorkflowRouteOutcomeService();

  public buildWorkflowWorkspaceContext(task: Task): WorkflowWorkspaceContext | null {
    return this.workspaceContextBuilder.build(task);
  }

  public buildWorkflowLaunchOptions(task: Task): WorkflowRunCreateOptions {
    const metadata = task.metadata || {};
    return {
      origin: {
        origin_task_id: task.task_id,
        origin_user_id: task.user_id || null,
        runtime_user_id: String(
          metadata.runtime_user_id
          || metadata.surface_runtime_user_id
          || task.user_id
          || '',
        ).trim() || null,
        tenant_id: String(metadata.tenant_id || metadata.tenant_context?.tenant_id || '').trim() || null,
        source_surface: String(metadata.surface_platform || task.source || '').trim() || null,
        route_strategy: String(
          metadata.auto_route_strategy
          || metadata.workspace_learned_route?.strategy
          || metadata.route_dispatch_mode
          || '',
        ).trim() || null,
        route_source: String(
          metadata.auto_route_source
          || metadata.workspace_learned_route?.source
          || metadata.workspace_routing_advice?.source
          || '',
        ).trim() || null,
        parent_chat_id: String(task.chat_id || '').trim() || null,
      },
      trigger: {
        task_kind: String(metadata.route_task_kind || '').trim() || null,
        task_subtype: String(metadata.route_task_subtype || '').trim() || null,
      },
    };
  }

  public buildWorkspaceRouteOutcome(
    task: Task,
    route: RouteIntent,
    advice: WorkspaceRoutingAdvice,
    learnedRoute: TelegramWorkspaceLearnedRoute,
  ): Record<string, any> {
    return this.routeOutcomeBuilder.build(task, route, advice, learnedRoute);
  }

  public resolveWorkspaceLearnedRoute(
    parsed: ParsedCommand,
    route: RouteIntent,
    workspaceRoutingAdvice: WorkspaceRoutingAdvice,
  ): TelegramWorkspaceLearnedRoute {
    if (parsed.command_type !== '/auto') {
      return null;
    }

    if (route.dispatch_mode === 'execution' && route.executor_preference) {
      return null;
    }

    if (parsed.explicit_executor) {
      return null;
    }

    if (workspaceRoutingAdvice.workflow_recommendation) {
      return {
        executor: `workflow:${workspaceRoutingAdvice.workflow_recommendation.workflow}`,
        reason: workspaceRoutingAdvice.workflow_recommendation.rationale,
        source: 'workspace_learning',
        strategy: 'workflow_recommendation',
        dispatchMode: 'execution',
        confidence: workspaceRoutingAdvice.workflow_recommendation.confidence,
      };
    }

    if (!workspaceRoutingAdvice.executor) {
      return null;
    }

    return {
      executor: workspaceRoutingAdvice.executor,
      reason: workspaceRoutingAdvice.rationale[0]
        || `Workspace sugere ${workspaceRoutingAdvice.executor} como executor preferencial para ${workspaceRoutingAdvice.task_kind}.`,
      source: 'workspace_learning',
      strategy: workspaceRoutingAdvice.source,
      dispatchMode: 'execution',
      confidence: workspaceRoutingAdvice.confidence,
    };
  }
}
