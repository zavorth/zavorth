#!/usr/bin/env node

import { ZavorthCapabilityCertificationPackService } from '../src/services/ZavorthCapabilityCertificationPackService.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const service = new ZavorthCapabilityCertificationPackService();
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
  console.error('[zavorth-capability-certification] failed');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
