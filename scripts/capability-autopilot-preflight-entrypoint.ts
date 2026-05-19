#!/usr/bin/env node
import {
  CapabilityAutopilotPreflightEntrypointService,
  type CapabilityAutopilotPreflightSnapshot,
} from '../src/services/CapabilityAutopilotPreflightEntrypointService.js';
import type {
  CapabilityAutopilotAudience,
  CapabilityAutopilotSurface,
} from '../src/contracts/CapabilityAutopilotContract.js';

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const requirePass = argv.includes('--require-pass') || argv.includes('--gate');
const capabilityId = readArg('--capability=') || 'executor-gemini-cli';
const audience = (readArg('--audience=') || (asJson ? 'technical_operator' : 'everyday_user')) as CapabilityAutopilotAudience;
const surfaces = readSurfaces('--surfaces=') || ['cli', 'web', 'chat', 'telegram', 'api'];
const expectedSurfaces = readSurfaces('--expected-surfaces=') || surfaces;
const rawIntentProbe = 'STAGE68-RAW-INTENT-MUST-NOT-LEAK';
const rawWorkspaceProbe = 'C:/private/STAGE68-RAW-WORKSPACE-MUST-NOT-LEAK';

main().catch((error) => {
  process.stderr.write(`[capability-autopilot-preflight-entrypoint] falha: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const service = new CapabilityAutopilotPreflightEntrypointService();
  const snapshot = await service.buildSnapshot({
    capabilityId,
    surfaces,
    expectedSurfaces,
    audience,
    rawIntentText: rawIntentProbe,
    workspace: rawWorkspaceProbe,
  });

  writeSnapshot(service, snapshot);

  if (requirePass && !snapshot.summary.ok) {
    process.exitCode = 1;
  }
}

function writeSnapshot(
  service: CapabilityAutopilotPreflightEntrypointService,
  snapshot: CapabilityAutopilotPreflightSnapshot,
): void {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${service.renderReport(snapshot)}\n`);
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
