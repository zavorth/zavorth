import {
  ZavorthProductizationProtectedRuntimeService,
  type ZavorthProductizationProtectedRuntimeView,
} from '../src/services/ZavorthProductizationProtectedRuntimeService.js';

function readFlag(argv: string[], name: string): string | null {
  const prefix = `--${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] || null : null;
}

function resolveView(argv: string[]): ZavorthProductizationProtectedRuntimeView {
  const raw = readFlag(argv, 'view') || argv.find((arg) => !arg.startsWith('--')) || 'all';
  if (['all', 'journey', 'templates', 'missions', 'receipts', 'sandbox'].includes(raw)) {
    return raw as ZavorthProductizationProtectedRuntimeView;
  }
  return 'all';
}

const argv = process.argv.slice(2);
const service = new ZavorthProductizationProtectedRuntimeService();
const view = resolveView(argv);
const snapshot = service.buildSnapshot({
  dailyMode: readFlag(argv, 'mode'),
  detailMode: argv.includes('--advanced') ? 'advanced' : argv.includes('--simple') ? 'simple' : readFlag(argv, 'detail'),
  selectedTemplateId: readFlag(argv, 'template'),
  request: readFlag(argv, 'request'),
});

if (argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(view === 'all' ? snapshot : selectView(snapshot, view), null, 2)}\n`);
} else {
  process.stdout.write(service.renderText(snapshot, view));
}

function selectView(
  snapshot: ReturnType<ZavorthProductizationProtectedRuntimeService['buildSnapshot']>,
  view: ZavorthProductizationProtectedRuntimeView,
): unknown {
  if (view === 'journey') return snapshot.firstRun;
  if (view === 'templates') return snapshot.templates;
  if (view === 'missions') return snapshot.mission;
  if (view === 'receipts') return snapshot.receipt;
  if (view === 'sandbox') return snapshot.sandbox;
  return snapshot;
}
