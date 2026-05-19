#!/usr/bin/env node

import { ZavorthSupremacyParityPackService } from '../src/services/ZavorthSupremacyParityPackService.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const snapshot = await new ZavorthSupremacyParityPackService().buildSnapshot();
  if (args.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot.executionBackends, null, 2)}\n`);
    return;
  }
  process.stdout.write([
    'Zavorth Execution Backend Matrix',
    `Backends: ${snapshot.executionBackends.entries.length}`,
    ...snapshot.executionBackends.entries.map((backend) =>
      `- ${backend.status.toUpperCase()} ${backend.label}: isolation=${backend.isolation}, approval=${backend.approvalRequiredForHighRisk}, receipt=${backend.receiptRequired}`),
    '',
  ].join('\n'));
}

main().catch((error) => {
  console.error('[zavorth-execution-backends] failed');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
