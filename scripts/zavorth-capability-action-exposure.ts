import {
  ZavorthCapabilityActionExposureService,
} from '../src/services/ZavorthCapabilityActionExposureService.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const list = args.includes('--list') || (!args.includes('--preview') && !args.includes('--expose'));
const preview = args.includes('--preview');
const expose = args.includes('--expose');
const allVerified = args.includes('--all-verified');
const actor = valueFor('--actor') || 'operator';
const verificationIds = valuesFor('--verification');

void main().catch((error) => {
  process.stderr.write(`[capability-action-exposure] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const service = new ZavorthCapabilityActionExposureService();
  if (preview) {
    const plan = service.preview({ allVerified, verificationIds, actor });
    if (json) {
      process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    } else {
      process.stdout.write(`${['Zavorth Capability Action Exposure Preview', '', ...plan.lines].join('\n')}\n`);
    }
    return;
  }

  const snapshot = expose
    ? service.expose({ allVerified, verificationIds, actor })
    : service.snapshot();

  if (list || expose) {
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
