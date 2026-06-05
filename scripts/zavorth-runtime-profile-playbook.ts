#!/usr/bin/env node
import { RuntimeProfilePlaybookService } from '../src/services/RuntimeProfilePlaybookService.js';

const args = process.argv.slice(2);
const service = new RuntimeProfilePlaybookService();
const snapshot = service.buildSnapshot({
  target: readFlag('--target') || readPositional(),
});

if (args.includes('--json')) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(service.renderText(snapshot));
}

function readFlag(name: string): string | null {
  const direct = args.find((arg) => arg.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1).trim() || null;
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1]?.trim() || null : null;
}

function readPositional(): string | null {
  return args.find((arg) => !arg.startsWith('--')) || null;
}
