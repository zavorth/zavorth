import { CapabilityAutopilotFallbackResumeRunService } from '../../src/services/CapabilityAutopilotFallbackResumeRunService';
import type {
  CapabilityFallbackOption,
  CapabilityReceipt,
  CapabilityRepairPlan,
  CapabilityValidationResult,
  OriginalIntentEnvelope,
} from '../../src/contracts/CapabilityAutopilotContract';
import type { ExecutionResult } from '../../src/contracts/ExecutionContract';
import type { GatewayDecision } from '../../src/execution/ExecutionGateway';
import type { CapabilityFallbackSelectionResult } from '../../src/services/CapabilityAutopilotFallbackSelectionService';
import type { CapabilityFallbackHandoffResult } from '../../src/services/CapabilityAutopilotFallbackHandoffService';
import type { CapabilityAutopilotValidationResumeResult } from '../../src/services/CapabilityAutopilotValidationResumeService';

const FIXED_NOW = new Date('2026-04-26T00:30:00.000Z');

const selectedFallback: CapabilityFallbackOption = {
  id: 'fallback-external-executor',
  label: 'Tentar ExternalExecutor',
  executorName: 'external_executor',
  capabilityId: 'executor-external-executor',
  reason: 'ExternalExecutor esta pronto como executor alternativo.',
  requiresPermission: false,
  policyAllowed: true,
};

const resumeIntent: OriginalIntentEnvelope = {
  intentId: 'intent-1-fallback-fallback-external-executor',
  createdAt: FIXED_NOW.toISOString(),
  surface: 'chat',
  audience: 'everyday_user',
  userId: 'maria',
  sessionId: 'session-1',
  taskId: 'task-1',
  rawText: 'Zavorth, use o Gemini CLI para revisar esse projeto.',
  normalizedText: 'use gemini cli para revisar projeto',
  requestedCapabilityId: 'executor-external-executor',
  requestedExecutorName: 'external_executor',
  workspace: 'C:/workspace',
  executionRequest: {
    executor: 'external_executor',
    workspace: 'C:/workspace',
    objective: 'Revisar projeto com executor alternativo.',
    instructions: ['Revise o projeto e explique os achados.'],
    metadata: {},
  },
  metadata: {
    fallbackSelected: true,
    fallbackId: 'fallback-external-executor',
    previousCapabilityId: 'executor-gemini-cli',
    previousExecutorName: 'gemini_cli',
  },
};

function createRepairPlan(): CapabilityRepairPlan {
  return {
    repairPlanId: 'repair-1',
    capabilityId: 'executor-gemini-cli',
    diagnosisId: 'diagnosis-1',
    createdAt: FIXED_NOW.toISOString(),
    status: 'approval_required',
    summary: 'Gemini CLI indisponivel.',
    riskLevel: 5,
    trustLevelRequired: 'collaborator',
    permissionRequirements: [],
    steps: [],
    validators: [],
    fallbackOptions: [selectedFallback],
    resumeIntent,
  };
}

function createReceipt(): CapabilityReceipt {
  return {
    receiptId: 'receipt-1',
    generatedAt: FIXED_NOW.toISOString(),
    stage: 'resume',
    surface: 'chat',
    audience: 'everyday_user',
    capabilityId: 'executor-external-executor',
    capabilityLabel: 'ExternalExecutor',
    headline: 'ExternalExecutor esta pronto; posso retomar.',
    userSummary: 'Fallback validado.',
    technicalSummary: 'ready_to_resume',
    trustLevel: 'collaborator',
    readiness: null,
    diagnosis: null,
    repairPlan: createRepairPlan(),
    validation: null,
    selectedFallback,
    resumeIntent,
    timeline: [
      {
        at: FIXED_NOW.toISOString(),
        stage: 'fallback',
        status: 'completed',
        summary: 'Fallback escolhido: Tentar ExternalExecutor.',
      },
    ],
  };
}

