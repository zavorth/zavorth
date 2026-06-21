import type { CapabilityAutopilotPreflightSnapshot } from '../../src/services/CapabilityAutopilotPreflightEntrypointService';
import { CapabilityAutopilotPreflightActionHandlerService } from '../../src/services/CapabilityAutopilotPreflightActionHandlerService';
import { CapabilityAutopilotPreflightApplyAdapterService } from '../../src/services/CapabilityAutopilotPreflightApplyAdapterService';
import { CapabilityAutopilotPreflightApplyDryRunExecutorService } from '../../src/services/CapabilityAutopilotPreflightApplyDryRunExecutorService';
import {
  CapabilityAutopilotPreflightControlledRealApplyExecutorService,
  type CapabilityPreflightControlledRealApplyAdapter,
} from '../../src/services/CapabilityAutopilotPreflightControlledRealApplyExecutorService';
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

const fixtureAdapter: CapabilityPreflightControlledRealApplyAdapter = (decision, context) => ({
  ok: true,
  adapterReceiptId: `fixture-${decision.realApplyGateId.slice(-8)}`,
  mode: 'fixture',
  sideEffectInvoked: true,
  executedAgainstRealTarget: false,
  targetFingerprint: `fixture:${decision.sourceSurface}:${decision.sourceAction?.kind || '<none>'}`,
  outputSummary: `Fixture adapter committed ${decision.sourceAction?.kind || '<none>'}.`,
  evidence: [
    `contextBudgetLock=${context.budgetLockId || '<none>'}`,
    `contextRollbackPlan=${context.rollbackPlanId || '<none>'}`,
    `contextAudit=${context.auditReceiptId || '<none>'}`,
  ],
  rollbackToken: `rollback-${decision.sourceSurface}-${decision.sourceAction?.kind || 'none'}`,
  metadata: {
    fixture: true,
  },
});

const failingAdapter: CapabilityPreflightControlledRealApplyAdapter = (decision) => ({
  ok: false,
  adapterReceiptId: `fixture-failed-${decision.realApplyGateId.slice(-8)}`,
  mode: 'fixture',
  sideEffectInvoked: false,
  executedAgainstRealTarget: false,
  targetFingerprint: null,
  outputSummary: 'Fixture adapter failed before commit.',
  evidence: ['fixtureFailure=true'],
  rollbackToken: null,
  errorCode: 'fixture_adapter_failed',
});

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

