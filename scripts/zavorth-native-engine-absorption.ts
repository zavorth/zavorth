import { ZavorthNativeEngineAbsorptionService } from '../src/services/ZavorthNativeEngineAbsorptionService.js';
import type { ZavorthExternalContractLayerStatus } from '../src/contracts/ZavorthExternalContractLayerContract.js';

type CliOptions = {
  json: boolean;
  requirePass: boolean;
  contractLayerStatus: ZavorthExternalContractLayerStatus | null;
};

const CONTRACT_LAYER_STATUSES = new Set<ZavorthExternalContractLayerStatus>([
  'contract-layer-ready',
  'attention',
  'blocked',
]);

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
    requirePass: false,
    contractLayerStatus: null,
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
    if (arg === '--contract-layer-status') {
      const value = String(argv[index + 1] || '').trim();
      if (!CONTRACT_LAYER_STATUSES.has(value as ZavorthExternalContractLayerStatus)) {
        throw new Error(`Invalid --contract-layer-status value: ${value}`);
      }
      options.contractLayerStatus = value as ZavorthExternalContractLayerStatus;
      index += 1;
    }
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const service = new ZavorthNativeEngineAbsorptionService();
  const snapshot = service.buildSnapshot({
    contractLayerStatus: options.contractLayerStatus,
  });

  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.formatSnapshotText(snapshot));
  }

  if (options.requirePass && snapshot.status !== 'native-engine-ready') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[zavorth-native-engine-absorption] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
