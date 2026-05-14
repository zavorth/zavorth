import { ZavorthCapabilityProviderRegistryService } from '../src/services/ZavorthCapabilityProviderRegistryService.js';
import type {
  ZavorthExternalSidecarAdapterStatus,
} from '../src/contracts/ZavorthExternalSidecarAdapterContract.js';

type CliOptions = {
  json: boolean;
  requirePass: boolean;
  sidecarAdapterStatus: ZavorthExternalSidecarAdapterStatus | null;
};

const SIDECAR_ADAPTER_STATUSES = new Set<ZavorthExternalSidecarAdapterStatus>([
  'sidecar-adapter-ready',
  'attention',
  'blocked',
]);

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
    requirePass: false,
    sidecarAdapterStatus: null,
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
    if (arg === '--sidecar-adapter-status') {
      const value = String(argv[index + 1] || '').trim();
      if (!SIDECAR_ADAPTER_STATUSES.has(value as ZavorthExternalSidecarAdapterStatus)) {
        throw new Error(`Invalid --sidecar-adapter-status value: ${value}`);
      }
      options.sidecarAdapterStatus = value as ZavorthExternalSidecarAdapterStatus;
      index += 1;
    }
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const service = new ZavorthCapabilityProviderRegistryService();
  const snapshot = service.buildSnapshot({
    sidecarAdapterStatus: options.sidecarAdapterStatus,
  });

  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.formatSnapshotText(snapshot));
  }

  if (options.requirePass && snapshot.status !== 'capability-provider-registry-ready') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[zavorth-capability-provider-registry] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
