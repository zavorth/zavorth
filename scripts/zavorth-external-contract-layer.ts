import { ZavorthExternalContractLayerService } from '../src/services/ZavorthExternalContractLayerService.js';
import type { ZavorthExternalCapabilityInventoryStatus } from '../src/contracts/ZavorthExternalCapabilityInventoryContract.js';

type CliOptions = {
  json: boolean;
  requirePass: boolean;
  inventoryStatus: ZavorthExternalCapabilityInventoryStatus | null;
};

const INVENTORY_STATUSES = new Set<ZavorthExternalCapabilityInventoryStatus>([
  'inventory-ready',
  'attention',
  'blocked',
]);

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
    requirePass: false,
    inventoryStatus: null,
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
    if (arg === '--inventory-status') {
      const value = String(argv[index + 1] || '').trim();
      if (!INVENTORY_STATUSES.has(value as ZavorthExternalCapabilityInventoryStatus)) {
        throw new Error(`Invalid --inventory-status value: ${value}`);
      }
      options.inventoryStatus = value as ZavorthExternalCapabilityInventoryStatus;
      index += 1;
    }
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const service = new ZavorthExternalContractLayerService();
  const snapshot = service.buildSnapshot({
    inventoryStatus: options.inventoryStatus,
  });

  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.formatSnapshotText(snapshot));
  }

  if (options.requirePass && snapshot.status !== 'contract-layer-ready') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[zavorth-external-contract-layer] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
