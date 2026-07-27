#!/usr/bin/env node
import { requireAutopilotCapabilityId } from '../src/services/CapabilityAutopilotSelection.js';
import { CapabilityAutopilotBetaReadinessGateService } from '../src/services/CapabilityAutopilotBetaReadinessGateService.js';
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
const betaChecklistApproved = !argv.includes('--no-beta-checklist');
const releaseNotesReady = !argv.includes('--no-release-notes');
const featureFlagDefaultOff = !argv.includes('--feature-flag-on-by-default');
const rollbackDrillReady = !argv.includes('--no-rollback-drill');
const telemetryOptInReady = !argv.includes('--no-telemetry-opt-in');
const docsUpdated = !argv.includes('--no-docs-update');
const capabilityId = (() => { try { return requireAutopilotCapabilityId(typeof argv !== 'undefined' ? argv : process.argv.slice(2)); } catch (error) { process.stderr.write('[' + 'capability-autopilot-beta-readiness' + '] ' + (error instanceof Error ? error.message : String(error)) + '\n'); process.exit(1); return ''; } })();
const audience = (readArg('--audience=') || (asJson ? 'technical_operator' : 'everyday_user')) as CapabilityAutopilotAudience;
const surfaces = readSurfaces('--surfaces=') || ['cli', 'web', 'chat', 'telegram', 'api'];
const expectedSurfaces = readSurfaces('--expected-surfaces=') || surfaces;
const allowedSurfaces = readSurfaces('--allowed-surfaces=') || surfaces;
const budgetLimitUnits = readNumberArg('--budget-limit=', 25);
const estimatedBudgetUnits = readOptionalNumberArg('--estimated-budget=');
const minVerifiedEntries = readOptionalNumberArg('--min-verified-entries=');
const rawIntentProbe = 'GATE78-RAW-INTENT-MUST-NOT-LEAK';
const rawWorkspaceProbe = 'C:/private/GATE78-RAW-WORKSPACE-MUST-NOT-LEAK';

const fixtureAdapter: CapabilityPreflightControlledRealApplyAdapter = (decision, context) => ({
  ok: true,
  adapterReceiptId: `gate-78-fixture-${decision.realApplyGateId.slice(-8)}`,
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
  rollbackToken: `gate-78-rollback-${decision.sourceSurface}-${decision.sourceAction?.kind || 'none'}`,
  metadata: {
    fixture: true,
  },
});

