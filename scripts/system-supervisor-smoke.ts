#!/usr/bin/env node

import { SystemOverlordSmokeService } from '../src/services/SystemOverlordSmokeService.js';

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const service = new SystemOverlordSmokeService();
  const report = await service.run();

  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = report.status === 'failed' ? 1 : 0;
    return;
  }

  console.log('[system-overlord] smoke');
  console.log(`[system-overlord] summary: ${report.summary}`);
  console.log(`[system-overlord] status: ${report.status}`);
  if (report.probeUrl) {
    console.log(`[system-overlord] probe local: ${report.probeUrl}`);
  }
  for (const item of report.items) {
    console.log(
      `[system-overlord] ${item.capability}: ${item.status} | ${item.summary}`,
    );
    if (item.detail) {
      console.log(`- detalhe: ${item.detail}`);
    }
    if (item.operatorNextStep) {
      console.log(`- next passo: ${item.operatorNextStep}`);
    }
  }

  if (report.status === 'failed') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[system-overlord] smoke failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
