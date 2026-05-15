import { ZavorthCapabilityStoreService } from '../src/services/ZavorthCapabilityStoreService.js';

const args = process.argv.slice(2);

function readFlag(name: string): string | null {
  const inline = args.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) {
    return inline.slice(name.length + 3);
  }
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith('--') ? args[index + 1] : null;
}

const positionalQuery = args.filter((arg) => !arg.startsWith('--')).join(' ').trim();
const service = new ZavorthCapabilityStoreService();
const snapshot = service.buildContract({
  query: readFlag('query') || positionalQuery,
  category: readFlag('category'),
  selectedId: readFlag('select') || readFlag('id'),
});

if (args.includes('--json')) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  process.stdout.write(service.renderText(snapshot));
}
