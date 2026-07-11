import type { GatewayDecision } from '../../../src/execution/ExecutionGateway.js';
import {
  ZAVORTH_SCHEDULED_TASK_RUNTIME_CONTRACT_VERSION,
} from '../../../src/contracts/ZavorthScheduledTaskRuntimeContract.js';
import { ZavorthScheduledTaskExecutionGatewayRuntimeService } from '../../../src/services/ZavorthScheduledTaskExecutionGatewayRuntimeService.js';

describe('ZavorthScheduledTaskExecutionGatewayRuntimeService', () => {
  const fixedNow = () => new Date('2026-05-12T12:00:00.000Z');
  const cwd = () => 'C:/workspace/zavorth-core/Zavorth';

  it('does not submit when Intent model registry still needs approval', async () => {
    const service = new ZavorthScheduledTaskExecutionGatewayRuntimeService({ now: fixedNow, cwd });
    const snapshot = await service.buildSnapshot({
      tick: {
        submit: true,
      },
    });

    expect(snapshot.contractVersion).toBe(ZAVORTH_SCHEDULED_TASK_RUNTIME_CONTRACT_VERSION);
    expect(snapshot.gate).toBe('checkpoint-2-scheduled-task-execution-gateway');
    expect(snapshot.status).toBe('needs_reapproval');
    expect(snapshot.summary.gatewayCalled).toBe(false);
    expect(snapshot.summary.executionPerformed).toBe(false);
    expect(snapshot.safety).toMatchObject({
      consumesStage1Registry: true,
      validatesEnvelopeOnEveryTick: true,
      preservesApprovedScope: true,
      usesExecutionGatewaySubmit: true,
      noDirectToolDispatch: true,
    });
  });

  it('prepares a Task and Plan without submitting before the scheduler tick', async () => {
    const service = new ZavorthScheduledTaskExecutionGatewayRuntimeService({ now: fixedNow, cwd });
    const snapshot = await service.buildSnapshot(approvedInput());

    expect(snapshot.status).toBe('ready');
    expect(snapshot.summary.registryActive).toBe(true);
    expect(snapshot.summary.submitRequested).toBe(false);
    expect(snapshot.summary.gatewayCalled).toBe(false);
    expect(snapshot.task.command_type).toBe('scheduled_task');
    expect(snapshot.task.approval_status).toBe('approved');
    expect(snapshot.plan.steps[0]).toMatchObject({
      type: 'analyze',
      tool: 'scheduled_task_dispatch',
      command: null,
    });
  });

  it('submits due ticks through the ExecutionGateway dry-run boundary', async () => {
    const service = new ZavorthScheduledTaskExecutionGatewayRuntimeService({ now: fixedNow, cwd });
    const snapshot = await service.buildSnapshot({
      ...approvedInput(),
      tick: {
        submit: true,
      },
    });

    expect(snapshot.status).toBe('dry_run_submitted');
    expect(snapshot.mode).toBe('gateway-dry-run');
    expect(snapshot.summary.gatewayCalled).toBe(true);
    expect(snapshot.summary.gatewayAllowed).toBe(true);
    expect(snapshot.summary.executionPerformed).toBe(false);
    expect(snapshot.gatewayDecision.traceId).toBeTruthy();
  });

  it('submits live execution only through an injected ExecutionGateway', async () => {
    const gateway = {
      submit: jest.fn(async (task, plan, dryRun): Promise<GatewayDecision> => ({
        allowed: true,
        reason: 'fixture gateway completed scheduled task',
        requires_confirmation: false,
        correlation: {
          traceId: 'trace-live',
          runId: 'run-live',
          sessionId: task.chat_id,
          approvalId: task.metadata.scheduledTaskApprovalId,
          artifactId: null,
        },
        lifecycle: [],
        policy_evaluation: { allowed: true, violations: [], warnings: [] },
        risk_classification: null,
        mode_sufficient: true,
        execution_result: {
          execution_id: 'exec-live',
          task_id: task.task_id,
          executor: plan.executor_recommendation,
          success: true,
          started_at: '2026-05-12T12:00:00.000Z',
          finished_at: '2026-05-12T12:00:00.100Z',
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
          metadata: { dryRun },
        },
      })),
    };
    const service = new ZavorthScheduledTaskExecutionGatewayRuntimeService({
      now: fixedNow,
      cwd,
      executionGateway: gateway,
    });

    const snapshot = await service.buildSnapshot({
      ...approvedInput(),
      tick: {
        submit: true,
        dryRun: false,
      },
    });

    expect(snapshot.status).toBe('completed');
    expect(snapshot.summary.executionPerformed).toBe(true);
    expect(snapshot.gatewayDecision.executionId).toBe('exec-live');
    expect(gateway.submit).toHaveBeenCalledWith(
      expect.objectContaining({ command_type: 'scheduled_task' }),
      expect.objectContaining({ executor_recommendation: 'local' }),
      false,
    );
  });

  it('does not submit when the task is not due', async () => {
    const service = new ZavorthScheduledTaskExecutionGatewayRuntimeService({ now: fixedNow, cwd });
    const snapshot = await service.buildSnapshot({
      ...approvedInput(),
      tick: {
        submit: true,
        due: false,
      },
    });

    expect(snapshot.status).toBe('not_due');
    expect(snapshot.summary.gatewayCalled).toBe(false);
  });

  it('blocks scope changes before ExecutionGateway submit', async () => {
    const service = new ZavorthScheduledTaskExecutionGatewayRuntimeService({ now: fixedNow, cwd });
    const snapshot = await service.buildSnapshot({
      ...approvedInput(),
      tick: {
        submit: true,
        scopeOverride: {
          command: 'Comando diferente',
        },
      },
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.summary.scopeInvariant).toBe(false);
    expect(snapshot.summary.gatewayCalled).toBe(false);
    expect(snapshot.checks.some((check) =>
      check.kind === 'scope-invariance' && check.status === 'fail',
    )).toBe(true);
  });

  it('holds live submit when no host ExecutionGateway is injected', async () => {
    const service = new ZavorthScheduledTaskExecutionGatewayRuntimeService({ now: fixedNow, cwd });
    const snapshot = await service.buildSnapshot({
      ...approvedInput(),
      tick: {
        submit: true,
        dryRun: false,
      },
    });

    expect(snapshot.status).toBe('gateway_unavailable');
    expect(snapshot.gatewayDecision.reason).toBe('ExecutionGateway is not available on this host.');
    expect(snapshot.summary.gatewayCalled).toBe(false);
  });
});

function approvedInput() {
  return {
    scheduledTask: {
      intent: 'Enviar resumo operacional do workspace',
      schedule: 'every 15m',
      surface: 'telegram' as const,
      allowedTools: ['web_search'],
      approval: {
        ownerConfirmed: true,
        approvalId: 'approval-123',
        approvedBy: 'owner',
      },
    },
  };
}
