#!/usr/bin/env node

import path from 'path';
import { findProjectRoot } from '../src/config/configHelpers.js';
import { MinimalCapabilityRegistry } from '../src/core/MinimalCapabilityRegistry.js';
import { MinimalRuntimeProfileRegistry } from '../src/core/MinimalRuntimeProfileRegistry.js';

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const projectRoot = findProjectRoot();
  const profile = argv.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=')
    || process.env.ZAVORTH_RUNTIME_PROFILE
    || process.env.ZAVORTH_PROFILE
    || 'minimal';
  const manifestDir = argv.find((arg) => arg.startsWith('--manifest-dir='))?.split('=').slice(1).join('=')
    || path.resolve(projectRoot, 'config', 'capability-manifests');
  const profileDir = argv.find((arg) => arg.startsWith('--profile-dir='))?.split('=').slice(1).join('=')
    || path.resolve(projectRoot, 'config', 'runtime-profiles');
  const profileSnapshot = new MinimalRuntimeProfileRegistry({ profileDir }).load(profile);
  const registry = new MinimalCapabilityRegistry({
    manifestDir,
    profileId: profileSnapshot.selectedProfile.id,
    bootOverrides: profileSnapshot.selectedProfile.capabilityBootOverrides,
  });
  const snapshot = registry.load();

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write([
      '[zavorth-core] capability registry doctor',
      `[zavorth-core] profile: ${profileSnapshot.selectedProfile.id} | budget: ${profileSnapshot.selectedProfile.budgetProfile}`,
      `[zavorth-core] manifests: ${snapshot.manifestDir}`,
      `[zavorth-core] total: ${snapshot.total} | boot: ${snapshot.activeOnBoot} | on-demand: ${snapshot.onDemand} | sidecars: ${snapshot.sidecars} | disabled: ${snapshot.disabled} | invalid: ${snapshot.invalid}`,
      `[zavorth-core] capabilities: ${snapshot.capabilities.map((capability) => `${capability.id}:${capability.boot}`).join(', ')}`,
    ].join('\n') + '\n');
  }

  process.exitCode = snapshot.invalid > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error('[zavorth-core] capability registry doctor failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
