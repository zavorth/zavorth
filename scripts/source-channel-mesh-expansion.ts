import { SourceChannelMeshExpansionService } from '../src/services/SourceChannelMeshExpansionService.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const requirePass = args.includes('--require-pass');
const confirmLiveIo = args.includes('--confirm-live-io');
const sourceRoot = readArg('--source-root');
const zavorthRoot = readArg('--zavorth-root');
const channel = readArg('--channel');

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const service = new SourceChannelMeshExpansionService();
  const snapshot = service.buildSnapshot({
    sourceRoot,
    zavorthRoot,
  });

  if (channel && confirmLiveIo) {
    const liveSmokeReceipt = channel === 'slack'
      ? await service.runSlackLiveSmoke({
          channelId: readArg('--slack-channel') || process.env.SLACK_LIVE_SMOKE_CHANNEL_ID || '',
          text: readArg('--message') || undefined,
          confirmLiveIo,
        })
      : {
          id: `channel-live-smoke-${channel}`,
          channelId: channel,
          action: 'send',
          status: 'blocked',
          messageId: null,
          threadId: null,
          liveIoPerformed: false,
          secretValuesSerialized: false,
          reason: 'Phase 4 live smoke command currently supports Slack only; other channels use their existing channel-live-activation commands.',
        };
    if (asJson) {
      console.log(JSON.stringify({
        ...snapshot,
        liveSmokeReceipt,
      }, null, 2));
    } else {
      console.log(service.formatSnapshotText(snapshot));
      console.log('Live smoke receipt:');
      console.log(JSON.stringify(liveSmokeReceipt, null, 2));
    }
  } else {
    if (asJson) {
      console.log(JSON.stringify(snapshot, null, 2));
    } else {
      console.log(service.formatSnapshotText(snapshot));
      if (channel && !confirmLiveIo) {
        console.log(`Live smoke for ${channel} was not run. Pass --confirm-live-io explicitly.`);
      }
    }
  }

  if (requirePass && snapshot.status !== 'passed') {
    process.exitCode = 1;
  }
}

function readArg(name: string): string | null {
  const direct = args.find((arg) => arg.startsWith(`${name}=`));
  if (direct) {
    return direct.slice(name.length + 1);
  }
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) {
    return args[index + 1];
  }
  return null;
}
