/**
 * Unified approval presentation CLI (Proof OS product face).
 *
 *   zavorth approval
 *   zavorth approvals
 *   zavorth approval list
 *   zavorth approval show <id>
 *   zavorth approval decide <id> --action approve|deny|defer
 *   zavorth approval seed-demo
 *   zavorth approval format-lease --json
 *   zavorth approval --help
 *
 * Does not replace `zavorth trust` / approval-leases; demo + formatter surface.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  ApprovalPresentationService,
  createApprovalPresentationDemoCards,
  type ApprovalLeaseLike,
} from '../services/approval/ApprovalPresentationService.js';
import {
  formatLeaseExpiry,
  formatRiskLabel,
  formatScopeLine,
  mapLeaseRiskToProofRisk,
  buildEffectsSummaryFromLease,
} from '../services/approval/approvalPresentationFormatters.js';
import {
  APPROVAL_PRESENTATION_CONTRACT_VERSION,
  type ApprovalDecisionAction,
  type ApprovalPresentationCard,
} from '../contracts/approval/ApprovalPresentationContract.js';
import {
  ProofLedgerService,
  defaultProofLedgerJsonlPath,
} from '../services/proof/ProofLedgerService.js';

const DEMO_STORE_REL = path.join('.zavorth', 'approval-presentation-demo.json');

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
    '=== Zavorth Approval Presentation (Proof OS) ===',
    '',
    'Unified approval card facade over leases + loose desktop/control shapes.',
    'Does not replace approval-leases, trust panel, or desktop approval modals.',
    '',
    'Usage:',
    '  zavorth approval',
    '  zavorth approvals',
    '  zavorth approval list [--json] [--open]',
    '  zavorth approval show <id> [--json]',
    '  zavorth approval decide <id> --action approve|deny|defer [--by <who>] [--reason <text>] [--json]',
    '  zavorth approval seed-demo [--with-proof] [--json]',
    '  zavorth approval format-lease [--json] [--expires <iso>] [--risk <level>]',
    '  zavorth approval status',
    '  zavorth approval --help',
    '',
    'Lifecycle: Request → Scope → Lease → Decision → Receipt',
    `Contract: ${APPROVAL_PRESENTATION_CONTRACT_VERSION}`,
    '',
    'Examples:',
    '  zavorth approval seed-demo --with-proof',
    '  zavorth approval list --open',
    '  zavorth approval show card-demo-open',
    '  zavorth approval decide card-demo-open --action approve --by operator',
    '  zavorth approval format-lease --json',
    '  zavorth proof list --kind approval',
  ].join('\n'));
}

function demoStorePath(cwd: string = process.cwd()): string {
  return path.join(cwd, DEMO_STORE_REL);
}

function loadDemoCards(): ApprovalPresentationCard[] {
  const filePath = demoStorePath();
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as { cards?: ApprovalPresentationCard[] };
    return Array.isArray(raw.cards) ? raw.cards : [];
  } catch {
    return [];
  }
}

function saveDemoCards(cards: ApprovalPresentationCard[]): void {
  const filePath = demoStorePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    `${JSON.stringify({
      contractVersion: APPROVAL_PRESENTATION_CONTRACT_VERSION,
      updatedAt: new Date().toISOString(),
      cards,
    }, null, 2)}\n`,
    'utf8',
  );
}

function createService(options: {
  emitProof?: boolean;
  proofLedger?: ProofLedgerService | null;
} = {}): ApprovalPresentationService {
  return new ApprovalPresentationService({
    emitProofByDefault: Boolean(options.emitProof),
    proofLedger: options.proofLedger ?? null,
  });
}

function printCardLine(card: ApprovalPresentationCard): void {
  const decision = card.decision.action || 'pending';
  console.log(
    `  [${card.stage}/${decision}] risk=${card.riskLevel} ${card.title}`,
  );
  console.log(`    id=${card.id} · surface=${card.surface}`);
  if (card.leaseId) console.log(`    leaseId=${card.leaseId}`);
  if (card.proofEventId) console.log(`    proofEventId=${card.proofEventId}`);
}

/**
 * Whether `zavorth <command> ...` should hit the presentation facade.
 * Keeps premium `approve` / plural `approvals list` intact while allowing
 * `zavorth approval list|seed-demo|decide|...` and unique presentation subs.
 */
