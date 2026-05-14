import { ZavorthSensitiveActionFlowUxService } from '../src/services/ZavorthSensitiveActionFlowUxService.js';

const args = process.argv.slice(2);
const service = new ZavorthSensitiveActionFlowUxService();

function readFlag(name: string): string | null {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : null;
}

const request = readFlag('request')
  || args.filter((arg) => !arg.startsWith('--')).join(' ')
  || 'Review this workspace in read-only mode.';

const snapshot = service.buildSnapshot({
  request,
  decision: readFlag('decision') as any,
  approvalId: readFlag('approval-id'),
  sandboxReady: args.includes('--sandbox-ready'),
  source: 'cli',
});

if (args.includes('--json')) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  process.stdout.write(service.renderText(snapshot));
}
