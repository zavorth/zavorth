#!/usr/bin/env node

import { AcpLiveSessionService } from '../src/services/AcpLiveSessionService.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const requirePass = args.includes('--require-pass');
const prompt = readFlag('prompt') || args.find((arg) => !arg.startsWith('--')) || 'ping';
const transport = args.includes('--stdio') || args.includes('--acp-sdk-stdio') ? 'acp-sdk-stdio' : 'local-jsonrpc';
const serverId = readFlag('server') || process.env.ZAVORTH_ACPX_BRIDGE_SERVER_ID || 'local-acp';
const receiptPath = readFlag('receipt');
const stdioCommand = readFlag('stdio-command') || process.env.ZAVORTH_ACPX_BRIDGE_STDIO_COMMAND;
const stdioArgs = readFlag('stdio-args')?.split(/\s+/).filter(Boolean);
const timeoutMs = Number(readFlag('timeout-ms') || process.env.ZAVORTH_ACPX_BRIDGE_SESSION_TIMEOUT_MS || 0) || undefined;

void main();

async function main(): Promise<void> {
  const service = new AcpLiveSessionService();
  const receipt = await service.run({
    prompt,
    serverId,
    transport,
    receiptPath: receiptPath || undefined,
    stdioCommand: stdioCommand || undefined,
    stdioArgs,
    timeoutMs,
  });

  if (asJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log(service.renderText(receipt));
  }

  if (requirePass && !['completed', 'approval_required'].includes(receipt.status)) {
    process.exitCode = 1;
  }
}

function readFlag(name: string): string | null {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length).trim() || null;
  const index = args.indexOf(`--${name}`);
  if (index >= 0) return String(args[index + 1] || '').trim() || null;
  return null;
}
