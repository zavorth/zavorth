import type { CapabilityAutopilotPreflightSnapshot } from '../../src/services/CapabilityAutopilotPreflightEntrypointService';
import { CapabilityAutopilotPreflightActionHandlerService } from '../../src/services/CapabilityAutopilotPreflightActionHandlerService';
import { CapabilityAutopilotPreflightApplyAdapterService } from '../../src/services/CapabilityAutopilotPreflightApplyAdapterService';
import { CapabilityAutopilotPreflightApplyDryRunExecutorService } from '../../src/services/CapabilityAutopilotPreflightApplyDryRunExecutorService';
import { CapabilityAutopilotPreflightDispatchAdapterService } from '../../src/services/CapabilityAutopilotPreflightDispatchAdapterService';
import { CapabilityAutopilotPreflightDispatchReceiptService } from '../../src/services/CapabilityAutopilotPreflightDispatchReceiptService';
import { CapabilityAutopilotPreflightRealApplyApprovalGateService } from '../../src/services/CapabilityAutopilotPreflightRealApplyApprovalGateService';
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
    phase: '68',
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
    nextRecommendedPhase: {
      phase: '69',
      title: 'Preflight Action Handler Wiring',
      reason: 'Wire explicit actions.',
    },
    metadata: {
      autoExecute: false,
    },
  };
}

