import { v4 as uuidv4 } from 'uuid';
import type { ExecutionResult } from '../../contracts/ExecutionContract.js';
import {
  buildExecutionLifecycleRecord,
  type ZavorthExecutionCorrelation,
  type ExecutionLifecycleRecord,
} from '../../contracts/ExecutionLifecycleContract.js';
import type { Plan } from '../../contracts/PlanContract.js';
import type { Task } from '../../contracts/TaskContract.js';

export function buildExecutionGatewayLifecycle(
  task: Task,
  plan: Plan,
  correlation: ZavorthExecutionCorrelation,
): ExecutionLifecycleRecord[] {
  return [
    buildExecutionLifecycleRecord({
      kind: 'intent',
      id: task.task_id,
      status: 'received',
      correlation,
      summary: task.normalized_message || task.raw_message || plan.objective,
      source: 'execution-gateway',
      surface: task.source,
      metadata: {
        taskId: task.task_id,
        commandType: task.command_type,
        intent: task.intent,
      },
    }),
    buildExecutionLifecycleRecord({
      kind: 'plan',
      id: plan.plan_id,
      status: 'planned',
      correlation,
      summary: plan.objective,
      source: 'execution-gateway',
      surface: task.source,
      parentId: task.task_id,
      metadata: {
        executorRecommendation: plan.executor_recommendation,
        requiresApproval: plan.requires_approval,
        riskLevel: plan.risk_level,
        stepCount: plan.steps.length,
      },
    }),
  ];
}

export function buildExecutionGatewayOutcomeLifecycle(input: {
  correlation: ZavorthExecutionCorrelation;
  existing: ExecutionLifecycleRecord[];
  plan: Plan;
  result: ExecutionResult;
  task: Task;
}): ExecutionLifecycleRecord[] {
  const { correlation, existing, plan, result, task } = input;
  const records = [
    ...existing,
    buildExecutionLifecycleRecord({
      kind: 'execution',
      id: result.execution_id,
      status: result.success ? 'completed' : 'failed',
      correlation,
      summary: result.success ? 'Execution result completed.'
        : (result.error_message || 'Execution result failed.'),
      source: 'execution-gateway',
      surface: task.source,
      parentId: plan.plan_id,
      timing: result.timing || null,
      metadata: {
        executor: result.executor,
        success: result.success,
        errorCode: result.error_code,
        commandsExecuted: result.commands_executed.length,
        actionsExecuted: result.actions_executed.length,
        timing: result.timing || null,
      },
    }),
    buildExecutionLifecycleRecord({
      kind: 'run',
      status: result.success ? 'completed' : 'failed',
      correlation,
      summary: result.success ? 'Canonical run completed.'
        : (result.error_message || 'Canonical run failed.'),
      source: 'execution-gateway',
      surface: task.source,
      parentId: result.execution_id,
      timing: result.timing || null,
      metadata: {
        timing: result.timing || null,
      },
    }),
  ];

  for (const artifact of result.artifacts || []) {
    const artifactId = resolveArtifactLifecycleId(artifact);
    records.push(
      buildExecutionLifecycleRecord({
        kind: 'artifact',
        id: artifactId,
        status: 'linked',
        correlation: {
          ...correlation,
          artifactId,
        },
        summary: 'Execution artifact linked to canonical run.',
        source: 'execution-gateway',
        surface: task.source,
        parentId: result.execution_id,
      }),
    );
  }

  return records;
}

function resolveArtifactLifecycleId(artifact: unknown): string {
  if (typeof artifact === 'string') {
    return artifact;
  }
  if (artifact && typeof artifact === 'object') {
    const record = artifact as Record<string, unknown>;
    return String(record.id || record.key || record.name || record.path || record.url || uuidv4()).trim();
  }
  return uuidv4();
}
