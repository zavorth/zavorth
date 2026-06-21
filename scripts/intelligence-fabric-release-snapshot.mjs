#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const writeDoc = process.argv.includes('--write-doc');
const generatedAt = '2026-05-08T14:00:00.000Z';
const docPath = path.join(root, 'docs', '471-zavorth-intelligence-fabric-default-release-snapshot-private.md');
const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');

const gates = [
  runGate({
    id: 'dynamic-acceptance',
    command: [process.execPath, tsxCli, 'scripts/intelligence-fabric-gate.ts', '--json'],
    summary: 'Classification, Risk Gate, Capability Hub, learning, and redacted secrets.',
  }),
  runGate({
    id: 'surface-default',
    command: [process.execPath, tsxCli, 'scripts/intelligence-fabric-surface-default-gate.ts', '--json'],
    summary: 'Canonical surfaces inherit the Fabric default through the gateway.',
  }),
  runGate({
    id: 'promotion-matrix',
    command: [process.execPath, tsxCli, 'scripts/intelligence-fabric-promotion-gate.ts', '--json'],
    summary: 'Risk 0-5 matrix, trust modes, surfaces, and no-live-action invariants.',
  }),
];

const failed = gates.filter((gate) => gate.status !== 'passed');
const snapshot = {
  contractVersion: 'zavorth-intelligence-fabric-default-release/v1',
  generatedAt,
  status: failed.length > 0 ? 'blocked' : 'ready',
  release: {
    name: 'Zavorth Intelligence Fabric Default',
    stage: 7,
    mode: 'default',
    defaultTrustModeForLocalOwner: 'local_owner',
    fallbackMode: 'current-runtime',
    rollbackInstruction: 'Set request metadata intelligenceFabricMode=disabled or runtime intelligenceFabricMode=disabled.',
  },
  phases: [
    { id: 1, status: 'done', summary: 'Surface entrypoints inherit Fabric default through the canonical gateway.' },
    { id: 2, status: 'done', summary: 'Trust mode policy defaults local owners without weakening remote/API surfaces.' },
    { id: 3, status: 'done', summary: 'Risk 0-2 model/context orientation includes fallback reason and latency metrics.' },
    { id: 4, status: 'done', summary: 'Risk 3 draft guidance exposes Mutation Plane observability before apply.' },
    { id: 5, status: 'done', summary: 'ZavorthControl/Run Observatory show draft plan, approval reason and no-live-impact state.' },
    { id: 6, status: 'done', summary: 'Promotion gate validates Risk 0-5, surfaces, trust modes and no live execution for risky impact.' },
    { id: 7, status: failed.length > 0 ? 'blocked' : 'done', summary: 'Release snapshot and rollback runbook are materialized.' },
  ],
  gates,
  invariants: {
    thinkingDoesNotRequireApproval: true,
    planningDoesNotRequireApproval: true,
    simulationDoesNotRequireApproval: true,
    risk3DraftDoesNotApplyLive: true,
    risk4RequiresSandboxOrApproval: true,
    risk5RequiresExplicitApproval: true,
    unknownCapabilityDraftOnly: true,
    currentRuntimeFallbackRetained: true,
  },
  rollback: {
    immediate: 'metadata.intelligenceFabricMode = disabled',
    runtime: 'AgentRunService runtime.intelligenceFabricMode = disabled',
    expectedEffect: 'Fabric records disabled metadata and current runtime continues handling the run.',
    destructive: false,
  },
};

if (writeDoc) {
  fs.writeFileSync(docPath, renderMarkdown(snapshot), 'utf8');
}

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(`[intelligence-fabric-release] ${snapshot.status} ${snapshot.release.name}`);
  for (const gate of gates) {
    console.log(`[intelligence-fabric-release] ${gate.status === 'passed' ? 'ok' : 'fail'} ${gate.id}: ${gate.summary}`);
    for (const detail of gate.details.slice(0, 10)) {
      console.log(`  - ${detail}`);
    }
  }
  if (writeDoc) {
    console.log(`[intelligence-fabric-release] wrote ${path.relative(root, docPath)}`);
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function runGate(input) {
  const result = spawnSync(input.command[0], input.command.slice(1), {
    cwd: root,
    encoding: 'utf8',
  });
  const parsed = parseJson(result.stdout);
  const status = result.status === 0 && (parsed?.status === 'passed' || parsed?.status === 'ready')
    ? 'passed'
    : 'failed';
  return {
    id: input.id,
    status,
    exitCode: result.status,
    summary: input.summary,
    observedStatus: parsed?.status || 'unknown',
    observedSummary: parsed?.summary || null,
    details: status === 'passed' ? [] : [
      result.error ? String(result.error.message || result.error) : '',
      result.stdout,
      result.stderr,
    ].filter(Boolean).join('\n').split(/\r?\n/).slice(0, 20),
  };
}

function parseJson(value) {
  try {
    return JSON.parse(String(value || '').trim());
  } catch {
    return null;
  }
}

function renderMarkdown(snapshot) {
  const gateRows = snapshot.gates
    .map((gate) => `| ${gate.id} | ${gate.status} | ${gate.summary} |`)
    .join('\n');
  const phaseRows = snapshot.phases
    .map((phase) => `| ${phase.id} | ${phase.status} | ${phase.summary} |`)
    .join('\n');
  return [
    '# Zavorth Intelligence Fabric Default Release Snapshot',
    '',
    `> Generated at: ${snapshot.generatedAt}`,
    `> Status: ${snapshot.status}`,
    '',
    '## Summary',
    '',
    'Intelligence Fabric is promoted as a thin default orchestrator above the current runtime. It does not replace the executor, remove fallback, or apply live impact by itself.',
    '',
    'Operational phrase: Zavorth does not ask permission to think; it asks permission to cause impact.',
    '',
    '## Phases',
    '',
    '| Phase | Status | Result |',
    '|---|---|---|',
    phaseRows,
    '',
    '## Gates',
    '',
    '| Gate | Status | Coverage |',
    '|---|---|---|',
    gateRows,
    '',
    '## Invariants',
    '',
    '- Risk 0-2: thinking, reading, planning, drafts, and simulation stay approval-free.',
    '- Risk 3: creates draft/Mutation Plane/preview; apply requires an explicit request and policy.',
    '- Risk 4: shell/install/network require sandbox or approval.',
    '- Risk 5: secrets/deploy/delete/external send require explicit approval.',
    '- Unknown capability becomes a disabled draft, never live activation.',
    '- Current runtime fallback remains available.',
    '',
    '## Rollback',
    '',
    '- Per request: `metadata.intelligenceFabricMode = "disabled"`.',
    '- Per runtime: `intelligenceFabricMode: "disabled"` in `AgentRunService`.',
    '- Expected effect: Fabric records disabled metadata and the current runtime continues running.',
    '',
    '## Decision',
    '',
    snapshot.status === 'ready'
      ? 'Ready to keep as default, with immediate rollback and green gates.'
      : 'Blocked: one or more gates failed; do not promote without fixing.',
    '',
  ].join('\n');
}
