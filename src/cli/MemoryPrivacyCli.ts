/**
 * Memory Privacy OS CLI (Mnemos product narrative).
 *
 *   zavorth memory-privacy
 *   zavorth memory-privacy status [--json]
 *   zavorth memory-privacy list [--json]
 *   zavorth memory-privacy explain <id>
 *   zavorth memory-privacy forget <id> [--yes]
 *   zavorth memory-privacy seed-demo
 *   zavorth memory-privacy --help
 *
 * Aliases: memory-privacy-os, privacy-memory
 */

import path from 'node:path';
import {
  MEMORY_PRIVACY_CONTRACT_VERSION,
  type MemoryPrivacyItemView,
} from '../contracts/memory/MemoryPrivacyContract.js';
import {
  MemoryPrivacyService,
  defaultMemoryPrivacyDemoPath,
} from '../services/memory/MemoryPrivacyService.js';
import {
  ProofLedgerService,
  defaultProofLedgerJsonlPath,
} from '../services/proof/ProofLedgerService.js';
import {
  paintCliBadge,
  paintCliTone,
  renderCliWordmarkStrip,
} from './ZavorthCliVisualTheme.js';

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function readOption(args: string[], name: string): string | null {
  const idx = args.indexOf(name);
  if (idx >= 0 && args[idx + 1] && !String(args[idx + 1]).startsWith('--')) {
    return args[idx + 1];
  }
  const pref = `${name}=`;
  const hit = args.find((a) => a.startsWith(pref));
  return hit ? hit.slice(pref.length) : null;
}

function printHelp(): void {
  console.log([
    `${paintCliBadge('MEMORY PRIVACY', 'brand')} ${paintCliTone('Zavorth Memory Privacy OS', 'brand')}`,
    paintCliTone('What does it remember... Why... Forget it.', 'muted'),
    paintCliTone('Product UX over Mnemos / dream / forget — does not replace the engine.', 'muted'),
    '',
    paintCliTone('Usage:', 'info'),
    '  zavorth memory-privacy',
    '  zavorth memory-privacy status [--json] [--markdown]',
    '  zavorth memory-privacy list [--json]',
    '  zavorth memory-privacy explain <id> [--json]',
    '  zavorth memory-privacy forget <id> [--yes] [--json]',
    '  zavorth memory-privacy seed-demo [--json]',
    '  zavorth memory-privacy --help',
    '',
    paintCliTone('Aliases:', 'info'),
    '  zavorth memory-privacy-os …',
    '  zavorth privacy-memory …',
    '',
    paintCliTone('Storage:', 'info'),
    `  Demo store: ${defaultMemoryPrivacyDemoPath()}`,
    '  Override with env ZAVORTH_MEMORY_PRIVACY_DEMO_PATH',
    `  Proof ledger: ${defaultProofLedgerJsonlPath()}`,
    '',
    paintCliTone('Notes:', 'info'),
    '  forget --yes records a proof event (kind=memory, title "Memory forgotten").',
    '  Demo forget marks the item forgotten in the demo store only — it does not',
    '  wipe live Mnemos product memory stores unless a host wire exists.',
    '',
    paintCliTone('Examples:', 'info'),
    '  zavorth memory-privacy seed-demo',
    '  zavorth memory-privacy list',
    '  zavorth memory-privacy explain mem-demo-pref-tabs',
    '  zavorth memory-privacy forget mem-demo-secret-flag --yes',
    `  contract: ${MEMORY_PRIVACY_CONTRACT_VERSION}`,
  ].join('\n'));
}

function resolveDemoPath(): string {
  const fromEnv = String(process.env.ZAVORTH_MEMORY_PRIVACY_DEMO_PATH || '').trim();
  if (fromEnv) return path.resolve(fromEnv);
  return defaultMemoryPrivacyDemoPath(process.cwd());
}

function resolveProofPath(): string {
  const fromEnv = String(process.env.ZAVORTH_PROOF_LEDGER_PATH || '').trim();
  if (fromEnv) return path.resolve(fromEnv);
  return defaultProofLedgerJsonlPath(process.cwd());
}

function createService(): MemoryPrivacyService {
  return new MemoryPrivacyService({
    demoStorePath: resolveDemoPath(),
  });
}

function createProofLedger(): ProofLedgerService | null {
  try {
    return new ProofLedgerService({ jsonlPath: resolveProofPath() });
  } catch {
    return null;
  }
}

function printItemLine(item: MemoryPrivacyItemView): void {
  const flags = [
    item.canForget ? 'forgettable' : 'locked',
    item.secretLike ? 'secret-like' : null,
    item.consentState,
  ].filter(Boolean).join('/');
  console.log(`  [${item.origin}] ${item.title}`);
  console.log(`    id=${item.id} · ${flags}`);
  console.log(`    why: ${item.whyIKnowThis}`);
}

