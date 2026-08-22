import { Task } from '../../../../contracts/TaskContract.js';
import { RouteIntent } from '../../../../orchestrator/IntentRouter.js';
import type { WorkspaceRoutingAdvice } from '../../../../runtime/context/WorkspaceRoutingAdvisor.js';

export type TelegramWorkspaceLearnedRouteLike = {
  executor: string;
  reason: string;
  source: 'workspace_learning';
  strategy: WorkspaceRoutingAdvice['source'] | 'workflow_recommendation';
  dispatchMode: 'execution';
  confidence: number;
} | null;

export class TelegramTaskWorkflowRouteOutcomeService {
  public build(
    task: Task,
    route: RouteIntent,
    advice: WorkspaceRoutingAdvice,
    learnedRoute: TelegramWorkspaceLearnedRouteLike,
  ): Record<string, unknown> {
    const metadata = task.metadata || {};
    const selectedExecutor = String(
      metadata.auto_route_executor
      || learnedRoute?.executor
      || route.executor_preference
      || advice.executor
      || task.executor_used
      || '',
    ).trim() || null;
    const workflowName = String(
      metadata.workflow_name
      || advice.workflow_recommendation?.workflow
      || (selectedExecutor && selectedExecutor.startsWith('workflow:')
        ? selectedExecutor.replace(/^workflow:/, '').trim()
        : ''),
    ).trim() || null;

    return {
      ...(metadata.workspace_route_outcome || {}),
      selected_executor: selectedExecutor,
      final_executor: String(task.executor_used || selectedExecutor || '').trim() || null,
      source: String(
        metadata.auto_route_source
        || learnedRoute?.source
        || advice.source
        || route.dispatch_mode
        || task.source
        || '',
      ).trim() || null,
      strategy: String(
        metadata.auto_route_strategy
        || learnedRoute?.strategy
        || (workflowName ? 'workflow_recommendation' : route.dispatch_mode)
        || '',
      ).trim() || null,
      confidence: Number(
        metadata.auto_route_confidence
        ?? learnedRoute?.confidence
        ?? advice.confidence
        ?? route.routing_confidence
        ?? 0,
      ),
      workflow_name: workflowName,
      task_kind: advice.task_kind,
      task_subtype: advice.task_subtype,
      source_surface: String(metadata.surface_platform || task.source || '').trim() || null,
      tenant_id: String(metadata.tenant_id || metadata.tenant_context?.tenant_id || '').trim() || null,
      final_status: task.status,
      approval_needed: Boolean(task.requires_approval),
      permission_needed: Boolean(metadata.pendingPermissionId),
    };
  }
}
