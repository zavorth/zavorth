import type { CapabilityAutopilotPreflightSnapshot } from '../../src/services/CapabilityAutopilotPreflightEntrypointService';
import { CapabilityAutopilotPreflightActionHandlerService } from '../../src/services/CapabilityAutopilotPreflightActionHandlerService';
import { CapabilityAutopilotPreflightDispatchAdapterService } from '../../src/services/CapabilityAutopilotPreflightDispatchAdapterService';
import { CapabilityAutopilotPreflightDispatchReceiptService } from '../../src/services/CapabilityAutopilotPreflightDispatchReceiptService';
import { CapabilityAutopilotPreflightSideEffectGateService } from '../../src/services/CapabilityAutopilotPreflightSideEffectGateService';
import { CapabilityAutopilotPreflightSurfaceService } from '../../src/services/CapabilityAutopilotPreflightSurfaceService';
import type {
  CapabilityPreflightHintKind,
  CapabilityPreflightHintResult,
} from '../../src/services/CapabilityAutopilotPreflightHintService';
import type { CapabilityReadinessSnapshot } from '../../src/contracts/CapabilityAutopilotContract';

const FIXED_NOW = new Date('2026-04-26T07:00:00.000Z');

const readiness: CapabilityReadinessSnapshot = {
  capabilityId: 'executor-gemini-cli',
  generatedAt: FIXED_NOW.toISOString(),
  status: 'missing',
  severity: 'error',
  ready: false,
  safeToRun: false,
  summary: 'Gemini CLI ainda nao esta pronto.',
  detail: 'Autenticacao ausente.',
  checkedTargets: [],
  missingRequirements: [],
  blockingReason: 'missing_auth',
  probe: null,
  executor: null,
  evidence: [],
};

function createHint(
  hintKind: CapabilityPreflightHintKind,
  recommendedNextAction: string | null,
): CapabilityPreflightHintResult {
  return {
    generatedAt: FIXED_NOW.toISOString(),
    capabilityId: 'executor-gemini-cli',
    status: 'hint_available',
    hintKind,
    readiness: hintKind === 'ready'
      ? {
        ...readiness,
        status: 'ready',
        severity: 'info',
        ready: true,
        safeToRun: true,
        summary: 'Gemini CLI esta pronto.',
        blockingReason: null,
      }
      : readiness,
    recall: {
      generatedAt: FIXED_NOW.toISOString(),
      status: 'match_found',
      query: {
        capabilityId: 'executor-gemini-cli',
        workspaceHash: 'w'.repeat(64),
        intentFingerprint: 'i'.repeat(64),
        failureKind: 'missing_auth',
      },
      matches: [],
      bestMatch: null,
      shouldPreloadHint: true,
      recommendedNextAction,
      safeSummary: 'Memoria procedural redigida. Nada deve ser executado automaticamente.',
      metadata: {
        autoExecute: false,
      },
    },
    headline: 'Preflight conhecido.',
    userSummary: 'Existe uma dica de preflight, mas nada sera executado automaticamente.',
    technicalSummary: `preflightHint=hint_available; hintKind=${hintKind}; autoExecute=false`,
    recommendedNextAction,
    shouldAskPermission: hintKind === 'permission' || hintKind === 'fallback' || hintKind === 'repair',
    requiresExplicitUserChoice: hintKind === 'permission' || hintKind === 'fallback' || hintKind === 'repair',
    shouldRunAutomatically: false,
    metadata: {
      autoExecute: false,
    },
  };
}

function createSnapshot(hint: CapabilityPreflightHintResult): CapabilityAutopilotPreflightSnapshot {
  const surfaceService = new CapabilityAutopilotPreflightSurfaceService({
    now: () => FIXED_NOW,
  });
  const payloads = surfaceService.buildPayloads(hint, ['cli', 'web', 'chat', 'telegram', 'api']);

  return {
    stage: '68',
    surface: 'capability-autopilot-preflight-entrypoint',
    generatedAt: FIXED_NOW.toISOString(),
    capabilityId: 'executor-gemini-cli',
    status: 'ready',
    summary: {
      ok: true,
      passed: 6,
      warnings: 0,
      failed: 0,
    },
    hint,
    records: [],
    payloads,
    checks: [],
    nextRecommendedGate: {
      stage: '69',
      title: 'Preflight Action Handler Wiring',
      reason: 'Wire explicit actions.',
    },
    metadata: {
      autoExecute: false,
    },
  };
}

