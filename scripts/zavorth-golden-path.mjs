/**
 * P13 — Zavorth golden path (hermetic Trust Loop).
 *
 * Steps:
 * 1) Unit gate — critical Jest suites (runInBand)
 * 2) Service smoke — scripts/zavorth-golden-path-smoke.ts via tsx
 * 3) Report — stdout summary + best-effort .zavorth/golden-path-last.json
 *
 * No external network. Exit non-zero on any failure.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const UNIT_SUITES = [
  'tests/services/proof/ProofLedgerService.test.ts',
  'tests/services/approval/ApprovalPresentationService.test.ts',
  'tests/services/risk/RiskBudgetService.test.ts',
  'tests/services/preview/ChangePreviewPresenter.test.ts',
  'tests/services/honesty/ReadinessHonesty.test.ts',
  'tests/services/memory/MemoryPrivacyService.test.ts',
  'tests/control/TrustLoopModel.test.ts',
];

/**
 * @typedef {{ name: string, ok: boolean, detail: string, durationMs: number }} StepResult
 */

/** @type {StepResult[]} */
const steps = [];
const startedAt = Date.now();

/**
 * @param {string} name
 * @param {boolean} ok
 * @param {string} detail
 * @param {number} durationMs
 */
function record(name, ok, detail, durationMs) {
  steps.push({ name, ok, detail, durationMs });
  const tag = ok ? '[pass]' : '[fail]';
  console.log(`${tag} ${name}${detail ? ` — ${detail}` : ''}${durationMs != null ? ` (${durationMs}ms)` : ''}`);
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {{ timeoutMs?: number, shell?: boolean }} [opts]
 */
function runCommand(command, args, opts = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      NO_COLOR: '1',
      CI: process.env.CI || '1',
      // Hermetic: discourage accidental live calls in child tools
      ZAVORTH_GOLDEN_PATH: '1',
    },
    maxBuffer: 1024 * 1024 * 40,
    shell: opts.shell === true,
    timeout: opts.timeoutMs ?? 180_000,
    windowsHide: true,
  });
  return result;
}

/**
 * Spawn npx-compatible CLI on Windows and POSIX.
 * @param {string[]} npxArgs args after `npx` (e.g. ['jest', 'path', '--runInBand'])
 * @param {{ timeoutMs?: number }} [opts]
 */
function runNpx(npxArgs, opts = {}) {
  if (process.platform === 'win32') {
    const quoted = npxArgs.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ');
    return runCommand('cmd.exe', ['/d', '/s', '/c', `npx ${quoted}`], {
      ...opts,
      shell: false,
    });
  }
  return runCommand('npx', npxArgs, opts);
}

function runUnitGate() {
  const t0 = Date.now();
  const args = ['jest', ...UNIT_SUITES, '--runInBand', '--colors=false'];
  const result = runNpx(args, { timeoutMs: 150_000 });
  const durationMs = Date.now() - t0;
  const stdout = (result.stdout || '').trim();
  const stderr = (result.stderr || '').trim();
  const combined = [stdout, stderr].filter(Boolean).join('\n');

  if (result.error) {
    record('unit-gate', false, result.error.message, durationMs);
    if (combined) console.log(combined);
    return false;
  }
  if (result.status !== 0) {
    const tail = combined.split('\n').slice(-40).join('\n');
    record('unit-gate', false, `jest exit=${result.status}`, durationMs);
    if (tail) console.log(tail);
    return false;
  }

  const summaryMatch = combined.match(/Tests:\s+[^\n]+/);
  record(
    'unit-gate',
    true,
    summaryMatch ? summaryMatch[0].trim() : `${UNIT_SUITES.length} suites`,
    durationMs,
  );
  return true;
}

function runServiceSmoke() {
  const t0 = Date.now();
  const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const smokePath = path.join(root, 'scripts', 'zavorth-golden-path-smoke.ts');
  const tsconfig = path.join(root, 'tsconfig.json');

  if (!fs.existsSync(smokePath)) {
    record('service-smoke', false, `missing ${smokePath}`, Date.now() - t0);
    return false;
  }

  let result;
  if (fs.existsSync(tsxCli)) {
    result = runCommand(process.execPath, [tsxCli, '--tsconfig', tsconfig, smokePath], {
      timeoutMs: 60_000,
    });
  } else {
    result = runNpx(['tsx', '--tsconfig', tsconfig, smokePath], {
      timeoutMs: 60_000,
    });
  }

  const durationMs = Date.now() - t0;
  const stdout = (result.stdout || '').trim();
  const stderr = (result.stderr || '').trim();

  if (stdout) {
    for (const line of stdout.split('\n')) {
      if (line.trim()) console.log(`  ${line}`);
    }
  }
  if (result.error) {
    record('service-smoke', false, result.error.message, durationMs);
    if (stderr) console.log(stderr);
    return false;
  }
  if (result.status !== 0) {
    record('service-smoke', false, `smoke exit=${result.status}`, durationMs);
    if (stderr) console.log(stderr);
    return false;
  }

  record('service-smoke', true, 'proof→approval→risk→preview→memory→honesty→absorb→migration', durationMs);
  return true;
}

/**
 * @param {boolean} ok
 */
function writeReport(ok) {
  const durationMs = Date.now() - startedAt;
  const report = {
    contractVersion: 'zavorth-golden-path/1',
    ok,
    generatedAt: new Date().toISOString(),
    durationMs,
    steps,
    unitSuites: UNIT_SUITES,
    commands: {
      run: 'npm run qa:zavorth-golden-path',
      alias: 'npm run zavorth:golden-path',
    },
  };

  console.log('');
  console.log('=== Golden path summary ===');
  console.log(`status: ${ok ? 'PASS' : 'FAIL'}`);
  console.log(`durationMs: ${durationMs}`);
  for (const step of steps) {
    console.log(`- ${step.ok ? 'pass' : 'fail'}: ${step.name} (${step.durationMs}ms) ${step.detail}`);
  }
  console.log('');
  console.log(
    ok ? '[pass] golden path complete — hermetic Trust Loop verified'
      : '[fail] golden path failed — see steps above',
  );

  // Best-effort: write under .zavorth when present (keep repo clean otherwise)
  const zavorthDir = path.join(root, '.zavorth');
  if (fs.existsSync(zavorthDir) && fs.statSync(zavorthDir).isDirectory()) {
    try {
      const outPath = path.join(zavorthDir, 'golden-path-last.json');
      fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
      console.log(`[info] wrote ${path.relative(root, outPath)}`);
    } catch (error) {
      console.log(
        `[info] skipped .zavorth/golden-path-last.json (${error instanceof Error ? error.message : String(error)})`,
      );
    }
  }

  return report;
}

function main() {
  console.log('Zavorth golden path — hermetic Trust Loop');
  console.log(`root: ${root}`);
  console.log('');

  const unitOk = runUnitGate();
  // Always attempt smoke for full diagnostics when unit fails... Prefer fail-fast for speed.
  let smokeOk = false;
  if (unitOk) {
    smokeOk = runServiceSmoke();
  } else {
    record('service-smoke', false, 'skipped (unit-gate failed)', 0);
  }

  const ok = unitOk && smokeOk;
  writeReport(ok);
  process.exit(ok ? 0 : 1);
}

main();
