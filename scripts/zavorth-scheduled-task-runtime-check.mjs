#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const rules = [
  ruleFilesExist(),
  ruleMarkers(),
  runNeedsReapprovalFixture(),
  runReadyFixture(),
  runDryRunSubmitFixture(),
  runNotDueFixture(),
  runScopeOverrideFixture(),
  runLiveWithoutGatewayFixture(),
  runKillSwitchFixture(),
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
  console.log('[zavorth-scheduled-task-runtime] checking Preview engine');
  printRules(rules, '[zavorth-scheduled-task-runtime]');
}
if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthScheduledTaskRuntimeContract.ts',
    'src/services/ZavorthScheduledTaskExecutionGatewayRuntimeService.ts',
    'scripts/zavorth-scheduled-task-runtime.ts',
    'scripts/zavorth-scheduled-task-runtime-check.mjs',
    'tests/domain/agent/ScheduledTaskExecutionGatewayRuntimeService.test.ts',
    'docs/README.md',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('scheduled-task-runtime-files', 'Preview engine files exist', missing.length === 0, `${missing.length}/${files.length}`, 'contract, service, CLI, check, tests and docs are present', missing);
}

function ruleMarkers() {
  const checks = [
    ['src/contracts/scheduler/ZavorthScheduledTaskRuntimeContract.ts', ['ZAVORTH_SCHEDULED_TASK_RUNTIME_CONTRACT_VERSION', 'dry_run_submitted', 'gateway_unavailable', 'usesExecutionGatewaySubmit']],
    ['src/services/ZavorthScheduledTaskExecutionGatewayRuntimeService.ts', ['checkpoint-2-scheduled-task-execution-gateway', 'gateway.submit', 'ZavorthGovernedScheduledTaskRegistryService', 'ScheduledTaskDryRunGateway']],
    ['scripts/zavorth-scheduled-task-runtime.ts', ['--submit', '--live', '--override-command', '--kill-switch']],
    ['src/sdk/contracts.ts', ['ZavorthScheduledTaskRuntimeContract']],
    ['src/sdk/index.ts', ['ZavorthScheduledTaskExecutionGatewayRuntimeService']],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    for (const needle of needles) {
      if (!text.includes(needle)) missing.push(`${file}: missing ${needle}`);
    }
  }
  return rule('scheduled-task-runtime-markers', 'Preview engine markers are wired', missing.length === 0, missing.length === 0 ? 'all markers' : `${missing.length} missing`, 'contract, service, SDK and CLI markers exist', missing);
}

function runNeedsReapprovalFixture() {
  const result = runTs(['--json']);
  return jsonRule('scheduled-task-runtime-needs-reapproval', 'Missing approval prevents runtime submit', result, (snapshot) =>
    snapshot.contractVersion === '2026-05-12.scheduled-task-execution-gateway-checkpoint-2'
    && snapshot.status === 'needs_reapproval'
    && snapshot.summary.gatewayCalled === false
    && snapshot.summary.executionPerformed === false
    && snapshot.safety.usesExecutionGatewaySubmit === true);
}

function runReadyFixture() {
  const result = runTs(approvedArgs());
  return jsonRule('scheduled-task-runtime-ready', 'Approved task is ready before due submit', result, (snapshot) =>
    snapshot.status === 'ready'
    && snapshot.summary.registryActive === true
    && snapshot.summary.submitRequested === false
    && snapshot.summary.gatewayCalled === false
    && snapshot.task.command_type === 'scheduled_task'
    && snapshot.plan.steps[0].tool === 'scheduled_task_dispatch');
}

function runDryRunSubmitFixture() {
  const args = approvedArgs();
  args.push('--submit');
  const result = runTs(args);
  return jsonRule('scheduled-task-runtime-dry-run-submit', 'Due tick enters ExecutionGateway dry-run', result, (snapshot) =>
    snapshot.status === 'dry_run_submitted'
    && snapshot.mode === 'gateway-dry-run'
    && snapshot.summary.gatewayCalled === true
    && snapshot.summary.gatewayAllowed === true
    && snapshot.summary.executionPerformed === false
    && snapshot.gatewayDecision.traceId
    && snapshot.receipts.some((receipt) => receipt.kind === 'gateway-submit' && receipt.status === 'submitted'));
}

function runNotDueFixture() {
  const args = approvedArgs();
  args.push('--submit', '--not-due');
  const result = runTs(args);
  return jsonRule('scheduled-task-runtime-not-due', 'Not-due tick does not submit to gateway', result, (snapshot) =>
    snapshot.status === 'not_due'
    && snapshot.summary.due === false
    && snapshot.summary.gatewayCalled === false
    && snapshot.checks.some((check) => check.kind === 'due-window' && check.status === 'fail'));
}

function runScopeOverrideFixture() {
  const args = approvedArgs();
  args.push('--submit', '--override-command=do something else');
  const result = runTs(args);
  return jsonRule('scheduled-task-runtime-scope-invariance', 'Scope override is blocked before gateway', result, (snapshot) =>
    snapshot.status === 'blocked'
    && snapshot.summary.scopeInvariant === false
    && snapshot.summary.gatewayCalled === false
    && snapshot.receipts.some((receipt) => receipt.kind === 'scope-invariance' && receipt.status === 'blocked'));
}

function runLiveWithoutGatewayFixture() {
  const args = approvedArgs();
  args.push('--submit', '--live');
  const result = runTs(args);
  return jsonRule('scheduled-task-runtime-live-needs-host-gateway', 'Live tick requires host ExecutionGateway injection', result, (snapshot) =>
    snapshot.status === 'gateway_unavailable'
    && snapshot.summary.submitRequested === true
    && snapshot.summary.dryRun === false
    && snapshot.summary.gatewayCalled === false
    && snapshot.gatewayDecision.reason === 'ExecutionGateway is not available on this host.');
}

function runKillSwitchFixture() {
  const args = approvedArgs();
  args.push('--submit', '--kill-switch');
  const result = runTs(args);
  return jsonRule('scheduled-task-runtime-kill-switch', 'Runtime kill switch blocks each tick', result, (snapshot) =>
    snapshot.status === 'blocked'
    && snapshot.summary.blockedByKillSwitch === true
    && snapshot.summary.gatewayCalled === false
    && snapshot.checks.some((check) => check.kind === 'kill-switch' && check.status === 'fail'));
}

function approvedArgs() {
  return [
    '--json',
    '--owner-confirmed',
    '--approval=schedule-owner-ok',
    '--approved-by=owner',
    '--schedule=every 15m',
    '--surface=telegram',
    '--tool=web_search',
  ];
}

function ruleWorkspaceCheck() {
  const text = read('package.json');
  const marker = 'node scripts/zavorth-scheduled-task-runtime-check.mjs';
  return rule('workspace-check-wire', 'workspace:check includes Preview engine scheduled runtime gate', text.includes(marker), text.includes(marker) ? 'wired' : 'missing', marker, []);
}

function runTs(args) {
  return spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/zavorth-scheduled-task-runtime.ts',
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
    return rule(id, label, passed, `status=${snapshot.status}; gateway=${snapshot.summary?.gatewayCalled}`, 'expected scheduled task runtime snapshot', passed ? [] : [JSON.stringify(snapshot, null, 2), ...compact(result.stderr)]);
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
