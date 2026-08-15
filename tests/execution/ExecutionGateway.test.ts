import { ExecutionGateway } from '../../src/execution/ExecutionGateway';
import { Plan } from '../../src/contracts/PlanContract';
import { Task } from '../../src/contracts/TaskContract';
import { IExecutor } from '../../src/contracts/IExecutor';
import { ExecutionRequest, ExecutionResult } from '../../src/contracts/ExecutionContract';
import { OperationalMode } from '../../src/security/OperationalMode';

class StubExecutor implements IExecutor {
  public readonly name = 'stub';
  public readonly executeMock = jest.fn<Promise<ExecutionResult>, [ExecutionRequest]>();

  public async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    return this.executeMock(request);
  }

  public async isAvailable(): Promise<boolean> {
    return true;
  }
}

describe('ExecutionGateway', () => {
  const workspace = __dirname.replace(/\\/g, '/');

  function buildTask(): Task {
    const now = new Date().toISOString();
    return {
      task_id: 'task-1',
      created_at: now,
      updated_at: now,
      source: 'telegram',
      chat_id: 'chat',
      user_id: 'user',
      raw_message: '/run npm run build',
      normalized_message: '/run npm run build',
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

  function buildPlan(executor = 'local_executor'): Plan {
    return {
      plan_id: 'plan-1',
      task_id: 'task-1',
      objective: 'Executar build local',
      context: 'Teste',
      assumptions: [],
      executor_recommendation: executor,
      workspace_recommendation: workspace,
      risk_level: 1,
      requires_approval: false,
      steps: [
        {
          step_id: 'step-1',
          type: 'exec',
          description: 'Rodar npm run build',
          tool: null,
          args: null,
          command: 'npm run build',
          file_targets: [workspace],
          expected_output: 'Build concluido',
          sensitive: false,
        },
      ],
      validation_steps: [],
      success_condition: 'Build concluido',
      rollback_condition: null,
      notes: [],
    };
  }

  it('normalizes executor aliases and forwards policy context to the request', async () => {
    const gateway = new ExecutionGateway({ log: jest.fn() } as any, OperationalMode.BUILD);
    const executor = new StubExecutor();
    executor.executeMock.mockResolvedValue({
      execution_id: 'exec-1',
      task_id: 'task-1',
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
    });
    gateway.registerExecutor('local', executor);

    const decision = await gateway.submit(buildTask(), buildPlan());

    expect(decision.allowed).toBe(true);
    expect(decision.correlation.traceId).toBeTruthy();
    expect(decision.correlation.runId).toBe(decision.correlation.traceId);
    expect(decision.correlation.sessionId).toBe('chat');
    expect(decision.lifecycle).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'intent', id: 'task-1' }),
      expect.objectContaining({ kind: 'plan', id: 'plan-1' }),
      expect.objectContaining({ kind: 'execution', id: 'exec-1' }),
      expect.objectContaining({ kind: 'run', id: decision.correlation.runId }),
    ]));
    expect(decision.execution_result?.timing).toEqual(expect.objectContaining({
      startedAt: expect.any(String),
      finishedAt: expect.any(String),
      durationMs: expect.any(Number),
    }));
    expect(decision.execution_result?.timing?.durationMs).toBeGreaterThanOrEqual(0);
    expect(decision.execution_result?.metadata?.timing).toEqual(decision.execution_result?.timing);
    expect(decision.lifecycle).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'execution',
        traceId: decision.correlation.traceId,
        runId: decision.correlation.runId,
        sessionId: 'chat',
        timing: decision.execution_result?.timing,
        metadata: expect.objectContaining({
          timing: decision.execution_result?.timing,
        }),
      }),
    ]));
    expect(decision.execution_result?.metadata?.execution_lifecycle).toEqual(decision.lifecycle);
    expect(executor.executeMock).toHaveBeenCalledTimes(1);
    expect(executor.executeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        executor: 'local',
        workspace,
        allowed_paths: [workspace],
        blocked_paths: expect.any(Array),
        blocked_commands: expect.any(Array),
        metadata: expect.objectContaining({
          plan_id: 'plan-1',
          traceId: decision.correlation.traceId,
          runId: decision.correlation.runId,
          sessionId: 'chat',
          requested_executor: 'local_executor',
          execution_lifecycle: expect.arrayContaining([
            expect.objectContaining({ kind: 'intent' }),
            expect.objectContaining({ kind: 'plan' }),
          ]),
        }),
      }),
    );
  });

  it('blocks runtime execution when a runtime before hook vetoes the request', async () => {
    const run = jest.fn(async ({ event }: any) => ({
      ok: event !== 'runtime.before_execute' ? true : false,
      event,
      workspace,
      listenerCount: 0,
      workspaceHookCount: 1,
    }));
    const gateway = new ExecutionGateway(
      { log: jest.fn() } as any,
      OperationalMode.BUILD,
      undefined,
      null,
      {
        hookPipelineService: {
          run,
        } as any,
      },
    );
    const executor = new StubExecutor();
    gateway.registerExecutor('local', executor);

    const decision = await gateway.submit(buildTask(), buildPlan());

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/hook bloqueou|hook blocked/i);
    expect(executor.executeMock).not.toHaveBeenCalled();
    expect(run).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        event: 'runtime.before_execute',
        context: expect.objectContaining({
          executor: 'local',
          taskId: 'task-1',
          planId: 'plan-1',
        }),
      }),
    );
    expect(run).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        event: 'runtime.exec_failed',
        context: expect.objectContaining({
          executor: 'local',
          reason: 'blocked_by_hook',
        }),
      }),
    );
  });

  it('runs runtime after_execute once after a successful final execution', async () => {
    const run = jest.fn(async ({ event }: any) => ({
      ok: true,
      event,
      workspace,
      listenerCount: 0,
      workspaceHookCount: 0,
    }));
    const gateway = new ExecutionGateway(
      { log: jest.fn() } as any,
      OperationalMode.BUILD,
      undefined,
      null,
      {
        hookPipelineService: {
          run,
        } as any,
      },
    );
    const executor = new StubExecutor();
    executor.executeMock.mockResolvedValue({
      execution_id: 'exec-ok',
      task_id: 'task-1',
      executor: 'local',
      success: true,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      actions_executed: ['passo'],
      files_read: [],
      files_written: [],
      files_deleted: [],
      commands_executed: ['npm run build'],
      stdout: 'ok',
      stderr: null,
      diff_summary: null,
      artifacts: [],
      rollback_available: false,
      error_code: null,
      error_message: null,
      metadata: {},
    });
    gateway.registerExecutor('local', executor);

    const decision = await gateway.submit(buildTask(), buildPlan());

    expect(decision.allowed).toBe(true);
    expect(run).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        event: 'runtime.before_execute',
      }),
    );
    expect(run).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        event: 'runtime.after_execute',
        context: expect.objectContaining({
          executor: 'local',
          success: true,
          commandsExecuted: 1,
          actionsExecuted: 1,
        }),
      }),
    );
  });

  it('runs runtime exec_failed once when the final execution result is unsuccessful', async () => {
    const run = jest.fn(async ({ event }: any) => ({
      ok: true,
      event,
      workspace,
      listenerCount: 0,
      workspaceHookCount: 0,
    }));
    const gateway = new ExecutionGateway(
      { log: jest.fn() } as any,
      OperationalMode.BUILD,
      undefined,
      null,
      {
        hookPipelineService: {
          run,
        } as any,
      },
    );
    const executor = new StubExecutor();
    executor.executeMock.mockResolvedValue({
      execution_id: 'exec-fail',
      task_id: 'task-1',
      executor: 'local',
      success: false,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      actions_executed: [],
      files_read: [],
      files_written: [],
      files_deleted: [],
      commands_executed: ['npm run build'],
      stdout: null,
      stderr: 'error',
      diff_summary: null,
      artifacts: [],
      rollback_available: false,
      error_code: 'SANDBOX_REQUIRED_DOCKER_UNAVAILABLE',
      error_message: 'failed',
      metadata: {},
    });
    gateway.registerExecutor('local', executor);

    const decision = await gateway.submit(buildTask(), buildPlan());

    expect(decision.allowed).toBe(true);
    expect(decision.execution_result?.success).toBe(false);
    expect(decision.execution_result?.timing).toEqual(expect.objectContaining({
      startedAt: expect.any(String),
      finishedAt: expect.any(String),
      durationMs: expect.any(Number),
    }));
    expect(decision.execution_result?.timing?.durationMs).toBeGreaterThanOrEqual(0);
    expect(decision.execution_result?.metadata?.timing).toEqual(decision.execution_result?.timing);
    expect(decision.lifecycle).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'execution',
        status: 'failed',
        traceId: decision.correlation.traceId,
        runId: decision.correlation.runId,
        sessionId: 'chat',
        timing: decision.execution_result?.timing,
      }),
    ]));
    expect(run).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        event: 'runtime.before_execute',
      }),
    );
    expect(run).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        event: 'runtime.exec_failed',
        context: expect.objectContaining({
          executor: 'local',
          reason: 'execution_failed',
          errorCode: 'SANDBOX_REQUIRED_DOCKER_UNAVAILABLE',
          errorMessage: 'failed',
        }),
      }),
    );
  });

  it('does not invoke executors during dry runs', async () => {
    const gateway = new ExecutionGateway({ log: jest.fn() } as any, OperationalMode.BUILD);
    const executor = new StubExecutor();
    gateway.registerExecutor('local', executor);

    const decision = await gateway.submit(buildTask(), buildPlan(), true);

    expect(decision.allowed).toBe(true);
    expect(decision.execution_result?.metadata?.dry_run).toBe(true);
    expect(executor.executeMock).not.toHaveBeenCalled();
  });

  it('blocks execution when the selected executor is unavailable', async () => {
    const gateway = new ExecutionGateway({ log: jest.fn() } as any, OperationalMode.BUILD);
    const executor = new StubExecutor();
    jest.spyOn(executor, 'isAvailable').mockResolvedValue(false);
    gateway.registerExecutor('codex', executor);

    const decision = await gateway.submit(buildTask(), buildPlan('codex'));

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("Executor 'codex' unavailable on this host.");
    expect(executor.executeMock).not.toHaveBeenCalled();
  });

  it('allows dry runs even when the current mode would block real execution', async () => {
    const gateway = new ExecutionGateway({ log: jest.fn() } as any, OperationalMode.WORKSPACE);
    const executor = new StubExecutor();
    gateway.registerExecutor('local', executor);

    const decision = await gateway.submit(buildTask(), buildPlan(), true);

    expect(decision.allowed).toBe(true);
    expect(decision.mode_sufficient).toBe(true);
    expect(decision.execution_result?.metadata?.dry_run).toBe(true);
    expect(executor.executeMock).not.toHaveBeenCalled();
  });

  it('does not ask for the same explicit approval twice after the task was approved', async () => {
    const gateway = new ExecutionGateway({ log: jest.fn() } as any, OperationalMode.BUILD);
    const executor = new StubExecutor();
    executor.executeMock.mockResolvedValue({
      execution_id: 'exec-2',
      task_id: 'task-1',
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
    });
    gateway.registerExecutor('local', executor);

    const task = buildTask();
    task.requires_approval = false;
    task.approval_status = 'approved';
    const plan = {
      ...buildPlan(),
      requires_approval: true,
      risk_level: 2,
    };

    const decision = await gateway.submit(task, plan);

    expect(decision.requires_confirmation).toBe(false);
    expect(decision.allowed).toBe(true);
    expect(executor.executeMock).toHaveBeenCalledTimes(1);
  });

  it('retries AI Studio once with a forced final plain response when no final answer is produced', async () => {
    const gateway = new ExecutionGateway({ log: jest.fn() } as any, OperationalMode.BUILD);
    const executor = new StubExecutor();
    executor.executeMock
      .mockResolvedValueOnce({
        execution_id: 'exec-a1',
        task_id: 'task-1',
        executor: 'aistudio',
        success: false,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        actions_executed: [],
        files_read: [],
        files_written: [],
        files_deleted: [],
        commands_executed: [],
        stdout: null,
        stderr: null,
        diff_summary: null,
        artifacts: [],
        rollback_available: false,
        error_code: 'AISTUDIO_NO_FINAL_RESPONSE',
        error_message: 'sem resposta final',
        metadata: {},
      })
      .mockResolvedValueOnce({
        execution_id: 'exec-a2',
        task_id: 'task-1',
        executor: 'aistudio',
        success: true,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        actions_executed: ['finalizou'],
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
      });
    gateway.registerExecutor('aistudio', executor);

    const decision = await gateway.submit(buildTask(), buildPlan('aistudio'));

    expect(decision.allowed).toBe(true);
    expect(executor.executeMock).toHaveBeenCalledTimes(2);
    expect(executor.executeMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        metadata: expect.objectContaining({
          aistudio_force_final_plain_response: true,
          executor_recovery_attempt: 1,
        }),
      }),
    );
    expect(decision.execution_result?.metadata?.executor_recovery).toEqual(
      expect.objectContaining({
        previous_error_code: 'AISTUDIO_NO_FINAL_RESPONSE',
      }),
    );
  });

  it('retries Stitch once with a compact prompt and flash model after timeout', async () => {
    const gateway = new ExecutionGateway({ log: jest.fn() } as any, OperationalMode.BUILD);
    const executor = new StubExecutor();
    executor.executeMock
      .mockResolvedValueOnce({
        execution_id: 'exec-s1',
        task_id: 'task-1',
        executor: 'stitch',
        success: false,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        actions_executed: [],
        files_read: [],
        files_written: [],
        files_deleted: [],
        commands_executed: [],
        stdout: null,
        stderr: null,
        diff_summary: null,
        artifacts: [],
        rollback_available: false,
        error_code: 'STITCH_TIMEOUT',
        error_message: 'timeout',
        metadata: {},
      })
      .mockResolvedValueOnce({
        execution_id: 'exec-s2',
        task_id: 'task-1',
        executor: 'stitch',
        success: true,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        actions_executed: ['gerou app'],
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
      });
    gateway.registerExecutor('stitch', executor);

    const decision = await gateway.submit(buildTask(), buildPlan('stitch'));

    expect(decision.allowed).toBe(true);
    expect(executor.executeMock).toHaveBeenCalledTimes(2);
    expect(executor.executeMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        metadata: expect.objectContaining({
          stitch_force_compact_prompt: true,
          stitch_model_id: 'GEMINI_3_FLASH',
          executor_recovery_attempt: 1,
        }),
      }),
    );
  });

  it('does not run shell patch self-healing for prompt-based executors like Codex', async () => {
    const gateway = new ExecutionGateway({ log: jest.fn() } as any, OperationalMode.BUILD);
    (gateway as any).healer = {
      analyzeAndProposeFix: jest.fn().mockResolvedValue('npm install left-pad'),
    };
    const executor = new StubExecutor();
    executor.executeMock.mockResolvedValue({
      execution_id: 'exec-c1',
      task_id: 'task-1',
      executor: 'codex',
      success: false,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      actions_executed: [],
      files_read: [],
      files_written: [],
      files_deleted: [],
      commands_executed: [],
      stdout: null,
      stderr: 'timeout',
      diff_summary: null,
      artifacts: [],
      rollback_available: false,
      error_code: 'CODEX_CLI_FAILED',
      error_message: 'timeout during prompt execution',
      metadata: {},
    });
    gateway.registerExecutor('codex', executor);

    const decision = await gateway.submit(buildTask(), buildPlan('codex'));

    expect(executor.executeMock).toHaveBeenCalledTimes(2);
    expect((gateway as any).healer.analyzeAndProposeFix).not.toHaveBeenCalled();
    expect(decision.execution_result?.actions_executed).not.toEqual(
      expect.arrayContaining([expect.stringContaining('[SELF-HEALING] Tentativa rapida de correcao')]),
    );
    expect(decision.execution_result?.metadata?.self_reflection).toBeUndefined();
  });

  it('does not invoke shell self-healing when sandbox infrastructure is unavailable', async () => {
    const gateway = new ExecutionGateway({ log: jest.fn() } as any, OperationalMode.BUILD);
    (gateway as any).healer = {
      analyzeAndProposeFix: jest.fn().mockResolvedValue('choco install docker-desktop --yes'),
    };
    const executor = new StubExecutor();
    executor.executeMock.mockResolvedValue({
      execution_id: 'exec-local-1',
      task_id: 'task-1',
      executor: 'local',
      success: false,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      actions_executed: [],
      files_read: [],
      files_written: [],
      files_deleted: [],
      commands_executed: [],
      stdout: null,
      stderr: 'docker missing',
      diff_summary: null,
      artifacts: [],
      rollback_available: false,
      error_code: 'SANDBOX_REQUIRED_DOCKER_UNAVAILABLE',
      error_message: 'Docker sandbox requerido, mas o Docker nao esta disponivel neste host.',
      metadata: {},
    });
    gateway.registerExecutor('local', executor);

    const decision = await gateway.submit(buildTask(), buildPlan());

    expect(executor.executeMock).toHaveBeenCalledTimes(1);
    expect((gateway as any).healer.analyzeAndProposeFix).not.toHaveBeenCalled();
    expect(decision.execution_result?.metadata?.self_reflection).toBeUndefined();
  });
});
