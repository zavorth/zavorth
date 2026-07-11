#!/usr/bin/env node
import { requireAutopilotCapabilityId } from '../src/services/CapabilityAutopilotSelection.js';
import type {
  CapabilityAutopilotAudience,
  CapabilityAutopilotSurface,
} from '../src/contracts/CapabilityAutopilotContract.js';
import { CapabilityAutopilotPreflightEntrypointService } from '../src/services/CapabilityAutopilotPreflightEntrypointService.js';

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const requirePass = argv.includes('--require-pass') || argv.includes('--gate');
const capabilityId = (() => { try { return requireAutopilotCapabilityId(typeof argv !== 'undefined' ? argv : process.argv.slice(2)); } catch (error) { process.stderr.write('[' + 'capability-autopilot-preflight' + '] ' + (error instanceof Error ? error.message : String(error)) + '\n'); process.exit(1); return ''; } })();
const audience = readAudience();
const expectedSurfaces: CapabilityAutopilotSurface[] = ['cli', 'web', 'chat', 'telegram', 'api'];
const surfaces = readSurfaces();
const rawIntentProbe = 'STAGE68-RAW-INTENT-MUST-NOT-LEAK';
const rawWorkspaceProbe = 'C:/private/STAGE68-RAW-WORKSPACE-MUST-NOT-LEAK';

main().catch((error) => {
  process.stderr.write(`[capability-autopilot-preflight] falha: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const entrypoint = new CapabilityAutopilotPreflightEntrypointService();
  const snapshot = await entrypoint.buildSnapshot({
    capabilityId,
    surfaces,
    expectedSurfaces,
    audience,
    rawIntentText: rawIntentProbe,
    workspace: rawWorkspaceProbe,
  });

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(`${entrypoint.renderReport(snapshot)}\n`);
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

function readAudience(): CapabilityAutopilotAudience {
  const value = readArg('--audience=') || (asJson ? 'technical_operator' : 'everyday_user');
  if (value === 'technical_operator' || value === 'system' || value === 'everyday_user') {
    return value;
  }
  return 'everyday_user';
}

function readSurfaces(): CapabilityAutopilotSurface[] {
  const inline = readArg('--surfaces=');
  const values = inline
    ? inline.split(',').map((entry) => entry.trim()).filter(Boolean)
    : expectedSurfaces;
  return values as CapabilityAutopilotSurface[];
}
