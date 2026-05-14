import { ZavorthApprovalActionCardsUxService } from '../src/services/ZavorthApprovalActionCardsUxService.js';
import { ZavorthSensitiveActionFlowUxService } from '../src/services/ZavorthSensitiveActionFlowUxService.js';
import { ZavorthVisualReceiptUxService } from '../src/services/ZavorthVisualReceiptUxService.js';

const args = process.argv.slice(2);

function readFlag(name: string): string | null {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : null;
}

const request = readFlag('request')
  || args.filter((arg) => !arg.startsWith('--')).join(' ')
  || 'Edit one file after approval.';

const sensitiveActionFlowUx = new ZavorthSensitiveActionFlowUxService().buildSnapshot({
  request,
  decision: readFlag('decision') as any,
  sandboxReady: args.includes('--sandbox-ready'),
  source: 'cli',
});
const visualReceipts = new ZavorthVisualReceiptUxService().buildSnapshot({});
const service = new ZavorthApprovalActionCardsUxService();
const snapshot = service.buildSnapshot({
  sensitiveActionFlowUx,
  visualReceipts,
});

if (args.includes('--json')) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  process.stdout.write(service.renderText(snapshot));
}
