import os from 'node:os';
import path from 'node:path';
import type { SatelliteDeviceLiveEntry } from '../src/contracts/SatelliteDeviceLivePlaneContract.js';
import { SatelliteDeviceLivePlaneService } from '../src/services/SatelliteDeviceLivePlaneService.js';
import { SatelliteDeviceLiveService } from '../src/services/SatelliteDeviceLiveService.js';

type Profile = 'configured' | 'staging-live';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const target = readArg('--target');
const profile = (readArg('--profile') || 'configured') as Profile;
const confirmLiveIo = args.includes('--confirm-live-io');
const snapshot = new SatelliteDeviceLivePlaneService().buildSnapshot();
const selected = target
  ? snapshot.entries.filter((entry) => entry.targetId === target)
  : snapshot.entries;

if (selected.length === 0) {
  console.error(`[satellite-device-live-plane] unknown target: ${target}`);
  process.exit(1);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main(): Promise<void> {
  const liveReceiptByTarget = new Map<string, unknown>();
  if (profile === 'staging-live' && confirmLiveIo) {
    for (const entry of selected) {
      liveReceiptByTarget.set(entry.targetId, await runLiveSmoke(entry));
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    profile,
    liveIoPerformed: [...liveReceiptByTarget.values()].some(receiptHasLiveIo),
    confirmLiveIo,
    status: profile === 'staging-live' && !confirmLiveIo ? 'blocked-until-confirmed' : 'ready-for-operator',
    reason: profile === 'staging-live' && !confirmLiveIo ? 'staging-live Satellite/device proof requires --confirm-live-io before local device state is touched.'
      : 'Intent model1 exposes governed Satellite/device pairing, heartbeat, invoke, approval and unsupported-native receipts.',
    entries: selected.map((entry) => ({
      targetId: entry.targetId,
      status: entry.status,
      capabilities: entry.capabilities,
      adapterFamily: entry.adapterFamily,
      modes: entry.modes,
      doctorCommand: entry.doctorCommand,
      stagingLiveSmokeCommand: entry.stagingLiveSmokeCommand,
      requiredEnv: entry.configSchema.requiredEnv,
      optionalEnv: entry.configSchema.optionalEnv,
      gaps: entry.gaps,
      receipt: entry.receipt,
      liveReceipt: liveReceiptByTarget.get(entry.targetId) || null,
    })),
  };

  if (asJson) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`[satellite-device-live-plane] profile=${profile} liveIoPerformed=${output.liveIoPerformed}`);
    console.log(`[satellite-device-live-plane] ${output.status}: ${output.reason}`);
    for (const entry of output.entries) {
      console.log(`[satellite-device-live-plane] ${entry.targetId} ${entry.status} capabilities=${entry.capabilities.join(',')}`);
      console.log(`  doctor: ${entry.doctorCommand}`);
      console.log(`  staging: ${entry.stagingLiveSmokeCommand}`);
      console.log(`  required env: ${entry.requiredEnv.join(', ') || 'none'}`);
    }
  }
}

async function runLiveSmoke(entry: SatelliteDeviceLiveEntry): Promise<unknown> {
  const service = new SatelliteDeviceLiveService({
    workspaceRoot: readArg('--workspace-root') || process.cwd(),
    tempRoot: readArg('--state-dir') || readEnv('ZAVORTH_SATELLITE_DEVICE_ARTIFACT_DIR') || path.join(os.tmpdir(), 'zavorth-satellite-device-live-smoke'),
  });
  if (entry.targetId === 'bonjour') {
    return {
      targetId: entry.targetId,
      operation: 'native-wrapper-decision',
      ...service.buildNativeSupportDecision(),
      liveIoPerformed: false,
      secretValuesSerialized: false,
    };
  }
  if (entry.targetId === 'satellite-backend') {
    return {
      targetId: entry.targetId,
      operation: 'offline-queue',
      ...service.runOfflineQueueProof(),
      liveIoPerformed: true,
      secretValuesSerialized: false,
    };
  }
  if (entry.targetId === 'device-pair') {
    return {
      targetId: entry.targetId,
      operation: 'device-pair',
      proof: await service.runBrowserPhoneProof({ includeHaptic: false }),
      doctor: await service.runDeviceDoctorProof(['device.info', 'camera.capture', 'location.read', 'device.confirm']),
      liveIoPerformed: true,
      secretValuesSerialized: false,
    };
  }
  return {
    targetId: entry.targetId,
    operation: 'phone-control',
    proof: await service.runBrowserPhoneProof({ includeHaptic: true }),
    approvalProbe: service.runSensitiveApprovalProbe(),
    nativeDecision: service.buildNativeSupportDecision(),
    liveIoPerformed: true,
    secretValuesSerialized: false,
  };
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

function readEnv(name: string): string | null {
  const value = String(process.env[name] || '').trim();
  return value || null;
}

function receiptHasLiveIo(receipt: unknown): boolean {
  return Boolean(
    receipt
    && typeof receipt === 'object'
    && (receipt as { liveIoPerformed?: unknown }).liveIoPerformed === true,
  );
}
