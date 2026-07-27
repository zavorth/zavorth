#!/usr/bin/env node

import { RemoteTransportDoctorService } from '../src/services/RemoteTransportDoctorService.js';

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const service = new RemoteTransportDoctorService();
  const report = await service.run();

  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  console.log('[transports] doctor');
  console.log(`[transports] summary: ${report.summary}`);
  console.log(`[transports] status: ${report.status}`);
  for (const item of report.items) {
    console.log(
      `[transports] ${item.transportId}: ${item.status} | readiness=${item.readiness} | kind=${item.kind} | ${item.summary}`,
    );
    if (item.error) {
      console.log(`[transports] ${item.transportId} error: ${item.error}`);
    }
    if (item.details.length > 0) {
      for (const detail of item.details) {
        console.log(`- ${detail}`);
      }
    }
  }

  if (report.status === 'failed') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[transports] doctor failed: ${error.message || error}`);
  process.exitCode = 1;
});
