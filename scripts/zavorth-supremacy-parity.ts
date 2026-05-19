#!/usr/bin/env node

import { ZavorthSupremacyParityPackService } from '../src/services/ZavorthSupremacyParityPackService.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const service = new ZavorthSupremacyParityPackService();
  const snapshot = await service.buildSnapshot();
  if (args.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(`${service.renderText(snapshot)}\n`);
  }
  if ((args.includes('--require-pass') || args.includes('--strict')) && snapshot.status === 'blocked') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[zavorth-supremacy-parity] failed');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
