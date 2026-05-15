import { ZavorthAutonomySliderService } from '../src/services/ZavorthAutonomySliderService.js';

const args = process.argv.slice(2);

function readFlag(name: string): string | null {
  const inline = args.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) {
    return inline.slice(name.length + 3);
  }
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith('--') ? args[index + 1] : null;
}

const positionalIntent = args.filter((arg) => !arg.startsWith('--')).join(' ').trim();
const service = new ZavorthAutonomySliderService();
const snapshot = service.buildContract({
  profile: readFlag('profile'),
  level: readFlag('level') || readFlag('autonomy'),
  intent: readFlag('intent') || positionalIntent,
});

if (args.includes('--json')) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  process.stdout.write(service.renderText(snapshot));
}
