#!/usr/bin/env node
import { ZavorthEffortControlService } from '../src/services/ZavorthEffortControlService.js';

const args = process.argv.slice(2);
const USAGE = [
  'Zavorth Effort Control',
  'usage: zavorth effort high --request "review this module" --max-cents 75',
  'levels: low, standard, high, ultra-code',
  'flags: --level, --request, --profile, --max-cents, --json',
].join('\n');

if (args.includes('--help') || args.includes('-h')) {
  process.stdout.write(`${USAGE}\n`);
  process.exit(0);
}

function readFlag(name: string): string | null {
  const inline = args.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3).trim() || null;
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')
    ? args[index + 1].trim() || null
    : null;
}

const positional = args.filter((arg) => !arg.startsWith('--'));
const firstPositional = positional[0] || null;
const knownLevel = /^(low|light|fast|standard|high|deep|heavy|ultra|ultra-code|ultra_code|ultracode|max|massive)$/i;
const positionalLevel = firstPositional && knownLevel.test(firstPositional) ? firstPositional : null;
const requestText = readFlag('request') || positional.slice(positionalLevel ? 1 : 0).join(' ').trim() || null;
const service = new ZavorthEffortControlService();
const snapshot = service.buildSnapshot({
  level: readFlag('level') || positionalLevel,
  request: requestText,
  profile: readFlag('profile'),
  maxCents: readFlag('max-cents'),
});

if (args.includes('--json')) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  process.stdout.write(`${service.renderText(snapshot)}\n`);
}
