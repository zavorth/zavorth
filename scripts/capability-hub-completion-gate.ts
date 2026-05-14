import fs from 'node:fs';
import path from 'node:path';
import { ZavorthCapabilityHubCompletionApiService } from '../src/services/ZavorthCapabilityHubCompletionApiService.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const tempDir = path.join(process.cwd(), '.tmp', 'capability-hub-completion');
fs.rmSync(tempDir, { recursive: true, force: true });
fs.mkdirSync(tempDir, { recursive: true });

const api = new ZavorthCapabilityHubCompletionApiService({
  now: () => new Date('2026-05-08T14:00:00.000Z'),
  statePath: path.join(tempDir, 'queue.json'),
  ledgerPath: path.join(tempDir, 'queue-ledger.jsonl'),
  requestLedgerPath: path.join(tempDir, 'activation-requests.jsonl'),
  env: {},
});
const snapshot = api.buildSnapshot();

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(api.renderReport());
}

process.exitCode = snapshot.status === 'passed' ? 0 : 1;
fs.rmSync(tempDir, { recursive: true, force: true });

