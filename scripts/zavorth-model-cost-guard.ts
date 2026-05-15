import { ZavorthModelCostGuardService } from '../src/services/ZavorthModelCostGuardService.js';

const args = process.argv.slice(2);

function readFlag(name: string): string | null {
  const inline = args.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) {
    return inline.slice(name.length + 3);
  }
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith('--') ? args[index + 1] : null;
}

const positionalRequest = args.filter((arg) => !arg.startsWith('--')).join(' ').trim();
const service = new ZavorthModelCostGuardService();
const snapshot = service.buildContract({
  profile: readFlag('profile'),
  autonomy: readFlag('autonomy') || readFlag('level'),
  request: readFlag('request') || positionalRequest,
  maxCents: readFlag('max-cents') || readFlag('budget-cents'),
  provider: readFlag('provider'),
});

if (args.includes('--json')) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  process.stdout.write(service.renderText(snapshot));
}
