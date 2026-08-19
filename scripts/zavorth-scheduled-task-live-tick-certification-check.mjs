#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const rules = [
  ruleFilesExist(),
  ruleMarkers(),
  runAllFixture(),
  runValidFixture(),
  runExpiredFixture(),
  runScopeDriftFixture(),
  runLegacyFixture(),
  runAutoPauseFixture(),
  ruleWorkspaceCheck(),
];
const failed = rules.filter((item) => item.status === 'failed');
const snapshot = {
  generatedAt: new Date().toISOString(),
  status: failed.length > 0 ? 'failed' : 'passed',
  rules,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[zavorth-scheduled-task-live-tick-certification] checking Runtime gateway');
  printRules(rules, '[zavorth-scheduled-task-live-tick-certification]');
}
if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthScheduledTaskLiveTickCertificationContract.ts',
    'src/services/ZavorthScheduledTaskLiveTickCertificationService.ts',
    'scripts/zavorth-scheduled-task-live-tick-certification.ts',
    'scripts/zavorth-scheduled-task-live-tick-certification-check.mjs',
    'tests/domain/agent/ScheduledTaskLiveTickCertificationService.test.ts',
    'docs/README.md',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('scheduled-task-live-tick-files', 'Runtime gateway files exist', missing.length === 0, `${missing.length}/${files.length}`, 'contract, service, CLI, check, tests and docs are present', missing);
}

function ruleMarkers() {
  const checks = [
    ['src/contracts/scheduler/ZavorthScheduledTaskLiveTickCertificationContract.ts', ['ZAVORTH_SCHEDULED_TASK_LIVE_TICK_CERTIFICATION_CONTRACT_VERSION', 'routesThroughExecutionGateway', 'blocksScopeDrift']],
    ['src/services/ZavorthScheduledTaskLiveTickCertificationService.ts', ['scheduled-task-live-tick-certification', 'ZavorthScheduledTaskOperationalGuardService', 'ZavorthScheduledTaskExecutionGatewayRuntimeService', 'noDirectDispatcherBypass']],
    ['scripts/zavorth-scheduled-task-live-tick-certification.ts', ['--task=', '--dry-run', 'ZavorthScheduledTaskLiveTickCertificationService']],
    ['src/sdk/contracts.ts', ['ZavorthScheduledTaskLiveTickCertificationContract']],
    ['src/sdk/index.ts', ['ZavorthScheduledTaskLiveTickCertificationService']],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    for (const needle of needles) {
      if (!text.includes(needle)) missing.push(`${file}: missing ${needle}`);
    }
  }
  return rule('scheduled-task-live-tick-markers', 'Runtime gateway markers are wired', missing.length === 0, missing.length === 0 ? 'all markers' : `${missing.length} missing`, 'contract, service, CLI and SDK markers exist', missing);
}

function runAllFixture() {
  const result = runTs(['--json', '--now=2026-05-12T10:00:00.000Z']);
  return jsonRule('scheduled-task-live-tick-all', 'All fixture scenarios behave as expected', result, (snapshot) =>
    snapshot.status === 'passed'
    && snapshot.summary.scenarios === 5
    && snapshot.summary.passedScenarios === 5
    && snapshot.summary.gatewaySubmitted === 1
    && snapshot.summary.blockedBeforeGateway === 4
    && snapshot.summary.autoPaused === 2);
}

function runValidFixture() {
  const result = runTs(['--json', '--scenario=valid_gateway_submit', '--now=2026-05-12T10:00:00.000Z']);
  return jsonRule('scheduled-task-live-tick-valid', 'Valid governed task reaches ExecutionGateway', result, (snapshot) =>
    snapshot.status === 'passed'
    && snapshot.summary.gatewaySubmitted === 1
    && snapshot.summary.executionPerformed === 1
    && snapshot.scenarios[0]?.gatewayCalled === true
    && snapshot.scenarios[0]?.blockReason === 'none');
}

