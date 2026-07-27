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
const capabilityId = (() => { try { return requireAutopilotCapabilityId(typeof argv !== 'undefined' ? argv : process.argv.slice(2)); } catch (error) { process.stderr.write('[' + 'capability-autopilot-preflight-controlled-apply' + '] ' + (error instanceof Error ? error.message : String(error)) + '\n'); process.exit(1); return ''; } })();
const audience = (readArg('--audience=') || (asJson ? 'technical_operator' : 'everyday_user')) as CapabilityAutopilotAudience;
const surfaces = readSurfaces('--surfaces=') || ['cli', 'web', 'chat', 'telegram', 'api'];
const expectedSurfaces = readSurfaces('--expected-surfaces=') || surfaces;
const allowedSurfaces = readSurfaces('--allowed-surfaces=') || surfaces;
const budgetLimitUnits = readNumberArg('--budget-limit=', 25);
const estimatedBudgetUnits = readOptionalNumberArg('--estimated-budget=');
const rawIntentProbe = 'GATE76-RAW-INTENT-MUST-NOT-LEAK';
const rawWorkspaceProbe = 'C:/private/GATE76-RAW-WORKSPACE-MUST-NOT-LEAK';

const fixtureAdapter: CapabilityPreflightControlledRealApplyAdapter = (decision, context) => ({
  ok: true,
  adapterReceiptId: `gate-76-fixture-${decision.realApplyGateId.slice(-8)}`,
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
  rollbackToken: `gate-76-rollback-${decision.sourceSurface}-${decision.sourceAction?.kind || 'none'}`,
  metadata: {
    fixture: true,
  },
});

main().catch((error) => {
  process.stderr.write(`[capability-autopilot-preflight-controlled-apply] failure: ${error instanceof Error ? error.message : String(error)}\n`);
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
    actorId: 'gate-76-gate',
    confirmationId: explicitlyConfirmed ? 'gate-76-explicit-confirmation' : null,
    reason: 'gate-76-controlled-apply-executor',
  });
  const adapterService = new CapabilityAutopilotPreflightDispatchAdapterService();
  const adapterSnapshot = adapterService.buildAdapterSnapshot(receiptSnapshot);
  const sideEffectGateService = new CapabilityAutopilotPreflightSideEffectGateService();
  const sideEffectSnapshot = sideEffectGateService.buildGateSnapshot(adapterSnapshot, {
    approvalGranted,
    validationPassed,
    actorId: 'gate-76-gate',
    approvalReceiptId: approvalGranted ? 'gate-76-approval' : null,
    validationReceiptId: validationPassed ? 'gate-76-validation' : null,
    reason: 'gate-76-controlled-apply-executor',
  });
  const applyService = new CapabilityAutopilotPreflightApplyAdapterService();
  const applySnapshot = applyService.buildApplySnapshot(sideEffectSnapshot, {
    explicitApplyConfirmed,
    actorId: 'gate-76-gate',
    applyConfirmationId: explicitApplyConfirmed ? 'gate-76-apply-confirmation' : null,
    reason: 'gate-76-controlled-apply-executor',
  });
  const dryRunService = new CapabilityAutopilotPreflightApplyDryRunExecutorService();
  const dryRunSnapshot = dryRunService.buildExecutorSnapshot(applySnapshot, {
    dryRunConfirmed,
    actorId: 'gate-76-gate',
    dryRunReceiptId: dryRunConfirmed ? 'gate-76-dry-run-confirmation' : null,
    reason: 'gate-76-controlled-apply-executor',
  });
  const realApplyGateService = new CapabilityAutopilotPreflightRealApplyApprovalGateService();
  const approvalSnapshot = realApplyGateService.buildGateSnapshot(dryRunSnapshot, {
    finalApprovalGranted,
    budgetApproved,
    scopeApproved,
    allowedSurfaces,
    budgetLimitUnits,
    estimatedBudgetUnits,
    actorId: 'gate-76-gate',
    finalApprovalReceiptId: finalApprovalGranted ? 'gate-76-final-approval' : null,
    budgetReceiptId: budgetApproved ? 'gate-76-budget' : null,
    scopeReceiptId: scopeApproved ? 'gate-76-scope' : null,
    reason: 'gate-76-controlled-apply-executor',
  });
  const controlledApplyService = new CapabilityAutopilotPreflightControlledRealApplyExecutorService({
    adapter: adapterEnabled ? fixtureAdapter : null,
  });
  const snapshot = await controlledApplyService.buildExecutorSnapshot(approvalSnapshot, {
    controlledExecutionConfirmed,
    budgetLocked,
    rollbackPlanApproved,
    auditSinkReady,
    actorId: 'gate-76-gate',
    executionReceiptId: controlledExecutionConfirmed ? 'gate-76-controlled-execution' : null,
    budgetLockId: budgetLocked ? 'gate-76-budget-lock' : null,
    rollbackPlanId: rollbackPlanApproved ? 'gate-76-rollback-plan' : null,
    auditReceiptId: auditSinkReady ? 'gate-76-audit' : null,
    reason: 'gate-76-controlled-apply-executor',
  });

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(`${controlledApplyService.renderReport(snapshot)}\n`);
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
