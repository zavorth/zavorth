#!/usr/bin/env node

import { MinimalRuntimeKernel } from '../src/core/MinimalRuntimeKernel.js';

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const profile = argv.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=')
    || process.env.ZAVORTH_RUNTIME_PROFILE
    || process.env.ZAVORTH_PROFILE
    || 'minimal';
  const kernel = new MinimalRuntimeKernel({ profile, registerSignalHandlers: false });
  const snapshot = await kernel.start();
  await kernel.stop('event-doctor');
  const finalSnapshot = kernel.snapshot();

  if (asJson) {
    process.stdout.write(`${JSON.stringify({
      profile: finalSnapshot.profile,
      eventBus: finalSnapshot.eventBus,
      scheduler: finalSnapshot.scheduler,
    }, null, 2)}\n`);
  } else {
    process.stdout.write([
      '[zavorth-core] runtime event doctor',
      `[zavorth-core] profile: ${finalSnapshot.profile}`,
      `[zavorth-core] events: emitted ${finalSnapshot.eventBus.emittedEvents} | listeners ${finalSnapshot.eventBus.listenerCount} | failed ${finalSnapshot.eventBus.failedDeliveries}`,
      `[zavorth-core] scheduler: tasks ${finalSnapshot.scheduler.taskCount} | event-first ${finalSnapshot.scheduler.eventFirstTasks} | adaptive ${finalSnapshot.scheduler.adaptiveTasks} | active timers ${finalSnapshot.scheduler.activeTimers}`,
      ...finalSnapshot.scheduler.tasks.map((task) =>
        `- ${task.id}: ${task.mode} | enabled=${task.enabled} | active=${task.active} | executions=${task.executions}`,
      ),
    ].join('\n') + '\n');
  }
}

main().catch((error) => {
  console.error('[zavorth-core] runtime event doctor falhou.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
