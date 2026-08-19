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
  approvalFixture(),
  liveDisabledFixture(),
  plannedBackendFixture(),
];

const failed = checks.filter((entry) => entry.status === 'failed');
const snapshot = {
  contractVersion: 'zavorth-terminal-backends-check/1',
  generatedAt: new Date().toISOString(),
  status: failed.length ? 'failed' : 'passed',
  checks,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  for (const entry of checks) {
    console.log(`[terminal-backends] ${entry.status === 'passed' ? 'ok' : 'fail'} ${entry.id}: ${entry.summary}`);
  }
}

if (failed.length) {
  process.exitCode = 1;
}

function filesExist() {
  const files = [
    'src/contracts/ZavorthTerminalBackendsContract.ts',
    'src/services/ZavorthTerminalBackendsService.ts',
    'scripts/zavorth-execution-backends.ts',
    'scripts/zavorth-terminal-backends-check.mjs',
    'tests/services/ZavorthTerminalBackendsService.test.ts',
    'docs/terminal-backends.md',
  ];
  const missing = files.filter((file) => !existsSync(join(root, file)));
  return rule('files', missing.length === 0, `${missing.length}/${files.length} files present`, missing);
}

function markersPresent() {
  const markers = [
    ['src/contracts/ZavorthTerminalBackendsContract.ts', [
      '2026-05-24.terminal-backends-phase-7',
      'vercel-sandbox',
      'readinessProof',
      'cloudBackendsRequireExplicitConfiguration',
      'stdoutStderrRedacted',
    ]],
    ['src/services/ZavorthTerminalBackendsService.ts', [
      'ZAVORTH_TERMINAL_BACKENDS_ALLOW_LIVE',
      'Docker container',
      'SSH remote shell',
      'WSL Linux runtime',
      'Vercel Sandbox',
      'Modal cloud function',
      'Daytona workspace',
    ]],
    ['package.json', [
      'zavorth:terminal-backends:check',
      'qa:zavorth-terminal-backends',
    ]],
    ['scripts/zavorth-product-readiness-gate.mjs', [
      'terminal-backends',
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
    snapshot.contractVersion === '2026-05-24.terminal-backends-phase-7'
    && snapshot.backends?.some((entry) => entry.id === 'local' && entry.status === 'ready')
    && snapshot.backends?.every((entry) => entry.readinessProof?.rawSecretSerialized === false)
    && snapshot.backends?.some((entry) => entry.id === 'docker')
    && snapshot.backends?.some((entry) => entry.id === 'ssh')
    && snapshot.backends?.some((entry) => entry.id === 'wsl')
    && snapshot.backends?.some((entry) => entry.id === 'vercel-sandbox')
    && snapshot.backends?.some((entry) => entry.id === 'modal' && entry.status === 'needs-configuration' && entry.liveCapable === true)
    && snapshot.backends?.some((entry) => entry.id === 'daytona' && entry.status === 'needs-configuration' && entry.liveCapable === true)
    && snapshot.safety?.noBackendLiveByDefault === true);
}

function approvalFixture() {
  const result = runTs(['--json', '--action', 'plan', '--backend', 'local', '--command', 'rm -rf dist']);
  return jsonRule('approval-fixture', result, (snapshot) =>
    snapshot.status === 'approval-required'
    && snapshot.command?.risk === 'dangerous'
    && snapshot.command?.approvalRequired === true
    && snapshot.execution?.performed === false);
}

function liveDisabledFixture() {
  const result = runTs([
    '--json',
    '--action', 'execute',
    '--backend', 'local',
    '--command', 'echo safe',
    '--live',
    '--approval-id', 'approval-test',
  ]);
  return jsonRule('live-disabled-fixture', result, (snapshot) =>
    snapshot.status === 'blocked'
    && snapshot.plan?.mode === 'live-disabled'
    && snapshot.execution?.performed === false
    && String(snapshot.plan?.reason || '').includes('disabled by default'));
}

function plannedBackendFixture() {
  const result = runTs(['--json', '--action', 'plan', '--backend', 'modal', '--command', 'echo later']);
  return jsonRule('planned-backend-fixture', result, (snapshot) =>
    snapshot.status === 'preview'
    && snapshot.selectedBackend === 'modal'
    && snapshot.plan?.executable === 'modal'
    && snapshot.safety?.cloudBackendsRequireExplicitConfiguration === true);
}

function runTs(args) {
  return spawnSync(process.execPath, [
    join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/zavorth-execution-backends.ts',
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
