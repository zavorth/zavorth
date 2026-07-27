#!/usr/bin/env node

import { MinimalRuntimeKernel } from '../src/core/MinimalRuntimeKernel.js';

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const once = argv.includes('--once') || argv.includes('--dry-run') || argv.includes('--snapshot');
  const profile = argv.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=');
  const kernel = new MinimalRuntimeKernel({ profile });
  const snapshot = await kernel.start();

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write([
      '[zavorth-core] minimal runtime kernel',
      `[zavorth-core] status: ${snapshot.status} | profile: ${snapshot.profile}`,
      `[zavorth-core] budget: ${snapshot.budget.ok ? 'ok' : 'violado'} | rss ${snapshot.budget.snapshot.runtime.rssMb}/${snapshot.budget.thresholds.rssMb} MB | heap ${snapshot.budget.snapshot.runtime.heapUsedMb}/${snapshot.budget.thresholds.heapUsedMb} MB`,
      `[zavorth-core] runtime profile: ${snapshot.runtimeProfile.label} | polling ${snapshot.runtimeProfile.pollingMode} | sidecars ${snapshot.runtimeProfile.maxActiveSidecars}`,
      `[zavorth-core] registry: total ${snapshot.capabilityRegistry.total} | boot ${snapshot.capabilityRegistry.activeOnBoot} | on-demand ${snapshot.capabilityRegistry.onDemand} | sidecars ${snapshot.capabilityRegistry.sidecars}`,
      `[zavorth-core] sidecars: total ${snapshot.sidecarManager.total} | launchable ${snapshot.sidecarManager.launchable} | running ${snapshot.sidecarManager.running}`,
      `[zavorth-core] scheduler: tasks ${snapshot.scheduler.taskCount} | event-first ${snapshot.scheduler.eventFirstTasks} | adaptive ${snapshot.scheduler.adaptiveTasks} | active timers ${snapshot.scheduler.activeTimers}`,
      `[zavorth-core] capabilities: ${snapshot.capabilities.map((capability) => capability.id).join(', ')}`,
    ].join('\n') + '\n');
  }

  if (once) {
    await kernel.stop('once');
    process.exitCode = snapshot.budget.ok ? 0 : 1;
    return;
  }

  await kernel.runUntilSignal();
}

main().catch((error) => {
  console.error('[zavorth-core] minimal kernel failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
