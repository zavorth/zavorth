#!/usr/bin/env node
/**
 * Launch-ready checklist (honest).
 * Exit 0  = launch-ready (all hard bars green; do not announce without operator review)
 * Exit 2  = program gates OK but ops residual remains (day1 calendar and/or signed assets)
 * Exit 1  = structural failure
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const asJson = process.argv.includes('--json');
const requireFull = process.argv.includes('--require-full');

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function readJson(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
  } catch {
    return null;
  }
}

function runNode(script, args = []) {
  const result = spawnSync(process.execPath, [path.join(root, script), ...args], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
    windowsHide: true,
    timeout: 120000,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
}

function runNpm(script) {
  const result = spawnSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', script, '--silent'],
    {
      cwd: root,
      encoding: 'utf8',
      env: process.env,
      windowsHide: true,
      shell: true,
      timeout: 600000,
    },
  );
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: (result.stdout || '').trim().slice(0, 2000),
    stderr: (result.stderr || '').trim().slice(0, 1000),
  };
}

const retention = readJson('.zavorth/retention-log.json') || {
  criteria: { day0Install: false, day1Return: false, completedMissionWithoutCreator: false },
};
const liveCells = readJson('.zavorth/launch-live-cells.json')
  || readJson('data/product/launch-live-cells.json');
const signing = runNode('scripts/ops-signing-readiness.mjs');
const installer = runNode('scripts/installer-readiness-check.mjs');
const valueSuite = runNode('scripts/value-test-all.mjs');

const signedHints = [
  'dist-release',
  'release-assets',
  'out/make',
  'apps/zavorth-desktop/out',
].filter((rel) => exists(rel));

const checks = [
  {
    id: 'value-suite-hermetic',
    bar: 'product',
    ok: valueSuite.ok,
    notes: valueSuite.ok ? 'value:test-all green' : 'value:test-all failed',
  },
  {
    id: 'retention-r1',
    bar: 'ops',
    ok: Boolean(retention.criteria?.day0Install),
    notes: retention.criteria?.day0Install ? 'day0Install recorded' : 'missing day0Install',
  },
  {
    id: 'retention-r3',
    bar: 'ops',
    ok: Boolean(retention.criteria?.completedMissionWithoutCreator),
    notes: retention.criteria?.completedMissionWithoutCreator
      ? 'solo mission recorded'
      : 'missing completedMissionWithoutCreator',
  },
  {
    id: 'retention-r2-calendar',
    bar: 'launch',
    ok: Boolean(retention.criteria?.day1Return),
    notes: retention.criteria?.day1Return
      ? 'day1Return recorded on later calendar day'
      : 'day1Return open — wait real next UTC day; never ZAVORTH_ALLOW_FAKE_DAY1 for claims',
  },
  {
    id: 'signing-packaging-structural',
    bar: 'product',
    ok: signing.ok,
    notes: signing.ok
      ? 'installer/signing packaging scripts present'
      : 'ops-signing-readiness structural fail',
  },
  {
    id: 'installer-readiness',
    bar: 'product',
    ok: installer.ok,
    notes: installer.ok ? 'installer-readiness-check passed' : 'installer-readiness-check failed',
  },
  {
    id: 'signed-store-artifacts',
    bar: 'launch',
    ok: signedHints.length > 0,
    notes: signedHints.length
      ? `signed/store paths present: ${signedHints.join(', ')}`
      : 'no signed/store artifact dirs — OPS-ONLY until certs/notarization',
  },
  {
    id: 'live-cells-recorded',
    bar: 'launch',
    ok: Boolean(liveCells?.cells?.some((cell) => cell.status === 'pass' && cell.live === true)),
    notes: liveCells?.cells?.length
      ? `live cells file has ${liveCells.cells.filter((c) => c.status === 'pass').length} pass cell(s)`
      : 'no launch-live-cells.json — run npm run launch:live-cells -- --live',
  },
  {
    id: 'announce-not-auto',
    bar: 'product',
    ok: true,
    notes: 'Public announce is never automatic; operator must clear full launch bar first',
  },
];

const productOk = checks.filter((c) => c.bar === 'product').every((c) => c.ok);
const launchOk = checks.filter((c) => c.bar === 'launch').every((c) => c.ok);
const opsSoftOk = checks.filter((c) => c.bar === 'ops').every((c) => c.ok);
const fullLaunchReady = productOk && opsSoftOk && launchOk;

const report = {
  generatedAt: new Date().toISOString(),
  version: 'launch-ready/v1',
  productReady: productOk && opsSoftOk,
  launchReady: fullLaunchReady,
  claimsPublicLaunch: false,
  residual: checks.filter((c) => !c.ok).map((c) => c.id),
  checks,
  operatorNext: fullLaunchReady
    ? [
        'Re-read docs/product/launch-readiness.md anti-claims',
        'Only then prepare public channel announce assets',
      ]
    : [
      !retention.criteria?.day1Return
        ? 'After a later UTC calendar day of real product use: node scripts/retention-log.mjs --day1-return'
        : null,
      signedHints.length === 0
        ? 'Produce signed installers/notarization into dist-release or release-assets'
        : null,
      !liveCells?.cells?.some((c) => c.status === 'pass')
        ? 'npm run launch:live-cells -- --live'
        : null,
    ].filter(Boolean),
};

const outPath = path.join(root, '.zavorth', 'launch-ready-report.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

if (asJson) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  process.stdout.write('Zavorth launch-ready checklist (honest)\n');
  process.stdout.write(`productReady: ${report.productReady ? 'yes' : 'no'}\n`);
  process.stdout.write(`launchReady: ${report.launchReady ? 'yes' : 'no'}\n`);
  process.stdout.write(`claimsPublicLaunch: false\n\n`);
  for (const check of checks) {
    process.stdout.write(`[${check.ok ? 'pass' : 'fail'}] (${check.bar}) ${check.id} — ${check.notes}\n`);
  }
  if (report.operatorNext.length) {
    process.stdout.write('\n[next]\n');
    for (const step of report.operatorNext) process.stdout.write(`- ${step}\n`);
  }
  process.stdout.write(`\nreport: ${path.relative(root, outPath)}\n`);
}

if (fullLaunchReady) {
  process.exit(0);
}
if (requireFull) {
  process.exit(1);
}
// Infrastructure present; ops residual is expected until day1 + signed assets.
process.exit(productOk ? 2 : 1);
