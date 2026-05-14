import { CapabilityAutopilotRepairExecutionService } from '../../src/services/CapabilityAutopilotRepairExecutionService';
import type {
  CapabilityRepairPlan,
  CapabilityRepairStep,
  CapabilityValidationResult,
  OriginalIntentEnvelope,
} from '../../src/contracts/CapabilityAutopilotContract';
import type { PermissionRequest } from '../../src/contracts/PermissionRequest';
import type { CapabilityAutopilotValidationResumeResult } from '../../src/services/CapabilityAutopilotValidationResumeService';

const FIXED_NOW = new Date('2026-04-25T19:00:00.000Z');

const resumeIntent: OriginalIntentEnvelope = {
  intentId: 'intent-1',
  createdAt: FIXED_NOW.toISOString(),
  surface: 'chat',
  audience: 'everyday_user',
  userId: 'maria',
  taskId: 'task-1',
  rawText: 'Zavorth, repare o Gemini CLI.',
  normalizedText: 'repare gemini cli',
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
  permissionIds: ['permission-1'],
  expectedOutcome: 'Binario fica disponivel.',
};

function createRepairPlan(overrides: Partial<CapabilityRepairPlan> = {}): CapabilityRepairPlan {
  return {
    repairPlanId: 'repair-1',
    capabilityId: 'executor-gemini-cli',
    diagnosisId: 'diagnosis-1',
    createdAt: FIXED_NOW.toISOString(),
    status: 'approved',
    summary: 'Gemini CLI tem reparo aprovado.',
    riskLevel: 7,
    trustLevelRequired: 'collaborator',
    permissionRequirements: [
      {
        id: 'install-binary',
        kind: 'install_binary',
        scope: 'host',
        reason: 'Instalar binario exige permissao no host.',
        requestedValue: 'gemini_cli',
        resolvedValue: 'gemini_cli',
        riskLevel: 7,
        trustLevelRequired: 'collaborator',
      },
    ],
    steps: [commandStep],
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
    reason: 'Instalar binario exige permissao.',
    requested_by: 'maria',
    decided_by: status === 'approved' ? 'maria' : null,
    decision_note: null,
    metadata: {},
  };
}

function createValidation(status: CapabilityAutopilotValidationResumeResult['status']): CapabilityAutopilotValidationResumeResult {
  const success = status === 'ready_to_resume';
  const validation: CapabilityValidationResult = {
    capabilityId: 'executor-gemini-cli',
    generatedAt: FIXED_NOW.toISOString(),
    success,
    summary: success ? 'Pronto para retomar.' : 'Ainda precisa de reparo.',
    results: [],
    readiness: null,
  };
  return {
    generatedAt: FIXED_NOW.toISOString(),
    capabilityId: 'executor-gemini-cli',
    status,
    permissionStatus: 'approved',
    permissions: [createPermission('approved')],
    readiness: null,
    diagnosis: null,
    repairPlan: createRepairPlan(),
    validation,
    receipt: {
      receiptId: 'receipt-1',
      generatedAt: FIXED_NOW.toISOString(),
      stage: success ? 'resume' : 'failed',
      surface: 'chat',
      audience: 'everyday_user',
      capabilityId: 'executor-gemini-cli',
      capabilityLabel: 'Gemini CLI',
      headline: success ? 'Gemini CLI esta pronto.' : 'Gemini CLI ainda nao esta pronto.',
      userSummary: validation.summary,
      technicalSummary: validation.summary,
      trustLevel: 'collaborator',
      readiness: null,
      diagnosis: null,
      repairPlan: createRepairPlan(),
      validation,
      selectedFallback: null,
      resumeIntent,
      timeline: [],
    },
    resumeIntent,
  };
}

function createService(options: {
  runner?: { run: jest.Mock };
  validationStatus?: CapabilityAutopilotValidationResumeResult['status'];
} = {}) {
  return new CapabilityAutopilotRepairExecutionService({
    now: () => FIXED_NOW,
    permissionService: {
      getRequest: jest.fn(),
    },
    runner: options.runner || null,
    validationResumeService: {
      validateForResume: jest.fn(async () => createValidation(options.validationStatus || 'needs_repair')),
    },
  });
}

describe('CapabilityAutopilotRepairExecutionService', () => {
  it('blocks execution when permissions are not approved', async () => {
    const service = createService();

    const result = await service.executeApprovedRepair({
      repairPlan: createRepairPlan(),
      permissions: [createPermission('pending')],
      dryRun: false,
    });

    expect(result).toMatchObject({
      status: 'blocked',
      approved: false,
      permissionStatus: 'pending',
      validationRuns: [],
      metadata: {
        phase: 'capability-autopilot-phase-62',
      },
    });
    expect(result.steps[0]).toMatchObject({
      status: 'blocked',
    });
  });

  it('dry-runs executable steps without invoking a real runner', async () => {
    const runner = { run: jest.fn() };
    const service = createService({ runner });

    const result = await service.executeApprovedRepair({
      repairPlan: createRepairPlan(),
      permissions: [createPermission('approved')],
      dryRun: true,
    });

    expect(result).toMatchObject({
      status: 'dry_run',
      approved: true,
      permissionStatus: 'approved',
      validationRequired: false,
      validationRuns: [],
    });
    expect(result.steps[0]).toMatchObject({
      status: 'dry_run',
    });
    expect(runner.run).not.toHaveBeenCalled();
  });

  it('executes through the injected runner and stops when validation can resume', async () => {
    const runner = {
      run: jest.fn(async () => ({
        success: true,
        summary: 'Repair executado.',
        detail: 'fixture ok',
      })),
    };
    const service = createService({ runner, validationStatus: 'ready_to_resume' });

    const result = await service.executeApprovedRepair({
      repairPlan: createRepairPlan(),
      permissions: [createPermission('approved')],
      dryRun: false,
    });

    expect(result).toMatchObject({
      status: 'completed',
      approved: true,
      validationRequired: true,
      validationRuns: [
        {
          status: 'ready_to_resume',
        },
      ],
      receipt: {
        stage: 'resume',
      },
    });
    expect(result.steps[0]).toMatchObject({
      status: 'succeeded',
      summary: 'Repair executado.',
    });
    expect(runner.run).toHaveBeenCalledTimes(1);
  });
});