function createApprovalSnapshot(
  hint: CapabilityPreflightHintResult,
  options: {
    explicitlyConfirmed?: boolean;
    approvalGranted?: boolean;
    validationPassed?: boolean;
    explicitApplyConfirmed?: boolean;
    dryRunConfirmed?: boolean;
    finalApprovalGranted?: boolean;
    budgetApproved?: boolean;
    scopeApproved?: boolean;
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
  const approvalService = new CapabilityAutopilotPreflightRealApplyApprovalGateService({
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
  const dryRunSnapshot = dryRunService.buildExecutorSnapshot(applySnapshot, {
    dryRunConfirmed: options.dryRunConfirmed !== false,
    actorId: 'operator-1',
    dryRunReceiptId: 'dry-run-1',
  });
  return approvalService.buildGateSnapshot(dryRunSnapshot, {
    finalApprovalGranted: options.finalApprovalGranted !== false,
    budgetApproved: options.budgetApproved !== false,
    scopeApproved: options.scopeApproved !== false,
    allowedSurfaces: ['cli', 'web', 'chat', 'telegram', 'api'],
    finalApprovalReceiptId: 'final-approval-1',
    budgetReceiptId: 'budget-1',
    scopeReceiptId: 'scope-1',
  });
}

function createExecutorService(adapter: CapabilityPreflightControlledRealApplyAdapter | null = fixtureAdapter) {
  return new CapabilityAutopilotPreflightControlledRealApplyExecutorService({
    now: () => FIXED_NOW,
    adapter,
  });
}

describe('CapabilityAutopilotPreflightControlledRealApplyExecutorService', () => {
  it('executes authorized decisions through an injected adapter with budget lock, audit, and rollback token', async () => {
    const service = createExecutorService();
    const approval = createApprovalSnapshot(createHint(
      'permission',
      'ask_for_explicit_approval_with_scoped_permissions',
    ));

    const result = await service.buildExecutorSnapshot(approval, {
      controlledExecutionConfirmed: true,
      budgetLocked: true,
      rollbackPlanApproved: true,
      auditSinkReady: true,
      actorId: 'operator-1',
      executionReceiptId: 'execute-1',
      budgetLockId: 'budget-lock-1',
      rollbackPlanId: 'rollback-plan-1',
      auditReceiptId: 'audit-1',
      reason: 'checkpoint-76-test',
    });

    expect(result).toMatchObject({
      phase: '76',
      status: 'ready',
      summary: {
        ok: true,
        failed: 0,
      },
      metadata: {
        autoExecute: false,
        controlledExecution: true,
        adapterAvailable: true,
      },
    });
    expect(result.executions.length).toBe(approval.decisions.length);
    expect(result.executions.every((execution) => execution.status === 'controlled_apply_succeeded')).toBe(true);
    expect(result.executions.every((execution) => execution.adapterInvoked)).toBe(true);
    expect(result.executions.every((execution) => execution.sideEffectInvoked)).toBe(true);
    expect(result.executions.every((execution) => execution.dispatchExecuted)).toBe(true);
    expect(result.executions.every((execution) => execution.executedAgainstRealTarget === false)).toBe(true);
    expect(result.executions.every((execution) => execution.rollbackPlan.rollbackToken !== null)).toBe(true);
    expect(result.executions.some((execution) => execution.adapterResult?.mode === 'fixture')).toBe(true);
    expect(JSON.stringify(result)).not.toContain('rawText');
    expect(JSON.stringify(result)).not.toContain('normalizedText');
  });

  it('blocks controlled execution when no adapter is injected', async () => {
    const service = createExecutorService(null);
    const approval = createApprovalSnapshot(createHint(
      'permission',
      'ask_for_explicit_approval_with_scoped_permissions',
    ));

    const result = await service.buildExecutorSnapshot(approval, {
      controlledExecutionConfirmed: true,
      budgetLocked: true,
      rollbackPlanApproved: true,
      auditSinkReady: true,
      budgetLockId: 'budget-lock-1',
      rollbackPlanId: 'rollback-plan-1',
      auditReceiptId: 'audit-1',
    });

    expect(result.status).toBe('blocked');
    expect(result.executions.some((execution) => execution.blockers.includes('execution_adapter_required'))).toBe(true);
    expect(result.executions.every((execution) => execution.adapterInvoked === false)).toBe(true);
    expect(result.executions.every((execution) => execution.sideEffectInvoked === false)).toBe(true);
  });

  it('blocks before adapter invocation without confirmation, budget lock, rollback plan, or audit sink', async () => {
    const service = createExecutorService();
    const approval = createApprovalSnapshot(createHint(
      'permission',
      'ask_for_explicit_approval_with_scoped_permissions',
    ));

    const result = await service.buildExecutorSnapshot(approval, {
      controlledExecutionConfirmed: false,
      budgetLocked: false,
      rollbackPlanApproved: false,
      auditSinkReady: false,
    });

    expect(result.status).toBe('blocked');
    expect(result.executions.some((execution) => execution.blockers.includes('controlled_execution_confirmation_required'))).toBe(true);
    expect(result.executions.some((execution) => execution.blockers.includes('budget_lock_required'))).toBe(true);
    expect(result.executions.some((execution) => execution.blockers.includes('rollback_plan_required'))).toBe(true);
    expect(result.executions.some((execution) => execution.blockers.includes('audit_sink_required'))).toBe(true);
    expect(result.executions.every((execution) => execution.adapterInvoked === false)).toBe(true);
  });

  it('reports adapter failures as blocked snapshots with no committed side effect', async () => {
    const service = createExecutorService(failingAdapter);
    const approval = createApprovalSnapshot(createHint(
      'permission',
      'ask_for_explicit_approval_with_scoped_permissions',
    ));

    const result = await service.buildExecutorSnapshot(approval, {
      controlledExecutionConfirmed: true,
      budgetLocked: true,
      rollbackPlanApproved: true,
      auditSinkReady: true,
      budgetLockId: 'budget-lock-1',
      rollbackPlanId: 'rollback-plan-1',
      auditReceiptId: 'audit-1',
    });

    expect(result.status).toBe('blocked');
    expect(result.executions.every((execution) => execution.status === 'adapter_failed')).toBe(true);
    expect(result.executions.every((execution) => execution.adapterInvoked)).toBe(true);
    expect(result.executions.every((execution) => execution.sideEffectInvoked === false)).toBe(true);
    expect(result.executions.some((execution) => execution.blockers.includes('fixture_adapter_failed'))).toBe(true);
  });

  it('preserves resume apply execution and renders the next phase', async () => {
    const service = createExecutorService();
    const approval = createApprovalSnapshot(createHint(
      'ready',
      'resume_original_intent_after_readiness_check',
    ));

    const result = await service.buildExecutorSnapshot(approval, {
      controlledExecutionConfirmed: true,
      budgetLocked: true,
      rollbackPlanApproved: true,
      auditSinkReady: true,
      budgetLockId: 'resume-budget-lock',
      rollbackPlanId: 'resume-rollback-plan',
      auditReceiptId: 'resume-audit',
      executionReceiptId: 'resume-execute',
    });
    const apiResume = result.executions.find((execution) =>
      execution.sourceSurface === 'api' &&
      execution.sourceAction?.kind === 'resume_after_check'
    );

    expect(apiResume).toMatchObject({
      status: 'controlled_apply_succeeded',
      adapterInvoked: true,
      sideEffectInvoked: true,
      invocationKind: 'api_request_dry_run',
      budgetLock: {
        budgetLockId: 'resume-budget-lock',
        withinBudget: true,
      },
      rollbackPlan: {
        rollbackPlanId: 'resume-rollback-plan',
        rollbackRequired: true,
      },
    });
    expect(apiResume?.adapterResult?.rollbackToken).toBe('rollback-api-resume_after_check');
    expect(service.renderReport(result)).toContain('Etapa 76 - Preflight Controlled Real Apply Executor');
    expect(service.renderReport(result)).toContain('proximo passo recomendada: 77 - Real Apply Post-Run Verification And Rollback Ledger');
  });
});