function createDryRunSnapshot(
  hint: CapabilityPreflightHintResult,
  options: {
    explicitlyConfirmed?: boolean;
    approvalGranted?: boolean;
    validationPassed?: boolean;
    explicitApplyConfirmed?: boolean;
    dryRunConfirmed?: boolean;
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
  const dryRunService = new CapabilityAutopilotPreflightApplyDryRunExecutorService({
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
  const applySnapshot = applyService.buildApplySnapshot(gateSnapshot, {
    explicitApplyConfirmed: options.explicitApplyConfirmed !== false,
    actorId: 'operator-1',
    applyConfirmationId: 'apply-confirm-1',
  });
  return dryRunService.buildExecutorSnapshot(applySnapshot, {
    dryRunConfirmed: options.dryRunConfirmed !== false,
    actorId: 'operator-1',
    dryRunReceiptId: 'dry-run-1',
  });
}

function createApprovalService() {
  return new CapabilityAutopilotPreflightRealApplyApprovalGateService({
    now: () => FIXED_NOW,
  });
}

describe('CapabilityAutopilotPreflightRealApplyApprovalGateService', () => {
  it('authorizes real apply decisions after dry-run, final approval, budget, and scope without invoking targets', () => {
    const service = createApprovalService();
    const dryRun = createDryRunSnapshot(createHint(
      'permission',
      'ask_for_explicit_approval_with_scoped_permissions',
    ));

    const approval = service.buildGateSnapshot(dryRun, {
      finalApprovalGranted: true,
      budgetApproved: true,
      scopeApproved: true,
      allowedSurfaces: ['cli', 'web', 'chat', 'telegram', 'api'],
      budgetLimitUnits: 25,
      actorId: 'operator-1',
      finalApprovalReceiptId: 'final-approval-1',
      budgetReceiptId: 'budget-1',
      scopeReceiptId: 'scope-1',
      reason: 'phase-75-test',
    });

    expect(approval).toMatchObject({
      phase: '75',
      status: 'ready',
      summary: {
        ok: true,
        failed: 0,
      },
      metadata: {
        autoExecute: false,
        sideEffectInvoked: false,
        dispatchExecuted: false,
        executedAgainstRealTarget: false,
      },
    });
    expect(approval.decisions.length).toBe(dryRun.executions.length);
    expect(approval.decisions.every((decision) => decision.status === 'real_apply_ready')).toBe(true);
    expect(approval.decisions.every((decision) => decision.realApplyAuthorized)).toBe(true);
    expect(approval.decisions.every((decision) => decision.realApplyPrepared)).toBe(true);
    expect(approval.decisions.every((decision) => decision.realApplyInvoked === false)).toBe(true);
    expect(approval.decisions.every((decision) => decision.executedAgainstRealTarget === false)).toBe(true);
    expect(approval.decisions.every((decision) => decision.sideEffectLevel === 'approval_only')).toBe(true);
    expect(approval.decisions.some((decision) => decision.invocationKind === 'cli_command_dry_run')).toBe(true);
    expect(approval.decisions.some((decision) => decision.invocationKind === 'api_request_dry_run')).toBe(true);
    expect(JSON.stringify(approval)).not.toContain('rawText');
    expect(JSON.stringify(approval)).not.toContain('normalizedText');
  });

  it('blocks real apply decisions without final approval', () => {
    const service = createApprovalService();
    const dryRun = createDryRunSnapshot(createHint(
      'permission',
      'ask_for_explicit_approval_with_scoped_permissions',
    ));

    const approval = service.buildGateSnapshot(dryRun, {
      finalApprovalGranted: false,
      budgetApproved: true,
      scopeApproved: true,
      allowedSurfaces: ['cli', 'web', 'chat', 'telegram', 'api'],
    });

    expect(approval.status).toBe('blocked');
    expect(approval.decisions.some((decision) => decision.blockers.includes('final_approval_required'))).toBe(true);
    expect(approval.decisions.every((decision) => decision.realApplyAuthorized === false)).toBe(true);
    expect(approval.checks.find((check) => check.id === 'capability-autopilot-preflight-real-apply:final-approval'))
      .toMatchObject({
        status: 'fail',
      });
  });

  it('blocks real apply decisions when budget approval or budget limit fails', () => {
    const service = createApprovalService();
    const dryRun = createDryRunSnapshot(createHint(
      'permission',
      'ask_for_explicit_approval_with_scoped_permissions',
    ));

    const approval = service.buildGateSnapshot(dryRun, {
      finalApprovalGranted: true,
      budgetApproved: true,
      scopeApproved: true,
      allowedSurfaces: ['cli', 'web', 'chat', 'telegram', 'api'],
      estimatedBudgetUnits: 50,
      budgetLimitUnits: 5,
    });

    expect(approval.status).toBe('blocked');
    expect(approval.decisions.some((decision) => decision.blockers.includes('budget_exceeded'))).toBe(true);
    expect(approval.decisions.every((decision) => decision.budget.withinBudget === false)).toBe(true);
    expect(approval.decisions.every((decision) => decision.realApplyInvoked === false)).toBe(true);
  });

  it('blocks real apply decisions outside the approved surface scope', () => {
    const service = createApprovalService();
    const dryRun = createDryRunSnapshot(createHint(
      'permission',
      'ask_for_explicit_approval_with_scoped_permissions',
    ));

    const approval = service.buildGateSnapshot(dryRun, {
      finalApprovalGranted: true,
      budgetApproved: true,
      scopeApproved: true,
      allowedSurfaces: ['api'],
    });

    expect(approval.status).toBe('blocked');
    expect(approval.decisions.some((decision) => decision.blockers.includes('surface_out_of_scope'))).toBe(true);
    expect(approval.decisions.some((decision) => decision.sourceSurface === 'api' && decision.scope.sourceSurfaceAllowed)).toBe(true);
    expect(approval.decisions.some((decision) => decision.sourceSurface === 'cli' && !decision.scope.sourceSurfaceAllowed)).toBe(true);
  });

  it('preserves resume validation approvals and renders the next phase', () => {
    const service = createApprovalService();
    const dryRun = createDryRunSnapshot(createHint(
      'ready',
      'resume_original_intent_after_readiness_check',
    ));

    const approval = service.buildGateSnapshot(dryRun, {
      finalApprovalGranted: true,
      budgetApproved: true,
      scopeApproved: true,
      allowedSurfaces: ['cli', 'web', 'chat', 'telegram', 'api'],
      finalApprovalReceiptId: 'resume-final-approval',
      budgetReceiptId: 'resume-budget',
      scopeReceiptId: 'resume-scope',
    });
    const apiResume = approval.decisions.find((decision) =>
      decision.sourceSurface === 'api' &&
      decision.sourceAction?.kind === 'resume_after_check'
    );

    expect(apiResume).toMatchObject({
      status: 'real_apply_ready',
      invocationKind: 'api_request_dry_run',
      sourceDryRunStatus: 'dry_run_passed',
      sourceDryRunPassed: true,
      realApplyAuthorized: true,
      realApplyInvoked: false,
      sideEffectInvoked: false,
      budget: {
        withinBudget: true,
        budgetReceiptId: 'resume-budget',
      },
      scope: {
        sourceSurfaceAllowed: true,
        scopeReceiptId: 'resume-scope',
      },
    });
    expect(service.renderReport(approval)).toContain('Fase 75 - Preflight Real Apply Approval Gate');
    expect(service.renderReport(approval)).toContain('proxima fase recomendada: 76 - Preflight Controlled Real Apply Executor');
  });
});
