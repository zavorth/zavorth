import { CapabilityAutopilotMemoryReplayService } from '../../src/services/CapabilityAutopilotMemoryReplayService';
import { CapabilityAutopilotPreflightHintService } from '../../src/services/CapabilityAutopilotPreflightHintService';
import type {
  CapabilityReadinessSnapshot,
  CapabilityReceipt,
  CapabilityRepairPlan,
  CapabilityValidationResult,
  OriginalIntentEnvelope,
} from '../../src/contracts/CapabilityAutopilotContract';

const FIXED_NOW = new Date('2026-04-26T01:30:00.000Z');
const RAW_INTENT = 'Use Gemini CLI with private phrase DO-NOT-LEAK.';
const RAW_WORKSPACE = 'C:/Users/example/private workspace DO-NOT-LEAK';

const resumeIntent: OriginalIntentEnvelope = {
  intentId: 'intent-preflight',
  createdAt: FIXED_NOW.toISOString(),
  surface: 'chat',
  audience: 'everyday_user',
  userId: 'maria',
  sessionId: 'session-preflight',
  taskId: 'task-preflight',
  rawText: RAW_INTENT,
  normalizedText: 'use gemini cli with private phrase',
  requestedCapabilityId: 'executor-gemini-cli',
  requestedExecutorName: 'gemini_cli',
  workspace: RAW_WORKSPACE,
};

const missingReadiness: CapabilityReadinessSnapshot = {
  capabilityId: 'executor-gemini-cli',
  generatedAt: FIXED_NOW.toISOString(),
  status: 'missing',
  severity: 'error',
  ready: false,
  safeToRun: false,
  summary: 'Gemini CLI ainda not esta ready.',
  detail: 'Autenticaction missing.',
  checkedTargets: [],
  missingRequirements: [],
  blockingReason: 'missing_auth',
  probe: null,
  executor: null,
  evidence: [],
};

const readyReadiness: CapabilityReadinessSnapshot = {
  ...missingReadiness,
  status: 'ready',
  severity: 'info',
  ready: true,
  safeToRun: true,
  summary: 'Gemini CLI esta ready.',
  detail: 'Readiness passou.',
  blockingReason: null,
};

function createRepairPlan(): CapabilityRepairPlan {
  return {
    repairPlanId: 'repair-preflight',
    capabilityId: 'executor-gemini-cli',
    diagnosisId: 'diagnosis-preflight',
    createdAt: FIXED_NOW.toISOString(),
    status: 'validated',
    summary: 'Previous plan validated.',
    riskLevel: 5,
    trustLevelRequired: 'collaborator',
    permissionRequirements: [],
    steps: [],
    validators: [],
    fallbackOptions: [],
    resumeIntent,
  };
}

function createValidation(success = true): CapabilityValidationResult {
  return {
    capabilityId: 'executor-gemini-cli',
    generatedAt: FIXED_NOW.toISOString(),
    success,
    summary: success ? 'Readiness is green.' : 'Readiness failed.',
    results: [],
    readiness: success ? readyReadiness : missingReadiness,
  };
}

function createReceipt(overrides: Partial<CapabilityReceipt> = {}): CapabilityReceipt {
  const validation = overrides.validation === undefined ? createValidation(true) : overrides.validation;
  return {
    receiptId: 'receipt-preflight',
    generatedAt: FIXED_NOW.toISOString(),
    stage: validation?.success ? 'resume' : 'failed',
    surface: 'chat',
    audience: 'everyday_user',
    capabilityId: 'executor-gemini-cli',
    capabilityLabel: 'Gemini CLI',
    headline: 'Gemini CLI esta ready.',
    userSummary: 'Readiness validated.',
    technicalSummary: 'ready',
    trustLevel: 'collaborator',
    readiness: validation?.success ? readyReadiness : missingReadiness,
    diagnosis: null,
    repairPlan: createRepairPlan(),
    validation,
    selectedFallback: null,
    resumeIntent,
    timeline: [],
    ...overrides,
  };
}

