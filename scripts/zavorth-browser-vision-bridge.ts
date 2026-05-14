#!/usr/bin/env tsx
import { ZavorthBrowserVisionBridgeService } from '../src/services/ZavorthBrowserVisionBridgeService.js';
import type {
  ZavorthBrowserVisionAction,
  ZavorthBrowserVisionInput,
} from '../src/contracts/ZavorthBrowserVisionBridgeContract.js';

type Args = ZavorthBrowserVisionInput & {
  json: boolean;
};

const args = parseArgs(process.argv.slice(2));

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const service = new ZavorthBrowserVisionBridgeService();
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
    action: 'browser.inspect',
    url: null,
    selector: null,
    requestText: null,
    domText: null,
    ariaText: null,
    htmlText: null,
    pdfText: null,
    screenshotText: null,
    planId: null,
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
    else if (arg === '--action') out.action = normalizeAction(argv[++index]) as ZavorthBrowserVisionAction;
    else if (arg.startsWith('--action=')) out.action = normalizeAction(arg.slice('--action='.length)) as ZavorthBrowserVisionAction;
    else if (arg === '--url') out.url = argv[++index] || null;
    else if (arg.startsWith('--url=')) out.url = arg.slice('--url='.length);
    else if (arg === '--selector') out.selector = argv[++index] || null;
    else if (arg.startsWith('--selector=')) out.selector = arg.slice('--selector='.length);
    else if (arg === '--dom') out.domText = argv[++index] || null;
    else if (arg.startsWith('--dom=')) out.domText = arg.slice('--dom='.length);
    else if (arg === '--aria') out.ariaText = argv[++index] || null;
    else if (arg.startsWith('--aria=')) out.ariaText = arg.slice('--aria='.length);
    else if (arg === '--html') out.htmlText = argv[++index] || null;
    else if (arg.startsWith('--html=')) out.htmlText = arg.slice('--html='.length);
    else if (arg === '--pdf') out.pdfText = argv[++index] || null;
    else if (arg.startsWith('--pdf=')) out.pdfText = arg.slice('--pdf='.length);
    else if (arg === '--screenshot-text') out.screenshotText = argv[++index] || null;
    else if (arg.startsWith('--screenshot-text=')) out.screenshotText = arg.slice('--screenshot-text='.length);
    else if (arg === '--plan') out.planId = argv[++index] || null;
    else if (arg.startsWith('--plan=')) out.planId = arg.slice('--plan='.length);
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
  if (!out.requestText && textParts.length > 0) {
    out.requestText = textParts.join(' ');
  }
  return out;
}

function normalizeAction(value: unknown): string {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'status') return 'browser.status';
  if (normalized === 'plan') return 'browser.plan';
  if (normalized === 'apply') return 'browser.apply';
  return normalized.startsWith('browser.') ? normalized : 'browser.inspect';
}

function parsePositive(value: string | undefined): number | null {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
