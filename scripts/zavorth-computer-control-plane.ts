#!/usr/bin/env tsx
import { ZavorthComputerControlPlaneService } from '../src/services/ZavorthComputerControlPlaneService.js';
import type {
  ZavorthComputerControlAction,
  ZavorthComputerControlInput,
  ZavorthComputerTargetKind,
} from '../src/contracts/ZavorthComputerControlPlaneContract.js';

type Args = ZavorthComputerControlInput & {
  json: boolean;
};

const args = parseArgs(process.argv.slice(2));

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const service = new ZavorthComputerControlPlaneService();
  const snapshot = await service.execute(args);
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
    action: 'computer.status',
    targetWindow: null,
    targetKind: 'desktop-window',
    objective: null,
    screenText: null,
    targetText: null,
    payload: null,
    planId: null,
    approvalId: null,
    runId: null,
    sourceSurface: null,
    actorId: null,
    live: false,
    strictApproval: null,
    maxIterations: null,
    maxScreenshots: null,
    maxDurationMs: null,
    idleTtlMs: null,
  };
  const textParts: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] || '';
    if (arg === '--json') out.json = true;
    else if (arg === '--live') out.live = true;
    else if (arg === '--strict') out.strictApproval = true;
    else if (arg === '--no-strict') out.strictApproval = false;
    else if (arg === '--action') out.action = normalizeAction(argv[++index]) as ZavorthComputerControlAction;
    else if (arg.startsWith('--action=')) out.action = normalizeAction(arg.slice('--action='.length)) as ZavorthComputerControlAction;
    else if (arg === '--window' || arg === '--target-window') out.targetWindow = argv[++index] || null;
    else if (arg.startsWith('--window=')) out.targetWindow = arg.slice('--window='.length);
    else if (arg.startsWith('--target-window=')) out.targetWindow = arg.slice('--target-window='.length);
    else if (arg === '--target-kind') out.targetKind = normalizeTargetKind(argv[++index]) as ZavorthComputerTargetKind;
    else if (arg.startsWith('--target-kind=')) out.targetKind = normalizeTargetKind(arg.slice('--target-kind='.length)) as ZavorthComputerTargetKind;
    else if (arg === '--screen') out.screenText = argv[++index] || null;
    else if (arg.startsWith('--screen=')) out.screenText = arg.slice('--screen='.length);
    else if (arg === '--target-text') out.targetText = argv[++index] || null;
    else if (arg.startsWith('--target-text=')) out.targetText = arg.slice('--target-text='.length);
    else if (arg === '--payload') out.payload = argv[++index] || null;
    else if (arg.startsWith('--payload=')) out.payload = arg.slice('--payload='.length);
    else if (arg === '--plan') out.planId = argv[++index] || null;
    else if (arg.startsWith('--plan=')) out.planId = arg.slice('--plan='.length);
    else if (arg === '--approval-id') out.approvalId = argv[++index] || null;
    else if (arg.startsWith('--approval-id=')) out.approvalId = arg.slice('--approval-id='.length);
    else if (arg === '--run') out.runId = argv[++index] || null;
    else if (arg.startsWith('--run=')) out.runId = arg.slice('--run='.length);
    else if (arg === '--surface') out.sourceSurface = argv[++index] || null;
    else if (arg.startsWith('--surface=')) out.sourceSurface = arg.slice('--surface='.length);
    else if (arg === '--actor') out.actorId = argv[++index] || null;
    else if (arg.startsWith('--actor=')) out.actorId = arg.slice('--actor='.length);
    else if (arg === '--max-iterations') out.maxIterations = parsePositive(argv[++index]);
    else if (arg.startsWith('--max-iterations=')) out.maxIterations = parsePositive(arg.slice('--max-iterations='.length));
    else if (arg === '--max-screenshots') out.maxScreenshots = parsePositive(argv[++index]);
    else if (arg.startsWith('--max-screenshots=')) out.maxScreenshots = parsePositive(arg.slice('--max-screenshots='.length));
    else if (arg === '--max-duration-ms') out.maxDurationMs = parsePositive(argv[++index]);
    else if (arg.startsWith('--max-duration-ms=')) out.maxDurationMs = parsePositive(arg.slice('--max-duration-ms='.length));
    else if (arg === '--idle-ttl-ms') out.idleTtlMs = parsePositive(argv[++index]);
    else if (arg.startsWith('--idle-ttl-ms=')) out.idleTtlMs = parsePositive(arg.slice('--idle-ttl-ms='.length));
    else textParts.push(arg);
  }
  if (!out.objective && textParts.length > 0) {
    out.objective = textParts.join(' ');
  }
  return out;
}

function normalizeAction(value: unknown): string {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'observe') return 'computer.observe';
  if (normalized === 'plan') return 'computer.plan';
  if (normalized === 'approve') return 'computer.approve';
  if (normalized === 'cancel' || normalized === 'stop') return 'computer.cancel';
  return normalized.startsWith('computer.') ? normalized : 'computer.status';
}

function normalizeTargetKind(value: unknown): string {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'browser' || normalized === 'browser-tab') return 'browser-tab';
  if (normalized === 'app' || normalized === 'local-app') return 'local-app';
  if (normalized === 'desktop' || normalized === 'window' || normalized === 'desktop-window') return 'desktop-window';
  return 'unknown';
}

function parsePositive(value: string | undefined): number | null {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
