import {
  ZavorthCapabilityPrototypeSandboxService,
} from '../src/services/ZavorthCapabilityPrototypeSandboxService.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const list = args.includes('--list') || (!args.includes('--prototype'));
const runPrototype = args.includes('--prototype');
const allReady = args.includes('--all-ready');
const actor = valueFor('--actor') || 'operator';
const candidateIds = valuesFor('--candidate');

void main().catch((error) => {
  process.stderr.write(`[capability-prototypes] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const service = new ZavorthCapabilityPrototypeSandboxService();
  const snapshot = runPrototype
    ? service.prototype({ allReady, candidateIds, actor })
    : service.snapshot();

  if (list || runPrototype) {
    if (json) {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      process.stdout.write(`${service.renderText(snapshot)}\n`);
    }
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
