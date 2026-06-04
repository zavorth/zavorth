import { ZavorthCapabilityAtlasService } from '../src/services/ZavorthCapabilityAtlasService.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const query = readFlag('query') || args.filter((arg) => !arg.startsWith('--')).join(' ');
const category = readFlag('category');
const limit = Number(readFlag('limit') || 200);

const service = new ZavorthCapabilityAtlasService({ projectRoot: process.cwd() });
const snapshot = service.buildSnapshot({
  query,
  category: category as any || null,
  limit,
});

if (json) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  process.stdout.write(service.renderText(snapshot));
}

function readFlag(name: string): string | null {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  if (index >= 0) return args[index + 1] || null;
  return null;
}
