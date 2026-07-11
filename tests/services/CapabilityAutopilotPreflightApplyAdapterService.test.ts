import type { CapabilityAutopilotPreflightSnapshot } from '../../src/services/CapabilityAutopilotPreflightEntrypointService';
import { CapabilityAutopilotPreflightActionHandlerService } from '../../src/services/CapabilityAutopilotPreflightActionHandlerService';
import { CapabilityAutopilotPreflightApplyAdapterService } from '../../src/services/CapabilityAutopilotPreflightApplyAdapterService';
import { CapabilityAutopilotPreflightDispatchAdapterService } from '../../src/services/CapabilityAutopilotPreflightDispatchAdapterService';
import { CapabilityAutopilotPreflightDispatchReceiptService } from '../../src/services/CapabilityAutopilotPreflightDispatchReceiptService';
import { CapabilityAutopilotPreflightSideEffectGateService } from '../../src/services/CapabilityAutopilotPreflightSideEffectGateService';
import { CapabilityAutopilotPreflightSurfaceService } from '../../src/services/CapabilityAutopilotPreflightSurfaceService';
import type {
  CapabilityPreflightHintKind,
  CapabilityPreflightHintResult,
} from '../../src/services/CapabilityAutopilotPreflightHintService';
import type { CapabilityReadinessSnapshot } from '../../src/contracts/CapabilityAutopilotContract';

const FIXED_NOW = new Date('2026-04-26T08:00:00.000Z');

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

function createGateSnapshot(
  hint: CapabilityPreflightHintResult,
  options: {
    explicitlyConfirmed?: boolean;
    approvalGranted?: boolean;
    validationPassed?: boolean;
  } = {},
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
  const gateService = new CapabilityAutopilotPreflightSideEffectGateService({
    now: () => FIXED_NOW,
  });
  const source = createSnapshot(hint);
  const receiptSnapshot = receiptService.buildReceiptSnapshot(source, {
    explicitlyConfirmed: options.explicitlyConfirmed !== false,
    actorId: 'operator-1',
    confirmationId: 'confirm-1',
  });
  const adapterSnapshot = adapterService.buildAdapterSnapshot(receiptSnapshot);
  return gateService.buildGateSnapshot(adapterSnapshot, {
    approvalGranted: options.approvalGranted !== false,
    validationPassed: options.validationPassed !== false,
    actorId: 'operator-1',
    approvalReceiptId: 'approval-1',
    validationReceiptId: 'validation-1',
  });
}

function createApplyService() {
  return new CapabilityAutopilotPreflightApplyAdapterService({
    now: () => FIXED_NOW,
  });
}

describe('CapabilityAutopilotPreflightApplyAdapterService', () => {
  it('builds dry-run apply receipts from authorized gate decisions without invocation', () => {
    const service = createApplyService();
    const gate = createGateSnapshot(createHint(
      'permission',
      'ask_for_explicit_approval_with_scoped_permissions',
    ));

    const apply = service.buildApplySnapshot(gate, {
      explicitApplyConfirmed: true,
      actorId: 'operator-1',
      applyConfirmationId: 'apply-confirm-1',
      reason: 'checkpoint-73-test',
    });

    expect(apply).toMatchObject({
      stage: '73',
      status: 'ready',
      summary: {
        ok: true,
        failed: 0,
      },
      metadata: {
        autoExecute: false,
        applyInvoked: false,
        sideEffectInvoked: false,
        dispatchExecuted: false,
      },
    });
    expect(apply.applyReceipts.length).toBe(gate.decisions.length);
    expect(apply.applyReceipts.every((receipt) => receipt.status === 'apply_receipt_ready')).toBe(true);
    expect(apply.applyReceipts.every((receipt) => receipt.applyPrepared)).toBe(true);
    expect(apply.applyReceipts.every((receipt) => receipt.applyInvoked === false)).toBe(true);
    expect(apply.applyReceipts.every((receipt) => receipt.invocationPlan.dryRun)).toBe(true);
    expect(apply.applyReceipts.some((receipt) => receipt.applyAdapterKind === 'cli_apply_plan')).toBe(true);
    expect(apply.applyReceipts.some((receipt) => receipt.applyAdapterKind === 'api_request_plan')).toBe(true);
    expect(JSON.stringify(apply)).not.toContain('rawText');
    expect(JSON.stringify(apply)).not.toContain('normalizedText');
  });

  it('blocks apply receipts without a separate explicit apply confirmation', () => {
    const service = createApplyService();
    const gate = createGateSnapshot(createHint(
      'permission',
      'ask_for_explicit_approval_with_scoped_permissions',
    ));

    const apply = service.buildApplySnapshot(gate, {
      explicitApplyConfirmed: false,
    });

    expect(apply.status).toBe('blocked');
    expect(apply.applyReceipts.some((receipt) => receipt.blockers.includes('apply_confirmation_required'))).toBe(true);
    expect(apply.checks.find((check) => check.id === 'capability-autopilot-preflight-apply:explicit-confirmation'))
      .toMatchObject({
        status: 'fail',
      });
    expect(apply.applyReceipts.every((receipt) => receipt.applyInvoked === false)).toBe(true);
  });

  it('blocks apply receipts when side-effect gate decisions are not authorized', () => {
    const service = createApplyService();
    const gate = createGateSnapshot(createHint(
      'permission',
      'ask_for_explicit_approval_with_scoped_permissions',
    ), {
      approvalGranted: false,
    });

    const apply = service.buildApplySnapshot(gate, {
      explicitApplyConfirmed: true,
    });

    expect(apply.status).toBe('blocked');
    expect(apply.applyReceipts.some((receipt) => receipt.blockers.includes('side_effect_not_authorized'))).toBe(true);
    expect(apply.applyReceipts.every((receipt) => receipt.sideEffectInvoked === false)).toBe(true);
  });

  it('preserves resume validation receipts as dry-run apply plans and renders a report', () => {
    const service = createApplyService();
    const gate = createGateSnapshot(createHint(
      'ready',
      'resume_original_intent_after_readiness_check',
    ));

    const apply = service.buildApplySnapshot(gate, {
      explicitApplyConfirmed: true,
      applyConfirmationId: 'apply-confirm-resume',
    });
    const apiResume = apply.applyReceipts.find((receipt) =>
      receipt.sourceSurface === 'api' &&
      receipt.sourceAction?.kind === 'resume_after_check'
    );

    expect(apiResume).toMatchObject({
      status: 'apply_receipt_ready',
      applyAdapterKind: 'api_request_plan',
      requiresValidation: true,
      validationStatus: 'validated',
      invocationPlan: {
        route: '/api/capabilities/executor-gemini-cli/autopilot/preflight/resume',
        method: 'POST',
        dryRun: true,
      },
    });
    expect(service.renderReport(apply)).toContain('Gate capability-autopilot-preflight-apply-adapter - Preflight Dispatch Apply Adapter');
    expect(service.renderReport(apply)).toContain('proximo passo recomendada: 74 - Preflight Apply Dry-Run Executor');
  });
});
