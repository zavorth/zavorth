/**
 * Proof OS unified receipt ledger CLI.
 *
 *   zavorth proof
 *   zavorth proof list [--kind ...] [--status ...] [--limit N] [--json]
 *   zavorth proof show <id> [--json]
 *   zavorth proof export [--format json|markdown] [--out path]
 *   zavorth proof ingest-demo
 *   zavorth proof --help
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  ProofLedgerService,
  createProofLedgerDemoEvents,
  defaultProofLedgerJsonlPath,
} from '../services/proof/ProofLedgerService.js';
import type { ProofEventKind, ProofEventStatus } from '../contracts/proof/ProofLedgerContract.js';

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function readOption(args: string[], name: string): string | null {
  const idx = args.indexOf(name);
  if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith('--')) {
    return args[idx + 1];
  }
  const pref = `${name}=`;
  const hit = args.find((a) => a.startsWith(pref));
  return hit ? hit.slice(pref.length) : null;
}

function printHelp(): void {
  console.log([
    '=== Zavorth Proof Ledger (Proof OS) ===',
    '',
    'Unified receipt / evidence projection facade.',
    'Does not replace desktop receipts, agent evidence store, or AI-first ledgers.',
    '',
    'Usage:',
    '  zavorth proof',
    '  zavorth proof list [--kind <kind>] [--status <status>] [--run-id <id>] [--query <text>] [--limit N] [--json]',
    '  zavorth proof show <id> [--json]',
    '  zavorth proof export [--format json|markdown] [--out <path>] [--kind <kind>] [--limit N]',
    '  zavorth proof ingest-demo',
    '  zavorth proof status',
    '  zavorth proof --help',
    '',
    'Storage:',
    `  Default local ledger: ${defaultProofLedgerJsonlPath()}`,
    '  Override with env ZAVORTH_PROOF_LEDGER_PATH',
    '',
    'Kinds:',
    '  chat | approval | runtime | system | channel | memory | marketplace |',
    '  workboard | action | evidence | unknown',
    '',
    'Examples:',
    '  zavorth proof list --limit 20',
    '  zavorth proof list --kind approval --json',
    '  zavorth proof show proof-demo-chat-1',
    '  zavorth proof export --format markdown --out ./proof.md',
    '  zavorth proof ingest-demo',
  ].join('\n'));
}

function resolveLedgerPath(): string {
  const fromEnv = String(process.env.ZAVORTH_PROOF_LEDGER_PATH || '').trim();
  if (fromEnv) return path.resolve(fromEnv);
  return defaultProofLedgerJsonlPath(process.cwd());
}

function createService(): ProofLedgerService {
  return new ProofLedgerService({
    jsonlPath: resolveLedgerPath(),
  });
}

function printEventLine(event: {
  id: string;
  kind: string;
  status: string;
  riskLevel: string;
  title: string;
  createdAt: string;
}): void {
  console.log(
    `  [${event.kind}/${event.status}] risk=${event.riskLevel} ${event.title}`,
  );
  console.log(`    id=${event.id} · ${event.createdAt}`);
}

export async function runProofLedgerCli(rawArgs: string[] = []): Promise<number> {
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printHelp();
    return 0;
  }

  const first = String(rawArgs[0] || '').trim().toLowerCase();
  const json = hasFlag(rawArgs, '--json');

  // Bare `zavorth proof` or flags-only → status
  if (!first || first.startsWith('--')) {
    return runStatus(rawArgs, json);
  }

  const rest = rawArgs.slice(1);
  const sub = first;

  if (sub === 'status' || sub === 'summary') {
    return runStatus(rest, json || hasFlag(rest, '--json'));
  }

  if (sub === 'list' || sub === 'ls') {
    return runList(rest, json || hasFlag(rest, '--json'));
  }

  if (sub === 'show' || sub === 'get') {
    return runShow(rest, json || hasFlag(rest, '--json'));
  }

  if (sub === 'export') {
    return runExport(rest, json || hasFlag(rest, '--json'));
  }

  if (sub === 'ingest-demo' || sub === 'demo' || sub === 'seed') {
    return runIngestDemo(rest, json || hasFlag(rest, '--json'));
  }

  if (sub === 'help') {
    printHelp();
    return 0;
  }

  console.log(`Unknown proof subcommand: ${sub}`);
  console.log('');
  printHelp();
  return 1;
}

function runStatus(args: string[], json: boolean): number {
  const service = createService();
  const limitOpt = readOption(args, '--limit');
  const limit = limitOpt ? Math.max(1, Number(limitOpt) || 10) : 10;
  const snapshot = service.buildSnapshot({ limit: 10_000 });

  if (json) {
    console.log(service.toJson(snapshot));
    return 0;
  }

  const ledgerPath = resolveLedgerPath();
  console.log('Proof ledger status');
  console.log(`  contract: ${snapshot.contractVersion}`);
  console.log(`  ledgerId: ${snapshot.ledgerId}`);
  console.log(`  path: ${ledgerPath}`);
  console.log(`  exists: ${fs.existsSync(ledgerPath) ? 'yes' : 'no'}`);
  console.log(`  total: ${snapshot.summary.total}`);
  console.log(`  highRiskOrAbove: ${snapshot.summary.highRiskOrAbove}`);
  if (Object.keys(snapshot.summary.byKind).length) {
    console.log('  byKind:');
    for (const [kind, count] of Object.entries(snapshot.summary.byKind)) {
      console.log(`    ${kind}: ${count}`);
    }
  }
  console.log('');
  const recent = service.list({ limit });
  if (recent.length === 0) {
    console.log('No events yet. Try: zavorth proof ingest-demo');
  } else {
    console.log(`Recent (${recent.length}):`);
    for (const event of recent) {
      printEventLine(event);
    }
  }
  return 0;
}

function runList(args: string[], json: boolean): number {
  const service = createService();
  const kind = readOption(args, '--kind') as ProofEventKind | null;
  const status = readOption(args, '--status') as ProofEventStatus | null;
  const runId = readOption(args, '--run-id') || readOption(args, '--runId');
  const query = readOption(args, '--query') || readOption(args, '-q');
  const limitOpt = readOption(args, '--limit');
  const limit = limitOpt ? Math.max(0, Number(limitOpt) || 0) : 50;

  const filter = {
    ...(kind ? { kind } : {}),
    ...(status ? { status } : {}),
    ...(runId ? { runId } : {}),
    ...(query ? { query } : {}),
    limit,
  };

  const events = service.list(filter);

  if (json) {
    console.log(JSON.stringify({ total: events.length, events }, null, 2));
    return 0;
  }

  if (events.length === 0) {
    console.log('No proof events match the filter.');
    console.log(`Ledger: ${resolveLedgerPath()}`);
    console.log('Tip: zavorth proof ingest-demo');
    return 0;
  }

  console.log(`Proof events (${events.length}):`);
  for (const event of events) {
    printEventLine(event);
    console.log(`    ${event.summary}`);
  }
  return 0;
}

function runShow(args: string[], json: boolean): number {
  const positional = args.filter((a) => !a.startsWith('--'));
  const id = positional[0];
  if (!id) {
    console.log('Usage: zavorth proof show <id> [--json]');
    return 1;
  }

  const service = createService();
  const event = service.get(id);
  if (!event) {
    if (json) {
      console.log(JSON.stringify({ found: false, id }, null, 2));
    } else {
      console.log(`Event not found: ${id}`);
    }
    return 1;
  }

  if (json) {
    console.log(JSON.stringify(event, null, 2));
    return 0;
  }

  console.log(`Proof event: ${event.title}`);
  console.log(`  id: ${event.id}`);
  console.log(`  kind: ${event.kind}`);
  console.log(`  status: ${event.status}`);
  console.log(`  risk: ${event.riskLevel}`);
  console.log(`  surface: ${event.surface}`);
  console.log(`  source: ${event.source}`);
  console.log(`  runId: ${event.runId || '—'}`);
  console.log(`  approvalId: ${event.approvalId || '—'}`);
  console.log(`  createdAt: ${event.createdAt}`);
  console.log(`  summary: ${event.summary}`);
  if (event.artifacts.length) {
    console.log('  artifacts:');
    for (const art of event.artifacts) {
      console.log(`    - ${art.type}/${art.id}${art.label ? ` (${art.label})` : ''}`);
    }
  }
  return 0;
}

function runExport(args: string[], jsonFlag: boolean): number {
  const service = createService();
  const formatRaw = (readOption(args, '--format') || (jsonFlag ? 'json' : 'markdown')).toLowerCase();
  const format = formatRaw === 'json' || formatRaw === 'md' || formatRaw === 'markdown'
    ? (formatRaw === 'md' ? 'markdown' : formatRaw)
    : 'markdown';
  const outPath = readOption(args, '--out') || readOption(args, '-o');
  const kind = readOption(args, '--kind') as ProofEventKind | null;
  const limitOpt = readOption(args, '--limit');
  const limit = limitOpt ? Math.max(0, Number(limitOpt) || 0) : undefined;

  const snapshot = service.buildSnapshot({
    ...(kind ? { kind } : {}),
    ...(limit !== undefined ? { limit } : {}),
  });

  const body = format === 'json'
    ? service.toJson(snapshot)
    : service.toMarkdown(snapshot);

  if (outPath) {
    const resolved = path.resolve(outPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, body.endsWith('\n') ? body : `${body}\n`, 'utf8');
    console.log(`Wrote ${format} export to ${resolved}`);
    console.log(`Events: ${snapshot.summary.total}`);
    return 0;
  }

  process.stdout.write(body.endsWith('\n') ? body : `${body}\n`);
  return 0;
}

function runIngestDemo(args: string[], json: boolean): number {
  const service = createService();
  const demos = createProofLedgerDemoEvents();
  const ingested = service.ingestProjected(demos);

  // Always ensure demos exist: if already present, re-list them
  const present = demos.map((d) => service.get(d.id)).filter(Boolean);

  if (json) {
    console.log(JSON.stringify({
      ingested: ingested.length,
      events: present,
      path: resolveLedgerPath(),
    }, null, 2));
    return 0;
  }

  console.log(`Ingested ${ingested.length} demo event(s) (${present.length} present).`);
  console.log(`Ledger: ${resolveLedgerPath()}`);
  for (const event of present) {
    if (event) printEventLine(event);
  }
  console.log('');
  console.log('Next: zavorth proof list');
  return 0;
}
