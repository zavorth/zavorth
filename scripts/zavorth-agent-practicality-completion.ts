#!/usr/bin/env node
import { ZavorthAgentPracticalityCompletionService } from '../src/services/ZavorthAgentPracticalityCompletionService.js';

async function main(): Promise<void> {
  const json = process.argv.includes('--json');
  const service = new ZavorthAgentPracticalityCompletionService();
  const snapshot = await service.buildSnapshot();
  if (json) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }
  console.log(service.formatSnapshotText(snapshot));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
