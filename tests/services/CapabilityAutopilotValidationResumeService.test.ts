import { CapabilityAutopilotReceiptService } from '../../src/services/CapabilityAutopilotReceiptService';
import { CapabilityAutopilotValidationResumeService } from '../../src/services/CapabilityAutopilotValidationResumeService';
import type {
  CapabilityDiagnosis,
  CapabilityOperationalDescriptor,
  CapabilityReadinessSnapshot,
  CapabilityReceiptParts,
  CapabilityRepairPlan,
  OriginalIntentEnvelope,
} from '../../src/contracts/CapabilityAutopilotContract';
import type { PermissionRequest } from '../../src/contracts/PermissionRequest';

const FIXED_NOW = new Date('2026-04-25T17:00:00.000Z');

const descriptor: CapabilityOperationalDescriptor = {
  capabilityId: 'executor-gemini-cli',
  label: 'Gemini CLI',
  type: 'executor',
  intent: 'code_execution',
  summary: 'Executa tarefas via Gemini CLI.',
  source: 'builtin',
  command: '/gemini',
  tags: ['gemini', 'cli'],
  capability: null,
  lifecycle: null,
  integration: null,
  executor: {
    executorName: 'gemini_cli',
    requestedExecutorName: 'gemini_cli',
    available: true,
    source: 'registry',
  },
  policy: null,
  hooks: [],
  fallbackMode: 'ask_before_switch',
};

const resumeIntent: OriginalIntentEnvelope = {
  intentId: 'intent-1',
  createdAt: FIXED_NOW.toISOString(),
  surface: 'chat',
  audience: 'everyday_user',
  userId: 'maria',
  taskId: 'task-1',
  rawText: 'Zavorth, use o Gemini CLI.',
  normalizedText: 'use gemini cli',
  requestedCapabilityId: 'executor-gemini-cli',
  requestedExecutorName: 'gemini_cli',
  workspace: 'C:/workspace',
};

function createReadiness(overrides: Partial<CapabilityReadinessSnapshot> = {}): CapabilityReadinessSnapshot {
  return {
    capabilityId: 'executor-gemini-cli',
    generatedAt: FIXED_NOW.toISOString(),
    status: 'missing',
    severity: 'error',
    ready: false,
    safeToRun: false,
    summary: 'Gemini CLI ainda nao esta pronto.',
    detail: 'Falta login.',
    checkedTargets: [],
    missingRequirements: [],
    blockingReason: 'auth',
    probe: null,
    executor: descriptor.executor,
    evidence: [],
    suggestedNextAction: {
      label: 'Pedir permissao',
      reason: 'Falta login.',
      repairable: true,
    },
    ...overrides,
  };
}

function createDiagnosis(overrides: Partial<CapabilityDiagnosis> = {}): CapabilityDiagnosis {
  return {
    diagnosisId: 'diagnosis-1',
    capabilityId: 'executor-gemini-cli',
    generatedAt: FIXED_NOW.toISOString(),
    failureKind: 'missing_auth',
    status: 'missing',
    rootCause: 'Conta ou autenticacao pendente.',
    confidence: 0.86,
    repairable: true,
    requiresUserInput: true,
    narratives: [],
    evidence: [],
    relatedExecution: null,
    ...overrides,
  };
}

function createRepairPlan(overrides: Partial<CapabilityRepairPlan> = {}): CapabilityRepairPlan {
  return {
    repairPlanId: 'repair-1',
    capabilityId: 'executor-gemini-cli',
    diagnosisId: 'diagnosis-1',
    createdAt: FIXED_NOW.toISOString(),
    status: 'approval_required',
    summary: 'Gemini CLI precisa de permissao.',
    riskLevel: 5,
    trustLevelRequired: 'collaborator',
    permissionRequirements: [
      {
        id: 'auth-session',
        kind: 'authenticate',
        scope: 'session',
        reason: 'Autorizar login.',
        requestedValue: 'gemini_cli',
        resolvedValue: 'gemini_cli',
        riskLevel: 5,
        trustLevelRequired: 'collaborator',
      },
    ],
    steps: [],
    validators: [
      {
        id: 'readiness-snapshot',
        title: 'Recalcular readiness',
        kind: 'manual',
        target: 'executor-gemini-cli',
        successCondition: 'ready=true',
        required: true,
      },
    ],
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
    kind: 'authenticate',
    status,
    scope: 'session',
    workspace: 'C:/workspace',
    requested_value: 'gemini_cli',
    resolved_value: 'gemini_cli',
    reason: 'Autorizar login.',
    requested_by: 'maria',
    decided_by: status === 'pending' ? null : 'maria',
    decision_note: null,
    metadata: {},
  };
}

