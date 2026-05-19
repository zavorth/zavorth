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
import { CapabilityAutopilotPreflightPostRunRollbackLedgerService } from '../../src/services/CapabilityAutopilotPreflightPostRunRollbackLedgerService';
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

const missingRollbackAdapter: CapabilityPreflightControlledRealApplyAdapter = (decision) => ({
  ok: true,
  adapterReceiptId: `fixture-no-rollback-${decision.realApplyGateId.slice(-8)}`,
  mode: 'fixture',
  sideEffectInvoked: true,
  executedAgainstRealTarget: false,
  targetFingerprint: `fixture:${decision.sourceSurface}:${decision.sourceAction?.kind || '<none>'}`,
  outputSummary: 'Fixture adapter committed without rollback token.',
  evidence: ['missingRollbackToken=true'],
  rollbackToken: null,
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

async function createControlledSnapshot(
  hint: CapabilityPreflightHintResult,
  options: {
    adapter?: CapabilityPreflightControlledRealApplyAdapter | null;
    controlledExecutionConfirmed?: boolean;
    budgetLocked?: boolean;
    rollbackPlanApproved?: boolean;
    auditSinkReady?: boolean;
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
  const controlledService = new CapabilityAutopilotPreflightControlledRealApplyExecutorService({
    now: () => FIXED_NOW,
    adapter: options.adapter === undefined ? fixtureAdapter : options.adapter,
  });
  const source = createSnapshot(hint);
  const receiptSnapshot = receiptService.buildReceiptSnapshot(source, {
    explicitlyConfirmed: true,
    actorId: 'operator-1',
    confirmationId: 'confirm-1',
  });
  const adapterSnapshot = adapterService.buildAdapterSnapshot(receiptSnapshot);
  const gateSnapshot = gateService.buildGateSnapshot(adapterSnapshot, {
    approvalGranted: true,
    validationPassed: true,
    actorId: 'operator-1',
    approvalReceiptId: 'approval-1',
    validationReceiptId: 'validation-1',
  });
  const applySnapshot = applyService.buildApplySnapshot(gateSnapshot, {
    explicitApplyConfirmed: true,
    actorId: 'operator-1',
    applyConfirmationId: 'apply-confirm-1',
  });
  const dryRunSnapshot = dryRunService.buildExecutorSnapshot(applySnapshot, {
    dryRunConfirmed: true,
    actorId: 'operator-1',
    dryRunReceiptId: 'dry-run-1',
  });
  const approvalSnapshot = approvalService.buildGateSnapshot(dryRunSnapshot, {
    finalApprovalGranted: true,
    budgetApproved: true,
    scopeApproved: true,
    allowedSurfaces: ['cli', 'web', 'chat', 'telegram', 'api'],
    finalApprovalReceiptId: 'final-approval-1',
    budgetReceiptId: 'budget-1',
    scopeReceiptId: 'scope-1',
  });
  return controlledService.buildExecutorSnapshot(approvalSnapshot, {
    controlledExecutionConfirmed: options.controlledExecutionConfirmed !== false,
    budgetLocked: options.budgetLocked !== false,
    rollbackPlanApproved: options.rollbackPlanApproved !== false,
    auditSinkReady: options.auditSinkReady !== false,
    actorId: 'operator-1',
    executionReceiptId: 'execute-1',
    budgetLockId: options.budgetLocked === false ? null : 'budget-lock-1',
    rollbackPlanId: options.rollbackPlanApproved === false ? null : 'rollback-plan-1',
    auditReceiptId: options.auditSinkReady === false ? null : 'audit-1',
  });
}

function createPostRunService() {
  return new CapabilityAutopilotPreflightPostRunRollbackLedgerService({
    now: () => FIXED_NOW,
  });
}

describe('CapabilityAutopilotPreflightPostRunRollbackLedgerService', () => {
  it('verifies controlled executions and persists rollback ledger plus audit receipts', async () => {
    const service = createPostRunService();
    const controlled = await createControlledSnapshot(createHint(
      'permission',
      'ask_for_explicit_approval_with_scoped_permissions',
    ));

    const postRun = service.buildLedgerSnapshot(controlled, {
      postRunVerificationConfirmed: true,
      verificationPassed: true,
      rollbackLedgerPersisted: true,
      auditPersisted: true,
      actorId: 'operator-1',
      postRunReceiptId: 'post-run-1',
      verificationReceiptId: 'verification-1',
      rollbackLedgerId: 'rollback-ledger-1',
      auditReceiptId: 'post-run-audit-1',
      reason: 'checkpoint-77-test',
    });

    expect(postRun).toMatchObject({
      stage: '77',
      status: 'ready',
      summary: {
        ok: true,
        failed: 0,
      },
      metadata: {
        autoExecute: false,
        rollbackInvoked: false,
      },
    });
    expect(postRun.entries.length).toBe(controlled.executions.length);
    expect(postRun.entries.every((entry) => entry.status === 'post_run_verified')).toBe(true);
    expect(postRun.entries.every((entry) => entry.postRunVerified)).toBe(true);
    expect(postRun.entries.every((entry) => entry.rollback.rollbackRequired)).toBe(true);
    expect(postRun.entries.every((entry) => entry.rollback.rollbackAvailable)).toBe(true);
    expect(postRun.entries.every((entry) => entry.rollback.rollbackToken !== null)).toBe(true);
    expect(postRun.entries.every((entry) => entry.rollback.rollbackInvoked === false)).toBe(true);
    expect(JSON.stringify(postRun)).not.toContain('rawText');
    expect(JSON.stringify(postRun)).not.toContain('normalizedText');
  });

  it('marks rollback required when post-run verification fails but rollback evidence exists', async () => {
    const service = createPostRunService();
    const controlled = await createControlledSnapshot(createHint(
      'permission',
      'ask_for_explicit_approval_with_scoped_permissions',
    ));

    const postRun = service.buildLedgerSnapshot(controlled, {
      postRunVerificationConfirmed: true,
      verificationPassed: false,
      rollbackLedgerPersisted: true,
      auditPersisted: true,
      postRunReceiptId: 'post-run-1',
      verificationReceiptId: 'verification-1',
      rollbackLedgerId: 'rollback-ledger-1',
      auditReceiptId: 'post-run-audit-1',
    });

    expect(postRun.status).toBe('blocked');
    expect(postRun.entries.every((entry) => entry.status === 'rollback_required')).toBe(true);
    expect(postRun.entries.some((entry) => entry.blockers.includes('post_run_verification_failed'))).toBe(true);
    expect(postRun.entries.every((entry) => entry.rollback.rollbackAvailable)).toBe(true);
    expect(postRun.entries.every((entry) => entry.rollback.rollbackInvoked === false)).toBe(true);
  });

  it('blocks post-run verification before persistence receipts are available', async () => {
    const service = createPostRunService();
    const controlled = await createControlledSnapshot(createHint(
      'permission',
      'ask_for_explicit_approval_with_scoped_permissions',
    ));

    const postRun = service.buildLedgerSnapshot(controlled, {
      postRunVerificationConfirmed: false,
      verificationPassed: true,
      rollbackLedgerPersisted: false,
      auditPersisted: false,
    });

    expect(postRun.status).toBe('blocked');
    expect(postRun.entries.some((entry) => entry.blockers.includes('post_run_verification_confirmation_required'))).toBe(true);
    expect(postRun.entries.some((entry) => entry.blockers.includes('rollback_ledger_persistence_required'))).toBe(true);
    expect(postRun.entries.some((entry) => entry.blockers.includes('post_run_audit_persistence_required'))).toBe(true);
    expect(postRun.entries.every((entry) => entry.rollback.rollbackInvoked === false)).toBe(true);
  });

  it('blocks ledger closure when a committed execution has no rollback token', async () => {
    const service = createPostRunService();
    const controlled = await createControlledSnapshot(createHint(
      'permission',
      'ask_for_explicit_approval_with_scoped_permissions',
    ), {
      adapter: missingRollbackAdapter,
    });

    const postRun = service.buildLedgerSnapshot(controlled, {
      postRunVerificationConfirmed: true,
      verificationPassed: true,
      rollbackLedgerPersisted: true,
      auditPersisted: true,
      postRunReceiptId: 'post-run-1',
      verificationReceiptId: 'verification-1',
      rollbackLedgerId: 'rollback-ledger-1',
      auditReceiptId: 'post-run-audit-1',
    });

    expect(postRun.status).toBe('blocked');
    expect(postRun.entries.some((entry) => entry.blockers.includes('rollback_token_required'))).toBe(true);
    expect(postRun.entries.every((entry) => entry.rollback.rollbackAvailable === false)).toBe(true);
  });

  it('preserves resume post-run ledger entries and renders the next phase', async () => {
    const service = createPostRunService();
    const controlled = await createControlledSnapshot(createHint(
      'ready',
      'resume_original_intent_after_readiness_check',
    ));

    const postRun = service.buildLedgerSnapshot(controlled, {
      postRunVerificationConfirmed: true,
      verificationPassed: true,
      rollbackLedgerPersisted: true,
      auditPersisted: true,
      postRunReceiptId: 'resume-post-run',
      verificationReceiptId: 'resume-verification',
      rollbackLedgerId: 'resume-rollback-ledger',
      auditReceiptId: 'resume-audit',
    });
    const apiResume = postRun.entries.find((entry) =>
      entry.sourceSurface === 'api' &&
      entry.sourceAction?.kind === 'resume_after_check'
    );

    expect(apiResume).toMatchObject({
      status: 'post_run_verified',
      postRunVerified: true,
      sourceExecutionStatus: 'controlled_apply_succeeded',
      sourceSideEffectInvoked: true,
      rollback: {
        rollbackLedgerId: 'resume-rollback-ledger',
        rollbackInvoked: false,
      },
      audit: {
        verificationReceiptId: 'resume-verification',
        auditReceiptId: 'resume-audit',
      },
    });
    expect(service.renderReport(postRun)).toContain('Etapa 77 - Real Apply Post-Run Verification And Rollback Ledger');
    expect(service.renderReport(postRun)).toContain('proximo passo recomendada: 78 - Capability Autopilot v1.1 Beta Readiness Gate');
  });
});