function createService(readiness: CapabilityReadinessSnapshot) {
  return new CapabilityAutopilotPreflightHintService({
    now: () => FIXED_NOW,
    readinessService: {
      buildReadinessSnapshot: jest.fn(async () => readiness),
    },
  });
}

function createReplayService() {
  return new CapabilityAutopilotMemoryReplayService({
    now: () => FIXED_NOW,
  });
}

describe('CapabilityAutopilotPreflightHintService', () => {
  it('turns a remembered fallback into a visible preflight hint without auto execution', async () => {
    const replay = createReplayService();
    const fallbackReceipt = createReceipt({
      receiptId: 'receipt-fallback',
      stage: 'fallback',
      selectedFallback: {
        id: 'fallback-codex',
        label: 'Use Codex',
        executorName: 'codex',
        capabilityId: 'executor-codex',
        reason: 'Fallback visible.',
        requiresPermission: true,
        policyAllowed: null,
      },
      validation: null,
    });
    const record = replay.buildMemoryRecord({
      receipt: fallbackReceipt,
      rawIntentText: RAW_INTENT,
      workspace: RAW_WORKSPACE,
    });
    const service = createService(missingReadiness);

    const result = await service.buildPreflightHint({
      capabilityId: 'executor-gemini-cli',
      records: [record],
      receipt: fallbackReceipt,
      rawIntentText: RAW_INTENT,
      workspace: RAW_WORKSPACE,
    });
    const serialized = JSON.stringify(result);

    expect(result).toMatchObject({
      status: 'hint_available',
      hintKind: 'fallback',
      recommendedNextAction: 'continue_selected_fallback_with_audit_receipt',
      shouldAskPermission: true,
      requiresExplicitUserChoice: true,
      shouldRunAutomatically: false,
      metadata: {
        autoExecute: false,
        rawIntentStored: false,
        rawWorkspaceStored: false,
      },
    });
    expect(result.userSummary).toContain('will not switch de executor unless you choose');
    expect(serialized).not.toContain(RAW_INTENT);
    expect(serialized).not.toContain(RAW_WORKSPACE);
  });

  it('turns a ready memory into a lightweight readiness hint', async () => {
    const replay = createReplayService();
    const readyReceipt = createReceipt();
    const record = replay.buildMemoryRecord({
      receipt: readyReceipt,
      rawIntentText: RAW_INTENT,
      workspace: RAW_WORKSPACE,
    });
    const service = createService(readyReadiness);

    const result = await service.buildPreflightHint({
      capabilityId: 'executor-gemini-cli',
      records: [record],
      receipt: readyReceipt,
      rawIntentText: RAW_INTENT,
      workspace: RAW_WORKSPACE,
    });

    expect(result).toMatchObject({
      status: 'hint_available',
      hintKind: 'ready',
      recommendedNextAction: 'resume_original_intent_after_readiness_check',
      shouldAskPermission: false,
      requiresExplicitUserChoice: false,
      shouldRunAutomatically: false,
    });
    expect(result.headline).toBe('I have seen a similar case that ended ready to resume.');
  });

  it('falls back to normal diagnosis when there is no useful memory', async () => {
    const service = createService(missingReadiness);

    const result = await service.buildPreflightHint({
      capabilityId: 'executor-gemini-cli',
      records: [],
      rawIntentText: RAW_INTENT,
      workspace: RAW_WORKSPACE,
    });

    expect(result).toMatchObject({
      status: 'no_hint',
      hintKind: 'none',
      recommendedNextAction: null,
      shouldAskPermission: false,
      requiresExplicitUserChoice: false,
      shouldRunAutomatically: false,
    });
    expect(result.headline).toBe('Vou seguir pelo diagnostico normal desta capability.');
  });

  it('reports insufficient signal without inventing a hint', async () => {
    const service = createService(readyReadiness);

    const result = await service.buildPreflightHint({
      capabilityId: '',
      records: [],
    });

    expect(result).toMatchObject({
      status: 'insufficient_signal',
      hintKind: 'none',
      recommendedNextAction: null,
      shouldRunAutomatically: false,
    });
  });
});
