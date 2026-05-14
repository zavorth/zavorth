#!/usr/bin/env tsx
import { ZavorthSchedulerPerceptionDeviceLiveCompletionService } from '../src/services/ZavorthSchedulerPerceptionDeviceLiveCompletionService.js';

const args = parseArgs(process.argv.slice(2));

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const service = new ZavorthSchedulerPerceptionDeviceLiveCompletionService();
  const snapshot = await service.buildSnapshot();
  if (args.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.formatSnapshotText(snapshot));
  }
  if (args.requirePass && snapshot.status === 'blocked') {
    process.exitCode = 1;
  }
}

function parseArgs(argv: string[]): { json: boolean; requirePass: boolean } {
  return {
    json: argv.includes('--json'),
    requirePass: argv.includes('--require-pass'),
  };
}
