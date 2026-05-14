import { v4 as uuidv4 } from 'uuid';
import type { ExecutionRequest } from '../../contracts/ExecutionContract.js';
import type {
  ZavorthExecutionCorrelation,
  ExecutionLifecycleRecord,
} from '../../contracts/ExecutionLifecycleContract.js';
import type { Plan } from '../../contracts/PlanContract.js';
import type { Task } from '../../contracts/TaskContract.js';
import type { PolicyEngine } from '../../security/PolicyEngine.js';

export function buildExecutionGatewayRequest(input: {
  correlation: ZavorthExecutionCorrelation;
  decisionLifecycle: ExecutionLifecycleRecord[];
  executorName: string;
  plan: Plan;
  policyEngine: PolicyEngine;
  requestedExecutorName: string;
  task: Task;
}): ExecutionRequest {
  const { correlation, decisionLifecycle, executorName, plan, policyEngine, requestedExecutorName, task } = input;
  const workspace = plan.workspace_recommendation || task.workspace || '';
  const policy = policyEngine.getPolicy();
  const extraAllowedPaths = Array.isArray(task.metadata?.extra_allowed_paths)
    ? task.metadata.extra_allowed_paths.filter(
        (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0,
      )
    : [];
  const extraAllowedCommands = Array.isArray(task.metadata?.extra_allowed_commands)
    ? task.metadata.extra_allowed_commands.filter(
        (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0,
      )
    : [];
  const extraAllowedPathPolicies = Array.isArray(task.metadata?.extra_allowed_path_policies)
    ? task.metadata.extra_allowed_path_policies.filter(
        (value: unknown) => Boolean(value && typeof value === 'object'),
      )
    : extraAllowedPaths.map((pathValue: string) => ({
        path: pathValue,
        access_level: 'read_only',
        scope: 'once',
      }));
  const extraAllowedCommandPolicies = Array.isArray(task.metadata?.extra_allowed_command_policies)
    ? task.metadata.extra_allowed_command_policies.filter(
        (value: unknown) => Boolean(value && typeof value === 'object'),
      )
    : extraAllowedCommands.map((commandValue: string) => ({
        command: commandValue,
        match_type: 'exact',
        scope: 'once',
      }));

  return {
    execution_id: uuidv4(),
    task_id: task.task_id,
    executor: executorName,
    workspace,
    objective: plan.objective,
    instructions: plan.steps
      .map((step) => step.command || step.description)
      .filter((value): value is string => Boolean(value && value.trim())),
    allowed_paths: Array.from(new Set(workspace ? [workspace, ...extraAllowedPaths] : extraAllowedPaths)),
    blocked_paths: [...policy.blocked_paths],
    allowed_commands: Array.from(new Set(extraAllowedCommands)),
    blocked_commands: [...policy.blocked_commands],
    timeout_seconds: policyEngine.getMaxCommandTimeout(),
    dry_run: false,
    requires_backup: plan.steps.some((step) => step.sensitive),
    metadata: {
      plan_id: plan.plan_id,
      traceId: correlation.traceId,
      runId: correlation.runId,
      sessionId: correlation.sessionId,
      approvalId: correlation.approvalId,
      artifactId: correlation.artifactId,
      requested_executor: requestedExecutorName,
      sandboxRequired:
        Boolean(task.metadata?.sandboxRequired) ||
        plan.steps.some((step) => step.sensitive) ||
        plan.steps.some((step) => String(step.command || '').match(/\b(test|jest|vitest|pytest|playwright|cypress)\b/i)),
      untrustedContent: Boolean(task.metadata?.untrustedContent),
      task_metadata: task.metadata || {},
      allowed_path_policies: extraAllowedPathPolicies,
      allowed_command_policies: extraAllowedCommandPolicies,
      execution_lifecycle: decisionLifecycle,
    },
  };
}
