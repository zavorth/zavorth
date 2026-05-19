import { ProviderLongTailActivationService } from '../src/services/ProviderLongTailActivationService.js';

type Profile = 'configured' | 'staging-live';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const provider = readArg('--provider');
const profile = (readArg('--profile') || 'configured') as Profile;
const confirmLiveIo = args.includes('--confirm-live-io');
const prompt = readArg('--prompt') || undefined;
const embeddingInput = readArg('--embedding-input') || undefined;
const modelName = readArg('--model') || undefined;
const service = new ProviderLongTailActivationService();
const snapshot = service.buildSnapshot();
const selected = provider
  ? snapshot.entries.filter((entry) => entry.providerId === provider)
  : snapshot.entries;

if (selected.length === 0) {
  console.error(`[provider-long-tail-activation] unknown provider: ${provider}`);
  process.exit(1);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main(): Promise<void> {
  const activationEntries = [];
  for (const entry of selected) {
    const doctor = service.runConfiguredDoctor({ providerId: entry.providerId });
    const liveReceipt = profile === 'staging-live'
      ? await service.runStagingLiveSmoke({
          providerId: entry.providerId,
          confirmLiveIo,
          prompt,
          embeddingInput,
          modelName,
        })
      : null;
    activationEntries.push({
      providerId: entry.providerId,
      status: entry.status,
      readinessStatus: entry.readinessStatus,
      adapterFamily: entry.adapterFamily,
      providerFactoryTarget: entry.providerFactoryTarget,
      doctorCommand: entry.doctorCommand,
      stagingLiveSmokeCommand: entry.stagingLiveSmokeCommand,
      requiredEnv: entry.configSchema.requiredEnv,
      optionalEnv: entry.configSchema.optionalEnv,
      gaps: entry.gaps,
      receipt: entry.receipt,
      doctor,
      liveReceipt,
    });
  }
  const liveReceipts = activationEntries
    .map((entry) => entry.liveReceipt)
    .filter(Boolean);
  const blockedLiveReceipts = liveReceipts.filter((receipt) => receipt?.status !== 'passed');
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
      ? 'staging-live smoke requires --confirm-live-io, provider credentials and runtime base URL before live call.'
      : missingDoctors.length > 0
        ? 'configured doctor found missing provider environment or runtime config.'
        : 'Credential vault exposes long-tail provider routes, adapter families and redacted activation receipts.',
    entries: activationEntries,
  };

  if (asJson) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`[provider-long-tail-activation] profile=${profile} liveIoPerformed=${output.liveIoPerformed}`);
    console.log(`[provider-long-tail-activation] ${output.status}: ${output.reason}`);
    for (const entry of output.entries) {
      console.log(`[provider-long-tail-activation] ${entry.providerId} ${entry.status} family=${entry.adapterFamily} doctor=${entry.doctor.status}`);
      console.log(`  factory: ${entry.providerFactoryTarget}`);
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
