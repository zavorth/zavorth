/**
 * Unit tests for desktop production readiness pure helpers (no certs / publish).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { resolve } = require('node:path');

const readinessUrl = pathToFileURL(
  resolve(__dirname, '../scripts/desktop-production-readiness.mjs'),
).href;

async function loadReadiness() {
  return import(readinessUrl);
}

test('evaluatePackageJsonChecks fails without electron-updater', async () => {
  const { evaluatePackageJsonChecks } = await loadReadiness();
  const checks = evaluatePackageJsonChecks({
    scripts: {
      'package:release': 'x',
      'package:publish': 'x',
      'signing:status': 'x',
    },
  });
  const dep = checks.find((c) => c.id === 'dep-electron-updater');
  assert.equal(dep.status, 'fail');
  assert.equal(dep.strictFail, true);
});

test('evaluatePackageJsonChecks passes with updater + scripts', async () => {
  const { evaluatePackageJsonChecks } = await loadReadiness();
  const checks = evaluatePackageJsonChecks({
    dependencies: { 'electron-updater': '^6.0.0' },
    scripts: {
      'package:release': 'electron-builder --publish never',
      'package:publish': 'electron-builder --publish always',
      'signing:status': 'node electron/desktop-update-signing.cjs',
    },
  });
  assert.ok(checks.every((c) => c.status === 'pass'));
});

test('evaluateElectronFileChecks requires main bridge + entitlements', async () => {
  const { evaluateElectronFileChecks } = await loadReadiness();
  const files = {
    'electron/desktop-electron-updater.cjs': true,
    'electron/desktop-update-signing.cjs': true,
    'electron/desktop-updates.cjs': true,
    'electron/main.cjs': true,
    'build/entitlements.mac.plist': true,
  };
  const checks = evaluateElectronFileChecks({
    exists: (rel) => Boolean(files[rel]),
    read: (rel) => (rel === 'electron/main.cjs'
      ? "const { createDesktopElectronUpdater } = require('./desktop-electron-updater.cjs');"
      : null),
  });
  assert.ok(checks.every((c) => c.status === 'pass'), JSON.stringify(checks, null, 2));
});

test('evaluateSigningChecks treats unsigned as warn not fail', async () => {
  const { evaluateSigningChecks } = await loadReadiness();
  const checks = evaluateSigningChecks({
    shippingReady: false,
    message: 'Signing not configured — installers will be unsigned (OK for local smoke; required for shipping).',
    windows: { readyToSign: false, notes: 'No Windows cert configured.' },
    mac: { readyToSign: true, notarizeReady: false, notes: 'macOS identity may sign.' },
  });
  assert.ok(checks.every((c) => c.status === 'warn' || c.status === 'pass'));
  assert.ok(checks.every((c) => c.strictFail !== true));
});

test('runDesktopProductionReadiness against this app is ok (unsigned warn)', async () => {
  const { runDesktopProductionReadiness } = await loadReadiness();
  const report = runDesktopProductionReadiness({
    appRoot: resolve(__dirname, '..'),
    env: {},
    strict: true,
  });
  assert.equal(report.contractVersion, 'desktop-production-readiness/1');
  assert.equal(report.ok, true, report.message);
  assert.match(report.honesty, /unsigned|CSC_LINK|local/i);
  const hardFails = report.checks.filter((c) => c.status === 'fail' && c.strictFail);
  assert.equal(hardFails.length, 0, JSON.stringify(hardFails, null, 2));
});

test('parseCliArgs recognizes --json and --strict', async () => {
  const { parseCliArgs } = await loadReadiness();
  assert.deepEqual(parseCliArgs(['--json', '--strict']), { json: true, strict: true });
  assert.deepEqual(parseCliArgs([]), { json: false, strict: false });
});
