/**
 * Unified CLI for the Universal Capability Fabric.
 *
 * Single entry point for absorbing capabilities AND importing workspaces:
 *
 *   zavorth absorb <source>                    — auto-detects source type
 *   zavorth absorb <path-to-skill-pack>        — installs skill/plugin/MCP pack
 *   zavorth absorb <path-to-agent-workspace>   — imports workspace from another agent
 *   zavorth absorb --auto                      — scans common locations for agent workspaces
 */

import fs from 'node:fs';
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

// Brand-agnostic: only structural markers common to agent workspaces
const AGENT_WORKSPACE_MARKERS = [
  'SOUL.md', 'AGENTS.md', 'IDENTITY.md', 'USER.md',
  'config.yaml', 'RULES.md', 'MEMORY.md', 'TOOLS.md',
];

function looksLikeAgentWorkspace(sourcePath: string): boolean {
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isDirectory()) return false;
  try {
    const entries = fs.readdirSync(sourcePath, { withFileTypes: true });
    const names = entries.map((e) => e.name);
    return AGENT_WORKSPACE_MARKERS.some((marker) => names.includes(marker));
  } catch {
    return false;
  }
}

function printHelp(): void {
  console.log([
    '=== Zavorth Capability Fabric ===',
    '',
    'Absorb capabilities or import workspaces — one command, auto-detected source type.',
    '',
    'Source types (auto-detected):',
    '  Capability pack  — skill, plugin, or MCP from a directory, archive, or HTTPS URL',
    '  Agent workspace  — another agent\'s home directory (skills, memory, config)',
    '',
    'Usage:',
    '  zavorth absorb <source>                          — auto-detect and process',
    '  zavorth absorb <source> --kind skill|plugin|mcp  — force capability pack mode',
    '  zavorth absorb <source> --workspace              — force workspace import mode',
    '  zavorth absorb --auto                            — scan common locations for workspaces',
    '',
    'Options:',
    '  [--preview] [--apply] [--consent/--yes]         — install control',
    '  [--json]                                        — JSON output',
    '  [--no-proof]                                    — skip Trust Loop receipt',
    '  [--overwrite]                                   — overwrite existing',
    '  [--allow-executable] [--allow-all]              — elevate risk gates',
    '  [--auto]                                        — auto-detect workspace location',
    '',
    'Rules:',
    '  - preview is default (safe install preview + risk report)',
    '  - apply requires --consent / --yes',
    '  - workspace import is brand-agnostic (detects structure, not product names)',
    '  - Trust Loop events are written for preview / promote / reject',
    '',
    'Examples:',
    '  zavorth absorb ./my-skill                       — detect as capability pack',
    '  zavorth absorb https://example.com/skill-page   — detect from URL',
    '  zavorth absorb ~/.config/my-agent               — detect as agent workspace',
    '  zavorth absorb ./old-agent-home --workspace     — force workspace mode',
    '  zavorth absorb --auto                           — scan for agent workspaces',
  ].join('\n'));
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

function appendMigrationProofEvent(
  migration: WorkspaceMigrationProfileService,
  report: ReturnType<WorkspaceMigrationProfileService['buildReport']>,
): void {
  try {
    const ledger = new ProofLedgerService({
      jsonlPath: defaultProofLedgerJsonlPath(),
    });
    ledger.append(migration.toProofEventInput(report));
  } catch {
    // Proof append is best-effort
  }
}

export async function runCapabilityFabricCli(rawArgs: string[] = []): Promise<number> {
  if (rawArgs.length === 0 || rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printHelp();
    return rawArgs.length === 0 ? 1 : 0;
  }

  const args = [...rawArgs];
  const apply = hasFlag(args, '--apply');
  const consent = hasFlag(args, '--consent') || hasFlag(args, '--yes');
  const json = hasFlag(args, '--json');
  const overwrite = hasFlag(args, '--overwrite');
  const skipProof = hasFlag(args, '--no-proof');
  const forceWorkspace = hasFlag(args, '--workspace');
  const autoDetect = hasFlag(args, '--auto');
  const includeSecretLike = hasFlag(args, '--include-secret-like');

  // Kind detection (for capability packs)
  let kind: CapabilityFabricKind | 'auto' = 'auto';
  const maybeKind = String(args.filter((a) => !a.startsWith('--'))[0] || '').toLowerCase();
  if (['skill', 'plugin', 'mcp', 'auto'].includes(maybeKind) && !forceWorkspace) {
    kind = maybeKind as CapabilityFabricKind | 'auto';
  }
  const kindOpt = readOption(args, '--kind');
  if (kindOpt && ['skill', 'plugin', 'mcp', 'auto'].includes(kindOpt)) {
    kind = kindOpt as CapabilityFabricKind | 'auto';
  }

  if (apply && !consent) {
    console.log('Apply requires --consent (or --yes). Showing preview instead.\n');
  }

  const projectRoot = process.cwd();

  // ── Auto-detect workspace location ──
  let sourcePath: string | undefined;
  const positional = args.filter((a) => !a.startsWith('--'));

  // If --auto or no positional source, try auto-detection
  if (autoDetect || positional.length === 0) {
    const importer = new UniversalWorkspaceImportService({ projectRoot });
    const detected = importer.detectFromHomeHints();
    if (detected) {
      sourcePath = detected.path;
      console.log(`Auto-detected workspace: ${sourcePath}`);
    } else if (positional.length === 0) {
      console.log('No source specified and no agent workspace found in common locations.');
      printHelp();
      return 1;
    }
  }

  if (!sourcePath) {
    sourcePath = positional[0];
  }

  if (!sourcePath) {
    printHelp();
    return 1;
  }

  // ── Determine mode: workspace import vs capability pack ──
  const isWorkspaceMode = forceWorkspace || looksLikeAgentWorkspace(sourcePath);

  if (isWorkspaceMode) {
    return runWorkspaceImport({
      sourcePath,
      apply,
      consent,
      json,
      skipProof,
      overwrite,
      includeSecretLike,
      projectRoot,
    });
  }

  // ── Capability pack mode (existing behavior) ──
  const allowExecutable = hasFlag(args, '--allow-executable');
  const allowAll = hasFlag(args, '--allow-all');

  const fabric = new UniversalCapabilityFabricService({ projectRoot });
  const snapshot = await fabric.buildSnapshot({
    source: sourcePath,
    kind,
    apply: apply && consent,
    allowExecutable: allowExecutable || allowAll,
    allowAllCandidates: allowAll,
    overwrite,
    label: path.basename(sourcePath),
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
    console.log(JSON.stringify({ snapshot, riskReport, proofAction }, null, 2));
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

  console.log('');
  printRiskReportSection(riskService.toMarkdown(riskReport));
  console.log('');
  console.log(`Next: ${snapshot.narrative.nextSafeAction}`);
  return snapshot.status === 'blocked' ? 1 : 0;
}

// ── Legacy alias: import-workspace routes here ──
export { runCapabilityFabricCli as runImportWorkspaceCli };

// ── Workspace import (internal) ──

function runWorkspaceImport(opts: {
  sourcePath: string;
  apply: boolean;
  consent: boolean;
  json: boolean;
  skipProof: boolean;
  overwrite: boolean;
  includeSecretLike: boolean;
  projectRoot: string;
}): number {
  const { sourcePath, apply, consent, json, skipProof, overwrite, includeSecretLike, projectRoot } = opts;
  const importer = new UniversalWorkspaceImportService({ projectRoot });
  const migration = new WorkspaceMigrationProfileService({ projectRoot });

  if (apply && !consent) {
    console.log('Apply requires --consent. Running preview.\n');
  }

  const migrationReport = migration.buildReport({
    sourcePath,
    profile: 'auto',
    includeSecretLike,
  });

  if (!skipProof) {
    appendMigrationProofEvent(migration, migrationReport);
  }

  const snapshot = importer.buildSnapshot({
    sourcePath,
    apply: apply && consent,
    consent,
    includeSecretLike,
    overwrite,
  });

  if (json) {
    console.log(JSON.stringify({ migrationReport, structuralImport: snapshot }, null, 2));
    return snapshot.status === 'blocked' ? 1 : 0;
  }

  console.log('=== Workspace migration report ===');
  console.log(migration.toMarkdown(migrationReport));
  console.log('');
  console.log('=== Structural import ===');
  console.log(snapshot.narrative.headline);
  console.log(snapshot.narrative.operatorSummary);
  console.log(`Detected: ${migrationReport.detectedProfileId} (${Math.round(migrationReport.confidence * 100)}% confidence)`);
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

function printRiskReportSection(markdown: string): void {
  console.log(markdown);
}
