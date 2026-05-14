import { ExecutionGateway } from '../../../src/execution/ExecutionGateway';
import type { ExecutionRequest, ExecutionResult } from '../../../src/contracts/ExecutionContract';
import type { IExecutor } from '../../../src/contracts/IExecutor';
import type { Plan } from '../../../src/contracts/PlanContract';
import type { Task } from '../../../src/contracts/TaskContract';
import { OperationalMode } from '../../../src/security/OperationalMode';

class TelemetryExecutor implements IExecutor {
  public readonly name = 'stub';

  constructor(private readonly result: ExecutionResult) {}

  public async execute(_request: ExecutionRequest): Promise<ExecutionResult> {
    return this.result;
  }

  public async isAvailable(): Promise<boolean> {
    return true;
  }
}

describe('ExecutionGateway telemetry', () => {
  const workspace = process.cwd().replace(/\\/g, '/');

  function buildTask(): Task {
    const now = new Date().toISOString();
    return {
      task_id: 'task-telemetry',
      created_at: now,
      updated_at: now,
      source: 'telegram',
      chat_id: 'chat',
      user_id: 'user',
      raw_message: '/run npm test',
      normalized_message: '/run npm test',
      command_type: '/run',
      intent: 'shell_execution',
      target: null,
      workspace,
      risk_level: 1,
      status: 'running',
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
      metadata: {},
    };
  }

  function buildPlan(): Plan {
    return {
      plan_id: 'plan-telemetry',
      task_id: 'task-telemetry',
      objective: 'Rodar teste local',
      context: 'Teste',
      assumptions: [],
      executor_recommendation: 'local_executor',
      workspace_recommendation: workspace,
      risk_level: 1,
      requires_approval: false,
      steps: [
        {
          step_id: 'step-1',
          type: 'exec',
          description: 'Rodar npm test',
          tool: null,
          args: null,
          command: 'npm test',
          file_targets: [],
          expected_output: 'ok',
          sensitive: false,
        },
      ],
      validation_steps: [],
      success_condition: 'ok',
      rollback_condition: null,
      notes: [],
    };
  }

  it('records start and completion events for successful executions', async () => {
    const telemetryRuntime = {
      record: jest.fn().mockResolvedValue(undefined),
    } as any;
    const gateway = new ExecutionGateway(
      { log: jest.fn() } as any,
      OperationalMode.BUILD,
      undefined,
      telemetryRuntime,
    );
    gateway.registerExecutor(
      'local',
      new TelemetryExecutor({
        execution_id: 'exec-telemetry',
        task_id: 'task-telemetry',
        executor: 'local',
        success: true,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        actions_executed: [],
        files_read: [],
        files_written: [],
        files_deleted: [],
        commands_executed: [],
        stdout: 'ok',
        stderr: null,
        diff_summary: null,
        artifacts: [],
        rollback_available: false,
        error_code: null,
        error_message: null,
        metadata: {},
      }),
    );

    const decision = await gateway.submit(buildTask(), buildPlan());

    expect(telemetryRuntime.record).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: 'task:task-telemetry',
        source: 'execution-gateway',
        eventType: 'execution.started',
        status: 'running',
      }),
    );
    expect(telemetryRuntime.record).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: 'task:task-telemetry',
        source: 'execution-gateway',
        eventType: 'execution.completed',
        status: 'success',
        payload: expect.objectContaining({
          traceId: 'task:task-telemetry',
          runId: 'task:task-telemetry',
          sessionId: 'chat',
          timing: decision.execution_result?.timing,
        }),
      }),
    );
  });
});