export async function runMemoryPrivacyCli(rawArgs: string[] = []): Promise<number> {
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printHelp();
    return 0;
  }

  const first = String(rawArgs[0] || '').trim().toLowerCase();
  const json = hasFlag(rawArgs, '--json');
  const markdown = hasFlag(rawArgs, '--markdown') || hasFlag(rawArgs, '--md');

  if (!first || first.startsWith('--') || first === 'status' || first === 'summary') {
    return runStatus(
      rawArgs.filter((a) => {
        const t = a.toLowerCase();
        return t !== 'status' && t !== 'summary';
      }),
      json || hasFlag(rawArgs, '--json'),
      markdown || hasFlag(rawArgs, '--markdown') || hasFlag(rawArgs, '--md'),
    );
  }

  const rest = rawArgs.slice(1);

  if (first === 'list' || first === 'ls') {
    return runList(rest, json || hasFlag(rest, '--json'));
  }

  if (first === 'explain' || first === 'why' || first === 'show') {
    return runExplain(rest, json || hasFlag(rest, '--json'));
  }

  if (first === 'forget' || first === 'delete' || first === 'remove') {
    return runForget(rest, json || hasFlag(rest, '--json'));
  }

  if (first === 'seed-demo' || first === 'demo' || first === 'seed') {
    return runSeedDemo(rest, json || hasFlag(rest, '--json'));
  }

  if (first === 'help') {
    printHelp();
    return 0;
  }

  console.log(`Unknown memory-privacy subcommand: ${first}`);
  console.log('');
  printHelp();
  return 1;
}

function runStatus(args: string[], json: boolean, markdown: boolean): number {
  const service = createService();
  const snapshot = service.buildSnapshotFromDemo();

  if (json) {
    console.log(service.toJson(snapshot));
    return 0;
  }
  if (markdown) {
    console.log(service.toMarkdown(snapshot));
    return 0;
  }

  console.log(`${renderCliWordmarkStrip()} ${paintCliTone('Memory privacy', 'muted')}`);
  console.log(paintCliTone('Memory Privacy OS', 'brand'));
  console.log(`  contract: ${snapshot.contractVersion}`);
  console.log(`  demo path: ${resolveDemoPath()}`);
  console.log(`  total: ${snapshot.summary.total}`);
  console.log(`  forgettable: ${snapshot.summary.forgettable}`);
  console.log(`  reviewQueue: ${snapshot.summary.reviewQueue}`);
  console.log(`  secretLike: ${snapshot.summary.secretLike}`);
  console.log(`  next: ${snapshot.nextSafeAction}`);
  if (snapshot.items.length === 0) {
    console.log('');
    console.log('No demo memories yet. Try: zavorth memory-privacy seed-demo');
  } else {
    console.log('');
    console.log(`Items (${Math.min(5, snapshot.items.length)} of ${snapshot.items.length}):`);
    for (const item of snapshot.items.slice(0, 5)) {
      printItemLine(item);
    }
  }
  if (snapshot.dreamCandidates.length > 0) {
    console.log('');
    console.log(`Dream candidates: ${snapshot.dreamCandidates.length}`);
    for (const c of snapshot.dreamCandidates.slice(0, 5)) {
      const review = c.needsReview ? 'needs-review' : 'ok';
      console.log(`  - ${c.title} (${c.id}) ${c.lane || ''} ${review}`.replace(/\s+/g, ' ').trim());
    }
  }
  return 0;
}

function runList(args: string[], json: boolean): number {
  const service = createService();
  const snapshot = service.buildSnapshotFromDemo();

  if (json) {
    console.log(JSON.stringify({
      contractVersion: snapshot.contractVersion,
      generatedAt: snapshot.generatedAt,
      items: snapshot.items,
      dreamCandidates: snapshot.dreamCandidates,
      summary: snapshot.summary,
    }, null, 2));
    return 0;
  }

  if (snapshot.items.length === 0) {
    console.log('No memories in demo store. Try: zavorth memory-privacy seed-demo');
    return 0;
  }

  console.log(paintCliTone('Memory privacy list', 'brand'));
  console.log(`  total=${snapshot.summary.total} forgettable=${snapshot.summary.forgettable} secretLike=${snapshot.summary.secretLike}`);
  console.log('');
  for (const item of snapshot.items) {
    printItemLine(item);
  }
  if (snapshot.dreamCandidates.length > 0) {
    console.log('');
    console.log(paintCliTone('Candidates', 'info'));
    for (const c of snapshot.dreamCandidates) {
      console.log(`  ? ${c.title} · ${c.id}${c.lane ? ` · ${c.lane}` : ''}${c.needsReview ? ' · needs review' : ''}`);
    }
  }
  return 0;
}

