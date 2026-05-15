import { ZavorthNaturalRuntimeQuestionsService } from '../src/services/ZavorthNaturalRuntimeQuestionsService.js';

const args = process.argv.slice(2);
const question = readFlag('question') || args.filter((arg) => !arg.startsWith('--')).join(' ').trim();
const service = new ZavorthNaturalRuntimeQuestionsService();
const snapshot = service.buildSnapshot({ question });

if (args.includes('--json')) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  process.stdout.write(service.renderText(snapshot));
}

function readFlag(name: string): string | null {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : null;
}