function createSelection(): CapabilityFallbackSelectionResult {
  return {
    generatedAt: FIXED_NOW.toISOString(),
    status: 'selected',
    capabilityId: 'executor-gemini-cli',
    repairPlanId: 'repair-1',
    requestedFallbackId: 'fallback-external-executor',
    selectedFallback,
    candidates: [],
    receipt: createReceipt(),
    nextIntent: resumeIntent,
    summary: 'Fallback escolhido.',
    technicalSummary: 'fallback_selection=selected',
    metadata: {
      autoFallbackExecuted: false,
    },
  };
}

function createValidation(status: CapabilityAutopilotValidationResumeResult['status']): CapabilityAutopilotValidationResumeResult {
  const success = status === 'ready_to_resume';
  const validation: CapabilityValidationResult = {
    capabilityId: 'executor-external-executor',
    generatedAt: FIXED_NOW.toISOString(),
    success,
    summary: success ? 'Pronto para retomar.' : 'Ainda precisa de reparo.',
    results: [],
    readiness: null,
  };
  return {
    generatedAt: FIXED_NOW.toISOString(),
    capabilityId: 'executor-external-executor',
    status,
    permissionStatus: 'not_required',
    permissions: [],
    readiness: null,
    diagnosis: null,
    repairPlan: createRepairPlan(),
    validation,
    receipt: createReceipt(),
    resumeIntent,
  };
}

function createHandoff(
  status: CapabilityFallbackHandoffResult['status'] = 'ready_to_resume',
): CapabilityFallbackHandoffResult {
  return {
    generatedAt: FIXED_NOW.toISOString(),
    status,
    capabilityId: 'executor-external-executor',
    selectedFallback,
    selection: createSelection(),
    permissionPlan: null,
    permissionRequestResult: null,
    validationResult: createValidation(status === 'ready_to_resume' ? 'ready_to_resume' : 'needs_repair'),
    receipt: createReceipt(),
    resumeIntent,
    summary: 'Fallback pronto para retomar.',
    technicalSummary: `fallback_handoff=${status}`,
    metadata: {
      autoFallbackExecuted: false,
    },
  };
}

function createExecutionResult(overrides: Partial<ExecutionResult> = {}): ExecutionResult {
  return {
    execution_id: 'execution-1',
    task_id: 'task-1-fallback-resume',
    executor: 'external_executor',
    success: true,
    started_at: FIXED_NOW.toISOString(),
    finished_at: FIXED_NOW.toISOString(),
    actions_executed: ['reviewed project'],
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
    ...overrides,
  };
}

function createDecision(overrides: Partial<GatewayDecision> = {}): GatewayDecision {
  return {
    allowed: true,
    reason: 'Execucao concluida com sucesso.',
    requires_confirmation: false,
    correlation: {
      traceId: 'trace-1',
      runId: 'run-1',
      sessionId: 'session-1',
      approvalId: 'approval-1',
      artifactId: 'artifact-1',
    },
    lifecycle: [],
    policy_evaluation: {
      allowed: true,
      violations: [],
      warnings: [],
    },
    risk_classification: null,
    mode_sufficient: true,
    execution_result: createExecutionResult(),
    ...overrides,
  };
}

