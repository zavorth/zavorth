#!/usr/bin/env node
import { ZavorthDynamicWorkflowService } from '../src/services/ZavorthDynamicWorkflowService.js';

const args = process.argv.slice(2);

const USAGE = [
  'Zavorth Dynamic Workflows',
  'usage: zavorth workflows "objective" --fanout 40 --max-concurrency 8 --worker-model cheap --synthesis-model premium --max-cents 50',
  'launch: zavorth workflows launch <workflowId> --approval-id <approvalId>',
  'flags: --objective, --request, --fanout, --workers, --max-concurrency, --concurrency, --worker-model, --synthesis-model, --max-cents, --budget-cents, --approval-id, --storage-dir, --json',
].join('\n');

if (args.includes('--help') || args.includes('-h')) {
  process.stdout.write(`${USAGE}\n`);
  process.exit(0);
}

function readFlag(name: string): string | null {
  const inline = args.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3).trim() || null;
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')
    ? args[index + 1].trim() || null
    : null;
}

function readNumber(name: string): number | null {
  const value = readFlag(name);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function positionalValues(): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] || '';
    if (arg.startsWith('--')) {
      if (!arg.includes('=') && args[index + 1] && !args[index + 1].startsWith('--')) {
        index += 1;
      }
      continue;
    }
    values.push(arg);
  }
  return values;
}

const positionalObjective = positionalValues().join(' ').trim();
const positionals = positionalValues();
const service = new ZavorthDynamicWorkflowService({
  storageDir: readFlag('storage-dir'),
});

if (positionals[0] === 'launch') {
  const workflowId = readFlag('workflow-id') || positionals[1] || '';
  const result = service.launchSavedWorkflow(workflowId, {
    approvalId: readFlag('approval-id') || readFlag('approval'),
  });
  if (args.includes('--json')) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write([
      'Zavorth Dynamic Workflow Launch',
      `status: ${result.status}`,
      `workflow: ${result.workflowId}`,
      `receipt: ${result.receiptId || 'none'}`,
      result.reason ? `reason: ${result.reason}` : null,
    ].filter(Boolean).join('\n'));
    process.stdout.write('\n');
  }
  process.exit(result.status === 'blocked' && args.includes('--require-pass') ? 1 : 0);
}

const snapshot = service.buildPreview({
  objective: readFlag('objective') || readFlag('request') || positionalObjective,
  requestedFanout: readNumber('fanout') || readNumber('workers'),
  maxConcurrency: readNumber('max-concurrency') || readNumber('concurrency'),
  maxCents: readNumber('max-cents') || readNumber('budget-cents'),
  workerModelClass: readFlag('worker-model') || readFlag('worker-model-class'),
  synthesisModelClass: readFlag('synthesis-model') || readFlag('synthesis-model-class'),
});
const previewRegistry = service.savePreview(snapshot);

if (args.includes('--json')) {
  process.stdout.write(`${JSON.stringify({ ...snapshot, previewRegistry }, null, 2)}\n`);
} else {
  process.stdout.write(`${service.renderText(snapshot)}\npreview: ${previewRegistry.status} ${previewRegistry.receiptId || ''}\n`);
}
