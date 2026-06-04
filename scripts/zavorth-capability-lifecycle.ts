import { ZavorthCapabilityLifecycleService } from '../src/services/ZavorthCapabilityLifecycleService.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const apply = args.includes('--apply');

void main().catch((error) => {
  process.stderr.write(`[capability-lifecycle] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const service = new ZavorthCapabilityLifecycleService();
  const input = {
    actionIds: valuesFor('--action').concat(valuesFor('--action-id')),
    apply,
    actor: valueFor('--actor') || 'operator',
    approvalId: valueFor('--approval-id') || null,
  };
  const snapshot = apply ? service.apply(input) : service.snapshot(input);
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
