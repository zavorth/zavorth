import type { ExecutionRequest } from '../../contracts/ExecutionContract.js';
import type { Plan } from '../../contracts/PlanContract.js';
import type { Task } from '../../contracts/TaskContract.js';
import type { ToolHookPipelineService } from '../../services/ToolHookPipelineService.js';
import type { TelemetryRuntimeService } from '../../observability/telemetry/TelemetryRuntimeService.js';
import { resolveExecutionGatewayWorkspace } from './ExecutionGatewayAliases.js';export async function recordExecutionGatewayTelemetry(
  telemetryRuntime: TelemetryRuntimeService | null,
  traceId: string,
  eventType: string,
  status: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!telemetryRuntime) {
    return;
  }

  try {
    await telemetryRuntime.record({
      traceId,
      source: 'execution-gateway',
      eventType,
      status,
      payload,
    });
  } catch (error: unknown) {// telemetry should never break execution flow
  }
}

export function buildExecutionGatewayRuntimeHookContext(input: {
  defaultWorkspace: string | null;
  executorName: string;
  plan: Plan;
  request: ExecutionRequest;
  requestedExecutorName: string;
  task: Task;
  traceId: string;
}): Record<string, unknown> {
  return {
    traceId: input.traceId,
    taskId: input.task.task_id,
    planId: input.plan.plan_id,
    executor: input.executorName,
    requestedExecutor: input.requestedExecutorName,
    workspace: resolveExecutionGatewayWorkspace(input.request.workspace, input.defaultWorkspace),
    riskLevel: input.plan.risk_level,
    requiresApproval: input.plan.requires_approval,
    instructionCount: input.request.instructions.length,
  };
}

export async function runExecutionGatewayRuntimeHook(
  hookPipeline: Pick<ToolHookPipelineService, 'run'>,
  event: 'runtime.before_execute' | 'runtime.after_execute' | 'runtime.exec_failed',
  workspace: string | null,
  context: Record<string, unknown>,
): Promise<{ ok: boolean }> {
  return hookPipeline.run({
    event,
    workspace,
    context,
  });
}

export async function runExecutionGatewayRuntimeFailureHook(
  hookPipeline: Pick<ToolHookPipelineService, 'run'>,
  workspace: string | null,
  context: Record<string, unknown>,
): Promise<void> {
  try {
    await runExecutionGatewayRuntimeHook(hookPipeline, 'runtime.exec_failed', workspace, context);
  } catch (error: unknown) {// Observability hooks must not break the gateway decision.
  }
}
