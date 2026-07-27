#!/usr/bin/env node

import path from 'path';
import { findProjectRoot } from '../src/config/configHelpers.js';
import { MinimalRuntimeProfileRegistry } from '../src/core/MinimalRuntimeProfileRegistry.js';

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const projectRoot = findProjectRoot();
  const profile = argv.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=')
    || process.env.ZAVORTH_RUNTIME_PROFILE
    || process.env.ZAVORTH_PROFILE
    || 'minimal';
  const profileDir = argv.find((arg) => arg.startsWith('--profile-dir='))?.split('=').slice(1).join('=')
    || path.resolve(projectRoot, 'config', 'runtime-profiles');
  const registry = new MinimalRuntimeProfileRegistry({ profileDir });
  const snapshot = registry.load(profile);

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    const selected = snapshot.selectedProfile;
    process.stdout.write([
      '[zavorth-core] runtime profile doctor',
      `[zavorth-core] selected: ${selected.id} | budget: ${selected.budgetProfile} | posture: ${selected.resourcePosture}`,
      `[zavorth-core] polling: ${selected.pollingMode} | maintenance: ${selected.maintenanceMode} | sidecars: ${selected.maxActiveSidecars}`,
      `[zavorth-core] overrides: ${Object.entries(selected.capabilityBootOverrides).map(([id, boot]) => `${id}:${boot}`).join(', ')}`,
      `[zavorth-core] profiles: total ${snapshot.total} | builtin ${snapshot.builtin} | manifest ${snapshot.manifest} | invalid ${snapshot.invalid}`,
    ].join('\n') + '\n');
  }

  process.exitCode = snapshot.invalid > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error('[zavorth-core] runtime profile doctor failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
