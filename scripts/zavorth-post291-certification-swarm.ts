import { ZavorthPost291CertificationSwarmService } from '../src/services/ZavorthPost291CertificationSwarmService.js';
import type {
  ZavorthNativeReplacementDecommissionStatus,
} from '../src/contracts/ZavorthNativeReplacementDecommissionContract.js';

type CliOptions = {
  json: boolean;
  requirePass: boolean;
  nativeReplacementStatus: ZavorthNativeReplacementDecommissionStatus | null;
};

const NATIVE_REPLACEMENT_STATUSES = new Set<ZavorthNativeReplacementDecommissionStatus>([
  'native-replacement-decommission-ready',
  'attention',
  'blocked',
]);

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
    requirePass: false,
    nativeReplacementStatus: null,
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
    if (arg === '--native-replacement-status') {
      const value = String(argv[index + 1] || '').trim();
      if (!NATIVE_REPLACEMENT_STATUSES.has(value as ZavorthNativeReplacementDecommissionStatus)) {
        throw new Error(`Invalid --native-replacement-status value: ${value}`);
      }
      options.nativeReplacementStatus = value as ZavorthNativeReplacementDecommissionStatus;
      index += 1;
    }
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const service = new ZavorthPost291CertificationSwarmService();
  const snapshot = service.buildSnapshot({
    nativeReplacementStatus: options.nativeReplacementStatus,
  });

  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.formatSnapshotText(snapshot));
  }

  if (options.requirePass && snapshot.status !== 'certification-swarm-ready') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[zavorth-post291-certification-swarm] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
