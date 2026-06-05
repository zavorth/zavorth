#!/usr/bin/env node
import { ExecutionBackendPlaybookService } from '../src/services/ExecutionBackendPlaybookService.js';

const args = process.argv.slice(2);
const service = new ExecutionBackendPlaybookService();
const input = {
  backendId: readFlag('--backend') || readPositional(),
};
const snapshot = service.buildSnapshot(input);

if (args.includes('--json')) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(service.renderText(input));
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
