/**
 * CLI for the Universal Capability Fabric.
 *
 * Install capabilities safely under quarantine with a clear risk report:
 *
 *   zavorth absorb <source> [--kind skill|plugin|mcp|auto] [--apply] [--consent]
 *   zavorth absorb skill <source>
 *   zavorth absorb plugin <source>
 *   zavorth absorb mcp <source>
 *   zavorth import-workspace <path> [--profile auto|generic|openclaw-home|hermes-home] [--apply --consent]
 */

import path from 'node:path';
import { UniversalCapabilityFabricService } from '../services/UniversalCapabilityFabricService.js';
import { UniversalWorkspaceImportService } from '../services/UniversalWorkspaceImportService.js';
import {
  AbsorbRiskReportService,
  redactSecretLikeText,
  resolveAbsorbProofAction,
} from '../services/capability/AbsorbRiskReportService.js';
import { WorkspaceMigrationProfileService } from '../services/migration/WorkspaceMigrationProfileService.js';
import {
  ProofLedgerService,
  defaultProofLedgerJsonlPath,
} from '../services/proof/ProofLedgerService.js';
import type { CapabilityFabricKind } from '../contracts/UniversalCapabilityFabricContract.js';

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
    '=== Zavorth Capability Fabric ===',
    '',
    'Install capabilities safely under quarantine.',
    'Absorb skills, plugins, or MCP packs from path / archive / HTTPS URL.',
    'Preview shows a risk report (files, executable, network, permissions, secrets).',
    'Import any local workspace home by structure (brand-agnostic).',
    'Optional named migration profiles add a risk report on top of structural import.',
    '',
    'Usage:',
    '  zavorth absorb <source> [--kind auto|skill|plugin|mcp] [--preview|--apply] [--consent] [--json]',
    '  zavorth absorb skill <source> ...',
    '  zavorth absorb plugin <source> ...',
    '  zavorth absorb mcp <source> ...',
    '  zavorth import-workspace <path> [--profile auto|generic|generic-agent-home|openclaw-home|hermes-home] [--preview|--apply --consent] [--json]',
    '',
    'Rules:',
    '  - preview is default (safe install preview + risk report)',
    '  - apply requires --consent / --yes (consent does NOT elevate risk flags)',
    '  - elevated candidates need explicit --allow-executable and/or --allow-all',
    '  - executable plugins and MCP start held/disabled',
    '  - high risk / executable packs stay quarantined until trust upgrade',
    '  - no third-party product profile is required for structural import',
    '  - --profile is optional; labels are structure fingerprints only',
    '  - Trust Loop events are written for preview / promote / reject',
    '',
    'Examples:',
    '  zavorth absorb ./packs/my-skill --preview',
    '  zavorth absorb https://example.com/skill-page --kind skill --preview',
    '  zavorth absorb plugin ./packs/my-plugin --apply --consent --allow-executable',
    '  zavorth import-workspace ./old-agent-home --preview',
    '  zavorth import-workspace ./old-agent-home --profile auto --preview',
    '  zavorth import-workspace ./agent-home --profile openclaw-home --preview',
  ].join('\n'));
}

function printRiskReportSection(markdown: string): void {
  console.log('');
  console.log(markdown);
}

function appendAbsorbProofEvent(
  reportService: AbsorbRiskReportService,
  report: ReturnType<AbsorbRiskReportService['fromFabricSnapshot']>,
  action: 'preview' | 'promote' | 'reject',
): void {
  try {
    const ledger = new ProofLedgerService({
      jsonlPath: defaultProofLedgerJsonlPath(),
    });
    ledger.append(reportService.toProofEventInput(report, action));
  } catch {
    // Proof ledger is best-effort; never fail absorb UX on ledger I/O.
  }
}