function createAdapterSnapshot(
  hint: CapabilityPreflightHintResult,
  explicitlyConfirmed = true,
) {
  const actionHandlerService = new CapabilityAutopilotPreflightActionHandlerService({
    now: () => FIXED_NOW,
  });
  const receiptService = new CapabilityAutopilotPreflightDispatchReceiptService({
    now: () => FIXED_NOW,
    actionHandlerService,
  });
  const adapterService = new CapabilityAutopilotPreflightDispatchAdapterService({
    now: () => FIXED_NOW,
  });
  const source = createSnapshot(hint);
  const receiptSnapshot = receiptService.buildReceiptSnapshot(source, {
    explicitlyConfirmed,
    actorId: 'operator-1',
    confirmationId: 'confirm-1',
  });
  return adapterService.buildAdapterSnapshot(receiptSnapshot);
}

function createGateService() {
  return new CapabilityAutopilotPreflightSideEffectGateService({
    now: () => FIXED_NOW,
  });
}

describe('CapabilityAutopilotPreflightSideEffectGateService', () => {
  it('authorizes prepared adapter envelopes only as gate decisions without invocation', () => {
    const service = createGateService();
    const adapters = createAdapterSnapshot(createHint(
      'permission',
      'ask_for_explicit_approval_with_scoped_permissions',
    ));

    const gate = service.buildGateSnapshot(adapters, {
      approvalGranted: true,
      validationPassed: true,
      actorId: 'operator-1',
      approvalReceiptId: 'approval-1',
      validationReceiptId: 'validation-1',
      reason: 'checkpoint-72-test',
    });

    expect(gate).toMatchObject({
      stage: '72',
      status: 'ready',
      summary: {
        ok: true,
        failed: 0,
      },
      metadata: {
        autoExecute: false,
        sideEffectInvoked: false,
        adapterInvoked: false,
        dispatchExecuted: false,
      },
    });
    expect(gate.decisions.length).toBe(adapters.envelopes.length);
    expect(gate.decisions.every((decision) => decision.status === 'side_effect_ready')).toBe(true);
    expect(gate.decisions.every((decision) => decision.sideEffectAuthorized)).toBe(true);
    expect(gate.decisions.every((decision) => decision.sideEffectInvoked === false)).toBe(true);
    expect(gate.decisions.every((decision) => decision.dispatchExecuted === false)).toBe(true);
    expect(JSON.stringify(gate)).not.toContain('rawText');
    expect(JSON.stringify(gate)).not.toContain('normalizedText');
  });

  it('blocks permission side effects when approval evidence is missing', () => {
    const service = createGateService();
    const adapters = createAdapterSnapshot(createHint(
      'permission',
      'ask_for_explicit_approval_with_scoped_permissions',
    ));

    const gate = service.buildGateSnapshot(adapters, {
      approvalGranted: false,
      validationPassed: true,
    });

    expect(gate.status).toBe('blocked');
    expect(gate.decisions.some((decision) => decision.blockers.includes('approval_required'))).toBe(true);
    expect(gate.checks.find((check) => check.id === 'capability-autopilot-preflight-side-effect:approval-gate'))
      .toMatchObject({
        status: 'fail',
      });
    expect(gate.decisions.every((decision) => decision.sideEffectInvoked === false)).toBe(true);
  });

  it('blocks resume side effects when validation evidence is missing', () => {
    const service = createGateService();
    const adapters = createAdapterSnapshot(createHint(
      'ready',
      'resume_original_intent_after_readiness_check',
    ));

    const gate = service.buildGateSnapshot(adapters, {
      approvalGranted: true,
      validationPassed: false,
    });

    expect(gate.status).toBe('blocked');
    expect(gate.decisions.some((decision) => decision.blockers.includes('validation_required'))).toBe(true);
    expect(gate.checks.find((check) => check.id === 'capability-autopilot-preflight-side-effect:validation-gate'))
      .toMatchObject({
        status: 'fail',
      });
    expect(gate.decisions.every((decision) => decision.dispatchExecuted === false)).toBe(true);
  });

  it('blocks unprepared adapter envelopes and renders a compact report', () => {
    const service = createGateService();
    const adapters = createAdapterSnapshot(createHint(
      'permission',
      'ask_for_explicit_approval_with_scoped_permissions',
    ), false);

    const gate = service.buildGateSnapshot(adapters, {
      approvalGranted: true,
      validationPassed: true,
    });

    expect(gate.status).toBe('blocked');
    expect(gate.decisions.some((decision) => decision.blockers.includes('receipt_confirmation_missing'))).toBe(true);
    expect(service.renderReport(gate)).toContain('Gate capability-autopilot-preflight-side-effect-gate - Preflight Dispatch Side-Effect Gate');
    expect(service.renderReport(gate)).toContain('proximo passo recomendada: 73 - Preflight Dispatch Apply Adapter');
  });
});
