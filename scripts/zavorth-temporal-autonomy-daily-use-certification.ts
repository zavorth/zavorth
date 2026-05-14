#!/usr/bin/env tsx
import { ZavorthTemporalAutonomyDailyUseCertificationService } from '../src/services/ZavorthTemporalAutonomyDailyUseCertificationService.js';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const service = new ZavorthTemporalAutonomyDailyUseCertificationService({
    now: () => new Date(args.now || new Date().toISOString()),
  });
  const snapshot = await service.buildSnapshot({
    now: args.now || null,
    taskId: args.taskId || null,
  });
  if (args.json) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }
  console.log(service.renderReport(snapshot));
}

function parseArgs(argv: string[]) {
  const args = {
    json: false,
    now: '',
    taskId: '',
  };
  for (const arg of argv) {
    if (arg === '--json') args.json = true;
    else if (arg.startsWith('--now=')) args.now = arg.slice('--now='.length);
    else if (arg.startsWith('--task=')) args.taskId = arg.slice('--task='.length);
  }
  return args;
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