describe('CapabilityAutopilotFallbackResumeRunService', () => {
  it('blocks resume when the fallback handoff is not ready', async () => {
    const submit = jest.fn();
    const service = new CapabilityAutopilotFallbackResumeRunService({
      now: () => FIXED_NOW,
      gateway: { submit },
    });

    const result = await service.resumeReadyFallback({
      handoff: createHandoff('needs_repair'),
    });

    expect(result).toMatchObject({
      status: 'blocked',
      task: null,
      plan: null,
      summary: 'Fallback ainda precisa de reparo antes da retomada.',
      metadata: {
        handoffStatus: 'needs_repair',
      },
    });
    expect(submit).not.toHaveBeenCalled();
  });

  it('submits the preserved original intent through the fallback executor in dry-run by default', async () => {
    const submit = jest.fn(async () => createDecision({
      reason: 'Dry run - plano validado com sucesso.',
      execution_result: createExecutionResult({
        executor: 'dry_run',
        success: true,
        stdout: null,
      }),
    }));
    const service = new CapabilityAutopilotFallbackResumeRunService({
      now: () => FIXED_NOW,
      gateway: { submit },
    });

    const result = await service.resumeReadyFallback({
      handoff: createHandoff(),
    });

    expect(result).toMatchObject({
      status: 'dry_run',
      dryRun: true,
      summary: "Retomada via 'Tentar ExternalExecutor' validada em dry-run.",
      metadata: {
        stage: 'capability-autopilot-fallback-handoff',
        autoFallbackExecuted: false,
        fallbackId: 'fallback-external-executor',
        executorName: 'external_executor',
      },
    });
    expect(submit).toHaveBeenCalledTimes(1);
    const [task, plan, dryRun] = submit.mock.calls[0];
    expect(dryRun).toBe(true);
    expect(task).toMatchObject({
      task_id: 'task-1-fallback-resume',
      source: 'bridge',
      executor_used: 'external_executor',
      fallback_used: true,
      workspace: 'C:/workspace',
      metadata: expect.objectContaining({
        fallback_resume: true,
        selected_fallback_id: 'fallback-external-executor',
        requested_executor_name: 'external_executor',
      }),
    });
    expect(plan).toMatchObject({
      executor_recommendation: 'external_executor',
      workspace_recommendation: 'C:/workspace',
      objective: 'Revisar projeto com executor alternativo.',
      steps: [
        expect.objectContaining({
          type: 'exec',
          description: 'Revise o projeto e explique os achados.',
          command: null,
          tool: 'external_executor',
        }),
      ],
    });
  });

  it('can execute the resume run when explicitly requested', async () => {
    const submit = jest.fn(async () => createDecision());
    const service = new CapabilityAutopilotFallbackResumeRunService({
      now: () => FIXED_NOW,
      gateway: { submit },
    });

    const result = await service.resumeReadyFallback({
      handoff: createHandoff(),
      dryRun: false,
    });

    expect(result).toMatchObject({
      status: 'completed',
      dryRun: false,
      executionResult: {
        success: true,
      },
      receipt: {
        stage: 'completed',
        metadata: {
          fallbackResumeRunRecorded: true,
          fallbackResumeDryRun: false,
        },
      },
    });
    expect(result.receipt?.timeline.at(-1)).toMatchObject({
      stage: 'resume',
      status: 'completed',
      summary: 'Pedido retomado via Tentar ExternalExecutor.',
    });
    expect(submit).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), false);
  });

  it('preserves gateway blocks as blocked resume results', async () => {
    const submit = jest.fn(async () => createDecision({
      allowed: false,
      reason: 'Bloqueado pela politica de seguranca.',
      execution_result: null,
      policy_evaluation: {
        allowed: false,
        violations: [
          {
            rule: 'BLOCKED_COMMAND',
            severity: 'BLOCK',
            detail: 'Comando bloqueado.',
          },
        ],
        warnings: [],
      },
    }));
    const service = new CapabilityAutopilotFallbackResumeRunService({
      now: () => FIXED_NOW,
      gateway: { submit },
    });

    const result = await service.resumeReadyFallback({
      handoff: createHandoff(),
      dryRun: false,
    });

    expect(result).toMatchObject({
      status: 'blocked',
      summary: "Retomada via 'Tentar ExternalExecutor' bloqueada: Bloqueado pela politica de seguranca.",
      executionResult: null,
    });
    expect(result.receipt?.timeline.at(-1)).toMatchObject({
      stage: 'resume',
      status: 'blocked',
    });
  });
});
