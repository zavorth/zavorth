/**
 * CLI for the Universal Capability Fabric.
 *
 *   zavorth absorb <source> [--kind skill|plugin|mcp|auto] [--apply] [--consent]
 *   zavorth absorb skill <source>
 *   zavorth absorb plugin <source>
 *   zavorth absorb mcp <source>
 *   zavorth import-workspace <path> [--apply --consent]
 */

import path from 'node:path';
import { UniversalCapabilityFabricService } from '../services/UniversalCapabilityFabricService.js';
import { UniversalWorkspaceImportService } from '../services/UniversalWorkspaceImportService.js';
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
    'Absorb skills, plugins, or MCP packs from path / archive / HTTPS URL.',
    'Import any local workspace home by structure (brand-agnostic).',
    '',
    'Usage:',
    '  zavorth absorb <source> [--kind auto|skill|plugin|mcp] [--preview|--apply] [--consent] [--json]',
    '  zavorth absorb skill <source> ...',
    '  zavorth absorb plugin <source> ...',
    '  zavorth absorb mcp <source> ...',
    '  zavorth import-workspace <path> [--preview|--apply --consent] [--json]',
    '',
    'Rules:',
    '  - preview is default',
    '  - apply requires --consent / --yes',
    '  - executable plugins and MCP start held/disabled',
    '  - no third-party product profile is required',
    '',
    'Examples:',
    '  zavorth absorb ./packs/my-skill --preview',
    '  zavorth absorb https://example.com/skill-page --kind skill --preview',
    '  zavorth absorb plugin ./packs/my-plugin --apply --consent',
    '  zavorth import-workspace ./old-agent-home --preview',
  ].join('\n'));
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
  const consent = hasFlag(args, '--consent') || hasFlag(args, '--yes');
  const json = hasFlag(args, '--json');
  const allowExecutable = hasFlag(args, '--allow-executable');
  const allowAll = hasFlag(args, '--allow-all') || consent;
  const overwrite = hasFlag(args, '--overwrite');

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

  if (json) {
    console.log(JSON.stringify(snapshot, null, 2));
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
      console.log(`  [${issue.severity}] ${issue.code}: ${issue.message}`);
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
  console.log(`Next: ${snapshot.narrative.nextSafeAction}`);
  return snapshot.status === 'blocked' ? 1 : 0;
}

export async function runImportWorkspaceCli(rawArgs: string[] = []): Promise<number> {
  if (rawArgs.length === 0 || rawArgs.includes('--help') || rawArgs.includes('-h')) {
    console.log([
      '=== Zavorth Universal Workspace Import ===',
      '',
      '  zavorth import-workspace <path> [--preview|--apply --consent] [--json]',
      '  zavorth import-workspace --auto [--preview]',
      '',
      'Structural detection only. No product-brand profiles.',
    ].join('\n'));
    return rawArgs.length === 0 ? 1 : 0;
  }

  const apply = hasFlag(rawArgs, '--apply');
  const consent = hasFlag(rawArgs, '--consent') || hasFlag(rawArgs, '--yes');
  const json = hasFlag(rawArgs, '--json');
  const auto = hasFlag(rawArgs, '--auto');
  const positional = rawArgs.filter((a) => !a.startsWith('--'));
  const importer = new UniversalWorkspaceImportService({ projectRoot: process.cwd() });

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
    console.log('Missing path. Usage: zavorth import-workspace <path>');
    return 1;
  }

  if (apply && !consent) {
    console.log('Apply requires --consent. Running preview.\n');
  }

  const snapshot = importer.buildSnapshot({
    sourcePath,
    apply: apply && consent,
    consent: consent,
    includeSecretLike: hasFlag(rawArgs, '--include-secret-like'),
    overwrite: hasFlag(rawArgs, '--overwrite'),
  });

  if (json) {
    console.log(JSON.stringify(snapshot, null, 2));
    return snapshot.status === 'blocked' ? 1 : 0;
  }

  console.log(snapshot.narrative.headline);
  console.log(snapshot.narrative.operatorSummary);
  console.log(`Profile: ${snapshot.profileId}`);
  console.log(`Confidence: ${Math.round(snapshot.confidence * 100)}%`);
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
