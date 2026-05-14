import { CapabilityAutopilotExecutionGatewayRunnerService } from '../../src/services/CapabilityAutopilotExecutionGatewayRunnerService';
import type {
  CapabilityRepairPlan,
  CapabilityRepairStep,
  OriginalIntentEnvelope,
} from '../../src/contracts/CapabilityAutopilotContract';
import type { ExecutionResult } from '../../src/contracts/ExecutionContract';
import type { PermissionRequest } from '../../src/contracts/PermissionRequest';
import type { GatewayDecision } from '../../src/execution/ExecutionGateway';

const FIXED_NOW = new Date('2026-04-25T23:00:00.000Z');

const resumeIntent: OriginalIntentEnvelope = {
  intentId: 'intent-1',
  createdAt: FIXED_NOW.toISOString(),
  surface: 'chat',
  audience: 'everyday_user',
  userId: 'maria',
  sessionId: 'session-1',
  taskId: 'original-task-1',
  rawText: 'Zavorth, use o Gemini CLI.',
  normalizedText: 'use gemini cli',
  requestedCapabilityId: 'executor-gemini-cli',
  requestedExecutorName: 'gemini_cli',
  workspace: 'C:/workspace',
};

const commandStep: CapabilityRepairStep = {
  id: 'install-gemini',
  kind: 'install_binary',
  title: 'Instalar Gemini CLI',
  summary: 'Preparar o binario gemini no host aprovado.',
  command: {
    executor: 'gemini_cli',
    command: 'gemini --version',
    cwd: 'C:/workspace',
    envKeys: ['GEMINI_API_KEY'],
    dryRun: false,
    timeoutSeconds: 30,
  },
  installStep: null,
  permissionIds: ['permission-1'],
  expectedOutcome: 'Gemini CLI responde com versao.',
  rollbackHint: 'Remover pacote instalado se necessario.',
};

function createRepairPlan(overrides: Partial<CapabilityRepairPlan> = {}): CapabilityRepairPlan {
  return {
    repairPlanId: 'repair-1',
    capabilityId: 'executor-gemini-cli',
    diagnosisId: 'diagnosis-1',
    createdAt: FIXED_NOW.toISOString(),
    status: 'approved',
    summary: 'Reparo aprovado para Gemini CLI ausente.',
    riskLevel: 7,
    trustLevelRequired: 'collaborator',
    permissionRequirements: [
      {
        id: 'permission-1',
        kind: 'install_binary',
        scope: 'host',
        reason: 'Instalar binario no host.',
        requestedValue: 'gemini_cli',
        resolvedValue: 'gemini_cli',
        riskLevel: 7,
        trustLevelRequired: 'collaborator',
      },
    ],
    steps: [commandStep],
    validators: [
      {
        id: 'validate-gemini',
        title: 'Validar Gemini CLI',
        kind: 'command',
        target: 'gemini',
        command: commandStep.command,
        successCondition: 'gemini --version retorna sucesso',
        required: true,
      },
    ],
    fallbackOptions: [],
    resumeIntent,
    ...overrides,
  };
}

function createPermission(): PermissionRequest {
  return {
    permission_id: 'permission-1',
    created_at: FIXED_NOW.toISOString(),
    updated_at: FIXED_NOW.toISOString(),
    task_id: 'original-task-1',
    executor: 'gemini_cli',
    kind: 'install_binary',
    status: 'approved',
    scope: 'persistent',
    workspace: 'C:/workspace',
    requested_value: 'gemini_cli',
    resolved_value: 'gemini_cli',
    reason: 'Instalar binario no host.',
    requested_by: 'maria',
    decided_by: 'maria',
    decision_note: null,
    metadata: {},
  };
}

