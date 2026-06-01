import { ZavorthMnemosLifecycleHookService } from '../src/services/ZavorthMnemosLifecycleHookService.js';
import type { ZavorthMnemosLifecycleHookType } from '../src/contracts/ZavorthMnemosLifecycleHookContract.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const valueAfter = (flag: string): string | null => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] || null : null;
};

const type = (valueAfter('--type') || 'session.started') as ZavorthMnemosLifecycleHookType;
const sessionId = valueAfter('--session-id') || 'mnemos-cli-session';
const payloadText = valueAfter('--payload');
let payload: Record<string, any> = { note: 'captured from mnemos lifecycle hook cli' };
if (payloadText) {
  try {
    payload = JSON.parse(payloadText);
  } catch {
    payload = { text: payloadText };
  }
}

const snapshot = new ZavorthMnemosLifecycleHookService().capture({
  sessionId,
  type,
  payload,
  source: {
    surface: 'cli',
    channel: 'mnemos:lifecycle',
  },
});

if (json) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  process.stdout.write([
    'Zavorth Mnemos Lifecycle Hook',
    `status: ${snapshot.status}`,
    `event: ${snapshot.eventType}`,
    `session: ${snapshot.sessionId}`,
    `trust: ${snapshot.trust.level}`,
    `receipt: ${snapshot.receipt.id}`,
  ].join('\n'));
  process.stdout.write('\n');
}
