#!/usr/bin/env tsx
import { ZavorthProviderCapabilityMatrixService } from '../src/services/ZavorthProviderCapabilityMatrixService.js';

const asJson = process.argv.includes('--json');
const query = readArg('--query');
const service = new ZavorthProviderCapabilityMatrixService();
const snapshot = service.buildSnapshot({ query });

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(service.renderText(snapshot));
}

if (snapshot.status === 'blocked') {
  process.exitCode = 1;
}

function readArg(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : null;
}
