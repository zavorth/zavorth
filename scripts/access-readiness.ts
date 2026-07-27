#!/usr/bin/env node

import { RuntimeAccessReadinessService } from '../src/runtime/access/RuntimeAccessReadinessService.js';

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const service = new RuntimeAccessReadinessService();
  const report = await service.inspectLive();
  const localConsoleUsable =
    report.local.ready
    || (
      report.runtime.telegramWorker.alive
      && (report.runtime.hostSupervisor.alive || report.runtime.zavorthControl?.active === true)
    );

  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  console.log('[zavorth-access] runtime readiness');
  console.log(`[zavorth-access] summary: ${report.summary}`);
  console.log(
    `[zavorth-access] local: ${report.local.ready ? 'ready' : localConsoleUsable ? 'readonly' : 'pending'} | ${report.local.appUrl}`,
  );
  console.log(
    `[zavorth-access] remote: ${report.remote.ready ? 'ready' : 'pending'} | ${report.remote.baseUrl || 'not configured'}`,
  );
  console.log(
    `[zavorth-access] host: ${report.runtime.hostSupervisor.alive || report.runtime.zavorthControl?.active ? 'online' : 'offline'} | worker: ${report.runtime.telegramWorker.alive ? 'online' : 'offline'}`,
  );
  console.log(
    `[zavorth-access] ${
      report.runtime.discordBridge.mode === 'native' ? 'native discord' : 'discord bridge'
    }: ${
      !report.runtime.discordBridge.enabled ? 'disabled'
        : report.runtime.discordBridge.started ? 'ready'
          : 'pending'
    }`,
  );
  console.log(
    `[zavorth-access] web auth: ${report.auth.enabled ? report.auth.source : 'absent'} | host authorized: ${
      report.runtime.hostAuthorized === false ? 'no' : 'yes'
    }`,
  );
  console.log(
    `[zavorth-access] node mesh smoke: ${report.runtime.nodeMeshSmoke.status} | ${
      report.runtime.nodeMeshSmoke.summary
      || report.runtime.nodeMeshSmoke.file
      || report.runtime.nodeMeshSmoke.command
    }`,
  );

  if (report.nextSteps.length > 0) {
    console.log('[zavorth-access] next steps:');
    for (const step of report.nextSteps) {
      console.log(`- ${step.title}: ${step.description}`);
    }
  }

  if (report.recommendations.length > 0) {
    console.log('[zavorth-access] recommendations:');
    for (const recommendation of report.recommendations) {
      console.log(`- ${recommendation}`);
    }
  }
}

main().catch((error) => {
  console.error('[zavorth-access] failed to inspect runtime readiness.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
