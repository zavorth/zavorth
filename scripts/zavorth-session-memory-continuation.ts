import { ZavorthSessionMemoryContinuationService } from '../src/services/ZavorthSessionMemoryContinuationService.js';
import type {
  ZavorthChannelMessagingBridgeStatus,
} from '../src/contracts/ZavorthChannelMessagingBridgeContract.js';

type CliOptions = {
  json: boolean;
  requirePass: boolean;
  channelMessagingStatus: ZavorthChannelMessagingBridgeStatus | null;
};

const CHANNEL_MESSAGING_STATUSES = new Set<ZavorthChannelMessagingBridgeStatus>([
  'channel-messaging-bridge-ready',
  'attention',
  'blocked',
]);

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
    requirePass: false,
    channelMessagingStatus: null,
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
    if (arg === '--channel-messaging-status') {
      const value = String(argv[index + 1] || '').trim();
      if (!CHANNEL_MESSAGING_STATUSES.has(value as ZavorthChannelMessagingBridgeStatus)) {
        throw new Error(`Invalid --channel-messaging-status value: ${value}`);
      }
      options.channelMessagingStatus = value as ZavorthChannelMessagingBridgeStatus;
      index += 1;
    }
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const service = new ZavorthSessionMemoryContinuationService();
  const snapshot = service.buildSnapshot({
    channelMessagingStatus: options.channelMessagingStatus,
  });

  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.formatSnapshotText(snapshot));
  }

  if (options.requirePass && snapshot.status !== 'session-memory-continuation-ready') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[zavorth-session-memory-continuation] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
