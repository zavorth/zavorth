#!/usr/bin/env tsx
import { ZavorthProviderActivationService } from '../src/services/ZavorthProviderActivationService.js';

const asJson = process.argv.includes('--json');
const liveConfigured = process.argv.includes('--live-configured');
const allowAllLive = process.argv.includes('--all');
const providerId = readFlag('provider') || readFlag('provider-id');

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const service = new ZavorthProviderActivationService();
  const snapshot = await service.buildSnapshot({
    includeAdvanced: process.argv.includes('--advanced'),
    providerId,
    liveConfigured,
    allowAllLive,
  });

  if (asJson) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(service.renderText(snapshot));
  }

  if (snapshot.status === 'blocked') {
    process.exitCode = 1;
  }
}

function readFlag(name: string): string | null {
  const exact = `--${name}`;
  const prefix = `${exact}=`;
  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index] || '';
    if (arg === exact) return process.argv[index + 1] || null;
    if (arg.startsWith(prefix)) return arg.slice(prefix.length) || null;
  }
  return null;
}
