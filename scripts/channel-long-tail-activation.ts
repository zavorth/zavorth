import { ChannelLongTailActivationService } from '../src/services/ChannelLongTailActivationService.js';

type Profile = 'configured' | 'staging-live';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const channel = readArg('--channel');
const profile = (readArg('--profile') || 'configured') as Profile;
const confirmLiveIo = args.includes('--confirm-live-io');
const message = readArg('--message') || undefined;
const recipients = readListArg('--recipient').concat(readListArg('--recipients'));
const service = new ChannelLongTailActivationService();
const snapshot = service.buildSnapshot();
const selected = channel
  ? snapshot.entries.filter((entry) => entry.channelId === channel)
  : snapshot.entries;

if (selected.length === 0) {
  console.error(`[channel-long-tail-activation] unknown channel: ${channel}`);
  process.exit(1);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main(): Promise<void> {
  const activationEntries = [];
  for (const entry of selected) {
    const doctor = service.runConfiguredDoctor({ channelId: entry.channelId });
    const liveReceipt = profile === 'staging-live'
      ? await service.runStagingLiveSmoke({
          channelId: entry.channelId,
          confirmLiveIo,
          message,
          recipients,
        })
      : null;
    activationEntries.push({
      channelId: entry.channelId,
      family: entry.family,
      status: entry.status,
      doctorCommand: entry.doctorCommand,
      stagingLiveSmokeCommand: entry.stagingLiveSmokeCommand,
      requiredEnv: entry.configSchema.requiredEnv,
      optionalEnv: entry.configSchema.optionalEnv,
      allowlistEnv: entry.configSchema.allowlistEnv,
      gaps: entry.gaps,
      receipt: entry.receipt,
      doctor,
      liveReceipt,
    });
  }

  const liveReceipts = activationEntries
    .map((entry) => entry.liveReceipt)
    .filter(Boolean);
  const blockedLiveReceipts = liveReceipts.filter((receipt) => receipt?.status !== 'sent');
  const missingDoctors = activationEntries.filter((entry) => !entry.doctor.configured);
  const output = {
    generatedAt: new Date().toISOString(),
    profile,
    liveIoPerformed: liveReceipts.some((receipt) => receipt?.liveIoPerformed === true),
    confirmLiveIo,
    status: profile === 'staging-live' && blockedLiveReceipts.length > 0
      ? 'blocked'
      : missingDoctors.length > 0
        ? 'attention'
        : 'ready-for-operator',
    reason: profile === 'staging-live' && blockedLiveReceipts.length > 0
      ? 'staging-live smoke requires --confirm-live-io, provider config and allowlisted recipients before live send.'
      : missingDoctors.length > 0
        ? 'configured doctor found missing environment, runtime endpoint/script or recipient allowlist.'
        : 'Phase 3 exposes configured doctors, family adapters and redacted live-send receipts.',
    entries: activationEntries,
  };

  if (asJson) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`[channel-long-tail-activation] profile=${profile} liveIoPerformed=${output.liveIoPerformed}`);
    console.log(`[channel-long-tail-activation] ${output.status}: ${output.reason}`);
    for (const entry of output.entries) {
      console.log(`[channel-long-tail-activation] ${entry.channelId} ${entry.status} family=${entry.family} doctor=${entry.doctor.status}`);
      console.log(`  doctor: ${entry.doctorCommand}`);
      console.log(`  staging: ${entry.stagingLiveSmokeCommand}`);
      console.log(`  required env: ${entry.requiredEnv.join(', ')}`);
      if (entry.doctor.missingRequiredEnv.length > 0) {
        console.log(`  missing required: ${entry.doctor.missingRequiredEnv.join(', ')}`);
      }
      if (entry.doctor.missingRuntimeConfig.length > 0) {
        console.log(`  missing runtime: ${entry.doctor.missingRuntimeConfig.join(', ')}`);
      }
      if (entry.liveReceipt) {
        console.log(`  live receipt: ${entry.liveReceipt.status}${entry.liveReceipt.blockedReason ? ` (${entry.liveReceipt.blockedReason})` : ''}`);
      }
    }
  }

  if (profile === 'staging-live' && blockedLiveReceipts.length > 0) {
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

function readListArg(name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith(`${name}=`)) {
      values.push(arg.slice(name.length + 1));
      continue;
    }
    if (arg === name && args[index + 1]) {
      values.push(args[index + 1]);
    }
  }
  return values
    .flatMap((value) => value.split(/[,;\n]/g))
    .map((value) => value.trim())
    .filter(Boolean);
}
