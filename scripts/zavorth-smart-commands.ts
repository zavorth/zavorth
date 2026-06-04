#!/usr/bin/env node

import { ZavorthSmartCommandSurfaceService } from '../src/services/ZavorthSmartCommandSurfaceService.js';

type CliOptions = {
  json: boolean;
  requirePass: boolean;
  rawText: string;
  channel: string | null;
  sessionId: string | null;
  apply: boolean;
  approvalId: string | null;
};

function parseArgs(argv: string[]): CliOptions {
  const rawText = readFlexibleStringFlag(argv, 'command')
    || readFlexibleStringFlag(argv, 'text')
    || argv.filter((arg) => !arg.startsWith('--')).join(' ').trim()
    || '/status';
  return {
    json: argv.includes('--json'),
    requirePass: argv.includes('--require-pass') || argv.includes('--strict'),
    rawText,
    channel: readFlexibleStringFlag(argv, 'channel'),
    sessionId: readFlexibleStringFlag(argv, 'session') || readFlexibleStringFlag(argv, 'session-id'),
    apply: argv.includes('--apply'),
    approvalId: readFlexibleStringFlag(argv, 'approval-id'),
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write([
      'Zavorth Smart Commands',
      '',
      'Usage:',
      '  zavorth smart-command /status',
      '  zavorth smart-command /model gemini:gemini-2.5-pro',
      '  zavorth smart-command /skills security review',
      '',
      'Supported:',
      '  /new /reset /model /personality /retry /undo /compress /usage /insights /skills /stop /platforms /status /sethome',
      '',
      'Safety:',
      '  Read-only commands do not start runtime, network or runtime adapters.',
      '  State-changing commands preview first and require approval before write/rollback/cancel.',
      '',
    ].join('\n'));
    return;
  }

  const options = parseArgs(argv);
  const service = new ZavorthSmartCommandSurfaceService();
  const snapshot = await service.buildSnapshot({
    rawText: options.rawText,
    channel: options.channel,
    sessionId: options.sessionId,
    apply: options.apply,
    approvalId: options.approvalId,
  });

  process.stdout.write(options.json ? `${JSON.stringify(snapshot, null, 2)}\n` : service.renderText(snapshot));
  if (options.requirePass && (snapshot.status === 'blocked' || snapshot.status === 'not-handled')) {
    process.exitCode = 1;
  }
}

function readFlexibleStringFlag(argv: string[], name: string): string | null {
  const prefix = `--${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : null;
}

main().catch((error) => {
  console.error(`[zavorth-smart-commands] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
