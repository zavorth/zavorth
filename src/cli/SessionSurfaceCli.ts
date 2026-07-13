/**
 * CLI surfaces:
 *   zavorth session export ...
 *   zavorth session model ...
 */

import fs from 'node:fs';
import path from 'node:path';
import { ZavorthSessionTranscriptExportService } from '../services/ZavorthSessionTranscriptExportService.js';
import { SessionModelRouteService } from '../services/SessionModelRouteService.js';

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function readOption(args: string[], name: string): string | null {
  const idx = args.indexOf(name);
  if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith('--')) return args[idx + 1];
  const pref = `${name}=`;
  const hit = args.find((a) => a.startsWith(pref));
  return hit ? hit.slice(pref.length) : null;
}

function printHelp(): void {
  console.log([
    '=== Zavorth Session Surface ===',
    '',
    'Export human-readable session transcripts and switch models mid-session.',
    '',
    'Usage:',
    '  zavorth session export --session <id> [--format markdown|html|prompt] [--export-path <path> --approval-id <id>]',
    '  zavorth session export --messages-file <json> --format html',
    '  zavorth session model <sessionId> <modelName> [--provider <name>]',
    '  zavorth session model-clear <sessionId>',
    '  zavorth session model-usage <sessionId>',
    '',
    'Notes:',
    '  - export redact is ON by default (use --no-redact to disable)',
    '  - writing export files requires --approval-id',
    '  - trajectory training export remains: npm run zavorth:trajectory-export',
  ].join('\n'));
}

export async function runSessionSurfaceCli(rawArgs: string[] = []): Promise<number> {
  if (rawArgs.length === 0 || rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printHelp();
    return rawArgs.length === 0 ? 1 : 0;
  }

  const [sub, ...rest] = rawArgs;
  const command = String(sub || '').trim().toLowerCase();

  if (command === 'export') {
    return runExport(rest);
  }
  if (command === 'model' || command === 'switch-model' || command === 'use-model') {
    return runModelSet(rest);
  }
  if (command === 'model-clear' || command === 'clear-model') {
    return runModelClear(rest);
  }
  if (command === 'model-usage' || command === 'usage') {
    return runModelUsage(rest);
  }

  printHelp();
  return 1;
}

function runExport(args: string[]): number {
  const sessionId = readOption(args, '--session') || readOption(args, '--session-id');
  const platform = readOption(args, '--platform') || 'web';
  const chatId = readOption(args, '--chat-id') || sessionId;
  const format = readOption(args, '--format') || 'markdown';
  const exportPath = readOption(args, '--export-path') || readOption(args, '--out');
  const approvalId = readOption(args, '--approval-id');
  const title = readOption(args, '--title');
  const messagesFile = readOption(args, '--messages-file');
  const json = hasFlag(args, '--json');
  const redact = !hasFlag(args, '--no-redact');
  const includeSystem = hasFlag(args, '--include-system');
  const printBody = hasFlag(args, '--print') || (!exportPath && !json);

  let messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string; createdAt?: string | null }> | undefined;
  if (messagesFile) {
    const raw = fs.readFileSync(path.resolve(messagesFile), 'utf8');
    const parsed = JSON.parse(raw);
    messages = Array.isArray(parsed) ? parsed : parsed.messages;
  }

  const service = new ZavorthSessionTranscriptExportService({ projectRoot: process.cwd() });
  const snapshot = service.export({
    sessionId,
    platform,
    chatId,
    format,
    exportPath,
    approvalId,
    title,
    redact,
    includeSystem,
    messages: messages as any,
  });

  if (json) {
    console.log(JSON.stringify(snapshot, null, 2));
    return snapshot.status === 'blocked' || snapshot.status === 'empty' ? 1 : 0;
  }

  console.log(`Session export: ${snapshot.status}`);
  console.log(`Format: ${snapshot.format}`);
  console.log(`Messages: ${snapshot.messageCount}`);
  console.log(`Redacted: ${snapshot.safety.secretsRedacted}`);
  if (snapshot.exportPath) console.log(`Wrote: ${snapshot.exportPath}`);
  if (snapshot.status === 'approval-required') {
    console.log('Write requires --approval-id. Preview only.');
  }
  if (printBody && snapshot.body) {
    console.log('');
    console.log(snapshot.bodyPreview.length < snapshot.body.length
      ? `${snapshot.bodyPreview}\n\n… (truncated preview; use --export-path to write full body)`
      : snapshot.body);
  }
  return snapshot.status === 'blocked' || snapshot.status === 'empty' ? 1 : 0;
}

function runModelSet(args: string[]): number {
  const positional = args.filter((a) => !a.startsWith('--'));
  const sessionId = positional[0] || readOption(args, '--session');
  const modelName = positional[1] || readOption(args, '--model');
  const providerName = readOption(args, '--provider');
  const json = hasFlag(args, '--json');

  if (!sessionId || !modelName) {
    console.log('Usage: zavorth session model <sessionId> <modelName> [--provider <name>]');
    return 1;
  }

  const service = SessionModelRouteService.getInstance();
  const ledger = service.setSessionModel({
    sessionId,
    modelName,
    providerName,
    source: 'cli',
  });

  if (json) {
    console.log(JSON.stringify(ledger, null, 2));
    return 0;
  }

  console.log(`Session model set: ${sessionId}`);
  console.log(`Model: ${ledger.route?.providerName || 'any'}/${ledger.route?.modelName}`);
  console.log(`Source: ${ledger.route?.source}`);
  return 0;
}

function runModelClear(args: string[]): number {
  const sessionId = args.filter((a) => !a.startsWith('--'))[0] || readOption(args, '--session');
  if (!sessionId) {
    console.log('Usage: zavorth session model-clear <sessionId>');
    return 1;
  }
  const ledger = SessionModelRouteService.getInstance().clearSessionModel(sessionId);
  console.log(`Cleared session model for ${ledger.sessionId}`);
  return 0;
}

function runModelUsage(args: string[]): number {
  const sessionId = args.filter((a) => !a.startsWith('--'))[0] || readOption(args, '--session');
  if (!sessionId) {
    console.log('Usage: zavorth session model-usage <sessionId>');
    return 1;
  }
  const ledger = SessionModelRouteService.getInstance().getLedger(sessionId);
  if (hasFlag(args, '--json')) {
    console.log(JSON.stringify(ledger, null, 2));
    return 0;
  }
  console.log(`Session: ${ledger.sessionId}`);
  console.log(`Active model: ${ledger.route ? `${ledger.route.providerName || 'any'}/${ledger.route.modelName}` : '(default)'}`);
  console.log('Usage by model:');
  const keys = Object.keys(ledger.totalsByModel);
  if (keys.length === 0) {
    console.log('  (empty)');
  } else {
    for (const key of keys) {
      const row = ledger.totalsByModel[key];
      console.log(`  - ${key}: ${row.calls} call(s), in=${row.inputTokens} out=${row.outputTokens}, ~$${row.estimatedCostUsd.toFixed(4)}`);
    }
  }
  return 0;
}
