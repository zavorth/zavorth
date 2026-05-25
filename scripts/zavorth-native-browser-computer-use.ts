#!/usr/bin/env tsx
import { ZavorthNativeBrowserComputerUseService } from '../src/services/ZavorthNativeBrowserComputerUseService.js';
import type {
  ZavorthNativeBrowserComputerUseAction,
  ZavorthNativeBrowserComputerUseInput,
} from '../src/contracts/ZavorthNativeBrowserComputerUseContract.js';

type Args = ZavorthNativeBrowserComputerUseInput & {
  json: boolean;
};

const args = parseArgs(process.argv.slice(2));

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const service = new ZavorthNativeBrowserComputerUseService();
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
    action: 'native.status',
    url: null,
    selector: null,
    text: null,
    objective: null,
    targetWindow: null,
    targetKind: 'unknown',
    approvalId: null,
    sourceSurface: null,
    actorId: null,
    live: false,
    allowPrivateEgress: false,
    timeoutMs: null,
  };
  const textParts: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] || '';
    if (arg === '--json') out.json = true;
    else if (arg === '--live') out.live = true;
    else if (arg === '--allow-private-egress') out.allowPrivateEgress = true;
    else if (arg === '--action') out.action = normalizeAction(argv[++index]) as ZavorthNativeBrowserComputerUseAction;
    else if (arg.startsWith('--action=')) out.action = normalizeAction(arg.slice('--action='.length)) as ZavorthNativeBrowserComputerUseAction;
    else if (arg === '--url') out.url = argv[++index] || null;
    else if (arg.startsWith('--url=')) out.url = arg.slice('--url='.length);
    else if (arg === '--selector') out.selector = argv[++index] || null;
    else if (arg.startsWith('--selector=')) out.selector = arg.slice('--selector='.length);
    else if (arg === '--text') out.text = argv[++index] || null;
    else if (arg.startsWith('--text=')) out.text = arg.slice('--text='.length);
    else if (arg === '--objective') out.objective = argv[++index] || null;
    else if (arg.startsWith('--objective=')) out.objective = arg.slice('--objective='.length);
    else if (arg === '--window') out.targetWindow = argv[++index] || null;
    else if (arg.startsWith('--window=')) out.targetWindow = arg.slice('--window='.length);
    else if (arg === '--target-kind') out.targetKind = normalizeTargetKind(argv[++index]);
    else if (arg.startsWith('--target-kind=')) out.targetKind = normalizeTargetKind(arg.slice('--target-kind='.length));
    else if (arg === '--approval-id') out.approvalId = argv[++index] || null;
    else if (arg.startsWith('--approval-id=')) out.approvalId = arg.slice('--approval-id='.length);
    else if (arg === '--surface') out.sourceSurface = argv[++index] || null;
    else if (arg.startsWith('--surface=')) out.sourceSurface = arg.slice('--surface='.length);
    else if (arg === '--actor') out.actorId = argv[++index] || null;
    else if (arg.startsWith('--actor=')) out.actorId = arg.slice('--actor='.length);
    else if (arg === '--timeout-ms') out.timeoutMs = parsePositive(argv[++index]);
    else if (arg.startsWith('--timeout-ms=')) out.timeoutMs = parsePositive(arg.slice('--timeout-ms='.length));
    else textParts.push(arg);
  }
  if (!out.objective && textParts.length > 0) {
    out.objective = textParts.join(' ');
  }
  return out;
}

function normalizeAction(value: unknown): string {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'status') return 'native.status';
  if (normalized === 'cdp') return 'browser.cdp.status';
  if (normalized === 'navigate') return 'browser.navigate';
  if (normalized === 'screenshot') return 'browser.screenshot';
  if (normalized === 'click') return 'browser.click';
  if (normalized === 'type') return 'browser.type';
  if (normalized === 'extract') return 'browser.extract';
  if (normalized === 'observe') return 'computer.observe';
  if (normalized === 'plan') return 'computer.plan';
  if (normalized === 'cancel') return 'computer.cancel';
  return normalized.includes('.') ? normalized : 'native.status';
}

function normalizeTargetKind(value: unknown): Args['targetKind'] {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'desktop' || normalized === 'desktop-window') return 'desktop-window';
  if (normalized === 'browser' || normalized === 'browser-tab') return 'browser-tab';
  if (normalized === 'app' || normalized === 'local-app') return 'local-app';
  return 'unknown';
}

function parsePositive(value: string | undefined): number | null {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
