#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const live = process.argv.includes('--live');
const asJson = process.argv.includes('--json');

function run(label, args, opts = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
    windowsHide: true,
    ...opts,
  });
  return {
    id: label,
    status: result.status === 0 ? 'pass' : 'fail',
    exitCode: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    kind: opts.kind || 'unit',
  };
}

const tsx = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const steps = [];

steps.push(run('agent-smartness-hermetic-unit', [
  tsx,
  path.join(root, 'scripts', 'agent-smartness-run.ts'),
  '--check',
], { kind: 'hermetic-unit' }));

if (live) {
  steps.push(run('agent-smartness-live-probe', [
    tsx,
    path.join(root, 'scripts', 'agent-smartness-live-run.ts'),
    '--check',
    '--live',
  ], { kind: 'live' }));
} else {
  steps.push({
    id: 'agent-smartness-live-probe',
    status: 'skipped',
    exitCode: 0,
    stdout: 'skipped (no --live); hermetic unit only',
    stderr: '',
    kind: 'live',
  });
}

steps.push(run('daily-product-experience', [
  path.join(root, 'scripts', 'zavorth-daily-product-experience-check.mjs'),
], { kind: 'product-projection' }));

steps.push(run('memory-drafts', [
  tsx,
  path.join(root, 'scripts', 'memory-drafts-run.ts'),
  '--check',
], { kind: 'integration-unit' }));

steps.push(run('killer-missions-catalog', [
  tsx,
  path.join(root, 'scripts', 'killer-missions-run.ts'),
  '--check',
], { kind: 'catalog' }));

steps.push(run('continuity-model', [
  tsx,
  path.join(root, 'scripts', 'continuity-return-run.ts'),
  '--check',
], { kind: 'unit' }));

steps.push(run('ttfu-structural', [
  tsx,
  path.join(root, 'scripts', 'value-ttfu-run.ts'),
  '--check',
], { kind: 'unit' }));

steps.push(run('code-daily-loop', [
  tsx,
  path.join(root, 'scripts', 'code-daily-loop-run.ts'),
  '--check',
], { kind: 'unit' }));

steps.push(run('launch-signing-structural', [
  path.join(root, 'scripts', 'ops-signing-readiness.mjs'),
], { kind: 'ops-structural' }));

const requiredFiles = [
  'docs/product/HOW-TO-TEST-VALUE.md',
  'docs/product/demo-scripts.md',
  'apps/zavorth-desktop/src/components/ContinuityBanner.tsx',
  'src/services/MemoryDraftStoreService.ts',
  'src/services/KillerMissionCatalogService.ts',
  'src/services/agent-smartness/LiveUserProviderHarness.ts',
  'src/services/agent-smartness/TimeToFirstUsefulWorkService.ts',
  'src/services/CapabilityAutopilotSelection.ts',
  'src/services/KillerMissionExecuteService.ts',
  'src/services/ZavorthCodeDailyLoopService.ts',
  'scripts/launch-ready-check.mjs',
  'scripts/launch-live-cells-record.mjs',
  'docs/product/launch-readiness.md',
  'docs/product/certified-live-matrix.md',
];
const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
steps.push({
  id: 'required-files',
  status: missing.length === 0 ? 'pass' : 'fail',
  exitCode: missing.length === 0 ? 0 : 1,
  stdout: missing.length === 0 ? 'all present' : missing.join(', '),
  stderr: '',
  kind: 'files',
});

const failed = steps.filter((step) => step.status === 'fail');
const report = {
  generatedAt: new Date().toISOString(),
  live,
  claimsLiveIntelligence: false,
  ok: failed.length === 0,
  passed: steps.filter((step) => step.status === 'pass').length,
  skipped: steps.filter((step) => step.status === 'skipped').length,
  failed: failed.length,
  steps: steps.map((step) => ({
    id: step.id,
    kind: step.kind,
    status: step.status,
    exitCode: step.exitCode,
    notes: (step.stdout || step.stderr || '').split(/\r...\n/).slice(0, 8).join(' | '),
  })),
};

if (asJson) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  process.stdout.write('Zavorth value test suite (honest kinds)\n');
  for (const step of report.steps) {
    process.stdout.write(`[${step.status}] (${step.kind}) ${step.id}${step.notes ? ` — ${step.notes.slice(0, 140)}` : ''}\n`);
  }
  process.stdout.write(`\nclaimsLiveIntelligence: false\n`);
  process.stdout.write(`${report.ok ? 'OK' : 'FAILED'} pass=${report.passed} skip=${report.skipped} fail=${report.failed}\n`);
}

process.exit(report.ok ? 0 : 1);
