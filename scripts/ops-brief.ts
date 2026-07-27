#!/usr/bin/env node

import { LogRepository } from '../src/storage/LogRepository.js';
import { OperationsCockpitService } from '../src/services/OperationsCockpitService.js';
import { OperatorBriefService } from '../src/services/OperatorBriefService.js';

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');

  const logRepo = new LogRepository();
  await logRepo.init();

  const cockpit = new OperationsCockpitService(logRepo);
  const briefService = new OperatorBriefService(cockpit);
  const snapshot = briefService.readSnapshot();

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${snapshot.text}\n`);
}

main().catch((error) => {
  console.error(`[ops-brief] failure: ${error.message || error}`);
  process.exitCode = 1;
});
