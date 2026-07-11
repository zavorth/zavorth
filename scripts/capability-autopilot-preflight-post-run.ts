#!/usr/bin/env node
import { requireAutopilotCapabilityId } from '../src/services/CapabilityAutopilotSelection.js';
import { CapabilityAutopilotPreflightApplyAdapterService } from '../src/services/CapabilityAutopilotPreflightApplyAdapterService.js';
import { CapabilityAutopilotPreflightApplyDryRunExecutorService } from '../src/services/CapabilityAutopilotPreflightApplyDryRunExecutorService.js';
import {
  CapabilityAutopilotPreflightControlledRealApplyExecutorService,
  type CapabilityPreflightControlledRealApplyAdapter,
} from '../src/services/CapabilityAutopilotPreflightControlledRealApplyExecutorService.js';
import { CapabilityAutopilotPreflightDispatchAdapterService } from '../src/services/CapabilityAutopilotPreflightDispatchAdapterService.js';
import { CapabilityAutopilotPreflightDispatchReceiptService } from '../src/services/CapabilityAutopilotPreflightDispatchReceiptService.js';
import { CapabilityAutopilotPreflightEntrypointService } from '../src/services/CapabilityAutopilotPreflightEntrypointService.js';
import { CapabilityAutopilotPreflightPostRunRollbackLedgerService } from '../src/services/CapabilityAutopilotPreflightPostRunRollbackLedgerService.js';
import { CapabilityAutopilotPreflightRealApplyApprovalGateService } from '../src/services/CapabilityAutopilotPreflightRealApplyApprovalGateService.js';
import { CapabilityAutopilotPreflightSideEffectGateService } from '../src/services/CapabilityAutopilotPreflightSideEffectGateService.js';
import type {
  CapabilityAutopilotAudience,
  CapabilityAutopilotSurface,
} from '../src/contracts/CapabilityAutopilotContract.js';

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const requirePass = argv.includes('--require-pass') || argv.includes('--gate');
const explicitlyConfirmed = !argv.includes('--unconfirmed');
const approvalGranted = !argv.includes('--no-approval');
const validationPassed = !argv.includes('--no-validation');
const explicitApplyConfirmed = !argv.includes('--no-apply-confirmation');
const dryRunConfirmed = !argv.includes('--no-dry-run-confirmation');
const finalApprovalGranted = !argv.includes('--no-final-approval');
const budgetApproved = !argv.includes('--no-budget');
const scopeApproved = !argv.includes('--no-scope');
const controlledExecutionConfirmed = !argv.includes('--no-controlled-execution-confirmation');
const budgetLocked = !argv.includes('--no-budget-lock');
const rollbackPlanApproved = !argv.includes('--no-rollback-plan');
const auditSinkReady = !argv.includes('--no-audit-sink');
const adapterEnabled = !argv.includes('--no-adapter');
const postRunVerificationConfirmed = !argv.includes('--no-post-run-confirmation');
const verificationPassed = !argv.includes('--no-post-run-verification');
const rollbackLedgerPersisted = !argv.includes('--no-rollback-ledger');
const auditPersisted = !argv.includes('--no-post-run-audit');
const capabilityId = (() => { try { return requireAutopilotCapabilityId(typeof argv !== 'undefined' ? argv : process.argv.slice(2)); } catch (error) { process.stderr.write('[' + 'capability-autopilot-preflight-post-run' + '] ' + (error instanceof Error ? error.message : String(error)) + '\n'); process.exit(1); return ''; } })();
const audience = (readArg('--audience=') || (asJson ? 'technical_operator' : 'everyday_user')) as CapabilityAutopilotAudience;
const surfaces = readSurfaces('--surfaces=') || ['cli', 'web', 'chat', 'telegram', 'api'];
const expectedSurfaces = readSurfaces('--expected-surfaces=') || surfaces;
const allowedSurfaces = readSurfaces('--allowed-surfaces=') || surfaces;
const budgetLimitUnits = readNumberArg('--budget-limit=', 25);
const estimatedBudgetUnits = readOptionalNumberArg('--estimated-budget=');
const rawIntentProbe = 'STAGE77-RAW-INTENT-MUST-NOT-LEAK';
const rawWorkspaceProbe = 'C:/private/STAGE77-RAW-WORKSPACE-MUST-NOT-LEAK';

const fixtureAdapter: CapabilityPreflightControlledRealApplyAdapter = (decision, context) => ({
  ok: true,
  adapterReceiptId: `checkpoint-77-fixture-${decision.realApplyGateId.slice(-8)}`,
  mode: 'fixture',
  sideEffectInvoked: true,
  executedAgainstRealTarget: false,
  targetFingerprint: `fixture:${decision.sourceSurface}:${decision.sourceAction?.kind || '<none>'}`,
  outputSummary: `Fixture controlled apply committed ${decision.sourceAction?.kind || '<none>'}.`,
  evidence: [
    `budgetLock=${context.budgetLockId || '<none>'}`,
    `rollbackPlan=${context.rollbackPlanId || '<none>'}`,
    `auditReceipt=${context.auditReceiptId || '<none>'}`,
  ],
  rollbackToken: `checkpoint-77-rollback-${decision.sourceSurface}-${decision.sourceAction?.kind || 'none'}`,
  metadata: {
    fixture: true,
  },
});

