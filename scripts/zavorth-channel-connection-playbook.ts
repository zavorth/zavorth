#!/usr/bin/env node
import { ChannelConnectionPlaybookService } from '../src/services/ChannelConnectionPlaybookService.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const channel = readFlag('--channel') || readPositionalChannel();
const mode = readFlag('--mode');
const intentText = args.filter((arg) => !arg.startsWith('--')).join(' ') || null;
const service = new ChannelConnectionPlaybookService();
const snapshot = service.buildSnapshot({ selectedId: channel, mode, intentText });

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(service.renderText({ selectedId: channel, mode, intentText }));
}

function readFlag(name: string): string | null {
  const direct = args.find((arg) => arg.startsWith(`${name}=`));
  if (direct) {
    return direct.slice(name.length + 1).trim() || null;
  }
  const index = args.indexOf(name);
  if (index >= 0) {
    return args[index + 1]?.trim() || null;
  }
  return null;
}

function readPositionalChannel(): string | null {
  return args.find((arg) => !arg.startsWith('--')) || null;
}
