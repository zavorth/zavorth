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
  requireLiveFixture(),
  liveHonestyFixture(),
  jestFixture(),
];

const failed = checks.filter((entry) => entry.status === 'failed');
const snapshot = {
  contractVersion: 'zavorth-product-qa-live-check/1',
  generatedAt: new Date().toISOString(),
  status: failed.length ? 'failed' : 'passed',
  checks,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  for (const entry of checks) {
    console.log(`[product-qa-live] ${entry.status === 'passed' ? 'ok' : 'fail'} ${entry.id}: ${entry.summary}`);
  }
}

if (failed.length) {
  process.exitCode = 1;
}

function filesExist() {
  const files = [
    'src/contracts/ZavorthProductQaLiveContract.ts',
    'src/services/ZavorthProductQaLiveService.ts',
    'scripts/zavorth-product-qa-live.ts',
    'scripts/zavorth-product-qa-live-check.mjs',
    'tests/services/ZavorthProductQaLiveService.test.ts',
    'docs/product-qa-live.md',
  ];
  const missing = files.filter((file) => !existsSync(join(root, file)));
  return rule('files', missing.length === 0, `${files.length - missing.length}/${files.length} files present`, missing);
}

function markersPresent() {
  const markers = [
    ['src/contracts/ZavorthProductQaLiveContract.ts', [
      '2026-05-24.product-qa-live-phase-9',
      'fresh-install',
      'real-provider',
      'real-telegram',
      'rollback-sandbox',
      'dryRunDoesNotClaimLiveProvider',
      'dryRunDoesNotClaimLiveTelegram',
    ]],
    ['src/services/ZavorthProductQaLiveService.ts', [
      'ZavorthProductQaLiveService',
      'PROVIDER_ENV_GROUPS',
      'TELEGRAM_TOKEN_KEYS',
      'TELEGRAM_ALLOWLIST_KEYS',
      'secretValuesSerialized: false',
    ]],
    ['package.json', [
      'zavorth:product-qa-live:check',
      'qa:zavorth-product-qa-live',
    ]],
    ['scripts/zavorth-product-readiness-gate.mjs', [
      'product-qa-live',
      'Final live product QA matrix',
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
    snapshot.contractVersion === '2026-05-24.product-qa-live-phase-9'
    && snapshot.status === 'passed'
    && snapshot.matrix?.length === 9
    && snapshot.summary?.total === 9
    && snapshot.summary?.liveRequired >= 2
    && snapshot.policy?.secretsNeverSerialized === true
    && snapshot.matrix?.every((row) => row.receiptsRequired === true && row.secretValuesSerialized === false));
}

function requireLiveFixture() {
  const result = runTs(['--json', '--require-live'], {});
  return jsonRule('require-live-fixture', result, (snapshot) =>
    ['passed', 'needs-live-credentials', 'needs-operator-action'].includes(snapshot.status)
    && snapshot.requireLive === true
    && snapshot.matrix?.some((row) => row.id === 'real-provider' && row.liveProof === 'required')
    && snapshot.matrix?.some((row) => row.id === 'real-telegram' && row.liveProof === 'required'));
}

function liveHonestyFixture() {
  const result = runTs(['--json'], {});
  return jsonRule('live-honesty-fixture', result, (snapshot) =>
    snapshot.policy?.dryRunDoesNotClaimLiveProvider === true
    && snapshot.policy?.dryRunDoesNotClaimLiveTelegram === true
    && snapshot.matrix?.find((row) => row.id === 'real-provider')?.mode === 'live-required'
    && snapshot.matrix?.find((row) => row.id === 'real-telegram')?.mode === 'live-required');
}

function jestFixture() {
  const command = ['npx', 'jest', 'tests/services/ZavorthProductQaLiveService.test.ts', '--runInBand'];
  const result = spawnSync(process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : command[0], process.platform === 'win32'
    ? ['/d', '/s', '/c', command.map(quoteWinArg).join(' ')]
    : command.slice(1), {
    cwd: root,
    encoding: 'utf8',
    shell: false,
  });
  return rule('jest-fixture', result.status === 0, result.status === 0 ? 'focused Jest tests passed' : result.stderr || result.stdout, []);
}

function runTs(args, env = process.env) {
  return spawnSync(process.execPath, [
    join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/zavorth-product-qa-live.ts',
    ...args,
  ], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    env,
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

function quoteWinArg(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
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
