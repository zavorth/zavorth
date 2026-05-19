#!/usr/bin/env node
import { CapabilityAutopilotPreflightApplyAdapterService } from '../src/services/CapabilityAutopilotPreflightApplyAdapterService.js';
import { CapabilityAutopilotPreflightDispatchAdapterService } from '../src/services/CapabilityAutopilotPreflightDispatchAdapterService.js';
import { CapabilityAutopilotPreflightDispatchReceiptService } from '../src/services/CapabilityAutopilotPreflightDispatchReceiptService.js';
import { CapabilityAutopilotPreflightEntrypointService } from '../src/services/CapabilityAutopilotPreflightEntrypointService.js';
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
const capabilityId = readArg('--capability=') || 'executor-gemini-cli';
const audience = (readArg('--audience=') || (asJson ? 'technical_operator' : 'everyday_user')) as CapabilityAutopilotAudience;
const surfaces = readSurfaces('--surfaces=') || ['cli', 'web', 'chat', 'telegram', 'api'];
const expectedSurfaces = readSurfaces('--expected-surfaces=') || surfaces;
const rawIntentProbe = 'STAGE73-RAW-INTENT-MUST-NOT-LEAK';
const rawWorkspaceProbe = 'C:/private/STAGE73-RAW-WORKSPACE-MUST-NOT-LEAK';

main().catch((error) => {
  process.stderr.write(`[capability-autopilot-preflight-apply] falha: ${error instanceof Error ? error.message : String(error)}\n`);
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
    actorId: 'checkpoint-73-gate',
    confirmationId: explicitlyConfirmed ? 'checkpoint-73-explicit-confirmation' : null,
    reason: 'checkpoint-73-apply-adapter-gate',
  });
  const adapterService = new CapabilityAutopilotPreflightDispatchAdapterService();
  const adapterSnapshot = adapterService.buildAdapterSnapshot(receiptSnapshot);
  const sideEffectGateService = new CapabilityAutopilotPreflightSideEffectGateService();
  const sideEffectSnapshot = sideEffectGateService.buildGateSnapshot(adapterSnapshot, {
    approvalGranted,
    validationPassed,
    actorId: 'checkpoint-73-gate',
    approvalReceiptId: approvalGranted ? 'checkpoint-73-approval' : null,
    validationReceiptId: validationPassed ? 'checkpoint-73-validation' : null,
    reason: 'checkpoint-73-apply-adapter-gate',
  });
  const applyService = new CapabilityAutopilotPreflightApplyAdapterService();
  const snapshot = applyService.buildApplySnapshot(sideEffectSnapshot, {
    explicitApplyConfirmed,
    actorId: 'checkpoint-73-gate',
    applyConfirmationId: explicitApplyConfirmed ? 'checkpoint-73-apply-confirmation' : null,
    reason: 'checkpoint-73-apply-adapter-gate',
  });

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(`${applyService.renderReport(snapshot)}\n`);
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
