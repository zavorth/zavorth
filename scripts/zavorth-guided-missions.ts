import { ZavorthGuidedMissionsService } from '../src/services/ZavorthGuidedMissionsService.js';

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
const service = new ZavorthGuidedMissionsService();
const contract = service.buildContract({
  profile: readFlag('profile'),
  intent: readFlag('intent') || positionalIntent,
  missionId: readFlag('mission') || readFlag('template'),
  category: readFlag('category'),
});

if (args.includes('--json')) {
  process.stdout.write(`${JSON.stringify(contract, null, 2)}\n`);
} else {
  process.stdout.write(service.renderText(contract));
}
