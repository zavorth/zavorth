#!/usr/bin/env node
import { requireAutopilotCapabilityId } from '../src/services/CapabilityAutopilotSelection.js';
import { CapabilityAutopilotPreflightDispatchReceiptService } from '../src/services/CapabilityAutopilotPreflightDispatchReceiptService.js';
import { CapabilityAutopilotPreflightEntrypointService } from '../src/services/CapabilityAutopilotPreflightEntrypointService.js';
import type {
  CapabilityAutopilotAudience,
  CapabilityAutopilotSurface,
} from '../src/contracts/CapabilityAutopilotContract.js';

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const requirePass = argv.includes('--require-pass') || argv.includes('--gate');
const explicitlyConfirmed = !argv.includes('--unconfirmed');
const capabilityId = (() => { try { return requireAutopilotCapabilityId(typeof argv !== 'undefined' ? argv : process.argv.slice(2)); } catch (error) { process.stderr.write('[' + 'capability-autopilot-preflight-dispatch' + '] ' + (error instanceof Error ? error.message : String(error)) + '\n'); process.exit(1); return ''; } })();
const audience = (readArg('--audience=') || (asJson ? 'technical_operator' : 'everyday_user')) as CapabilityAutopilotAudience;
const surfaces = readSurfaces('--surfaces=') || ['cli', 'web', 'chat', 'telegram', 'api'];
const expectedSurfaces = readSurfaces('--expected-surfaces=') || surfaces;
const rawIntentProbe = 'GATE70-RAW-INTENT-MUST-NOT-LEAK';
const rawWorkspaceProbe = 'C:/private/GATE70-RAW-WORKSPACE-MUST-NOT-LEAK';

main().catch((error) => {
  process.stderr.write(`[capability-autopilot-preflight-dispatch] failure: ${error instanceof Error ? error.message : String(error)}\n`);
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
  const snapshot = receiptService.buildReceiptSnapshot(sourceSnapshot, {
    explicitlyConfirmed,
    actorId: 'gate-70-gate',
    confirmationId: explicitlyConfirmed ? 'gate-70-explicit-confirmation' : null,
    reason: 'gate-70-dispatch-receipt-gate',
  });

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(`${receiptService.renderReport(snapshot)}\n`);
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
