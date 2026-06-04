import {
  type ZavorthCapabilityUsageEventKind,
  type ZavorthCapabilityUsageSurface,
} from '../src/contracts/ZavorthCapabilityUsageSignalsContract.js';
import { ZavorthCapabilityUsageSignalsService } from '../src/services/ZavorthCapabilityUsageSignalsService.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const record = args.includes('--record');

void main().catch((error) => {
  process.stderr.write(`[capability-usage-signals] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const service = new ZavorthCapabilityUsageSignalsService();
  const snapshot = record
    ? service.record({
      actionId: valueFor('--action') || valueFor('--action-id') || '',
      capabilityId: valueFor('--capability') || undefined,
      title: valueFor('--title') || undefined,
      kind: (valueFor('--event') || valueFor('--kind') || 'shown') as ZavorthCapabilityUsageEventKind,
      surface: (valueFor('--surface') || 'cli') as ZavorthCapabilityUsageSurface,
      actor: valueFor('--actor') || 'operator',
      status: (valueFor('--status') || 'ok') as 'ok' | 'attention' | 'blocked',
      durationMs: numberFor('--duration-ms'),
      receiptId: valueFor('--receipt') || undefined,
      metadata: metadataFromArgs(),
    })
    : service.snapshot();

  if (json) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(`${service.renderText(snapshot)}\n`);
  }
}

function valuesFor(flag: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === flag && args[index + 1]) {
      values.push(args[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith(`${flag}=`)) {
      values.push(arg.slice(flag.length + 1));
    }
  }
  return values;
}

function valueFor(flag: string): string | null {
  return valuesFor(flag)[0] || null;
}

function numberFor(flag: string): number | null {
  const raw = valueFor(flag);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function metadataFromArgs(): Record<string, string> {
  const output: Record<string, string> = {};
  for (const entry of valuesFor('--meta')) {
    const [key, ...rest] = entry.split('=');
    const value = rest.join('=');
    if (key && value) output[key] = value;
  }
  const title = valueFor('--title');
  if (title) output.title = title;
  return output;
}