main().catch((error) => {
  process.stderr.write(`[capability-autopilot-preflight-post-run] falha: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const entrypointService = new CapabilityAutopilotPreflightEntrypointService();
  const sourceSnapshot = await entrypointService.buildSnapshot({
    capabilityId,
    surfaces,
    expectedSurfaces,
    audience,
    rawIntentText: rawIntentProbe,
    workspace: rawWorkspaceProbe,
  });
  const receiptService = new CapabilityAutopilotPreflightDispatchReceiptService();
  const receiptSnapshot = receiptService.buildReceiptSnapshot(sourceSnapshot, {
    explicitlyConfirmed,
    actorId: 'checkpoint-77-gate',
    confirmationId: explicitlyConfirmed ? 'checkpoint-77-explicit-confirmation' : null,
    reason: 'checkpoint-77-post-run-rollback-ledger',
  });
  const adapterService = new CapabilityAutopilotPreflightDispatchAdapterService();
  const adapterSnapshot = adapterService.buildAdapterSnapshot(receiptSnapshot);
  const sideEffectGateService = new CapabilityAutopilotPreflightSideEffectGateService();
  const sideEffectSnapshot = sideEffectGateService.buildGateSnapshot(adapterSnapshot, {
    approvalGranted,
    validationPassed,
    actorId: 'checkpoint-77-gate',
    approvalReceiptId: approvalGranted ? 'checkpoint-77-approval' : null,
    validationReceiptId: validationPassed ? 'checkpoint-77-validation' : null,
    reason: 'checkpoint-77-post-run-rollback-ledger',
  });
  const applyService = new CapabilityAutopilotPreflightApplyAdapterService();
  const applySnapshot = applyService.buildApplySnapshot(sideEffectSnapshot, {
    explicitApplyConfirmed,
    actorId: 'checkpoint-77-gate',
    applyConfirmationId: explicitApplyConfirmed ? 'checkpoint-77-apply-confirmation' : null,
    reason: 'checkpoint-77-post-run-rollback-ledger',
  });
  const dryRunService = new CapabilityAutopilotPreflightApplyDryRunExecutorService();
  const dryRunSnapshot = dryRunService.buildExecutorSnapshot(applySnapshot, {
    dryRunConfirmed,
    actorId: 'checkpoint-77-gate',
    dryRunReceiptId: dryRunConfirmed ? 'checkpoint-77-dry-run-confirmation' : null,
    reason: 'checkpoint-77-post-run-rollback-ledger',
  });
  const realApplyGateService = new CapabilityAutopilotPreflightRealApplyApprovalGateService();
  const approvalSnapshot = realApplyGateService.buildGateSnapshot(dryRunSnapshot, {
    finalApprovalGranted,
    budgetApproved,
    scopeApproved,
    allowedSurfaces,
    budgetLimitUnits,
    estimatedBudgetUnits,
    actorId: 'checkpoint-77-gate',
    finalApprovalReceiptId: finalApprovalGranted ? 'checkpoint-77-final-approval' : null,
    budgetReceiptId: budgetApproved ? 'checkpoint-77-budget' : null,
    scopeReceiptId: scopeApproved ? 'checkpoint-77-scope' : null,
    reason: 'checkpoint-77-post-run-rollback-ledger',
  });
  const controlledApplyService = new CapabilityAutopilotPreflightControlledRealApplyExecutorService({
    adapter: adapterEnabled ? fixtureAdapter : null,
  });
  const controlledSnapshot = await controlledApplyService.buildExecutorSnapshot(approvalSnapshot, {
    controlledExecutionConfirmed,
    budgetLocked,
    rollbackPlanApproved,
    auditSinkReady,
    actorId: 'checkpoint-77-gate',
    executionReceiptId: controlledExecutionConfirmed ? 'checkpoint-77-controlled-execution' : null,
    budgetLockId: budgetLocked ? 'checkpoint-77-budget-lock' : null,
    rollbackPlanId: rollbackPlanApproved ? 'checkpoint-77-rollback-plan' : null,
    auditReceiptId: auditSinkReady ? 'checkpoint-77-audit' : null,
    reason: 'checkpoint-77-post-run-rollback-ledger',
  });
  const postRunService = new CapabilityAutopilotPreflightPostRunRollbackLedgerService();
  const snapshot = postRunService.buildLedgerSnapshot(controlledSnapshot, {
    postRunVerificationConfirmed,
    verificationPassed,
    rollbackLedgerPersisted,
    auditPersisted,
    actorId: 'checkpoint-77-gate',
    postRunReceiptId: postRunVerificationConfirmed ? 'checkpoint-77-post-run' : null,
    verificationReceiptId: postRunVerificationConfirmed ? 'checkpoint-77-verification' : null,
    rollbackLedgerId: rollbackLedgerPersisted ? 'checkpoint-77-rollback-ledger' : null,
    auditReceiptId: auditPersisted ? 'checkpoint-77-post-run-audit' : null,
    reason: 'checkpoint-77-post-run-rollback-ledger',
  });

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(`${postRunService.renderReport(snapshot)}\n`);
  }

  if (requirePass && !snapshot.summary.ok) {
    process.exitCode = 1;
  }
}

function readArg(prefix: string): string | null {
  const found = argv.find((arg) => arg.startsWith(prefix));
  const value = found ? found.slice(prefix.length).trim() : '';
  return value || null;
}

function readNumberArg(prefix: string, fallback: number): number {
  const value = readOptionalNumberArg(prefix);
  return value === undefined ? fallback : value;
}

function readOptionalNumberArg(prefix: string): number | undefined {
  const raw = readArg(prefix);
  if (!raw) {
    return undefined;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

function readSurfaces(prefix: string): CapabilityAutopilotSurface[] | null {
  const inline = readArg(prefix);
  if (!inline) {
    return null;
  }
  const values = inline
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return values.length > 0 ? values as CapabilityAutopilotSurface[] : null;
}