export function shouldRunApprovalPresentationCli(
  command: string,
  restArgs: string[] = [],
): boolean {
  const cmd = String(command || '').trim().toLowerCase();
  if (cmd === 'approval-presentation' || cmd === 'approval-os') return true;
  if (cmd !== 'approval' && cmd !== 'approvals') return false;

  const first = String(restArgs[0] || '').trim().toLowerCase();
  // Bare `zavorth approval` → presentation status; bare `approvals` stays premium.
  if (!first || first.startsWith('--')) {
    return cmd === 'approval';
  }

  const unique = new Set([
    'seed-demo',
    'demo',
    'seed',
    'format-lease',
    'format',
    'decide',
    'decision',
    'status',
    'summary',
    'presentation',
    'cards',
    'card',
  ]);
  if (unique.has(first)) return true;

  // list/show: singular `approval` routes to presentation; plural needs --demo/--presentation
  if (['list', 'ls', 'show', 'get'].includes(first)) {
    if (cmd === 'approval') return true;
    if (restArgs.includes('--demo') || restArgs.includes('--presentation')) return true;
  }

  return false;
}

/** Strip presentation namespace prefix and map `cards` → `list`. */
export function normalizeApprovalPresentationArgs(restArgs: string[] = []): string[] {
  const first = String(restArgs[0] || '').trim().toLowerCase();
  if (first === 'presentation' || first === 'proof-os' || first === 'card') {
    return restArgs.slice(1);
  }
  if (first === 'cards') {
    return ['list', ...restArgs.slice(1)];
  }
  // Drop presentation-only flags so subparsers stay clean
  return restArgs.filter((a) => a !== '--demo' && a !== '--presentation');
}

export async function runApprovalPresentationCli(rawArgs: string[] = []): Promise<number> {
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printHelp();
    return 0;
  }

  const first = String(rawArgs[0] || '').trim().toLowerCase();
  const json = hasFlag(rawArgs, '--json');

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

  if (sub === 'decide' || sub === 'decision') {
    return runDecide(rest, json || hasFlag(rest, '--json'));
  }

  if (sub === 'seed-demo' || sub === 'demo' || sub === 'seed') {
    return runSeedDemo(rest, json || hasFlag(rest, '--json'));
  }

  if (sub === 'format-lease' || sub === 'format') {
    return runFormatLease(rest, json || hasFlag(rest, '--json'));
  }

  if (sub === 'help') {
    printHelp();
    return 0;
  }

  console.log(`Unknown approval subcommand: ${sub}`);
  console.log('');
  printHelp();
  return 1;
}

function runStatus(args: string[], json: boolean): number {
  const cards = loadDemoCards();
  const service = createService();
  const snapshot = service.buildSnapshot(cards);

  if (json) {
    console.log(JSON.stringify(snapshot, null, 2));
    return 0;
  }

  console.log('Approval presentation status');
  console.log(`  contract: ${snapshot.contractVersion}`);
  console.log(`  demo store: ${demoStorePath()}`);
  console.log(`  total: ${snapshot.summary.total}`);
  console.log(`  open: ${snapshot.summary.open}`);
  if (Object.keys(snapshot.summary.byStage).length) {
    console.log('  byStage:');
    for (const [stage, count] of Object.entries(snapshot.summary.byStage)) {
      console.log(`    ${stage}: ${count}`);
    }
  }
  console.log('');
  if (cards.length === 0) {
    console.log('No demo cards yet. Try: zavorth approval seed-demo');
  } else {
    console.log('Cards:');
    for (const card of cards) {
      printCardLine(card);
    }
  }
  return 0;
}

