#!/usr/bin/env node
import { CapabilityAutopilotPreflightApplyAdapterService } from '../src/services/CapabilityAutopilotPreflightApplyAdapterService.js';
import { CapabilityAutopilotPreflightApplyDryRunExecutorService } from '../src/services/CapabilityAutopilotPreflightApplyDryRunExecutorService.js';
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
const capabilityId = readArg('--capability=') || 'executor-gemini-cli';
const audience = (readArg('--audience=') || (asJson ? 'technical_operator' : 'everyday_user')) as CapabilityAutopilotAudience;
const surfaces = readSurfaces('--surfaces=') || ['cli', 'web', 'chat', 'telegram', 'api'];
const expectedSurfaces = readSurfaces('--expected-surfaces=') || surfaces;
const allowedSurfaces = readSurfaces('--allowed-surfaces=') || surfaces;
const budgetLimitUnits = readNumberArg('--budget-limit=', 25);
const estimatedBudgetUnits = readOptionalNumberArg('--estimated-budget=');
const rawIntentProbe = 'STAGE75-RAW-INTENT-MUST-NOT-LEAK';
const rawWorkspaceProbe = 'C:/private/STAGE75-RAW-WORKSPACE-MUST-NOT-LEAK';

main().catch((error) => {
  process.stderr.write(`[capability-autopilot-preflight-real-apply] falha: ${error instanceof Error ? error.message : String(error)}\n`);
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
    actorId: 'checkpoint-75-gate',
    confirmationId: explicitlyConfirmed ? 'checkpoint-75-explicit-confirmation' : null,
    reason: 'checkpoint-75-real-apply-approval-gate',
  });
  const adapterService = new CapabilityAutopilotPreflightDispatchAdapterService();
  const adapterSnapshot = adapterService.buildAdapterSnapshot(receiptSnapshot);
  const sideEffectGateService = new CapabilityAutopilotPreflightSideEffectGateService();
  const sideEffectSnapshot = sideEffectGateService.buildGateSnapshot(adapterSnapshot, {
    approvalGranted,
    validationPassed,
    actorId: 'checkpoint-75-gate',
    approvalReceiptId: approvalGranted ? 'checkpoint-75-approval' : null,
    validationReceiptId: validationPassed ? 'checkpoint-75-validation' : null,
    reason: 'checkpoint-75-real-apply-approval-gate',
  });
  const applyService = new CapabilityAutopilotPreflightApplyAdapterService();
  const applySnapshot = applyService.buildApplySnapshot(sideEffectSnapshot, {
    explicitApplyConfirmed,
    actorId: 'checkpoint-75-gate',
    applyConfirmationId: explicitApplyConfirmed ? 'checkpoint-75-apply-confirmation' : null,
    reason: 'checkpoint-75-real-apply-approval-gate',
  });
  const dryRunService = new CapabilityAutopilotPreflightApplyDryRunExecutorService();
  const dryRunSnapshot = dryRunService.buildExecutorSnapshot(applySnapshot, {
    dryRunConfirmed,
    actorId: 'checkpoint-75-gate',
    dryRunReceiptId: dryRunConfirmed ? 'checkpoint-75-dry-run-confirmation' : null,
    reason: 'checkpoint-75-real-apply-approval-gate',
  });
  const realApplyGateService = new CapabilityAutopilotPreflightRealApplyApprovalGateService();
  const snapshot = realApplyGateService.buildGateSnapshot(dryRunSnapshot, {
    finalApprovalGranted,
    budgetApproved,
    scopeApproved,
    allowedSurfaces,
    budgetLimitUnits,
    estimatedBudgetUnits,
    actorId: 'checkpoint-75-gate',
    finalApprovalReceiptId: finalApprovalGranted ? 'checkpoint-75-final-approval' : null,
    budgetReceiptId: budgetApproved ? 'checkpoint-75-budget' : null,
    scopeReceiptId: scopeApproved ? 'checkpoint-75-scope' : null,
    reason: 'checkpoint-75-real-apply-approval-gate',
  });

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(`${realApplyGateService.renderReport(snapshot)}\n`);
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
