import { ZavorthDelegatedWorkerBridgeService } from '../src/services/ZavorthDelegatedWorkerBridgeService.js';
import type {
  ZavorthSessionMemoryContinuationStatus,
} from '../src/contracts/ZavorthSessionMemoryContinuationContract.js';

type CliOptions = {
  json: boolean;
  requirePass: boolean;
  sessionMemoryStatus: ZavorthSessionMemoryContinuationStatus | null;
};

const SESSION_MEMORY_STATUSES = new Set<ZavorthSessionMemoryContinuationStatus>([
  'session-memory-continuation-ready',
  'attention',
  'blocked',
]);

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
    requirePass: false,
    sessionMemoryStatus: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--require-pass' || arg === '--gate') {
      options.requirePass = true;
      continue;
    }
    if (arg === '--session-memory-status') {
      const value = String(argv[index + 1] || '').trim();
      if (!SESSION_MEMORY_STATUSES.has(value as ZavorthSessionMemoryContinuationStatus)) {
        throw new Error(`Invalid --session-memory-status value: ${value}`);
      }
      options.sessionMemoryStatus = value as ZavorthSessionMemoryContinuationStatus;
      index += 1;
    }
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const service = new ZavorthDelegatedWorkerBridgeService();
  const snapshot = service.buildSnapshot({
    sessionMemoryStatus: options.sessionMemoryStatus,
  });

  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.formatSnapshotText(snapshot));
  }

  if (options.requirePass && snapshot.status !== 'delegated-worker-bridge-ready') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[zavorth-delegated-worker-bridge] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
