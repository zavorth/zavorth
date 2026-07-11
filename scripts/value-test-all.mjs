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
  };
}

const tsx = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const steps = [];

steps.push(run('agent-smartness-hermetic', [
  tsx,
  path.join(root, 'scripts', 'agent-smartness-run.ts'),
  '--check',
]));

steps.push(run('agent-smartness-live', [
  tsx,
  path.join(root, 'scripts', 'agent-smartness-live-run.ts'),
  '--check',
  ...(live ? ['--live'] : ['--allow-blocked']),
]));

steps.push(run('daily-product-experience', [
  path.join(root, 'scripts', 'zavorth-daily-product-experience-check.mjs'),
]));

steps.push(run('memory-drafts', [
  tsx,
  path.join(root, 'scripts', 'memory-drafts-run.ts'),
  '--check',
]));

steps.push(run('killer-missions', [
  tsx,
  path.join(root, 'scripts', 'killer-missions-run.ts'),
  '--check',
]));

steps.push(run('continuity', [
  tsx,
  path.join(root, 'scripts', 'continuity-return-run.ts'),
  '--check',
]));

const requiredFiles = [
  'docs/product/HOW-TO-TEST-VALUE.md',
  'docs/product/demo-scripts.md',
  'apps/zavorth-desktop/src/components/ContinuityBanner.tsx',
  'src/services/MemoryDraftStoreService.ts',
  'src/services/KillerMissionCatalogService.ts',
];
const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
steps.push({
  id: 'required-files',
  status: missing.length === 0 ? 'pass' : 'fail',
  exitCode: missing.length === 0 ? 0 : 1,
  stdout: missing.length === 0 ? 'all present' : missing.join(', '),
  stderr: '',
});

const failed = steps.filter((step) => step.status === 'fail');
const report = {
  generatedAt: new Date().toISOString(),
  live,
  ok: failed.length === 0,
  passed: steps.filter((step) => step.status === 'pass').length,
  failed: failed.length,
  steps: steps.map((step) => ({
    id: step.id,
    status: step.status,
    exitCode: step.exitCode,
    notes: (step.stdout || step.stderr || '').split(/\r?\n/).slice(0, 8).join(' | '),
  })),
};

if (asJson) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  process.stdout.write('Zavorth value test suite\n');
  for (const step of report.steps) {
    process.stdout.write(`[${step.status}] ${step.id}${step.notes ? ` — ${step.notes.slice(0, 160)}` : ''}\n`);
  }
  process.stdout.write(`\n${report.ok ? 'OK' : 'FAILED'} ${report.passed}/${steps.length}\n`);
}

process.exit(report.ok ? 0 : 1);
