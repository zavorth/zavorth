import { CapabilityAutopilotFallbackHandoffService } from '../../src/services/CapabilityAutopilotFallbackHandoffService';
import { CapabilityAutopilotFallbackSelectionService } from '../../src/services/CapabilityAutopilotFallbackSelectionService';
import type {
  CapabilityReceipt,
  CapabilityRepairPlan,
  CapabilityValidationResult,
  OriginalIntentEnvelope,
} from '../../src/contracts/CapabilityAutopilotContract';
import type { PermissionRequest } from '../../src/contracts/PermissionRequest';
import type { CapabilityAutopilotPermissionRequestResult } from '../../src/services/CapabilityAutopilotPermissionService';
import type { CapabilityAutopilotValidationResumeResult } from '../../src/services/CapabilityAutopilotValidationResumeService';

const FIXED_NOW = new Date('2026-04-26T00:00:00.000Z');

const resumeIntent: OriginalIntentEnvelope = {
  intentId: 'intent-1',
  createdAt: FIXED_NOW.toISOString(),
  surface: 'chat',
  audience: 'everyday_user',
  userId: 'maria',
  sessionId: 'session-1',
  taskId: 'task-1',
  rawText: 'Zavorth, use o Gemini CLI.',
  normalizedText: 'use gemini cli',
  requestedCapabilityId: 'executor-gemini-cli',
  requestedExecutorName: 'gemini_cli',
  workspace: 'C:/workspace',
};

function createRepairPlan(overrides: Partial<CapabilityRepairPlan> = {}): CapabilityRepairPlan {
  return {
    repairPlanId: 'repair-1',
    capabilityId: 'executor-gemini-cli',
    diagnosisId: 'diagnosis-1',
    createdAt: FIXED_NOW.toISOString(),
    status: 'approval_required',
    summary: 'Gemini CLI indisponivel.',
    riskLevel: 7,
    trustLevelRequired: 'collaborator',
    permissionRequirements: [],
    steps: [],
    validators: [],
    fallbackOptions: [
      {
        id: 'fallback-codex',
        label: 'Tentar Codex',
        executorName: 'codex',
        capabilityId: 'executor-codex',
        reason: 'Codex pode continuar a tarefa.',
        requiresPermission: true,
        policyAllowed: null,
      },
      {
        id: 'fallback-external-executor',
        label: 'Tentar ExternalExecutor',
        executorName: 'external_executor',
        capabilityId: 'executor-external-executor',
        reason: 'ExternalExecutor esta pronto como executor externo.',
        requiresPermission: false,
        policyAllowed: true,
      },
    ],
    resumeIntent,
    ...overrides,
  };
}

function createReceipt(repairPlan = createRepairPlan()): CapabilityReceipt {
  return {
    receiptId: 'receipt-1',
    generatedAt: FIXED_NOW.toISOString(),
    stage: 'fallback',
    surface: 'chat',
    audience: 'everyday_user',
    capabilityId: repairPlan.capabilityId,
    capabilityLabel: 'Gemini CLI',
    headline: 'Gemini CLI precisa de fallback.',
    userSummary: 'Tenho alternativas, mas nenhuma sera usada escondida.',
    technicalSummary: 'fallbacks=2',
    trustLevel: 'collaborator',
    readiness: null,
    diagnosis: null,
    repairPlan,
    validation: null,
    selectedFallback: null,
    resumeIntent,
    timeline: [
      {
        at: FIXED_NOW.toISOString(),
        stage: 'fallback',
        status: 'pending',
        summary: 'Fallbacks disponiveis.',
      },
    ],
  };
}

function createPermission(status: PermissionRequest['status'] = 'approved'): PermissionRequest {
  return {
    permission_id: 'permission-1',
    created_at: FIXED_NOW.toISOString(),
    updated_at: FIXED_NOW.toISOString(),
    task_id: 'task-1',
    executor: 'codex',
    kind: 'switch_executor',
    status,
    scope: 'session',
    workspace: 'C:/workspace',
    requested_value: 'codex',
    resolved_value: 'codex',
    reason: 'Autorizar fallback para Codex.',
    requested_by: 'maria',
    decided_by: status === 'approved' ? 'maria' : null,
    decision_note: null,
    metadata: {
      requirement_id: 'fallback-fallback-codex-switch-executor-session',
      fallback_id: 'fallback-codex',
    },
  };
}

function createPermissionRequestResult(permission: PermissionRequest): CapabilityAutopilotPermissionRequestResult {
  return {
    generatedAt: FIXED_NOW.toISOString(),
    repairPlanId: 'repair-1-fallback-fallback-codex',
    capabilityId: 'executor-codex',
    requestedBy: 'maria',
    skipped: false,
    reason: 'Criados 1 pedido(s) de permissao contextual.',
    mappings: [],
    permissions: [permission],
  };
}

function createValidation(
  status: CapabilityAutopilotValidationResumeResult['status'],
  capabilityId = 'executor-external-executor',
): CapabilityAutopilotValidationResumeResult {
  const success = status === 'ready_to_resume';
  const validation: CapabilityValidationResult = {
    capabilityId,
    generatedAt: FIXED_NOW.toISOString(),
    success,
    summary: success ? 'Pronto para retomar.' : 'Ainda precisa de reparo.',
    results: [],
    readiness: null,
  };

  return {
    generatedAt: FIXED_NOW.toISOString(),
    capabilityId,
    status,
    permissionStatus: 'approved',
    permissions: status === 'waiting_permission' ? [] : [createPermission()],
    readiness: null,
    diagnosis: null,
    repairPlan: createRepairPlan({
      capabilityId,
      fallbackOptions: [],
    }),
    validation,
    receipt: {
      ...createReceipt(createRepairPlan({ capabilityId, fallbackOptions: [] })),
      stage: success ? 'resume' : 'failed',
      validation,
    },
    resumeIntent,
  };
}