function runList(args: string[], json: boolean): number {
  const cards = loadDemoCards();
  const service = createService();
  const openOnly = hasFlag(args, '--open');
  const filtered = service.listCards(cards, { openOnly });

  if (json) {
    console.log(JSON.stringify({ total: filtered.length, cards: filtered }, null, 2));
    return 0;
  }

  if (filtered.length === 0) {
    console.log(openOnly ? 'No open approval cards.' : 'No approval cards.');
    console.log('Tip: zavorth approval seed-demo');
    return 0;
  }

  console.log(`Approval cards (${filtered.length}${openOnly ? ', open only' : ''}):`);
  for (const card of filtered) {
    printCardLine(card);
    console.log(`    ${card.summary}`);
  }
  return 0;
}

function runShow(args: string[], json: boolean): number {
  const positional = args.filter((a) => !a.startsWith('--'));
  const id = positional[0];
  if (!id) {
    console.log('Usage: zavorth approval show <id> [--json]');
    return 1;
  }

  const cards = loadDemoCards();
  const card = cards.find((c) => c.id === id || c.leaseId === id || c.approvalId === id);
  if (!card) {
    if (json) {
      console.log(JSON.stringify({ found: false, id }, null, 2));
    } else {
      console.log(`Card not found: ${id}`);
      console.log('Tip: zavorth approval seed-demo && zavorth approval list');
    }
    return 1;
  }

  if (json) {
    console.log(JSON.stringify(card, null, 2));
    return 0;
  }

  console.log(`Approval card: ${card.title}`);
  console.log(`  id: ${card.id}`);
  console.log(`  stage: ${card.stage}`);
  console.log(`  risk: ${card.riskLevel} (${formatRiskLabel(card.riskLevel)})`);
  console.log(`  surface: ${card.surface}`);
  console.log(`  leaseId: ${card.leaseId || '—'}`);
  console.log(`  approvalId: ${card.approvalId || '—'}`);
  console.log(`  runId: ${card.runId || '—'}`);
  console.log(`  expiresAt: ${card.expiresAt || '—'}`);
  if (card.expiresAt) {
    const exp = formatLeaseExpiry(card.expiresAt);
    console.log(`  expiry: ${exp.label}`);
  }
  console.log(`  scope: ${formatScopeLine(card.scope)}`);
  console.log(`  summary: ${card.summary}`);
  console.log(`  decision: ${card.decision.action || 'pending'}`);
  if (card.decision.decidedBy) console.log(`  decidedBy: ${card.decision.decidedBy}`);
  if (card.decision.reason) console.log(`  reason: ${card.decision.reason}`);
  if (card.proofEventId) console.log(`  proofEventId: ${card.proofEventId}`);
  if (card.effectsSummary.length) {
    console.log('  effects:');
    for (const line of card.effectsSummary) {
      console.log(`    - ${line}`);
    }
  }
  return 0;
}

function runDecide(args: string[], json: boolean): number {
  const positional = args.filter((a) => !a.startsWith('--'));
  const id = positional[0];
  const actionRaw = readOption(args, '--action') || readOption(args, '-a') || positional[1];
  if (!id || !actionRaw) {
    console.log('Usage: zavorth approval decide <id> --action approve|deny|defer [--by <who>] [--reason <text>]');
    return 1;
  }

  const cards = loadDemoCards();
  const idx = cards.findIndex((c) => c.id === id || c.leaseId === id || c.approvalId === id);
  if (idx < 0) {
    console.log(`Card not found: ${id}`);
    console.log('Tip: zavorth approval seed-demo');
    return 1;
  }

  const withProof = !hasFlag(args, '--no-proof');
  const ledger = withProof
    ? new ProofLedgerService({ jsonlPath: defaultProofLedgerJsonlPath() })
    : null;
  const service = createService({
    emitProof: withProof,
    proofLedger: ledger,
  });

  const decidedBy = readOption(args, '--by') || readOption(args, '--decided-by') || 'cli-operator';
  const reason = readOption(args, '--reason');

  try {
    const updated = service.recordDecision(
      cards[idx],
      {
        action: actionRaw as ApprovalDecisionAction,
        decidedBy,
        reason,
      },
      {
        proofLedger: ledger,
        emitProof: withProof,
        surface: 'cli',
        source: 'approval-presentation-cli',
      },
    );
    cards[idx] = updated;
    saveDemoCards(cards);

    if (json) {
      console.log(JSON.stringify({ card: updated, proofEventId: updated.proofEventId }, null, 2));
      return 0;
    }

    console.log(`Decision recorded: ${updated.decision.action}`);
    printCardLine(updated);
    if (updated.proofEventId) {
      console.log(`Proof event: ${updated.proofEventId}`);
      console.log('Next: zavorth proof list --kind approval');
    }
    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`Failed to record decision: ${message}`);
    return 1;
  }
}