function createService(options: {
  readiness?: CapabilityReadinessSnapshot;
  diagnosis?: CapabilityDiagnosis;
  repairPlan?: CapabilityRepairPlan;
} = {}) {
  const readiness = options.readiness || createReadiness();
  const diagnosis = options.diagnosis || createDiagnosis({ status: readiness.status });
  const repairPlan = options.repairPlan || createRepairPlan({
    status: readiness.ready ? 'validated' : 'approval_required',
    permissionRequirements: readiness.ready ? [] : createRepairPlan().permissionRequirements,
  });
  const receiptService = new CapabilityAutopilotReceiptService({ now: () => FIXED_NOW });

  return new CapabilityAutopilotValidationResumeService({
    now: () => FIXED_NOW,
    permissionService: {
      getRequest: jest.fn(),
    },
    readinessService: {
      getOperationalDescriptor: () => descriptor,
      buildReadinessSnapshot: async () => readiness,
    },
    diagnosisService: {
      diagnoseReadiness: () => diagnosis,
    },
    repairPlannerService: {
      planFromDiagnosis: () => repairPlan,
    },
    receiptService: {
      buildReceiptFromParts: (parts: CapabilityReceiptParts) =>
        receiptService.buildReceiptFromParts(parts),
    },
  });
}

describe('CapabilityAutopilotValidationResumeService', () => {
  it('waits when required permissions are not approved yet', async () => {
    const repairPlan = createRepairPlan();
    const service = createService();

    const result = await service.validateForResume({
      capabilityId: 'executor-gemini-cli',
      repairPlan,
      resumeIntent,
      permissions: [createPermission('pending')],
    });

    expect(result).toMatchObject({
      status: 'waiting_permission',
      permissionStatus: 'pending',
      readiness: null,
      diagnosis: null,
      repairPlan,
      validation: {
        success: false,
      },
      receipt: {
        stage: 'permission',
      },
    });
  });

  it('stops when a required permission was rejected', async () => {
    const service = createService();

    const result = await service.validateForResume({
      capabilityId: 'executor-gemini-cli',
      repairPlan: createRepairPlan(),
      resumeIntent,
      permissions: [createPermission('rejected')],
    });

    expect(result).toMatchObject({
      status: 'permission_rejected',
      permissionStatus: 'rejected',
      validation: {
        success: false,
        results: [
          {
            validationStepId: 'permission-gate',
            status: 'failed',
          },
        ],
      },
      receipt: {
        stage: 'failed',
      },
    });
  });

  it('validates readiness and marks the original intent ready to resume', async () => {
    const readyReadiness = createReadiness({
      status: 'ready',
      severity: 'info',
      ready: true,
      safeToRun: true,
      summary: 'Gemini CLI esta pronto.',
      detail: 'Nenhum bloqueio encontrado.',
      blockingReason: null,
      executor: {
        ...descriptor.executor!,
        available: true,
      },
    });
    const service = createService({
      readiness: readyReadiness,
      diagnosis: createDiagnosis({
        failureKind: 'unknown',
        status: 'ready',
        repairable: false,
        requiresUserInput: false,
      }),
      repairPlan: createRepairPlan({
        status: 'validated',
        permissionRequirements: [],
        riskLevel: 0,
        trustLevelRequired: 'protected',
      }),
    });

    const result = await service.validateForResume({
      capabilityId: 'executor-gemini-cli',
      repairPlan: createRepairPlan(),
      resumeIntent,
      permissions: [createPermission('approved')],
    });

    expect(result).toMatchObject({
      status: 'ready_to_resume',
      permissionStatus: 'approved',
      readiness: {
        ready: true,
        safeToRun: true,
      },
      validation: {
        success: true,
      },
      receipt: {
        stage: 'resume',
      },
      resumeIntent: {
        intentId: 'intent-1',
      },
    });
  });
});