function runExplain(args: string[], json: boolean): number {
  const positional = args.filter((a) => !a.startsWith('--'));
  const id = String(positional[0] || '').trim();
  if (!id) {
    console.log('Usage: zavorth memory-privacy explain <id>');
    return 1;
  }

  const service = createService();
  const item = service.explainFromDemo(id);
  if (!item) {
    if (json) {
      console.log(JSON.stringify({ found: false, id }, null, 2));
    } else {
      console.log(`No memory found for id=${id}`);
      console.log('Tip: zavorth memory-privacy seed-demo && zavorth memory-privacy list');
    }
    return 1;
  }

  if (json) {
    console.log(JSON.stringify(item, null, 2));
    return 0;
  }

  console.log(paintCliTone('Why I know this', 'brand'));
  console.log(`  id: ${item.id}`);
  console.log(`  title: ${item.title}`);
  console.log(`  origin: ${item.originLabel} (${item.origin})`);
  console.log(`  why: ${item.whyIKnowThis}`);
  console.log(`  summary: ${item.summary}`);
  console.log(`  consent: ${item.consentState}`);
  console.log(`  canForget: ${item.canForget ? 'yes' : 'no'}`);
  console.log(`  secretLike: ${item.secretLike ? 'yes' : 'no'}`);
  if (item.createdAt) console.log(`  createdAt: ${item.createdAt}`);
  if (item.proofEventId) console.log(`  proofEventId: ${item.proofEventId}`);
  return 0;
}

function runForget(args: string[], json: boolean): number {
  const positional = args.filter((a) => !a.startsWith('--'));
  const id = String(positional[0] || '').trim();
  if (!id) {
    console.log('Usage: zavorth memory-privacy forget <id> [--yes]');
    return 1;
  }

  const yes = hasFlag(args, '--yes') || hasFlag(args, '-y');
  const service = createService();
  const item = service.explainFromDemo(id);

  if (!item) {
    if (json) {
      console.log(JSON.stringify({ ok: false, reason: 'not_found', id }, null, 2));
    } else {
      console.log(`No memory found for id=${id}`);
    }
    return 1;
  }

  if (!item.canForget) {
    if (json) {
      console.log(JSON.stringify({
        ok: false,
        reason: 'not_forgettable',
        id,
        title: item.title,
        origin: item.origin,
      }, null, 2));
    } else {
      console.log(`Cannot forget system-critical or locked memory: ${item.title} (${item.id})`);
    }
    return 2;
  }

  if (!yes) {
    if (json) {
      console.log(JSON.stringify({
        ok: false,
        reason: 'confirmation_required',
        id,
        title: item.title,
        hint: 'Re-run with --yes to mark forgotten and append a proof event.',
      }, null, 2));
    } else {
      console.log(`About to forget: ${item.title} (${item.id})`);
      console.log(`  why: ${item.whyIKnowThis}`);
      console.log(`  secretLike: ${item.secretLike ? 'yes' : 'no'}`);
      console.log('');
      console.log('Re-run with --yes to confirm. This marks the demo store item forgotten');
      console.log('and appends a proof event. It does not wipe live Mnemos stores.');
    }
    return 3;
  }

  const decidedBy = readOption(args, '--by') || readOption(args, '--decided-by') || 'owner';
  const result = service.forgetInDemo(id, decidedBy);
  if (!result) {
    if (json) {
      console.log(JSON.stringify({ ok: false, reason: 'forget_failed', id }, null, 2));
    } else {
      console.log(`Forget failed for id=${id}`);
    }
    return 1;
  }

  let proofEventId: string | null = null;
  const ledger = createProofLedger();
  if (ledger) {
    try {
      const event = ledger.append(result.proof);
      proofEventId = event.id;
    } catch {
      proofEventId = null;
    }
  }

  if (json) {
    console.log(JSON.stringify({
      ok: true,
      forgotten: true,
      item: result.item,
      proofEventId,
      proof: result.proof,
      note: 'Demo store only; live Mnemos stores were not wiped.',
    }, null, 2));
    return 0;
  }

  console.log(paintCliTone('Memory forgotten', 'brand'));
  console.log(`  id: ${result.item.id}`);
  console.log(`  title: ${result.item.title}`);
  console.log(`  decidedBy: ${decidedBy}`);
  if (proofEventId) {
    console.log(`  proofEventId: ${proofEventId}`);
  } else {
    console.log('  proofEventId: (not recorded — ledger unavailable)');
  }
  console.log('  note: demo store only; live Mnemos product stores were not wiped.');
  return 0;
}

function runSeedDemo(args: string[], json: boolean): number {
  const service = createService();
  const store = service.seedDemo();
  const snapshot = service.buildSnapshot({ items: store.items, learning: store.learning });

  if (json) {
    console.log(JSON.stringify({
      ok: true,
      path: resolveDemoPath(),
      store,
      summary: snapshot.summary,
    }, null, 2));
    return 0;
  }

  console.log(paintCliTone('Memory privacy demo seeded', 'brand'));
  console.log(`  path: ${resolveDemoPath()}`);
  console.log(`  items: ${store.items.length}`);
  console.log(`  learning: ${store.learning.length}`);
  console.log(`  forgettable: ${snapshot.summary.forgettable}`);
  console.log(`  secretLike: ${snapshot.summary.secretLike}`);
  console.log('');
  console.log('Next: zavorth memory-privacy list');
  console.log('      zavorth memory-privacy explain mem-demo-pref-tabs');
  return 0;
}