function runSeedDemo(args: string[], json: boolean): number {
  const withProof = hasFlag(args, '--with-proof') || hasFlag(args, '--proof');
  const cards = createApprovalPresentationDemoCards();
  saveDemoCards(cards);

  let proofCount = 0;
  if (withProof) {
    const ledger = new ProofLedgerService({ jsonlPath: defaultProofLedgerJsonlPath() });
    const service = createService({ proofLedger: ledger, emitProof: true });
    // Seed one decided demo with proof for the open card
    const open = cards.find((c) => c.id === 'card-demo-open');
    if (open) {
      const decided = service.recordDecision(
        open,
        { action: 'approve', decidedBy: 'demo-seeder', reason: 'seed-demo with proof' },
        { proofLedger: ledger, emitProof: true, surface: 'cli', source: 'approval-seed-demo' },
      );
      const idx = cards.findIndex((c) => c.id === open.id);
      if (idx >= 0) cards[idx] = decided;
      saveDemoCards(cards);
      proofCount = decided.proofEventId ? 1 : 0;
    }
  }

  if (json) {
    console.log(JSON.stringify({
      seeded: cards.length,
      cards,
      proofEvents: proofCount,
      path: demoStorePath(),
    }, null, 2));
    return 0;
  }

  console.log(`Seeded ${cards.length} demo approval card(s).`);
  console.log(`Store: ${demoStorePath()}`);
  if (withProof) {
    console.log(`Proof events appended: ${proofCount}`);
    console.log(`Ledger: ${defaultProofLedgerJsonlPath()}`);
  }
  for (const card of cards) {
    printCardLine(card);
  }
  console.log('');
  console.log('Next: zavorth approval list --open');
  return 0;
}

function runFormatLease(args: string[], json: boolean): number {
  const risk = readOption(args, '--risk') || 'medium';
  const expires = readOption(args, '--expires')
    || new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const tool = readOption(args, '--tool') || 'fs.write';
  const opsRaw = readOption(args, '--ops') || 'write,create';

  const lease: ApprovalLeaseLike = {
    leaseId: 'lease-format-sample',
    subjectId: 'user-sample',
    workspaceId: 'ws-sample',
    channelId: 'cli',
    toolQualifiedName: tool,
    riskClassAtGrant: risk,
    allowedOperations: opsRaw.split(',').map((s) => s.trim()).filter(Boolean),
    expiresAt: expires,
    grantReason: 'format-lease sample',
  };

  const expiry = formatLeaseExpiry(expires);
  const effects = buildEffectsSummaryFromLease(lease);
  const proofRisk = mapLeaseRiskToProofRisk(risk);
  const service = createService();
  const card = service.fromLease(lease, { surface: 'cli', id: 'card-format-sample' });

  const payload = {
    riskLabel: formatRiskLabel(risk),
    proofRisk,
    scopeLine: formatScopeLine(card.scope),
    expiry,
    effects,
    card,
  };

  if (json) {
    console.log(JSON.stringify(payload, null, 2));
    return 0;
  }

  console.log('Lease format sample');
  console.log(`  risk: ${payload.riskLabel} (proof=${proofRisk})`);
  console.log(`  scope: ${payload.scopeLine}`);
  console.log(`  expiry: ${expiry.label} (expired=${expiry.expired})`);
  console.log('  effects:');
  for (const line of effects) {
    console.log(`    - ${line}`);
  }
  console.log(`  card id: ${card.id} stage=${card.stage}`);
  return 0;
}
