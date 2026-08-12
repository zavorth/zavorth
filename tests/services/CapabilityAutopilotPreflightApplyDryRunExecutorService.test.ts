import type { CapabilityAutopilotPreflightSnapshot } from '../../src/services/CapabilityAutopilotPreflightEntrypointService';
import { CapabilityAutopilotPreflightActionHandlerService } from '../../src/services/CapabilityAutopilotPreflightActionHandlerService';
import { CapabilityAutopilotPreflightApplyAdapterService } from '../../src/services/CapabilityAutopilotPreflightApplyAdapterService';
import { CapabilityAutopilotPreflightApplyDryRunExecutorService } from '../../src/services/CapabilityAutopilotPreflightApplyDryRunExecutorService';
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

function createApplySnapshot(
  hint: CapabilityPreflightHintResult,
  options: {
    explicitlyConfirmed?: boolean;
    approvalGranted?: boolean;
    validationPassed?: boolean;
    explicitApplyConfirmed?: boolean;
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
  const applyService = new CapabilityAutopilotPreflightApplyAdapterService({
    now: () => FIXED_NOW,
  });
  const source = createSnapshot(hint);
  const receiptSnapshot = receiptService.buildReceiptSnapshot(source, {
    explicitlyConfirmed: options.explicitlyConfirmed !== false,
    actorId: 'operator-1',
    confirmationId: 'confirm-1',
  });
  const adapterSnapshot = adapterService.buildAdapterSnapshot(receiptSnapshot);
  const gateSnapshot = gateService.buildGateSnapshot(adapterSnapshot, {
    approvalGranted: options.approvalGranted !== false,
    validationPassed: options.validationPassed !== false,
    actorId: 'operator-1',
    approvalReceiptId: 'approval-1',
    validationReceiptId: 'validation-1',
  });
  return applyService.buildApplySnapshot(gateSnapshot, {
    explicitApplyConfirmed: options.explicitApplyConfirmed !== false,
    actorId: 'operator-1',
    applyConfirmationId: 'apply-confirm-1',
  });
}

function createDryRunService() {
  return new CapabilityAutopilotPreflightApplyDryRunExecutorService({
    now: () => FIXED_NOW,
  });
}

describe('CapabilityAutopilotPreflightApplyDryRunExecutorService', () => {
  it('builds dry-run executions from apply receipts without real target invocation', () => {
    const service = createDryRunService();
    const apply = createApplySnapshot(createHint(
      'permission',
      'ask_for_explicit_approval_with_scoped_permissions',
    ));

    const dryRun = service.buildExecutorSnapshot(apply, {
      dryRunConfirmed: true,
      actorId: 'operator-1',
      dryRunReceiptId: 'dry-run-1',
      reason: 'checkpoint-74-test',
    });

    expect(dryRun).toMatchObject({
      stage: '74',
      status: 'ready',
      summary: {
        ok: true,
        failed: 0,
      },
      metadata: {
        autoExecute: false,
        dryRunOnly: true,
        executedAgainstRealTarget: false,
      },
    });
    expect(dryRun.executions.length).toBe(apply.applyReceipts.length);
    expect(dryRun.executions.every((execution) => execution.status === 'dry_run_passed')).toBe(true);
    expect(dryRun.executions.every((execution) => execution.dryRunAttempted)).toBe(true);
    expect(dryRun.executions.every((execution) => execution.dryRunCompleted)).toBe(true);
    expect(dryRun.executions.every((execution) => execution.dryRunPassed)).toBe(true);
    expect(dryRun.executions.every((execution) => execution.executedAgainstRealTarget === false)).toBe(true);
    expect(dryRun.executions.every((execution) => execution.commandExecuted === false)).toBe(true);
    expect(dryRun.executions.every((execution) => execution.requestSent === false)).toBe(true);
    expect(dryRun.executions.every((execution) => execution.callbackSent === false)).toBe(true);
    expect(dryRun.executions.every((execution) => execution.navigationOpened === false)).toBe(true);
    expect(dryRun.executions.some((execution) => execution.invocationKind === 'cli_command_dry_run')).toBe(true);
    expect(dryRun.executions.some((execution) => execution.invocationKind === 'api_request_dry_run')).toBe(true);
    expect(JSON.stringify(dryRun)).not.toContain('rawText');
    expect(JSON.stringify(dryRun)).not.toContain('normalizedText');
  });

  it('blocks dry-run executions without a separate dry-run confirmation', () => {
    const service = createDryRunService();
    const apply = createApplySnapshot(createHint(
      'permission',
      'ask_for_explicit_approval_with_scoped_permissions',
    ));

    const dryRun = service.buildExecutorSnapshot(apply, {
      dryRunConfirmed: false,
    });

    expect(dryRun.status).toBe('blocked');
    expect(dryRun.executions.some((execution) => execution.blockers.includes('dry_run_confirmation_required'))).toBe(true);
    expect(dryRun.executions.every((execution) => execution.dryRunAttempted === false)).toBe(true);
    expect(dryRun.checks.find((check) => check.id === 'capability-autopilot-preflight-dry-run:attempted'))
      .toMatchObject({
        status: 'fail',
      });
  });

  it('blocks dry-run executions when source apply receipts are not prepared', () => {
    const service = createDryRunService();
    const apply = createApplySnapshot(createHint(
      'permission',
      'ask_for_explicit_approval_with_scoped_permissions',
    ), {
      explicitApplyConfirmed: false,
    });

    const dryRun = service.buildExecutorSnapshot(apply, {
      dryRunConfirmed: true,
    });

    expect(dryRun.status).toBe('blocked');
    expect(dryRun.executions.some((execution) => execution.blockers.includes('apply_not_prepared'))).toBe(true);
    expect(dryRun.executions.some((execution) => execution.blockers.includes('apply_receipt_not_ready:blocked'))).toBe(true);
    expect(dryRun.executions.every((execution) => execution.executedAgainstRealTarget === false)).toBe(true);
  });

  it('preserves resume validation dry-runs and renders the next phase', () => {
    const service = createDryRunService();
    const apply = createApplySnapshot(createHint(
      'ready',
      'resume_original_intent_after_readiness_check',
    ));

    const dryRun = service.buildExecutorSnapshot(apply, {
      dryRunConfirmed: true,
      dryRunReceiptId: 'dry-run-resume',
    });
    const apiResume = dryRun.executions.find((execution) =>
      execution.sourceSurface === 'api' &&
      execution.sourceAction?.kind === 'resume_after_check'
    );

    expect(apiResume).toMatchObject({
      status: 'dry_run_passed',
      invocationKind: 'api_request_dry_run',
      sourceInvocationPlan: {
        route: '/api/capabilities/executor-gemini-cli/autopilot/preflight/resume',
        method: 'POST',
        dryRun: true,
      },
      dryRunPassed: true,
      requestSent: false,
      sideEffectInvoked: false,
    });
    expect(apiResume?.evidence).toContain('targetShape=api-operation');
    expect(service.renderReport(dryRun)).toContain('Gate capability-autopilot-preflight-apply-dry-run - Preflight Apply Dry-Run Executor');
    expect(service.renderReport(dryRun)).toContain('proximo passo recomendada: 75 - Preflight Real Apply Approval Gate');
  });
});
