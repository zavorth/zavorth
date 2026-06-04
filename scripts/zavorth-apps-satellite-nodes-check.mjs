#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const checks = [
  filesExist(),
  markersPresent(),
  statusFixture(),
  pairingFixture(),
  approvalFixture(),
  pushFixture(),
  mobileTrayFixture(),
];

const failed = checks.filter((entry) => entry.status === 'failed');
const snapshot = {
  contractVersion: 'zavorth-apps-satellite-nodes-check/1',
  generatedAt: new Date().toISOString(),
  status: failed.length ? 'failed' : 'passed',
  checks,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  for (const entry of checks) {
    console.log(`[apps-satellite-nodes] ${entry.status === 'passed' ? 'ok' : 'fail'} ${entry.id}: ${entry.summary}`);
  }
}

if (failed.length) {
  process.exitCode = 1;
}

function filesExist() {
  const files = [
    'src/contracts/ZavorthAppsSatelliteNodesContract.ts',
    'src/services/ZavorthAppsSatelliteNodesService.ts',
    'scripts/zavorth-apps-satellite-nodes.ts',
    'scripts/zavorth-apps-satellite-nodes-check.mjs',
    'tests/services/ZavorthAppsSatelliteNodesService.test.ts',
    'docs/node-mesh-live-native.md',
  ];
  const missing = files.filter((file) => !existsSync(join(root, file)));
  return rule('files', missing.length === 0, `${files.length - missing.length}/${files.length} files present`, missing);
}

function markersPresent() {
  const markers = [
    ['src/contracts/ZavorthAppsSatelliteNodesContract.ts', [
      '2026-05-24.apps-satellite-nodes-phase-7',
      'qrPayloadUsesOpaqueShortLivedCode',
      'mobileAndTraySpecsDoNotClaimAppStoreBinaries',
      'pushRequiresConsentAndConfiguredProvider',
    ]],
    ['src/services/ZavorthAppsSatelliteNodesService.ts', [
      'NodePairingService',
      'ZAVORTH_WEB_PUSH_PUBLIC_KEY',
      'ZAVORTH_DESKTOP_TRAY_ENABLED',
      'storeBinaryClaimed: false',
      'binaryClaimed: false',
    ]],
    ['package.json', [
      'zavorth:apps-satellite-nodes:check',
      'qa:zavorth-apps-satellite-nodes',
    ]],
    ['scripts/zavorth-product-readiness-gate.mjs', [
      'apps-satellite-nodes',
    ]],
  ];
  const missing = [];
  for (const [file, needles] of markers) {
    const text = read(file);
    for (const needle of needles) {
      if (!text.includes(needle)) missing.push(`${file}: ${needle}`);
    }
  }
  return rule('markers', missing.length === 0, missing.length ? `${missing.length} missing` : 'all markers found', missing);
}

function statusFixture() {
  const result = runTs(['--json']);
  return jsonRule('status-fixture', result, (snapshot) =>
    snapshot.contractVersion === '2026-05-24.apps-satellite-nodes-phase-7'
    && snapshot.surfaces?.some((entry) => entry.id === 'satellite-pwa')
    && snapshot.surfaces?.some((entry) => entry.id === 'mobile-companion')
    && snapshot.surfaces?.some((entry) => entry.id === 'desktop-tray')
    && snapshot.offlineQueue?.receiptRequired === true
    && snapshot.safety?.noRawPairingSecretsSerialized === true);
}

function pairingFixture() {
  const result = runTs(['--json', '--action', 'pairing.qr', '--surface', 'mobile-companion', '--ttl-seconds', '180']);
  return jsonRule('pairing-fixture', result, (snapshot) =>
    snapshot.pairing?.status === 'preview'
    && snapshot.pairing?.materialized === false
    && String(snapshot.pairing?.setupCode || '').startsWith('ZA-')
    && String(snapshot.pairing?.qrPayload || '').startsWith('zavorth://pair?code=')
    && snapshot.pairing?.noRawTokenSerialized === true);
}

function approvalFixture() {
  const result = runTs(['--json', '--action', 'pairing.qr', '--materialize']);
  return jsonRule('approval-fixture', result, (snapshot) =>
    snapshot.status === 'approval-required'
    && snapshot.pairing?.status === 'approval-required'
    && snapshot.pairing?.materialized === false);
}

function pushFixture() {
  const result = runTs(['--json', '--action', 'push.plan']);
  return jsonRule('push-fixture', result, (snapshot) =>
    ['needs-configuration', 'approval-required', 'ready'].includes(snapshot.push?.status)
    && snapshot.push?.liveSendPerformed === false
    && snapshot.push?.consentRequired === true
    && snapshot.safety?.pushRequiresConsentAndConfiguredProvider === true);
}

function mobileTrayFixture() {
  const result = runTs(['--json', '--action', 'mobile.spec']);
  return jsonRule('mobile-tray-fixture', result, (snapshot) =>
    snapshot.mobileCompanionSpec?.ios?.storeBinaryClaimed === false
    && snapshot.mobileCompanionSpec?.android?.storeBinaryClaimed === false
    && snapshot.desktopTraySpec?.binaryClaimed === false
    && snapshot.safety?.mobileAndTraySpecsDoNotClaimAppStoreBinaries === true);
}

function runTs(args) {
  return spawnSync(process.execPath, [
    join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/zavorth-apps-satellite-nodes.ts',
    ...args,
  ], {
    cwd: root,
    encoding: 'utf8',
  });
}

function jsonRule(id, result, predicate) {
  if (result.status !== 0) {
    return rule(id, false, result.stderr || result.stdout || `exit ${result.status}`, []);
  }
  try {
    const parsed = JSON.parse(result.stdout);
    return rule(id, Boolean(predicate(parsed, result.stdout)), 'fixture output matches contract', parsed);
  } catch (error) {
    return rule(id, false, error instanceof Error ? error.message : String(error), {
      stdout: result.stdout,
      stderr: result.stderr,
    });
  }
}

function read(file) {
  return readFileSync(join(root, file), 'utf8');
}

function rule(id, ok, summary, detail) {
  return {
    id,
    status: ok ? 'passed' : 'failed',
    summary,
    detail,
  };
}
