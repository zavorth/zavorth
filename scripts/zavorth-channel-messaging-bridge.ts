import { ZavorthChannelMessagingBridgeService } from '../src/services/ZavorthChannelMessagingBridgeService.js';
import type {
  ZavorthCapabilityProviderRegistryStatus,
} from '../src/contracts/ZavorthCapabilityProviderRegistryContract.js';

type CliOptions = {
  json: boolean;
  requirePass: boolean;
  capabilityProviderStatus: ZavorthCapabilityProviderRegistryStatus | null;
};

const CAPABILITY_PROVIDER_STATUSES = new Set<ZavorthCapabilityProviderRegistryStatus>([
  'capability-provider-registry-ready',
  'attention',
  'blocked',
]);

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
    requirePass: false,
    capabilityProviderStatus: null,
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
    if (arg === '--capability-provider-status') {
      const value = String(argv[index + 1] || '').trim();
      if (!CAPABILITY_PROVIDER_STATUSES.has(value as ZavorthCapabilityProviderRegistryStatus)) {
        throw new Error(`Invalid --capability-provider-status value: ${value}`);
      }
      options.capabilityProviderStatus = value as ZavorthCapabilityProviderRegistryStatus;
      index += 1;
    }
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const service = new ZavorthChannelMessagingBridgeService();
  const snapshot = service.buildSnapshot({
    capabilityProviderStatus: options.capabilityProviderStatus,
  });

  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.formatSnapshotText(snapshot));
  }

  if (options.requirePass && snapshot.status !== 'channel-messaging-bridge-ready') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[zavorth-channel-messaging-bridge] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
