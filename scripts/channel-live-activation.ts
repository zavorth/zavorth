import { ChannelLiveActivationService } from '../src/services/ChannelLiveActivationService.js';

type Profile = 'configured' | 'staging-live';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const channel = readArg('--channel');
const profile = (readArg('--profile') || 'configured') as Profile;
const confirmLiveIo = args.includes('--confirm-live-io');
const snapshot = new ChannelLiveActivationService().buildSnapshot();
const selected = channel
  ? snapshot.entries.filter((entry) => entry.channelId === channel)
  : snapshot.entries;

if (selected.length === 0) {
  console.error(`[channel-live-activation] unknown channel: ${channel}`);
  process.exit(1);
}

const output = {
  generatedAt: new Date().toISOString(),
  profile,
  liveIoPerformed: false,
  confirmLiveIo,
  status: profile === 'staging-live' && !confirmLiveIo ? 'blocked-until-confirmed' : 'ready-for-operator',
  reason: profile === 'staging-live' && !confirmLiveIo ? 'staging-live smoke requires --confirm-live-io and real operator credentials.'
    : 'Preview engine exposes the gated command and redacted activation receipts; provider-specific live IO stays opt-in.',
  entries: selected.map((entry) => ({
    channelId: entry.channelId,
    status: entry.status,
    doctorCommand: entry.doctorCommand,
    stagingLiveSmokeCommand: entry.stagingLiveSmokeCommand,
    requiredEnv: entry.configSchema.requiredEnv,
    optionalEnv: entry.configSchema.optionalEnv,
    gaps: entry.gaps,
    receipt: entry.receipt,
  })),
};

if (asJson) {
  console.log(JSON.stringify(output, null, 2));
} else {
  console.log(`[channel-live-activation] profile=${profile} liveIoPerformed=false`);
  console.log(`[channel-live-activation] ${output.status}: ${output.reason}`);
  for (const entry of output.entries) {
    console.log(`[channel-live-activation] ${entry.channelId} ${entry.status}`);
    console.log(`  doctor: ${entry.doctorCommand}`);
    console.log(`  staging: ${entry.stagingLiveSmokeCommand}`);
    console.log(`  required env: ${entry.requiredEnv.join(', ')}`);
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
