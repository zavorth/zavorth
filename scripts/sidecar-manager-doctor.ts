#!/usr/bin/env node

import path from 'path';
import { findProjectRoot } from '../src/config/configHelpers.js';
import { MinimalCapabilityRegistry } from '../src/core/MinimalCapabilityRegistry.js';
import { MinimalRuntimeProfileRegistry } from '../src/core/MinimalRuntimeProfileRegistry.js';
import { MinimalSidecarManager } from '../src/core/MinimalSidecarManager.js';

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const apply = argv.includes('--apply');
  const projectRoot = findProjectRoot();
  const dataDir = path.resolve(projectRoot, 'data', 'runtime');
  const profile = argv.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=')
    || process.env.ZAVORTH_RUNTIME_PROFILE
    || process.env.ZAVORTH_PROFILE
    || 'minimal';
  const profileDir = argv.find((arg) => arg.startsWith('--profile-dir='))?.split('=').slice(1).join('=')
    || path.resolve(projectRoot, 'config', 'runtime-profiles');
  const manifestDir = argv.find((arg) => arg.startsWith('--manifest-dir='))?.split('=').slice(1).join('=')
    || path.resolve(projectRoot, 'config', 'capability-manifests');
  const startId = argv.find((arg) => arg.startsWith('--start='))?.split('=').slice(1).join('=');
  const stopId = argv.find((arg) => arg.startsWith('--stop='))?.split('=').slice(1).join('=');

  const profileSnapshot = new MinimalRuntimeProfileRegistry({ profileDir }).load(profile);
  const capabilityRegistry = new MinimalCapabilityRegistry({
    manifestDir,
    profileId: profileSnapshot.selectedProfile.id,
    bootOverrides: profileSnapshot.selectedProfile.capabilityBootOverrides,
  }).load();
  const manager = new MinimalSidecarManager({
    projectRoot,
    dataDir,
    runtimeProfile: profileSnapshot.selectedProfile,
    capabilityRegistry,
  });

  if (startId) {
    const result = await manager.start(startId, { dryRun: !apply });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (stopId) {
    const result = await manager.stop(stopId, { dryRun: !apply });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  const snapshot = await manager.inspectLive();
  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write([
      '[zavorth-core] sidecar manager doctor',
      `[zavorth-core] profile: ${snapshot.profileId} | total ${snapshot.total} | launchable ${snapshot.launchable} | running ${snapshot.running} | ready ${snapshot.ready}`,
      `[zavorth-core] limits: maxActiveSidecars ${snapshot.maxActiveSidecars} | idleTimeout ${snapshot.sidecarIdleTimeoutMs}ms`,
      ...snapshot.sidecars.map((sidecar) =>
        `- ${sidecar.id}: ${sidecar.state} | launchable=${sidecar.launchable} | command=${sidecar.command || 'manual'} | ${sidecar.message}`,
      ),
    ].join('\n') + '\n');
  }
}

main().catch((error) => {
  console.error('[zavorth-core] sidecar manager doctor failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
