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
  invalidManifestFixture(),
  lifecycleApprovalFixture(),
  hotReloadFixture(),
  jestFixture(),
];

const failed = checks.filter((entry) => entry.status === 'failed');
const snapshot = {
  contractVersion: 'zavorth-extension-plugin-sdk-check/1',
  generatedAt: new Date().toISOString(),
  status: failed.length ? 'failed' : 'passed',
  checks,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  for (const entry of checks) {
    console.log(`[extension-plugin-sdk] ${entry.status === 'passed' ? 'ok' : 'fail'} ${entry.id}: ${entry.summary}`);
  }
}

if (failed.length) {
  process.exitCode = 1;
}

function filesExist() {
  const files = [
    'src/contracts/ZavorthExtensionPluginSdkContract.ts',
    'src/services/ZavorthExtensionPluginSdkService.ts',
    'scripts/zavorth-extension-plugin-sdk.ts',
    'scripts/zavorth-extension-plugin-sdk-check.mjs',
    'tests/services/ZavorthExtensionPluginSdkService.test.ts',
    'docs/capability-plugins.md',
  ];
  const missing = files.filter((file) => !existsSync(join(root, file)));
  return rule('files', missing.length === 0, `${missing.length}/${files.length} files present`, missing);
}

function markersPresent() {
  const markers = [
    ['src/contracts/ZavorthExtensionPluginSdkContract.ts', [
      '2026-05-24.extension-plugin-sdk-phase-8',
      'checksumRequiredForTrustedInstall',
      'signatureRequiredForTrustedRemoteInstall',
      'hotReloadDoesNotBypassPolicy',
      'receiptsRequiredPerPluginAction',
    ]],
    ['src/services/ZavorthExtensionPluginSdkService.ts', [
      'ZavorthPluginRegistryService',
      'PluginStateService',
      'checksumManifest',
      'buildMarketplaceEntries',
      'buildHotReloadDev',
    ]],
    ['package.json', [
      'zavorth:extension-plugin-sdk:check',
      'qa:zavorth-extension-plugin-sdk',
    ]],
    ['scripts/zavorth-product-readiness-gate.mjs', [
      'extension-plugin-sdk',
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
    snapshot.contractVersion === '2026-05-24.extension-plugin-sdk-phase-8'
    && snapshot.manifestSchema?.schemaVersion === 'zavorth.plugin-sdk.v1'
    && snapshot.manifestSchema?.permissionKinds?.includes('network.external')
    && snapshot.marketplaceLocal?.entries?.length > 0
    && snapshot.safety?.receiptsRequiredPerPluginAction === true
    && snapshot.receipts?.every((receipt) => receipt.rawSecretSerialized === false));
}

function invalidManifestFixture() {
  const result = runTs(['--json', '--action', 'manifest.validate', '--manifest-json', '{"id":"bad"}']);
  return jsonRule('invalid-manifest-fixture', result, (snapshot) =>
    snapshot.status === 'blocked'
    && snapshot.validation?.status === 'invalid'
    && snapshot.validation?.findings?.length > 0);
}

function lifecycleApprovalFixture() {
  const manifest = JSON.stringify(validManifest());
  const result = runTs(['--json', '--action', 'lifecycle.apply', '--lifecycle', 'install', '--manifest-json', manifest]);
  return jsonRule('lifecycle-approval-fixture', result, (snapshot) =>
    snapshot.status === 'approval-required'
    && snapshot.lifecycle?.status === 'approval-required'
    && snapshot.lifecycle?.willMutateState === false);
}

function hotReloadFixture() {
  const manifest = JSON.stringify(validManifest());
  const result = runTs(['--json', '--action', 'dev.hot-reload', '--dev', '--manifest-json', manifest]);
  return jsonRule('hot-reload-fixture', result, (snapshot) =>
    snapshot.hotReloadDev?.status === 'ready'
    && snapshot.hotReloadDev?.enabled === true
    && snapshot.hotReloadDev?.constraints?.reloadDoesNotBypassPermissions === true);
}

function jestFixture() {
  const command = ['npx', 'jest', 'tests/services/ZavorthExtensionPluginSdkService.test.ts', '--runInBand'];
  const result = spawnSync(process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : command[0], process.platform === 'win32'
    ? ['/d', '/s', '/c', command.map(quoteWinArg).join(' ')]
    : command.slice(1), {
    cwd: root,
    encoding: 'utf8',
    shell: false,
  });
  return rule('jest-fixture', result.status === 0, result.status === 0 ? 'focused Jest tests passed' : result.stderr || result.stdout, []);
}

function quoteWinArg(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
}

function runTs(args) {
  return spawnSync(process.execPath, [
    join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/zavorth-extension-plugin-sdk.ts',
    ...args,
  ], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
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

function validManifest() {
  return {
    schemaVersion: 'zavorth.plugin-sdk.v1',
    id: 'plugin:test',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin.',
    entrypoint: {
      module: './plugin.js',
      exportName: 'activate',
      runtime: 'node',
    },
    permissions: [
      { kind: 'artifact.write', scope: 'workspace', reason: 'receipt', required: false },
    ],
    lifecycle: {
      actions: ['install', 'enable', 'disable', 'uninstall', 'invoke', 'doctor'],
      defaultAction: 'install',
    },
    integrity: {
      checksum: null,
      signature: null,
      publicKeyId: null,
    },
  };
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
