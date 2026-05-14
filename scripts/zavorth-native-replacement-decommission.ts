import { ZavorthNativeReplacementDecommissionService } from '../src/services/ZavorthNativeReplacementDecommissionService.js';
import type {
  ZavorthDelegatedWorkerBridgeStatus,
} from '../src/contracts/ZavorthDelegatedWorkerBridgeContract.js';

type CliOptions = {
  json: boolean;
  requirePass: boolean;
  delegatedWorkerStatus: ZavorthDelegatedWorkerBridgeStatus | null;
};

const DELEGATED_WORKER_STATUSES = new Set<ZavorthDelegatedWorkerBridgeStatus>([
  'delegated-worker-bridge-ready',
  'attention',
  'blocked',
]);

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
    requirePass: false,
    delegatedWorkerStatus: null,
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
    if (arg === '--delegated-worker-status') {
      const value = String(argv[index + 1] || '').trim();
      if (!DELEGATED_WORKER_STATUSES.has(value as ZavorthDelegatedWorkerBridgeStatus)) {
        throw new Error(`Invalid --delegated-worker-status value: ${value}`);
      }
      options.delegatedWorkerStatus = value as ZavorthDelegatedWorkerBridgeStatus;
      index += 1;
    }
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const service = new ZavorthNativeReplacementDecommissionService();
  const snapshot = service.buildSnapshot({
    delegatedWorkerStatus: options.delegatedWorkerStatus,
  });

  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.formatSnapshotText(snapshot));
  }

  if (options.requirePass && snapshot.status !== 'native-replacement-decommission-ready') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[zavorth-native-replacement-decommission] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
