import type { CapabilityAutopilotPreflightSnapshot } from '../../src/services/CapabilityAutopilotPreflightEntrypointService';
import { CapabilityAutopilotPreflightActionHandlerService } from '../../src/services/CapabilityAutopilotPreflightActionHandlerService';
import { CapabilityAutopilotPreflightSurfaceService } from '../../src/services/CapabilityAutopilotPreflightSurfaceService';
import type { CapabilityPreflightSurfaceAction } from '../../src/services/CapabilityAutopilotPreflightSurfaceService';
import type {
  CapabilityPreflightHintKind,
  CapabilityPreflightHintResult,
} from '../../src/services/CapabilityAutopilotPreflightHintService';
import type {
  CapabilityMemoryOutcome,
  CapabilityReadinessSnapshot,
} from '../../src/contracts/CapabilityAutopilotContract';

const FIXED_NOW = new Date('2026-04-26T04:00:00.000Z');

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
  outcome: CapabilityMemoryOutcome,
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
    technicalSummary: `preflightHint=hint_available; hintKind=${hintKind}; outcome=${outcome}; autoExecute=false`,
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

function createService() {
  return new CapabilityAutopilotPreflightActionHandlerService({
    now: () => FIXED_NOW,
  });
}

describe('CapabilityAutopilotPreflightActionHandlerService', () => {
  it('maps every preflight action to a non-dispatching handler plan', () => {
    const service = createService();
    const snapshot = createSnapshot(createHint(
      'permission',
      'permission_required',
      'ask_for_explicit_approval_with_scoped_permissions',
    ));

    const wiring = service.buildWiringSnapshot(snapshot);

    expect(wiring).toMatchObject({
      stage: '69',
      status: 'ready',
      summary: {
        ok: true,
        failed: 0,
      },
      metadata: {
        autoExecute: false,
        dispatchAttempted: false,
      },
    });
    expect(wiring.plans.length).toBeGreaterThan(0);
    expect(wiring.plans.every((plan) => plan.shouldRunAutomatically === false)).toBe(true);
    expect(wiring.plans.every((plan) => plan.dispatchAttempted === false)).toBe(true);
    expect(wiring.plans.every((plan) => plan.readyForExplicitDispatch === false)).toBe(true);
    expect(wiring.plans.some((plan) => plan.handlerKind === 'prepare_permission_request')).toBe(true);
    expect(JSON.stringify(wiring)).not.toContain('rawText');
    expect(JSON.stringify(wiring)).not.toContain('normalizedText');
  });

  it('routes chat callbacks to permission handlers only after explicit confirmation', () => {
    const service = createService();
    const snapshot = createSnapshot(createHint(
      'permission',
      'permission_required',
      'ask_for_explicit_approval_with_scoped_permissions',
    ));
    const chatPayload = snapshot.payloads.find((payload) => payload.surface === 'chat');
    const action = chatPayload?.actions.find((candidate) => candidate.kind === 'request_permission');

    const result = service.handleAction(snapshot, {
      surface: 'chat',
      callbackData: action?.callbackData,
      userConfirmed: true,
    });

    expect(result).toMatchObject({
      status: 'handler_ready',
      handlerKind: 'prepare_permission_request',
      handlerStage: 'permission',
      requiresApproval: true,
      userConfirmed: true,
      readyForExplicitDispatch: true,
      shouldRunAutomatically: false,
      dispatchAttempted: false,
      target: {
        callbackData: action?.callbackData,
      },
    });
  });

  it('preserves validation gates before resume handlers', () => {
    const service = createService();
    const snapshot = createSnapshot(createHint(
      'ready',
      'ready',
      'resume_original_intent_after_readiness_check',
    ));

    const result = service.handleAction(snapshot, {
      surface: 'api',
      actionKind: 'resume_after_check',
      userConfirmed: true,
    });

    expect(result).toMatchObject({
      status: 'handler_ready',
      handlerKind: 'prepare_resume_after_validation',
      handlerStage: 'resume',
      requiresValidation: true,
      shouldRunAutomatically: false,
      dispatchAttempted: false,
    });
    expect(result.target.route).toBe('/api/capabilities/executor-gemini-cli/autopilot/preflight/resume');
  });

  it('blocks unknown surfaces and unsafe actions', () => {
    const service = createService();
    const snapshot = createSnapshot(createHint(
      'fallback',
      'fallback_selected',
      'continue_selected_fallback_with_audit_receipt',
    ));

    const missingSurface = service.handleAction(snapshot, {
      surface: 'operator',
      actionKind: 'show_fallbacks',
    });
    const unsafeAction = {
      ...snapshot.payloads[0].actions[0],
      requiresExplicitUserAction: false,
    } as unknown as CapabilityPreflightSurfaceAction;
    const unsafeSnapshot: CapabilityAutopilotPreflightSnapshot = {
      ...snapshot,
      payloads: [
        {
          ...snapshot.payloads[0],
          actions: [unsafeAction],
        },
      ],
    };
    const unsafe = service.handleAction(unsafeSnapshot, {
      surface: 'cli',
      actionId: snapshot.payloads[0].actions[0].id,
    });

    expect(missingSurface).toMatchObject({
      status: 'blocked',
      blockers: ['surface_not_found:operator'],
      dispatchAttempted: false,
    });
    expect(unsafe).toMatchObject({
      status: 'blocked',
      blockers: ['missing_explicit_user_action_contract'],
      dispatchAttempted: false,
    });
  });
});
