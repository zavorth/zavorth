import os from 'node:os';
import path from 'node:path';
import {
  AsyncMediaJobGenerationLiveAdapter,
  DirectImageGenerationLiveAdapter,
} from '../src/adapters/media/MediaGenerationLiveAdapters.js';
import type { MediaGenerationLiveEntry } from '../src/contracts/MediaGenerationLivePlaneContract.js';
import { MediaGenerationService } from '../src/services/MediaGenerationService.js';
import { MediaGenerationLivePlaneService } from '../src/services/MediaGenerationLivePlaneService.js';

type Profile = 'configured' | 'staging-live';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const target = readArg('--target');
const profile = (readArg('--profile') || 'configured') as Profile;
const confirmLiveIo = args.includes('--confirm-live-io');
const prompt = readArg('--prompt') || 'A clean Zavorth media live smoke artifact.';
const snapshot = new MediaGenerationLivePlaneService().buildSnapshot();
const selected = target
  ? snapshot.entries.filter((entry) => entry.targetId === target)
  : snapshot.entries;

if (selected.length === 0) {
  console.error(`[media-generation-live-plane] unknown target: ${target}`);
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
    liveIoPerformed: liveReceiptByTarget.size > 0,
    confirmLiveIo,
    status: profile === 'staging-live' && !confirmLiveIo ? 'blocked-until-confirmed' : 'ready-for-operator',
    reason: profile === 'staging-live' && !confirmLiveIo
      ? 'staging-live media generation requires --confirm-live-io and real operator credentials.'
      : 'Runtime gateway exposes modality-aware media adapters, artifact storage and redacted receipts.',
    entries: selected.map((entry) => ({
      targetId: entry.targetId,
      status: entry.status,
      modalities: entry.modalities,
      adapterFamily: entry.adapterFamily,
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
    console.log(`[media-generation-live-plane] profile=${profile} liveIoPerformed=${output.liveIoPerformed}`);
    console.log(`[media-generation-live-plane] ${output.status}: ${output.reason}`);
    for (const entry of output.entries) {
      console.log(`[media-generation-live-plane] ${entry.targetId} ${entry.status} modalities=${entry.modalities.join(',')}`);
      console.log(`  doctor: ${entry.doctorCommand}`);
      console.log(`  staging: ${entry.stagingLiveSmokeCommand}`);
      console.log(`  required env: ${entry.requiredEnv.join(', ')}`);
    }
  }
}

async function runLiveSmoke(entry: MediaGenerationLiveEntry): Promise<unknown> {
  const adapter = buildAdapter(entry);
  const service = new MediaGenerationService({
    adapters: [adapter],
    artifactDir: readEnv('MEDIA_ARTIFACT_DIR') || path.join(os.tmpdir(), 'zavorth-media-live-smoke'),
  });
  const modality = entry.modalities.includes('video') ? 'video' : 'image';
  const result = await service.generate({
    prompt,
    modality,
    count: 1,
    providerHints: {
      model: readEnv(`${envPrefix(entry.targetId)}_MODEL`) || entry.defaultModelName,
    },
  });

  return {
    targetId: entry.targetId,
    ok: result.ok,
    artifacts: result.artifacts.map((artifact) => ({
      artifactId: artifact.artifactId,
      modality: artifact.modality,
      contentType: artifact.contentType,
      storageRef: artifact.storageRef,
      sizeBytes: artifact.sizeBytes,
      providerId: artifact.providerEvidence.providerId,
      modelId: artifact.providerEvidence.modelId,
    })),
    error: result.error || null,
    liveIoPerformed: true,
    secretValuesSerialized: false,
  };
}

function buildAdapter(entry: MediaGenerationLiveEntry) {
  if (entry.adapterFamily === 'direct-image') {
    return new DirectImageGenerationLiveAdapter({
      adapterId: entry.targetId,
      providerId: entry.targetId,
      baseUrl: readEnv('MEDIA_IMAGE_BASE_URL', 'AIGateway_BASE_URL', 'ZAVORTH_AIGateway_GATEWAY_BASE_URL') || 'http://127.0.0.1:21128/v1',
      apiKey: readEnv('MEDIA_IMAGE_API_KEY', 'AIGateway_API_KEY', 'OPENAI_API_KEY'),
      modelId: readEnv('MEDIA_IMAGE_MODEL') || entry.defaultModelName,
    });
  }

  const prefix = envPrefix(entry.targetId);
  const submitUrl = requireEnv(entry.targetId, `${prefix}_SUBMIT_URL`);
  return new AsyncMediaJobGenerationLiveAdapter({
    adapterId: entry.targetId,
    providerId: entry.targetId,
    supportedModalities: entry.modalities,
    submitUrl,
    pollUrlTemplate: readEnv(`${prefix}_POLL_URL_TEMPLATE`),
    apiKey: readEnv(`${prefix}_API_KEY`),
    modelId: readEnv(`${prefix}_MODEL`) || entry.defaultModelName,
    pollIntervalMs: Number(readEnv(`${prefix}_POLL_INTERVAL_MS`) || 1500),
    maxPolls: Number(readEnv(`${prefix}_MAX_POLLS`) || 12),
  });
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

function requireEnv(targetId: string, ...names: string[]): string {
  const value = readEnv(...names);
  if (value) return value;
  throw new Error(`[media-generation-live-plane] ${targetId} requires one of: ${names.join(', ')}`);
}

function readEnv(...names: Array<string | null | undefined>): string | null {
  for (const name of names) {
    const normalized = String(name || '').trim();
    if (!normalized) continue;
    const value = String(process.env[normalized] || '').trim();
    if (value) return value;
  }
  return null;
}

function envPrefix(targetId: string): string {
  return targetId.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
