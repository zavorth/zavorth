/**
 * CLI: zavorth learn-skill <source>
 *
 * Skill-first learn UX on top of the Universal Capability Fabric.
 * Preview by default; apply requires --consent / --approval-id.
 */

import path from 'node:path';
import { ZavorthLearnSkillService } from '../services/ZavorthLearnSkillService.js';
import {
  AbsorbRiskReportService,
  redactSecretLikeText,
  resolveAbsorbProofAction,
} from '../services/capability/AbsorbRiskReportService.js';
import { ProofLedgerService, defaultProofLedgerJsonlPath } from '../services/proof/ProofLedgerService.js';

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
  console.log(
    [
      '=== Zavorth Learn Skill ===',
      '',
      'Create a governed skill from a URL, local path, archive, or pasted notes.',
      'Pipeline: stage → quarantine preview → consent → install (fabric absorb, skill-only).',
      '',
      'Usage:',
      '  zavorth learn-skill <source> [--preview] [--apply --consent] [--json]',
      '  zavorth learn-skill <url> --confirm-live-network',
      '  zavorth skill-learn <source> ...',
      '',
      'Notes:',
      '  - preview is default (safe)',
      '  - --apply requires --consent / --yes or --approval-id',
      '  - --confirm-live-network enables SourceSearchFetch content extract for http(s)',
      '  - fabric still stages remote skills via governed scrape even without extract',
      '  - this is governed skill import; `zavorth learn` = skill drafts; `zavorth learning` = candidates',
      '',
      'Examples:',
      '  zavorth learn-skill ./packs/my-skill',
      '  zavorth learn-skill https://example.com/guide --confirm-live-network',
      '  zavorth learn-skill "Notes about our release checklist" --apply --consent',
    ].join('\n'),
  );
}

export async function runLearnSkillCli(rawArgs: string[] = []): Promise<number> {
  if (rawArgs.length === 0 || rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printHelp();
    return rawArgs.length === 0 ? 1 : 0;
  }

  const args = [...rawArgs];
  const positional = args.filter((a) => !a.startsWith('--'));
  const source = positional.join(' ').trim() || positional[0];
  if (!source) {
    printHelp();
    return 1;
  }

  const apply = hasFlag(args, '--apply');
  const consent = hasFlag(args, '--consent') || hasFlag(args, '--yes');
  const approvalId = readOption(args, '--approval-id');
  const json = hasFlag(args, '--json');
  const confirmLiveNetwork = hasFlag(args, '--confirm-live-network');
  const allowExecutable = hasFlag(args, '--allow-executable');
  const allowAll = hasFlag(args, '--allow-all');
  const overwrite = hasFlag(args, '--overwrite');
  const skipProof = hasFlag(args, '--no-proof');

  if (apply && !consent && !approvalId) {
    console.log('Apply requires --consent/--yes or --approval-id. Showing preview instead.\n');
  }

  const service = new ZavorthLearnSkillService({ projectRoot: process.cwd() });
  const snapshot = await service.learn({
    source,
    apply: apply && (consent || Boolean(approvalId)),
    consent: consent || Boolean(approvalId),
    approvalId,
    confirmLiveNetwork,
    allowExecutable: allowExecutable || allowAll,
    allowAllCandidates: allowAll,
    overwrite,
    label: path.basename(source.split(/\s+/)[0] || 'learn-skill'),
  });

  const riskService = new AbsorbRiskReportService();
  const riskReport = riskService.fromFabricSnapshot(snapshot.fabric);
  const proofAction = resolveAbsorbProofAction({
    apply: snapshot.applyRequested,
    consent: snapshot.consentGranted,
    status: snapshot.fabric.status,
    receipts: snapshot.fabric.receipts,
  });

  if (!skipProof) {
    try {
      const ledger = new ProofLedgerService({
        jsonlPath: defaultProofLedgerJsonlPath(),
      });
      ledger.append(riskService.toProofEventInput(riskReport, proofAction));
    } catch {
      // best-effort
    }
  }

  if (json) {
    console.log(JSON.stringify({ snapshot, riskReport, proofAction }, null, 2));
    return snapshot.status === 'blocked' ? 1 : 0;
  }

  console.log(snapshot.narrative.headline);
  console.log(snapshot.narrative.operatorSummary);
  console.log(`Status: ${snapshot.status}`);
  console.log(`Source kind: ${snapshot.sourceKind}`);
  console.log(
    `Extract: ${snapshot.extract.performed ? `${snapshot.extract.contentChars} chars` : snapshot.extract.reason}`,
  );
  console.log(`Quarantine: ${snapshot.fabric.quarantineRoot}`);
  console.log('');
  console.log('Candidates:');
  for (const c of snapshot.fabric.candidates) {
    console.log(
      `  - [${c.kind}/${c.risk}] ${c.name} · ${c.trustState}${c.executableCodeDetected ? ' · executable' : ''}`,
    );
  }
  if (snapshot.fabric.issues.length) {
    console.log('');
    console.log('Issues:');
    for (const issue of snapshot.fabric.issues.slice(0, 20)) {
      console.log(`  [${issue.severity}] ${issue.code}: ${redactSecretLikeText(String(issue.message || ''))}`);
    }
  }
  if (snapshot.fabric.receipts.length) {
    console.log('');
    console.log('Receipts:');
    for (const r of snapshot.fabric.receipts.slice(0, 20)) {
      console.log(`  - ${r.kind}/${r.status}: ${r.summary}`);
    }
  }
  console.log('');
  console.log(`Next: ${snapshot.narrative.nextStep}`);
  console.log(`Preview: ${snapshot.commands.preview}`);
  if (snapshot.status === 'preview' || snapshot.status === 'approval-required') {
    console.log(`Apply:   ${snapshot.commands.apply}`);
  }

  return snapshot.status === 'blocked' ? 1 : 0;
}
