import type { CapabilityAutopilotPreflightSnapshot } from '../../src/services/CapabilityAutopilotPreflightEntrypointService';
import { CapabilityAutopilotPreflightActionHandlerService } from '../../src/services/CapabilityAutopilotPreflightActionHandlerService';
import { CapabilityAutopilotPreflightDispatchReceiptService } from '../../src/services/CapabilityAutopilotPreflightDispatchReceiptService';
import { CapabilityAutopilotPreflightSurfaceService } from '../../src/services/CapabilityAutopilotPreflightSurfaceService';
import type {
  CapabilityPreflightHintKind,
  CapabilityPreflightHintResult,
} from '../../src/services/CapabilityAutopilotPreflightHintService';
import type { CapabilityReadinessSnapshot } from '../../src/contracts/CapabilityAutopilotContract';

const FIXED_NOW = new Date('2026-04-26T05:00:00.000Z');

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
    nextRecommendedStage: {
      stage: '69',
      title: 'Preflight Action Handler Wiring',
      reason: 'Wire explicit actions.',
    },
    metadata: {
      autoExecute: false,
    },
  };
}

function createServices() {
  const actionHandlerService = new CapabilityAutopilotPreflightActionHandlerService({
    now: () => FIXED_NOW,
  });
  const receiptService = new CapabilityAutopilotPreflightDispatchReceiptService({
    now: () => FIXED_NOW,
    actionHandlerService,
  });
  return {
    actionHandlerService,
    receiptService,
  };
}

describe('CapabilityAutopilotPreflightDispatchReceiptService', () => {
  it('builds explicit dispatch receipts without executing side effects', () => {
    const { receiptService } = createServices();
    const snapshot = createSnapshot(createHint(
      'permission',
      'ask_for_explicit_approval_with_scoped_permissions',
    ));

    const result = receiptService.buildReceiptSnapshot(snapshot, {
      explicitlyConfirmed: true,
      actorId: 'operator-1',
      confirmationId: 'confirm-1',
      reason: 'checkpoint-70-test',
    });

    expect(result).toMatchObject({
      stage: '70',
      status: 'ready',
      summary: {
        ok: true,
        failed: 0,
      },
      metadata: {
        autoExecute: false,
        dispatchAttempted: false,
        dispatchExecuted: false,
      },
    });
    expect(result.receipts.length).toBeGreaterThan(0);
    expect(result.receipts.every((receipt) => receipt.status === 'dispatch_receipt_ready')).toBe(true);
    expect(result.receipts.every((receipt) => receipt.dispatchPrepared)).toBe(true);
    expect(result.receipts.every((receipt) => receipt.dispatchExecuted === false)).toBe(true);
    expect(result.receipts.every((receipt) => receipt.sideEffectLevel === 'none')).toBe(true);
    expect(result.receipts.some((receipt) => receipt.dispatchMode === 'permission_request')).toBe(true);
    expect(JSON.stringify(result)).not.toContain('rawText');
    expect(JSON.stringify(result)).not.toContain('normalizedText');
  });

  it('blocks receipts when explicit confirmation is missing', () => {
    const { actionHandlerService, receiptService } = createServices();
    const snapshot = createSnapshot(createHint(
      'permission',
      'ask_for_explicit_approval_with_scoped_permissions',
    ));
    const plan = actionHandlerService.handleAction(snapshot, {
      surface: 'chat',
      actionKind: 'request_permission',
      userConfirmed: false,
    });

    const receipt = receiptService.buildDispatchReceipt(plan, {
      explicitlyConfirmed: false,
    });

    expect(receipt).toMatchObject({
      status: 'blocked',
      explicitlyConfirmed: false,
      dispatchPrepared: false,
      dispatchExecuted: false,
      blockers: ['explicit_confirmation_required'],
    });
  });

  it('preserves approval and validation requirements on sensitive receipts', () => {
    const { actionHandlerService, receiptService } = createServices();
    const permissionSnapshot = createSnapshot(createHint(
      'permission',
      'ask_for_explicit_approval_with_scoped_permissions',
    ));
    const readySnapshot = createSnapshot(createHint(
      'ready',
      'resume_original_intent_after_readiness_check',
    ));
    const permissionPlan = actionHandlerService.handleAction(permissionSnapshot, {
      surface: 'api',
      actionKind: 'request_permission',
      userConfirmed: true,
    });
    const resumePlan = actionHandlerService.handleAction(readySnapshot, {
      surface: 'api',
      actionKind: 'resume_after_check',
      userConfirmed: true,
    });

    const permissionReceipt = receiptService.buildDispatchReceipt(permissionPlan);
    const resumeReceipt = receiptService.buildDispatchReceipt(resumePlan);

    expect(permissionReceipt).toMatchObject({
      status: 'dispatch_receipt_ready',
      dispatchMode: 'permission_request',
      requiresApproval: true,
      requiresValidation: false,
      dispatchExecuted: false,
    });
    expect(resumeReceipt).toMatchObject({
      status: 'dispatch_receipt_ready',
      dispatchMode: 'resume_request',
      requiresApproval: false,
      requiresValidation: true,
      dispatchExecuted: false,
    });
  });

  it('renders a compact gate report and blocks unsafe source plans', () => {
    const { receiptService } = createServices();
    const snapshot = createSnapshot(createHint(
      'permission',
      'ask_for_explicit_approval_with_scoped_permissions',
    ));
    const blocked = receiptService.buildReceiptSnapshot(snapshot, {
      explicitlyConfirmed: false,
    });

    expect(blocked.status).toBe('blocked');
    expect(blocked.checks.find((check) => check.id === 'capability-autopilot-preflight-dispatch:coverage'))
      .toMatchObject({
        status: 'fail',
      });
    expect(receiptService.renderReport(blocked)).toContain('Etapa 70 - Preflight Handler Execution Receipts');
    expect(receiptService.renderReport(blocked)).toContain('proximo passo recomendada: 71 - Preflight Dispatch Adapter Integration');
  });
});
