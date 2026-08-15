import { CapabilityAutopilotFallbackSelectionService } from '../../src/services/CapabilityAutopilotFallbackSelectionService';
import type {
  CapabilityReceipt,
  CapabilityRepairPlan,
  OriginalIntentEnvelope,
} from '../../src/contracts/CapabilityAutopilotContract';

const FIXED_NOW = new Date('2026-04-25T23:30:00.000Z');

const resumeIntent: OriginalIntentEnvelope = {
  intentId: 'intent-fallback',
  createdAt: FIXED_NOW.toISOString(),
  surface: 'chat',
  audience: 'everyday_user',
  userId: 'maria',
  sessionId: 'session-fallback',
  taskId: 'task-fallback',
  rawText: 'Use Gemini CLI para revisar o repo.',
  normalizedText: 'use gemini cli revisar repo',
  requestedCapabilityId: 'executor-gemini-cli',
  requestedExecutorName: 'gemini_cli',
  workspace: 'C:/workspace',
};

const repairPlan: CapabilityRepairPlan = {
  repairPlanId: 'repair-fallback',
  capabilityId: 'executor-gemini-cli',
  diagnosisId: 'diagnosis-fallback',
  createdAt: FIXED_NOW.toISOString(),
  status: 'approval_required',
  summary: 'Gemini CLI ainda precisa de auth.',
  riskLevel: 5,
  trustLevelRequired: 'collaborator',
  permissionRequirements: [],
  steps: [],
  validators: [],
  fallbackOptions: [
    {
      id: 'fallback-codex',
      label: 'Usar Codex',
      executorName: 'codex',
      capabilityId: 'executor-codex',
      reason: 'Codex esta disponivel como fallback governado.',
      requiresPermission: true,
      policyAllowed: null,
    },
    {
      id: 'fallback-manual',
      label: 'Orientacao manual',
      executorName: null,
      capabilityId: null,
      reason: 'Explicar preparacao manual.',
      requiresPermission: false,
      policyAllowed: true,
    },
    {
      id: 'fallback-blocked',
      label: 'Executor bloqueado',
      executorName: 'blocked',
      capabilityId: null,
      reason: 'Policy atual bloqueia este executor.',
      requiresPermission: true,
      policyAllowed: false,
    },
  ],
  resumeIntent,
};

const receipt: CapabilityReceipt = {
  receiptId: 'receipt-fallback',
  generatedAt: FIXED_NOW.toISOString(),
  stage: 'permission',
  surface: 'chat',
  audience: 'everyday_user',
  capabilityId: 'executor-gemini-cli',
  capabilityLabel: 'Gemini CLI',
  headline: 'Gemini CLI precisa de permissao.',
  userSummary: 'Fallbacks ficam visiveis.',
  technicalSummary: 'fallbacks=3',
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
      stage: 'permission',
      status: 'pending',
      summary: 'Aguardando decisao.',
    },
  ],
};

function createService() {
  return new CapabilityAutopilotFallbackSelectionService({
    now: () => FIXED_NOW,
  });
}

describe('CapabilityAutopilotFallbackSelectionService', () => {
  it('builds a fallback menu with explicit selection and no automatic execution', () => {
    const service = createService();

    const menu = service.buildFallbackMenu({ receipt });

    expect(menu).toMatchObject({
      status: 'available',
      capabilityId: 'executor-gemini-cli',
      repairPlanId: 'repair-fallback',
      metadata: {
        stage: 'capability-autopilot-provider-expansion',
        explicitSelectionRequired: true,
        autoFallbackExecuted: false,
      },
    });
    expect(menu.candidates).toHaveLength(3);
    expect(menu.candidates.every((candidate) => candidate.explicitUserActionRequired)).toBe(true);
    expect(menu.candidates.find((candidate) => candidate.id === 'fallback-blocked')?.selectable).toBe(false);
  });

  it('records an allowed fallback selection and parks execution behind permission when required', () => {
    const service = createService();

    const result = service.selectFallback({
      receipt,
      fallbackId: 'fallback-codex',
      requestedBy: 'maria',
    });

    expect(result).toMatchObject({
      status: 'requires_permission',
      selectedFallback: {
        id: 'fallback-codex',
        executorName: 'codex',
      },
      metadata: {
        autoFallbackExecuted: false,
      },
    });
    expect(result.nextIntent).toMatchObject({
      requestedCapabilityId: 'executor-codex',
      requestedExecutorName: 'codex',
      metadata: {
        fallbackSelected: true,
        fallbackId: 'fallback-codex',
        previousCapabilityId: 'executor-gemini-cli',
      },
    });
    expect(result.receipt).toMatchObject({
      stage: 'fallback',
      selectedFallback: {
        id: 'fallback-codex',
      },
    });
  });

  it('does not select policy-blocked fallback options', () => {
    const service = createService();

    const result = service.selectFallback({
      receipt,
      fallbackId: 'fallback-blocked',
      requestedBy: 'maria',
    });

    expect(result).toMatchObject({
      status: 'policy_blocked',
      selectedFallback: null,
      nextIntent: null,
    });
    expect(result.summary).toContain('blocked');
    expect(result.receipt?.selectedFallback).toBeNull();
  });
});