function createExecutionResult(overrides: Partial<ExecutionResult> = {}): ExecutionResult {
  return {
    execution_id: 'execution-1',
    task_id: 'original-task-1',
    executor: 'gemini_cli',
    success: true,
    started_at: FIXED_NOW.toISOString(),
    finished_at: FIXED_NOW.toISOString(),
    actions_executed: ['checked gemini'],
    files_read: [],
    files_written: [],
    files_deleted: [],
    commands_executed: ['gemini --version'],
    stdout: '0.1.0',
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

describe('CapabilityAutopilotExecutionGatewayRunnerService', () => {
  it('converts an approved repair command into a governed ExecutionGateway submission', async () => {
    const submit = jest.fn(async () => createDecision());
    const service = new CapabilityAutopilotExecutionGatewayRunnerService({
      now: () => FIXED_NOW,
      gateway: { submit },
    });

    const result = await service.run({
      repairPlan: createRepairPlan(),
      step: commandStep,
      permissions: [createPermission()],
      dryRun: false,
    });

    expect(result).toMatchObject({
      success: true,
      summary: 'ExecutionGateway executou o repair com sucesso.',
      metadata: {
        phase: 'capability-autopilot-phase-65',
        gatewayRunner: true,
        gatewayAllowed: true,
        executionId: 'execution-1',
      },
    });
    expect(result.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'executor', source: 'ExecutionGateway', status: 'allowed' }),
      expect.objectContaining({ kind: 'command', checkedTarget: 'gemini --version', status: 'success' }),
    ]));

    expect(submit).toHaveBeenCalledTimes(1);
    const [task, plan, dryRun] = submit.mock.calls[0];
    expect(dryRun).toBe(false);
    expect(task).toMatchObject({
      task_id: 'original-task-1',
      source: 'bridge',
      status: 'approved',
      approval_status: 'approved',
      requires_approval: false,
      workspace: 'C:/workspace',
      metadata: expect.objectContaining({
        phase: 'capability-autopilot-phase-65',
        extra_allowed_commands: ['gemini --version'],
        extra_allowed_command_policies: [
          expect.objectContaining({ command: 'gemini --version', match_type: 'exact', scope: 'once' }),
        ],
      }),
    });
    expect(plan).toMatchObject({
      executor_recommendation: 'gemini_cli',
      workspace_recommendation: 'C:/workspace',
      requires_approval: false,
      steps: [
        expect.objectContaining({
          step_id: 'install-gemini',
          type: 'install',
          command: 'gemini --version',
          sensitive: true,
        }),
      ],
    });
  });

  it('honors command-level dry run before the gateway executes anything mutating', async () => {
    const submit = jest.fn(async () => createDecision({
      reason: 'Dry run - plano validado com sucesso.',
      execution_result: createExecutionResult({
        executor: 'dry_run',
        success: true,
        commands_executed: [],
        stdout: null,
      }),
    }));
    const service = new CapabilityAutopilotExecutionGatewayRunnerService({
      now: () => FIXED_NOW,
      gateway: { submit },
    });

    const dryRunStep: CapabilityRepairStep = {
      ...commandStep,
      command: {
        ...commandStep.command!,
        dryRun: true,
      },
    };

    const result = await service.run({
      repairPlan: createRepairPlan({ steps: [dryRunStep] }),
      step: dryRunStep,
      permissions: [createPermission()],
      dryRun: false,
    });

    expect(result).toMatchObject({
      success: true,
      summary: 'ExecutionGateway validou o repair em dry-run.',
      metadata: {
        dryRun: true,
      },
    });
    expect(submit).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), true);
  });

  it('maps a blocked gateway decision into a failed repair step without hiding the reason', async () => {
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
    const service = new CapabilityAutopilotExecutionGatewayRunnerService({
      now: () => FIXED_NOW,
      gateway: { submit },
    });

    const result = await service.run({
      repairPlan: createRepairPlan(),
      step: commandStep,
      permissions: [createPermission()],
      dryRun: false,
    });

    expect(result).toMatchObject({
      success: false,
      summary: 'ExecutionGateway bloqueou o repair: Bloqueado pela politica de seguranca.',
      metadata: {
        gatewayAllowed: false,
        executionId: null,
      },
    });
    expect(result.evidence?.[0]).toMatchObject({
      kind: 'policy',
      source: 'ExecutionGateway',
      status: 'blocked',
    });
  });

  it('blocks switch_executor defensively before submitting to the gateway', async () => {
    const submit = jest.fn();
    const service = new CapabilityAutopilotExecutionGatewayRunnerService({
      now: () => FIXED_NOW,
      gateway: { submit },
    });
    const switchStep: CapabilityRepairStep = {
      ...commandStep,
      kind: 'switch_executor',
      id: 'fallback-codex',
      title: 'Trocar para Codex',
    };

    const result = await service.run({
      repairPlan: createRepairPlan({ steps: [switchStep] }),
      step: switchStep,
      permissions: [createPermission()],
      dryRun: false,
    });

    expect(result).toMatchObject({
      success: false,
      summary: 'Fallback automatico bloqueado antes do gateway.',
    });
    expect(submit).not.toHaveBeenCalled();
  });
});
