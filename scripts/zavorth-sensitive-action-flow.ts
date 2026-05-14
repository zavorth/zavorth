import { ZavorthSensitiveActionFlowService } from '../src/services/ZavorthSensitiveActionFlowService.js';

function readFlag(argv: string[], name: string): string | null {
  const prefix = `--${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] || null : null;
}

const argv = process.argv.slice(2);
const service = new ZavorthSensitiveActionFlowService();
const request = readFlag(argv, 'request')
  || argv.filter((arg) => !arg.startsWith('--')).join(' ')
  || 'Review this workspace in read-only mode.';
const snapshot = service.buildSnapshot({
  request,
  decision: readFlag(argv, 'decision') as any,
  approvalId: readFlag(argv, 'approval-id'),
  sandboxReady: argv.includes('--sandbox-ready'),
  source: 'cli',
});

if (argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  process.stdout.write(service.renderText(snapshot));
}