main().catch((error) => {
  process.stderr.write(`[capability-autopilot-beta-readiness] failure: ${error instanceof Error ? error.message : String(error)}\n`);
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
    actorId: 'gate-78-gate',
    confirmationId: explicitlyConfirmed ? 'gate-78-explicit-confirmation' : null,
    reason: 'gate-78-beta-readiness-gate',
  });
  const adapterService = new CapabilityAutopilotPreflightDispatchAdapterService();
  const adapterSnapshot = adapterService.buildAdapterSnapshot(receiptSnapshot);
  const sideEffectGateService = new CapabilityAutopilotPreflightSideEffectGateService();
  const sideEffectSnapshot = sideEffectGateService.buildGateSnapshot(adapterSnapshot, {
    approvalGranted,
    validationPassed,
    actorId: 'gate-78-gate',
    approvalReceiptId: approvalGranted ? 'gate-78-approval' : null,
    validationReceiptId: validationPassed ? 'gate-78-validation' : null,
    reason: 'gate-78-beta-readiness-gate',
  });
  const applyService = new CapabilityAutopilotPreflightApplyAdapterService();
  const applySnapshot = applyService.buildApplySnapshot(sideEffectSnapshot, {
    explicitApplyConfirmed,
    actorId: 'gate-78-gate',
    applyConfirmationId: explicitApplyConfirmed ? 'gate-78-apply-confirmation' : null,
    reason: 'gate-78-beta-readiness-gate',
  });
  const dryRunService = new CapabilityAutopilotPreflightApplyDryRunExecutorService();
  const dryRunSnapshot = dryRunService.buildExecutorSnapshot(applySnapshot, {
    dryRunConfirmed,
    actorId: 'gate-78-gate',
    dryRunReceiptId: dryRunConfirmed ? 'gate-78-dry-run-confirmation' : null,
    reason: 'gate-78-beta-readiness-gate',
  });
  const realApplyGateService = new CapabilityAutopilotPreflightRealApplyApprovalGateService();
  const approvalSnapshot = realApplyGateService.buildGateSnapshot(dryRunSnapshot, {
    finalApprovalGranted,
    budgetApproved,
    scopeApproved,
    allowedSurfaces,
    budgetLimitUnits,
    estimatedBudgetUnits,
    actorId: 'gate-78-gate',
    finalApprovalReceiptId: finalApprovalGranted ? 'gate-78-final-approval' : null,
    budgetReceiptId: budgetApproved ? 'gate-78-budget' : null,
    scopeReceiptId: scopeApproved ? 'gate-78-scope' : null,
    reason: 'gate-78-beta-readiness-gate',
  });
  const controlledApplyService = new CapabilityAutopilotPreflightControlledRealApplyExecutorService({
    adapter: adapterEnabled ? fixtureAdapter : null,
  });
  const controlledSnapshot = await controlledApplyService.buildExecutorSnapshot(approvalSnapshot, {
    controlledExecutionConfirmed,
    budgetLocked,
    rollbackPlanApproved,
    auditSinkReady,
    actorId: 'gate-78-gate',
    executionReceiptId: controlledExecutionConfirmed ? 'gate-78-controlled-execution' : null,
    budgetLockId: budgetLocked ? 'gate-78-budget-lock' : null,
    rollbackPlanId: rollbackPlanApproved ? 'gate-78-rollback-plan' : null,
    auditReceiptId: auditSinkReady ? 'gate-78-audit' : null,
    reason: 'gate-78-beta-readiness-gate',
  });
  const postRunService = new CapabilityAutopilotPreflightPostRunRollbackLedgerService();
  const postRunSnapshot = postRunService.buildLedgerSnapshot(controlledSnapshot, {
    postRunVerificationConfirmed,
    verificationPassed,
    rollbackLedgerPersisted,
    auditPersisted,
    actorId: 'gate-78-gate',
    postRunReceiptId: postRunVerificationConfirmed ? 'gate-78-post-run' : null,
    verificationReceiptId: postRunVerificationConfirmed ? 'gate-78-verification' : null,
    rollbackLedgerId: rollbackLedgerPersisted ? 'gate-78-rollback-ledger' : null,
    auditReceiptId: auditPersisted ? 'gate-78-post-run-audit' : null,
    reason: 'gate-78-beta-readiness-gate',
  });
  const betaReadinessService = new CapabilityAutopilotBetaReadinessGateService();
  const snapshot = betaReadinessService.buildReadinessSnapshot(postRunSnapshot, {
    betaChecklistApproved,
    releaseNotesReady,
    featureFlagDefaultOff,
    rollbackDrillReady,
    telemetryOptInReady,
    docsUpdated,
    minVerifiedEntries,
    actorId: 'gate-78-gate',
    betaReadinessReceiptId: 'gate-78-beta-readiness',
    releaseChecklistId: betaChecklistApproved ? 'gate-78-release-checklist' : null,
    flagPolicyId: featureFlagDefaultOff ? 'gate-78-flag-policy' : null,
    rollbackDrillReceiptId: rollbackDrillReady ? 'gate-78-rollback-drill' : null,
    telemetryReceiptId: telemetryOptInReady ? 'gate-78-telemetry-opt-in' : null,
    docsReceiptId: docsUpdated ? 'gate-78-docs' : null,
    reason: 'gate-78-beta-readiness-gate',
  });

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(`${betaReadinessService.renderReport(snapshot)}\n`);
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
