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

const signingReport = readJson('.zavorth/ops-signing-report.json');
const signedArtifactsVerified = Boolean(
  signingReport?.signedArtifactsVerified
  || (Array.isArray(signingReport?.signedArtifactsFound) && signingReport.signedArtifactsFound.length > 0),
);
// Fallback: re-check via signing script field after runNode already executed.
const signedFromRun = (() => {
  try {
    const parsed = JSON.parse(signing.stdout || '{}');
    return Boolean(parsed.signedArtifactsVerified);
  } catch {
    return false;
  }
})();
const signedOk = signedArtifactsVerified || signedFromRun;

const day1Fake = Boolean(
  retention.criteria?.day1Return
  && (
    retention.day1Method === 'fake-env'
    || (Array.isArray(retention.history) && retention.history.some(
      (h) => h?.event === 'day1Return' && /FAKE|fake-env|ALLOW_FAKE/i.test(String(h?.note || h?.notes || '')),
    ))
  ),
);

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
    ok: Boolean(retention.criteria?.day1Return) && !day1Fake,
    notes: day1Fake
      ? 'day1Return present but marked fake/ALLOW_FAKE — not launch evidence'
      : retention.criteria?.day1Return
        ? 'day1Return recorded on later calendar day'
        : 'day1Return open — wait real next UTC day; never ZAVORTH_ALLOW_FAKE_DAY1 for claims',
  },
  {
    id: 'signing-packaging-structural',
    bar: 'product',
    ok: signing.ok || signing.status === 2,
    notes: signing.ok || signing.status === 2
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
    ok: signedOk,
    notes: signedOk
      ? 'non-empty installer/package files verified under release dirs'
      : 'no verified installer/package files — directory presence alone is not signed evidence',
  },
  {
    id: 'live-cells-recorded',
    bar: 'launch',
    ok: Boolean(liveCells?.cells?.some(
      (cell) => cell.id === 'live.multi-step.tool-plan' && cell.status === 'pass' && cell.live === true,
    )),
    notes: liveCells?.cells?.some(
      (cell) => cell.id === 'live.multi-step.tool-plan' && cell.status === 'pass' && cell.live === true,
    )
      ? 'live multi-step tool-plan cell pass retained'
      : 'require live.multi-step.tool-plan pass (probe-only is not enough) — run npm run launch:live-cells -- --live',
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
      !signedOk
        ? 'Produce non-empty signed installers into dist-release or release-assets (not empty dirs)'
        : null,
      !liveCells?.cells?.some((c) => c.id === 'live.multi-step.tool-plan' && c.status === 'pass')
        ? 'npm run launch:live-cells -- --live (need multi-step pass)'
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
