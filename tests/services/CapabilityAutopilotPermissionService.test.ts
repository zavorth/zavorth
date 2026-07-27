import { CapabilityAutopilotPermissionService } from '../../src/services/CapabilityAutopilotPermissionService';
import type {
  CapabilityReceipt,
  CapabilityRepairPlan,
  OriginalIntentEnvelope,
} from '../../src/contracts/CapabilityAutopilotContract';
import type { PermissionRequest } from '../../src/contracts/PermissionRequest';

const FIXED_NOW = new Date('2026-04-25T16:00:00.000Z');

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

const repairPlan: CapabilityRepairPlan = {
  repairPlanId: 'repair-1',
  capabilityId: 'executor-gemini-cli',
  diagnosisId: 'diagnosis-1',
  createdAt: FIXED_NOW.toISOString(),
  status: 'approval_required',
  summary: 'Gemini CLI needs de permission.',
  riskLevel: 7,
  trustLevelRequired: 'collaborator',
  permissionRequirements: [
    {
      id: 'install-binary',
      kind: 'install_binary',
      scope: 'host',
      reason: 'Instalar ou localizar Gemini CLI.',
      requestedValue: 'gemini_cli',
      resolvedValue: 'gemini_cli',
      riskLevel: 7,
      trustLevelRequired: 'collaborator',
    },
    {
      id: 'workspace-path',
      kind: 'workspace_access',
      scope: 'path',
      reason: 'Allow access to the project folder.',
      requestedValue: 'C:/workspace',
      resolvedValue: 'C:/workspace',
      riskLevel: 4,
      trustLevelRequired: 'collaborator',
    },
  ],
  steps: [],
  validators: [],
  fallbackOptions: [],
  resumeIntent,
};

const receipt: CapabilityReceipt = {
  receiptId: 'receipt-1',
  generatedAt: FIXED_NOW.toISOString(),
  stage: 'permission',
  surface: 'chat',
  audience: 'everyday_user',
  capabilityId: 'executor-gemini-cli',
  capabilityLabel: 'Gemini CLI',
  headline: 'Gemini CLI needs da sua permission.',
  userSummary: 'Preciso de permission antes de mexer nisso.',
  technicalSummary: 'permissions=2',
  trustLevel: 'collaborator',
  readiness: {
    capabilityId: 'executor-gemini-cli',
    generatedAt: FIXED_NOW.toISOString(),
    status: 'missing',
    severity: 'error',
    ready: false,
    safeToRun: false,
    summary: 'missing',
    detail: 'missing',
    checkedTargets: [],
    missingRequirements: [],
    blockingReason: 'missing',
    probe: null,
    executor: {
      executorName: 'gemini_cli',
      requestedExecutorName: 'gemini_cli',
      available: false,
      source: 'registry',
    },
    evidence: [],
  },
  diagnosis: null,
  repairPlan,
  validation: null,
  selectedFallback: null,
  resumeIntent,
  timeline: [],
};

function createPermissionFromInput(input: {
  task_id-: string | null;
  executor: string;
  kind: string;
  scope-: PermissionRequest['scope'];
  workspace-: string | null;
  requested_value-: string | null;
  resolved_value-: string | null;
  reason: string;
  requested_by-: string | null;
  metadata-: Record<string, any>;
}, index: number): PermissionRequest {
  return {
    permission_id: `permission-${index}`,
    created_at: FIXED_NOW.toISOString(),
    updated_at: FIXED_NOW.toISOString(),
    task_id: input.task_id || null,
    executor: input.executor,
    kind: input.kind,
    status: 'pending',
    scope: input.scope || 'once',
    workspace: input.workspace || null,
    requested_value: input.requested_value || null,
    resolved_value: input.resolved_value || null,
    reason: input.reason,
    requested_by: input.requested_by || null,
    decided_by: null,
    decision_note: null,
    metadata: input.metadata || {},
  };
}

describe('CapabilityAutopilotPermissionService', () => {
  it('creates contextual permission requests from a repair plan', async () => {
    const createRequest = jest.fn(async (input, index-: number) =>
      createPermissionFromInput(input, Number(index || createRequest.mock.calls.length)),
    );
    const service = new CapabilityAutopilotPermissionService({
      now: () => FIXED_NOW,
      permissionService: { createRequest },
    });

    const result = await service.createPermissionRequests({
      repairPlan,
      receipt,
      requestedBy: 'maria',
    });

    expect(result).toMatchObject({
      repairPlanId: 'repair-1',
      capabilityId: 'executor-gemini-cli',
      requestedBy: 'maria',
      skipped: false,
    });
    expect(createRequest).toHaveBeenCalledTimes(2);
    expect(result.permissions).toHaveLength(2);
    expect(result.permissions[0]).toMatchObject({
      executor: 'gemini_cli',
      kind: 'install_binary',
      scope: 'persistent',
      requested_by: 'maria',
      task_id: 'task-1',
      metadata: {
        capability_autopilot: true,
        capability_scope: 'host',
        legacy_scope: 'persistent',
        repair_plan_id: 'repair-1',
        receipt_id: 'receipt-1',
        resume_intent_id: 'intent-1',
      },
    });
    expect(result.permissions[1]).toMatchObject({
      kind: 'workspace_access',
      scope: 'workspace',
      workspace: 'C:/workspace',
      metadata: {
        capability_scope: 'path',
        legacy_scope: 'workspace',
      },
    });
  });

  it('skips plans without permission requirements', async () => {
    const createRequest = jest.fn();
    const service = new CapabilityAutopilotPermissionService({
      now: () => FIXED_NOW,
      permissionService: { createRequest },
    });

    const result = await service.createPermissionRequests({
      repairPlan: {
        ...repairPlan,
        permissionRequirements: [],
      },
      requestedBy: 'tester',
    });

    expect(result).toMatchObject({
      skipped: true,
      permissions: [],
      mappings: [],
    });
    expect(createRequest).not.toHaveBeenCalled();
  });

  it('maps extended capability scopes to the legacy PermissionService ledger scopes', () => {
    const service = new CapabilityAutopilotPermissionService({
      now: () => FIXED_NOW,
      permissionService: { createRequest: jest.fn() },
    });

    expect(service.mapRequirement({
      id: 'once',
      kind: 'x',
      scope: 'once',
      reason: 'once',
      riskLevel: 1,
      trustLevelRequired: 'protected',
    }, repairPlan).legacyScope).toBe('once');
    expect(service.mapRequirement({
      id: 'session',
      kind: 'x',
      scope: 'session',
      reason: 'session',
      riskLevel: 1,
      trustLevelRequired: 'protected',
    }, repairPlan).legacyScope).toBe('session');
    expect(service.mapRequirement({
      id: 'app',
      kind: 'x',
      scope: 'app',
      reason: 'app',
      riskLevel: 1,
      trustLevelRequired: 'protected',
    }, repairPlan, 'C:/workspace').legacyScope).toBe('workspace');
    expect(service.mapRequirement({
      id: 'host',
      kind: 'x',
      scope: 'host',
      reason: 'host',
      riskLevel: 1,
      trustLevelRequired: 'protected',
    }, repairPlan).legacyScope).toBe('persistent');
  });
});