function selectFallback(fallbackId: string, receipt = createReceipt()) {
  return new CapabilityAutopilotFallbackSelectionService({ now: () => FIXED_NOW }).selectFallback({
    receipt,
    fallbackId,
    requestedBy: 'maria',
  });
}

describe('CapabilityAutopilotFallbackHandoffService', () => {
  it('does not continue when no fallback was explicitly selected', async () => {
    const validateForResume = jest.fn();
    const createPermissionRequests = jest.fn();
    const receipt = createReceipt();
    const selection = new CapabilityAutopilotFallbackSelectionService({ now: () => FIXED_NOW }).buildFallbackMenu({
      receipt,
    });
    const service = new CapabilityAutopilotFallbackHandoffService({
      now: () => FIXED_NOW,
      validationResumeService: { validateForResume },
      permissionService: { createPermissionRequests },
    });

    const result = await service.continueSelectedFallback({ selection });

    expect(result).toMatchObject({
      status: 'not_selected',
      selectedFallback: null,
      validationResult: null,
      permissionRequestResult: null,
      summary: 'Nenhum fallback foi escolhido explicitamente.',
      metadata: {
        autoFallbackExecuted: false,
        explicitSelectionRequired: true,
      },
    });
    expect(validateForResume).not.toHaveBeenCalled();
    expect(createPermissionRequests).not.toHaveBeenCalled();
  });

  it('validates a selected fallback that does not require extra permission', async () => {
    const validateForResume = jest.fn(async () => createValidation('ready_to_resume', 'executor-external-executor'));
    const service = new CapabilityAutopilotFallbackHandoffService({
      now: () => FIXED_NOW,
      validationResumeService: { validateForResume },
      permissionService: { createPermissionRequests: jest.fn() },
    });
    const selection = selectFallback('fallback-external-executor');

    const result = await service.continueSelectedFallback({ selection });

    expect(result).toMatchObject({
      status: 'ready_to_resume',
      capabilityId: 'executor-external-executor',
      selectedFallback: {
        id: 'fallback-external-executor',
      },
      permissionPlan: null,
      permissionRequestResult: null,
      summary: "Fallback 'Tentar ExternalExecutor' esta pronto para retomar o pedido original.",
    });
    expect(validateForResume).toHaveBeenCalledWith(expect.objectContaining({
      capabilityId: 'executor-external-executor',
      requireApprovedPermissions: false,
      resumeIntent: expect.objectContaining({
        requestedExecutorName: 'external_executor',
        requestedCapabilityId: 'executor-external-executor',
      }),
    }));
  });

  it('requests contextual permission before validating a sensitive fallback', async () => {
    const permission = createPermission('pending');
    const createPermissionRequests = jest.fn(async () => createPermissionRequestResult(permission));
    const validateForResume = jest.fn();
    const service = new CapabilityAutopilotFallbackHandoffService({
      now: () => FIXED_NOW,
      validationResumeService: { validateForResume },
      permissionService: { createPermissionRequests },
    });
    const selection = selectFallback('fallback-codex');

    const result = await service.continueSelectedFallback({
      selection,
      requestedBy: 'maria',
    });

    expect(result).toMatchObject({
      status: 'permission_requested',
      capabilityId: 'executor-codex',
      selectedFallback: {
        id: 'fallback-codex',
      },
      permissionPlan: {
        status: 'approval_required',
        permissionRequirements: [
          expect.objectContaining({
            id: 'fallback-fallback-codex-switch-executor-session',
            kind: 'switch_executor',
            scope: 'session',
          }),
        ],
      },
      permissionRequestResult: {
        permissions: [
          expect.objectContaining({
            status: 'pending',
          }),
        ],
      },
      validationResult: null,
    });
    expect(createPermissionRequests).toHaveBeenCalledWith(expect.objectContaining({
      requestedBy: 'maria',
      repairPlan: expect.objectContaining({
        capabilityId: 'executor-codex',
      }),
    }));
    expect(validateForResume).not.toHaveBeenCalled();
  });

  it('continues to readiness validation once fallback permission is approved', async () => {
    const validateForResume = jest.fn(async () => createValidation('needs_repair', 'executor-codex'));
    const service = new CapabilityAutopilotFallbackHandoffService({
      now: () => FIXED_NOW,
      validationResumeService: { validateForResume },
      permissionService: { createPermissionRequests: jest.fn() },
    });
    const selection = selectFallback('fallback-codex');

    const result = await service.continueSelectedFallback({
      selection,
      permissions: [createPermission('approved')],
    });

    expect(result).toMatchObject({
      status: 'needs_repair',
      capabilityId: 'executor-codex',
      selectedFallback: {
        id: 'fallback-codex',
      },
      permissionRequestResult: null,
      validationResult: {
        status: 'needs_repair',
      },
    });
    expect(validateForResume).toHaveBeenCalledWith(expect.objectContaining({
      capabilityId: 'executor-codex',
      requireApprovedPermissions: true,
      permissions: [expect.objectContaining({ status: 'approved' })],
      repairPlan: expect.objectContaining({
        permissionRequirements: [
          expect.objectContaining({
            id: 'fallback-fallback-codex-switch-executor-session',
          }),
        ],
      }),
    }));
  });
});
