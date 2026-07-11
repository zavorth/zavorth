#!/usr/bin/env node
/**
 * Q4 + Q5 — Golden UX gates (automated stand-ins for manual Desktop/Control loops).
 *
 * Q4: Desktop vitest goldenTrustLoop.q4 (+ home/proof/next-action units)
 * Q5: Jest GoldenControlProofOs.q5 (+ ProofOsModel)
 * Also re-runs hermetic product golden-path for spine confidence.
 *
 * Exit non-zero on any failure. No live Electron/browser required.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const desktopRoot = path.join(root, 'apps', 'zavorth-desktop');

const steps = [];
const startedAt = Date.now();

function record(name, ok, detail, durationMs) {
  steps.push({ name, ok, detail, durationMs });
  console.log(`${ok ? '[pass]' : '[fail]'} ${name}${detail ? ` — ${detail}` : ''} (${durationMs}ms)`);
}

function run(command, args, opts = {}) {
  return spawnSync(command, args, {
    cwd: opts.cwd || root,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', CI: process.env.CI || '1' },
    maxBuffer: 40 * 1024 * 1024,
    shell: opts.shell === true,
    timeout: opts.timeoutMs ?? 300_000,
    windowsHide: true,
  });
}

function runNpx(npxArgs, opts = {}) {
  if (process.platform === 'win32') {
    return run('cmd.exe', ['/d', '/s', '/c', 'npx', ...npxArgs], opts);
  }
  return run('npx', npxArgs, opts);
}

// Q4 — Desktop golden UX unit loop
{
  const t0 = Date.now();
  const result = runNpx(
    [
      'vitest',
      'run',
      'tests/goldenTrustLoop.q4.test.ts',
      'tests/homeTrustModel.test.ts',
      'tests/proofStrip.test.ts',
      'tests/nextActionBanner.test.ts',
      'tests/trustShip.test.ts',
      'tests/qualityBar.test.ts',
    ],
    { cwd: desktopRoot, timeoutMs: 180_000 },
  );
  const ok = result.status === 0;
  record(
    'q4-desktop-golden-ux',
    ok,
    ok ? 'Desktop trust loop vitest suites' : (result.stderr || result.stdout || 'vitest failed').slice(0, 400),
    Date.now() - t0,
  );
}

// Q5 — Control Proof OS panel + risk chip
{
  const t0 = Date.now();
  const result = runNpx(
    [
      'jest',
      'tests/control/GoldenControlProofOs.q5.test.ts',
      'tests/control/ProofOsModel.test.ts',
      'tests/control/ProofOsUi.xss.test.ts',
      '--runInBand',
      '--no-coverage',
    ],
    { timeoutMs: 180_000 },
  );
  const ok = result.status === 0;
  record(
    'q5-control-proof-os',
    ok,
    ok ? 'Control Proof OS + risk chip + XSS' : (result.stderr || result.stdout || 'jest failed').slice(0, 400),
    Date.now() - t0,
  );
}

// Spine — product golden path
{
  const t0 = Date.now();
  const result = run(process.execPath, [path.join(root, 'scripts', 'zavorth-golden-path.mjs')], {
    timeoutMs: 300_000,
  });
  const ok = result.status === 0;
  record(
    'golden-path-spine',
    ok,
    ok ? 'hermetic Proof OS spine' : (result.stderr || result.stdout || 'golden-path failed').slice(0, 400),
    Date.now() - t0,
  );
}

const failed = steps.filter((s) => !s.ok);
const summary = {
  status: failed.length ? 'FAIL' : 'PASS',
  durationMs: Date.now() - startedAt,
  steps,
  q4: 'Desktop chat→approval→receipt→memory forget (automated models + vitest)',
  q5: 'Control proof panel + risk chip + honesty (jest + HTML render)',
};

console.log('\n=== Q4/Q5 golden UX summary ===');
console.log(`status: ${summary.status}`);
console.log(`durationMs: ${summary.durationMs}`);
for (const s of steps) {
  console.log(`- ${s.ok ? 'pass' : 'fail'}: ${s.name} (${s.durationMs}ms)`);
}

try {
  const outDir = path.join(root, '.zavorth');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'q4-q5-golden-ux-last.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log('[info] wrote .zavorth/q4-q5-golden-ux-last.json');
} catch {
  // best-effort
}

if (failed.length) {
  console.error(`\n[fail] Q4/Q5 golden UX — ${failed.length} step(s) failed`);
  process.exit(1);
}
console.log('\n[pass] Q4/Q5 golden UX complete');
process.exit(0);