function runExpiredFixture() {
  const result = runTs(['--json', '--scenario=expired_approval_block', '--now=2026-05-12T10:00:00.000Z']);
  return jsonRule('scheduled-task-live-tick-expired', 'Expired approval blocks before gateway', result, (snapshot) =>
    snapshot.status === 'passed'
    && snapshot.summary.gatewaySubmitted === 0
    && snapshot.scenarios[0]?.blockReason === 'approval_expired'
    && snapshot.scenarios[0]?.gatewayCalled === false);
}

function runScopeDriftFixture() {
  const result = runTs(['--json', '--scenario=scope_drift_block', '--now=2026-05-12T10:00:00.000Z']);
  return jsonRule('scheduled-task-live-tick-scope-drift', 'Scope drift blocks before gateway', result, (snapshot) =>
    snapshot.status === 'passed'
    && snapshot.scenarios[0]?.blockReason === 'scope_drift'
    && snapshot.scenarios[0]?.scopeInvariant === false
    && snapshot.scenarios[0]?.gatewayCalled === false);
}

function runLegacyFixture() {
  const result = runTs(['--json', '--scenario=legacy_task_block', '--now=2026-05-12T10:00:00.000Z']);
  return jsonRule('scheduled-task-live-tick-legacy', 'Legacy task blocks before gateway', result, (snapshot) =>
    snapshot.status === 'passed'
    && snapshot.scenarios[0]?.blockReason === 'legacy_task'
    && snapshot.summary.gatewaySubmitted === 0);
}

function runAutoPauseFixture() {
  const result = runTs(['--json', '--scenario=failure_auto_pause_block', '--now=2026-05-12T10:00:00.000Z']);
  return jsonRule('scheduled-task-live-tick-auto-pause', 'Failing task auto-pauses before gateway', result, (snapshot) =>
    snapshot.status === 'passed'
    && snapshot.summary.autoPaused === 1
    && snapshot.scenarios[0]?.blockReason === 'auto_pause_required'
    && snapshot.scenarios[0]?.gatewayCalled === false);
}

function ruleWorkspaceCheck() {
  const text = read('package.json');
  const marker = 'node scripts/zavorth-scheduled-task-live-tick-certification-check.mjs';
  return rule('workspace-check-wire', 'workspace:check includes Runtime gateway live tick certification gate', text.includes(marker), text.includes(marker) ? 'wired' : 'missing', marker, []);
}

function runTs(args) {
  return spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/zavorth-scheduled-task-live-tick-certification.ts',
    ...args,
  ], { cwd: root, encoding: 'utf8', env: process.env });
}

function jsonRule(id, label, result, expect) {
  if (!result.stdout.trim()) {
    return rule(id, label, false, `exit ${result.status ?? 'unknown'}`, 'valid JSON fixture', compact(result.stderr, result.stdout));
  }
  try {
    const snapshot = JSON.parse(result.stdout);
    const passed = expect(snapshot);
    return rule(id, label, passed, `status=${snapshot.status}; gateway=${snapshot.summary?.gatewaySubmitted}; blocked=${snapshot.summary?.blockedBeforeGateway}`, 'expected live tick certification snapshot', passed ? [] : [JSON.stringify(snapshot, null, 2), ...compact(result.stderr)]);
  } catch (error) {
    return rule(id, label, false, 'invalid JSON', 'valid JSON fixture', [String(error), ...compact(result.stderr, result.stdout)]);
  }
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function rule(id, label, passed, observed, target, details = []) {
  return { id, label, status: passed ? 'passed' : 'failed', observed, target, details };
}

function printRules(items, prefix) {
  for (const item of items) {
    console.log(`${prefix} ${item.status === 'passed' ? 'ok' : 'fail'} ${item.label}: ${item.observed} | ${item.target}`);
    for (const detail of item.details.slice(0, 12)) console.log(`  - ${detail}`);
  }
}

function compact(...parts) {
  return parts.join('\n').split(/\r...\n/).map((line) => line.trim()).filter(Boolean).slice(0, 12);
}
