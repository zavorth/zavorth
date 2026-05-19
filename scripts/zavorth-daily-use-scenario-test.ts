#!/usr/bin/env node

import { ZavorthDailyUseScenarioTestService } from '../src/services/ZavorthDailyUseScenarioTestService.js';

const args = process.argv.slice(2);
const service = new ZavorthDailyUseScenarioTestService();
main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const snapshot = await service.buildSnapshot();

  if (args.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  if ((args.includes('--require-pass') || args.includes('--strict')) && snapshot.status === 'failed') {
    process.exitCode = 1;
  }
}