export async function runCapabilityFabricCli(rawArgs: string[] = []): Promise<number> {
  if (rawArgs.length === 0 || rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printHelp();
    return rawArgs.length === 0 ? 1 : 0;
  }

  const args = [...rawArgs];
  let kind: CapabilityFabricKind | 'auto' = 'auto';
  const maybeKind = String(args[0] || '').toLowerCase();
  if (maybeKind === 'skill' || maybeKind === 'plugin' || maybeKind === 'mcp' || maybeKind === 'auto') {
    kind = maybeKind;
    args.shift();
  }
  const kindOpt = readOption(args, '--kind');
  if (kindOpt === 'skill' || kindOpt === 'plugin' || kindOpt === 'mcp' || kindOpt === 'auto') {
    kind = kindOpt;
  }

  const positional = args.filter((a) => !a.startsWith('--'));
  const source = positional[0];
  if (!source) {
    printHelp();
    return 1;
  }

  const apply = hasFlag(args, '--apply');
  // S4: consent only authorizes apply of already-allowed candidates — never elevates risk.
  const consent = hasFlag(args, '--consent') || hasFlag(args, '--yes');
  const json = hasFlag(args, '--json');
  const allowExecutable = hasFlag(args, '--allow-executable');
  const allowAll = hasFlag(args, '--allow-all');
  const overwrite = hasFlag(args, '--overwrite');
  const skipProof = hasFlag(args, '--no-proof');

  if (apply && !consent) {
    console.log('Apply requires --consent (or --yes). Showing preview instead.\n');
  }

  const fabric = new UniversalCapabilityFabricService({ projectRoot: process.cwd() });
  const snapshot = await fabric.buildSnapshot({
    source,
    kind,
    apply: apply && consent,
    allowExecutable: allowExecutable || allowAll,
    allowAllCandidates: allowAll,
    overwrite,
    label: path.basename(source),
  });

  const riskService = new AbsorbRiskReportService();
  const riskReport = riskService.fromFabricSnapshot(snapshot);
  const proofAction = resolveAbsorbProofAction({
    apply,
    consent,
    status: snapshot.status,
    receipts: snapshot.receipts,
  });

  if (!skipProof) {
    appendAbsorbProofEvent(riskService, riskReport, proofAction);
  }

  if (json) {
    console.log(
      JSON.stringify(
        {
          snapshot,
          riskReport,
          proofAction,
        },
        null,
        2,
      ),
    );
    return snapshot.status === 'blocked' ? 1 : 0;
  }

  console.log(snapshot.narrative.headline);
  console.log(snapshot.narrative.operatorSummary);
  console.log(`Status: ${snapshot.status}`);
  console.log(`Source kind: ${snapshot.source.kind}`);
  console.log(`Quarantine: ${snapshot.quarantineRoot}`);
  console.log('');
  console.log('Candidates:');
  for (const c of snapshot.candidates) {
    console.log(`  - [${c.kind}/${c.risk}] ${c.name} · ${c.trustState}${c.executableCodeDetected ? ' · executable' : ''}`);
  }
  if (snapshot.issues.length) {
    console.log('');
    console.log('Issues:');
    for (const issue of snapshot.issues.slice(0, 20)) {
      // Never echo secret-like issue bodies on the CLI (S1).
      const safeMessage = redactSecretLikeText(String(issue.message || ''));
      console.log(`  [${issue.severity}] ${issue.code}: ${safeMessage}`);
    }
  }
  if (snapshot.receipts.length) {
    console.log('');
    console.log('Receipts:');
    for (const r of snapshot.receipts.slice(0, 20)) {
      console.log(`  - ${r.kind}/${r.status}: ${r.summary}`);
    }
  }

  printRiskReportSection(riskService.toMarkdown(riskReport));

  console.log('');
  console.log(`Next: ${snapshot.narrative.nextSafeAction}`);
  return snapshot.status === 'blocked' ? 1 : 0;
}

