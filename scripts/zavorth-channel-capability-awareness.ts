#!/usr/bin/env tsx
import { ZavorthChannelCapabilityAwarenessService } from '../src/services/ZavorthChannelCapabilityAwarenessService.js';
import type { ChannelCapabilityChannel } from '../src/contracts/ChannelCapabilityContract.js';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const service = new ZavorthChannelCapabilityAwarenessService({
    now: () => new Date(args.now || new Date().toISOString()),
  });
  const snapshot = service.buildSnapshot({ channel: args.channel });
  if (args.json) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }
  console.log(service.renderReport(snapshot));
}

function parseArgs(argv: string[]) {
  const args = {
    json: false,
    channel: null as ChannelCapabilityChannel | null,
    now: '',
  };
  for (const arg of argv) {
    if (arg === '--json') args.json = true;
    else if (arg.startsWith('--channel=')) args.channel = normalizeChannel(arg.slice('--channel='.length));
    else if (arg.startsWith('--now=')) args.now = arg.slice('--now='.length);
  }
  return args;
}

function normalizeChannel(value: string): ChannelCapabilityChannel | null {
  const normalized = String(value || '').trim().toLowerCase();
  const allowed = new Set<ChannelCapabilityChannel>([
    'telegram',
    'discord',
    'whatsapp',
    'signal',
    'imessage',
    'cli',
    'web',
    'slack',
    'instagram',
    'teams',
    'email',
  ]);
  return allowed.has(normalized as ChannelCapabilityChannel)
    ? normalized as ChannelCapabilityChannel
    : null;
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
