#!/usr/bin/env tsx
import {
  ZavorthVisionControlPlaneService,
  type ZavorthVisionControlPlaneCommandInput,
} from '../src/services/ZavorthVisionControlPlaneService.js';
import type {
  ZavorthVisionControlPlaneAction,
  ZavorthVisionTargetKind,
} from '../src/contracts/ZavorthVisionControlPlaneContract.js';

type Args = ZavorthVisionControlPlaneCommandInput & {
  json: boolean;
};

const args = parseArgs(process.argv.slice(2));

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const service = new ZavorthVisionControlPlaneService();
  const snapshot = service.buildSnapshot(args);
  if (args.json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.formatSnapshotText(snapshot));
  }
  if (snapshot.status === 'blocked') {
    process.exitCode = 1;
  }
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    json: false,
    action: 'vision.inspect',
    targetKind: 'unknown',
    targetRef: null,
    sourceSurface: null,
    actorId: null,
    observationText: null,
    ocrText: null,
    artifactPath: null,
    artifactMime: null,
    requestedByNaturalLanguage: false,
    retentionTtlMs: null,
  };
  const textParts: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] || '';
    if (arg === '--json') out.json = true;
    else if (arg === '--natural') out.requestedByNaturalLanguage = true;
    else if (arg === '--action') out.action = normalizeAction(argv[++index]) as ZavorthVisionControlPlaneAction;
    else if (arg.startsWith('--action=')) out.action = normalizeAction(arg.slice('--action='.length)) as ZavorthVisionControlPlaneAction;
    else if (arg === '--target-kind') out.targetKind = normalizeTargetKind(argv[++index]) as ZavorthVisionTargetKind;
    else if (arg.startsWith('--target-kind=')) out.targetKind = normalizeTargetKind(arg.slice('--target-kind='.length)) as ZavorthVisionTargetKind;
    else if (arg === '--target') out.targetRef = argv[++index] || null;
    else if (arg.startsWith('--target=')) out.targetRef = arg.slice('--target='.length);
    else if (arg === '--source-surface' || arg === '--surface') out.sourceSurface = argv[++index] || null;
    else if (arg.startsWith('--source-surface=')) out.sourceSurface = arg.slice('--source-surface='.length);
    else if (arg === '--actor') out.actorId = argv[++index] || null;
    else if (arg.startsWith('--actor=')) out.actorId = arg.slice('--actor='.length);
    else if (arg === '--text') out.observationText = argv[++index] || null;
    else if (arg.startsWith('--text=')) out.observationText = arg.slice('--text='.length);
    else if (arg === '--ocr') out.ocrText = argv[++index] || null;
    else if (arg.startsWith('--ocr=')) out.ocrText = arg.slice('--ocr='.length);
    else if (arg === '--artifact') out.artifactPath = argv[++index] || null;
    else if (arg.startsWith('--artifact=')) out.artifactPath = arg.slice('--artifact='.length);
    else if (arg === '--mime') out.artifactMime = argv[++index] || null;
    else if (arg.startsWith('--mime=')) out.artifactMime = arg.slice('--mime='.length);
    else if (arg === '--retention-ttl-ms') out.retentionTtlMs = parsePositive(argv[++index]);
    else if (arg.startsWith('--retention-ttl-ms=')) out.retentionTtlMs = parsePositive(arg.slice('--retention-ttl-ms='.length));
    else textParts.push(arg);
  }
  if (!out.observationText && textParts.length > 0) {
    out.observationText = textParts.join(' ');
  }
  return out;
}

function normalizeAction(value: unknown): string {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'status') return 'vision.status';
  if (normalized === 'explain') return 'vision.explain';
  if (normalized === 'capture' || normalized === 'screenshot') return 'vision.capture';
  if (normalized === 'ocr') return 'vision.ocr';
  if (normalized === 'redact') return 'vision.redact';
  if (normalized === 'summarize' || normalized === 'summary') return 'vision.summarize';
  return normalized.startsWith('vision.') ? normalized : 'vision.inspect';
}

function normalizeTargetKind(value: unknown): string {
  const normalized = String(value || '').trim().toLowerCase();
  if (['desktop', 'pc', 'computer'].includes(normalized)) return 'desktop';
  if (['browser', 'web', 'site'].includes(normalized)) return 'browser';
  if (['android', 'adb', 'phone', 'celular'].includes(normalized)) return 'android';
  if (['device', 'mobile'].includes(normalized)) return 'device';
  if (['artifact', 'file', 'image'].includes(normalized)) return 'artifact';
  return 'unknown';
}

function parsePositive(value: string | undefined): number | null {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
