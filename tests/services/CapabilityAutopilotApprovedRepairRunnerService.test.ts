import { CapabilityAutopilotApprovedRepairRunnerService } from '../../src/services/CapabilityAutopilotApprovedRepairRunnerService';
import type {
  CapabilityRepairPlan,
  CapabilityRepairStep,
  OriginalIntentEnvelope,
} from '../../src/contracts/CapabilityAutopilotContract';
import type { PermissionRequest } from '../../src/contracts/PermissionRequest';

const FIXED_NOW = new Date('2026-04-25T18:00:00.000Z');

const resumeIntent: OriginalIntentEnvelope = {
  intentId: 'intent-1',
  createdAt: FIXED_NOW.toISOString(),
  surface: 'chat',
  audience: 'everyday_user',
  userId: 'maria',
  taskId: 'task-1',
  rawText: 'Zavorth, prepare o Gemini CLI.',
  normalizedText: 'prepare gemini cli',
  requestedCapabilityId: 'executor-gemini-cli',
  requestedExecutorName: 'gemini_cli',
  workspace: 'C:/workspace',
};

const commandStep: CapabilityRepairStep = {
  id: 'prepare-binary',
  kind: 'install_binary',
  title: 'Preparar binario local',
  summary: 'Instalar ou localizar o binario local.',
  command: {
    executor: 'local',
    command: 'gemini --version',
    cwd: 'C:/workspace',
    dryRun: false,
  },
  installStep: null,
  permissionIds: ['install-binary'],
  expectedOutcome: 'Binario fica disponivel.',
};

function createRepairPlan(overrides: Partial<CapabilityRepairPlan> = {}): CapabilityRepairPlan {
  return {
    repairPlanId: 'repair-1',
    capabilityId: 'executor-gemini-cli',
    diagnosisId: 'diagnosis-1',
    createdAt: FIXED_NOW.toISOString(),
    status: 'approval_required',
    summary: 'Gemini CLI needs de reparo approved.',
    riskLevel: 7,
    trustLevelRequired: 'collaborator',
    permissionRequirements: [
      {
        id: 'install-binary',
        kind: 'install_binary',
        scope: 'host',
        reason: 'Instalar binario exige permission no host.',
        requestedValue: 'gemini_cli',
        resolvedValue: 'gemini_cli',
        riskLevel: 7,
        trustLevelRequired: 'collaborator',
      },
    ],
    steps: [
      {
        id: 'explain-problem',
        kind: 'explain',
        title: 'Explicar o problema',
        summary: 'Falta binario.',
        command: null,
        installStep: null,
        permissionIds: [],
        expectedOutcome: 'The user understands.',
      },
      commandStep,
      {
        id: 'validate-repair',
        kind: 'validate',
        title: 'Validar reparo',
        summary: 'Recalcular readiness.',
        command: null,
        installStep: null,
        permissionIds: [],
        expectedOutcome: 'Readiness fica ready.',
      },
    ],
    validators: [],
    fallbackOptions: [],
    resumeIntent,
    ...overrides,
  };
}

function createPermission(status: PermissionRequest['status']): PermissionRequest {
  return {
    permission_id: 'permission-1',
    created_at: FIXED_NOW.toISOString(),
    updated_at: FIXED_NOW.toISOString(),
    task_id: 'task-1',
    executor: 'gemini_cli',
    kind: 'install_binary',
    status,
    scope: 'persistent',
    workspace: 'C:/workspace',
    requested_value: 'gemini_cli',
    resolved_value: 'gemini_cli',
    reason: 'Instalar binario exige permission.',
    requested_by: 'maria',
    decided_by: status === 'approved' ? 'maria' : null,
    decision_note: null,
    metadata: {
      requirement_id: 'install-binary',
    },
  };
}

function createService(stepExecutor = jest.fn()) {
  return new CapabilityAutopilotApprovedRepairRunnerService({
    now: () => FIXED_NOW,
    permissionService: {
      getRequest: jest.fn(),
    },
    stepExecutor,
  });
}

describe('CapabilityAutopilotApprovedRepairRunnerService', () => {
  it('blocks repair runs until required permissions are approved', async () => {
    const executor = jest.fn();
    const service = createService(executor);

    const result = await service.runApprovedRepair({
      repairPlan: createRepairPlan(),
      permissions: [createPermission('pending')],
      dryRun: false,
      requestedBy: 'maria',
    });

    expect(result).toMatchObject({
      status: 'blocked',
      approved: false,
      permissionStatus: 'pending',
      validationRequired: false,
      steps: [],
      metadata: {
        stage: 'capability-autopilot-repair-runner',
      },
    });
    expect(executor).not.toHaveBeenCalled();
  });

  it('dry-runs approved command steps without calling the executor', async () => {
    const executor = jest.fn();
    const service = createService(executor);

    const result = await service.runApprovedRepair({
      repairPlan: createRepairPlan(),
      permissions: [createPermission('approved')],
      dryRun: true,
      requestedBy: 'maria',
    });

    expect(result).toMatchObject({
      status: 'dry_run',
      approved: true,
      permissionStatus: 'approved',
      dryRun: true,
      validationRequired: false,
    });
    expect(result.steps.map((step) => step.status)).toEqual(['succeeded', 'dry_run', 'skipped']);
    expect(executor).not.toHaveBeenCalled();
  });

  it('executes approved command steps through the injected executor', async () => {
    const executor = jest.fn(async () => ({
      success: true,
      summary: 'Command executed in fixture.',
      detail: 'gemini --version ok',
      evidence: [
        {
          kind: 'command' as const,
          source: 'fixture',
          summary: 'stdout ok',
        },
      ],
    }));
    const service = createService(executor);

    const result = await service.runApprovedRepair({
      repairPlan: createRepairPlan({
        steps: [
          {
            ...commandStep,
            permissionIds: ['install-binary'],
          },
        ],
      }),
      permissions: [createPermission('approved')],
      dryRun: false,
      requestedBy: 'maria',
    });

    expect(result).toMatchObject({
      status: 'completed',
      approved: true,
      dryRun: false,
      validationRequired: true,
      steps: [
        {
          stepId: 'prepare-binary',
          status: 'succeeded',
          summary: 'Command executed in fixture.',
        },
      ],
    });
    expect(executor).toHaveBeenCalledTimes(1);
    expect(executor.mock.calls[0][0]).toMatchObject({
      dryRun: false,
      requestedBy: 'maria',
      step: {
        id: 'prepare-binary',
      },
    });
  });
});
