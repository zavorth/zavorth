import { ZavorthDoItWithMeService } from '../src/services/ZavorthDoItWithMeService.js';

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
const service = new ZavorthDoItWithMeService();
const snapshot = service.buildContract({
  request: readFlag('request') || positionalRequest,
  capabilityId: readFlag('capability') || readFlag('select'),
  missionId: readFlag('mission'),
  category: readFlag('category'),
  profile: readFlag('profile'),
});

if (args.includes('--json')) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  process.stdout.write(service.renderText(snapshot));
}