export async function runImportWorkspaceCli(rawArgs: string[] = []): Promise<number> {
  if (rawArgs.length === 0 || rawArgs.includes('--help') || rawArgs.includes('-h')) {
    console.log([
      '=== Zavorth Universal Workspace Import ===',
      '',
      '  zavorth import-workspace <path> [--profile auto|generic|generic-agent-home|openclaw-home|hermes-home]',
      '                                [--preview|--apply --consent] [--json] [--no-proof]',
      '  zavorth import-workspace --auto [--preview]',
      '',
      'Structural import always available (brand-agnostic).',
      'Optional --profile adds a risk migration report (structure labels only).',
      'Default profile: auto. Preview is default; apply still needs --consent.',
      'Secrets are never auto-imported; reports note presence only (values redacted).',
    ].join('\n'));
    return rawArgs.length === 0 ? 1 : 0;
  }

  const apply = hasFlag(rawArgs, '--apply');
  const consent = hasFlag(rawArgs, '--consent') || hasFlag(rawArgs, '--yes');
  const json = hasFlag(rawArgs, '--json');
  const auto = hasFlag(rawArgs, '--auto');
  const noProof = hasFlag(rawArgs, '--no-proof');
  const profileOpt = readOption(rawArgs, '--profile') || 'auto';
  const positional = rawArgs.filter((a) => !a.startsWith('--'));
  const projectRoot = process.cwd();
  const importer = new UniversalWorkspaceImportService({ projectRoot });
  const migration = new WorkspaceMigrationProfileService({ projectRoot });

  let sourcePath = positional[0];
  if (!sourcePath && auto) {
    const detected = importer.detectFromHomeHints();
    if (!detected) {
      console.log('No structural agent/workspace home found in common locations.');
      return 1;
    }
    sourcePath = detected.path;
    console.log(`Auto-detected: ${sourcePath} (${detected.profileId}, ${Math.round(detected.confidence * 100)}%)`);
  }

  if (!sourcePath) {
    console.log(
      'Missing path. Usage: zavorth import-workspace <path> [--profile auto|generic|openclaw-home|hermes-home]',
    );
    return 1;
  }

  if (apply && !consent) {
    console.log('Apply requires --consent. Running preview.\n');
  }

  // Migration risk report (preview-oriented; structural snapshot underneath)
  const migrationReport = migration.buildReport({
    sourcePath,
    profile: profileOpt,
    includeSecretLike: hasFlag(rawArgs, '--include-secret-like'),
  });

  // Optional Trust Loop receipt (system/marketplace); never includes secret values
  if (!noProof) {
    try {
      const ledger = new ProofLedgerService({
        jsonlPath: defaultProofLedgerJsonlPath(projectRoot),
      });
      ledger.append(migration.toProofEventInput(migrationReport));
    } catch {
      // Proof append is best-effort; never block import
    }
  }

  const snapshot = importer.buildSnapshot({
    sourcePath,
    apply: apply && consent,
    consent: consent,
    includeSecretLike: hasFlag(rawArgs, '--include-secret-like'),
    overwrite: hasFlag(rawArgs, '--overwrite'),
  });

  if (json) {
    console.log(
      JSON.stringify(
        {
          migrationReport,
          structuralImport: snapshot,
        },
        null,
        2,
      ),
    );
    return snapshot.status === 'blocked' ? 1 : 0;
  }

  // Migration report section before structural import narrative
  console.log('=== Migration risk report ===');
  console.log(migration.toMarkdown(migrationReport));
  console.log('=== Structural import ===');
  console.log(snapshot.narrative.headline);
  console.log(snapshot.narrative.operatorSummary);
  console.log(`Structural profile: ${snapshot.profileId}`);
  console.log(
    `Migration profile: ${migrationReport.profileId} (detected ${migrationReport.detectedProfileId})`,
  );
  console.log(`Confidence: ${Math.round(migrationReport.confidence * 100)}%`);
  console.log(`Status: ${snapshot.status}`);
  console.log('');
  console.log('Items (first 40):');
  for (const item of snapshot.items.slice(0, 40)) {
    console.log(`  [${item.kind}${item.secretLike ? '/secret-like' : ''}] ${item.name} · ${item.status}`);
  }
  if (snapshot.items.length > 40) console.log(`  ... +${snapshot.items.length - 40} more`);
  if (snapshot.warnings.length) {
    console.log('');
    console.log('Warnings:');
    for (const w of snapshot.warnings) console.log(`  ${w}`);
  }
  console.log('');
  console.log(`Next: ${snapshot.narrative.nextSafeAction}`);
  return snapshot.status === 'blocked' ? 1 : 0;
}
