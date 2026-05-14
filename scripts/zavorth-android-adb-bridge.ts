#!/usr/bin/env tsx
import { ZavorthAndroidAdbBridgeService } from '../src/services/ZavorthAndroidAdbBridgeService.js';
import type {
  ZavorthAndroidAdbAction,
  ZavorthAndroidAdbInput,
} from '../src/contracts/ZavorthAndroidAdbBridgeContract.js';

type Args = ZavorthAndroidAdbInput & {
  json: boolean;
};

const args = parseArgs(process.argv.slice(2));

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const service = new ZavorthAndroidAdbBridgeService();
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
    action: 'device.status',
    deviceSerial: null,
    objective: null,
    packageName: null,
    activityName: null,
    screenText: null,
    uiXml: null,
    logcatText: null,
    targetText: null,
    payload: null,
    planId: null,
    approvalId: null,
    runId: null,
    sourceSurface: null,
    actorId: null,
    live: false,
    maxLogLines: null,
    artifactRoot: null,
  };
  const textParts: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] || '';
    if (arg === '--json') out.json = true;
    else if (arg === '--live') out.live = true;
    else if (arg === '--action') out.action = normalizeAction(argv[++index]) as ZavorthAndroidAdbAction;
    else if (arg.startsWith('--action=')) out.action = normalizeAction(arg.slice('--action='.length)) as ZavorthAndroidAdbAction;
    else if (arg === '--device' || arg === '--serial') out.deviceSerial = argv[++index] || null;
    else if (arg.startsWith('--device=')) out.deviceSerial = arg.slice('--device='.length) || null;
    else if (arg.startsWith('--serial=')) out.deviceSerial = arg.slice('--serial='.length) || null;
    else if (arg === '--package') out.packageName = argv[++index] || null;
    else if (arg.startsWith('--package=')) out.packageName = arg.slice('--package='.length) || null;
    else if (arg === '--activity') out.activityName = argv[++index] || null;
    else if (arg.startsWith('--activity=')) out.activityName = arg.slice('--activity='.length) || null;
    else if (arg === '--screen') out.screenText = argv[++index] || null;
    else if (arg.startsWith('--screen=')) out.screenText = arg.slice('--screen='.length) || null;
    else if (arg === '--ui-xml' || arg === '--xml') out.uiXml = argv[++index] || null;
    else if (arg.startsWith('--ui-xml=')) out.uiXml = arg.slice('--ui-xml='.length) || null;
    else if (arg.startsWith('--xml=')) out.uiXml = arg.slice('--xml='.length) || null;
    else if (arg === '--logcat') out.logcatText = argv[++index] || null;
    else if (arg.startsWith('--logcat=')) out.logcatText = arg.slice('--logcat='.length) || null;
    else if (arg === '--target-text') out.targetText = argv[++index] || null;
    else if (arg.startsWith('--target-text=')) out.targetText = arg.slice('--target-text='.length) || null;
    else if (arg === '--payload') out.payload = argv[++index] || null;
    else if (arg.startsWith('--payload=')) out.payload = arg.slice('--payload='.length) || null;
    else if (arg === '--plan') out.planId = argv[++index] || null;
    else if (arg.startsWith('--plan=')) out.planId = arg.slice('--plan='.length) || null;
    else if (arg === '--approval-id') out.approvalId = argv[++index] || null;
    else if (arg.startsWith('--approval-id=')) out.approvalId = arg.slice('--approval-id='.length) || null;
    else if (arg === '--run') out.runId = argv[++index] || null;
    else if (arg.startsWith('--run=')) out.runId = arg.slice('--run='.length) || null;
    else if (arg === '--surface') out.sourceSurface = argv[++index] || null;
    else if (arg.startsWith('--surface=')) out.sourceSurface = arg.slice('--surface='.length) || null;
    else if (arg === '--actor') out.actorId = argv[++index] || null;
    else if (arg.startsWith('--actor=')) out.actorId = arg.slice('--actor='.length) || null;
    else if (arg === '--max-log-lines') out.maxLogLines = parsePositive(argv[++index]);
    else if (arg.startsWith('--max-log-lines=')) out.maxLogLines = parsePositive(arg.slice('--max-log-lines='.length));
    else if (arg === '--artifact-root') out.artifactRoot = argv[++index] || null;
    else if (arg.startsWith('--artifact-root=')) out.artifactRoot = arg.slice('--artifact-root='.length) || null;
    else textParts.push(arg);
  }
  if (!out.objective && textParts.length > 0) {
    out.objective = textParts.join(' ');
  }
  return out;
}

function normalizeAction(value: unknown): string {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'list' || normalized === 'devices') return 'device.list';
  if (normalized === 'doctor') return 'device.doctor';
  if (normalized === 'observe' || normalized === 'inspect') return 'device.observe';
  if (normalized === 'screenshot' || normalized === 'capture') return 'device.screenshot';
  if (normalized === 'ui_dump' || normalized === 'uidump' || normalized === 'dump') return 'device.ui_dump';
  if (normalized === 'logcat' || normalized === 'logs') return 'device.logcat';
  if (normalized === 'plan') return 'device.plan';
  if (normalized === 'approve') return 'device.approve';
  if (normalized === 'cancel' || normalized === 'stop') return 'device.cancel';
  return normalized.startsWith('device.') ? normalized : 'device.status';
}

function parsePositive(value: string | undefined): number | null {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
