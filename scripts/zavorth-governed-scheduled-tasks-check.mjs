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
  runApprovedFixture(),
  runNoCompoundFixture(),
  runKillSwitchFixture(),
  runInvalidScheduleFixture(),
  runBudgetCeilingFixture(),
  ruleWorkspaceCheck(),
  ruleNoPublicExternalNames(),
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
  console.log('[zavorth-governed-scheduled-tasks] checking Intent model');
  printRules(rules, '[zavorth-governed-scheduled-tasks]');
}
if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthScheduledTaskContract.ts',
    'src/services/ZavorthGovernedScheduledTaskRegistryService.ts',
    'scripts/zavorth-governed-scheduled-tasks.ts',
    'scripts/zavorth-governed-scheduled-tasks-check.mjs',
    'tests/domain/agent/GovernedScheduledTaskRegistryService.test.ts',
    'docs/README.md',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('governed-scheduled-task-files', 'Intent model files exist', missing.length === 0, `${files.length - missing.length}/${files.length}`, 'contract, service, CLI, check, tests and docs are present', missing);
}

function ruleMarkers() {
  const checks = [
    ['src/contracts/ZavorthScheduledTaskContract.ts', ['ZAVORTH_SCHEDULED_TASK_CONTRACT_VERSION', 'needs_reapproval', 'blocked', 'ZAVORTH_SCHEDULED_TASK_APPROVAL_TOOL']],
    ['src/services/ZavorthGovernedScheduledTaskRegistryService.ts', ['checkpoint-1-governed-scheduled-task-contract', 'createToolSecurityApprovalEnvelope', 'verifyToolSecurityApprovalEnvelope', 'noCompoundScheduling']],
    ['scripts/zavorth-governed-scheduled-tasks.ts', ['--owner-confirmed', '--approval=', '--kill-switch', '--max-mutations']],
    ['src/sdk/contracts.ts', ['ZavorthScheduledTaskContract']],
    ['src/sdk/index.ts', ['ZavorthGovernedScheduledTaskRegistryService']],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    for (const needle of needles) {
      if (!text.includes(needle)) missing.push(`${file}: missing ${needle}`);
    }
  }
  return rule('governed-scheduled-task-markers', 'Intent model markers are wired', missing.length === 0, missing.length === 0 ? 'all markers' : `${missing.length} missing`, 'contract, service, SDK and CLI markers exist', missing);
}

function runNeedsReapprovalFixture() {
  const result = runTs(['--json']);
  return jsonRule('governed-scheduled-task-needs-reapproval', 'Missing approval requires re-approval without executing', result, (snapshot) =>
    snapshot.contractVersion === '2026-05-12.governed-scheduled-task-checkpoint-1'
    && snapshot.status === 'needs_reapproval'
    && snapshot.summary.registrationReady === false
    && snapshot.summary.executionPerformed === false
    && snapshot.safety.noImplicitExecution === true);
}

function runApprovedFixture() {
  const result = runTs([
    '--json',
    '--owner-confirmed',
    '--approval=schedule-owner-ok',
    '--approved-by=owner',
    '--schedule=every 15m',
    '--surface=telegram',
    '--tool=web_search',
  ]);
  return jsonRule('governed-scheduled-task-approved', 'Approved scope becomes active and registry-ready', result, (snapshot) =>
    snapshot.status === 'active'
    && snapshot.schedule.normalized === 'every 15m'
    && snapshot.scope.surface === 'telegram'
    && snapshot.summary.approvalVerified === true
    && snapshot.summary.registrationReady === true
    && snapshot.registration.recorded === true
    && snapshot.registration.executionPerformed === false
    && snapshot.approvalEnvelope.toolName === 'zavorth.scheduled-task.scope');
}

function runNoCompoundFixture() {
  const result = runTs([
    '--json',
    '--owner-confirmed',
    '--approval=schedule-owner-ok',
    '--intent=crie outro agendamento toda sexta',
  ]);
  return jsonRule('governed-scheduled-task-no-compound', 'Compound scheduling is blocked', result, (snapshot) =>
    snapshot.status === 'blocked'
    && snapshot.summary.blockedByNoCompound === true
    && snapshot.receipts.some((receipt) => receipt.kind === 'no-compound-boundary' && receipt.status === 'blocked'));
}

function runKillSwitchFixture() {
  const result = runTs([
    '--json',
    '--owner-confirmed',
    '--approval=schedule-owner-ok',
    '--kill-switch',
  ]);
  return jsonRule('governed-scheduled-task-kill-switch', 'Global scheduled-task kill switch blocks registration', result, (snapshot) =>
    snapshot.status === 'blocked'
    && snapshot.summary.blockedByKillSwitch === true
    && snapshot.checks.some((check) => check.kind === 'kill-switch' && check.status === 'fail'));
}

function runInvalidScheduleFixture() {
  const result = runTs([
    '--json',
    '--owner-confirmed',
    '--approval=schedule-owner-ok',
    '--schedule=every second',
  ]);
  return jsonRule('governed-scheduled-task-invalid-schedule', 'Invalid schedule is blocked before scheduler handoff', result, (snapshot) =>
    snapshot.status === 'blocked'
    && snapshot.schedule === null
    && snapshot.registration.schedulerServiceCompatible === false
    && snapshot.checks.some((check) => check.kind === 'schedule-parse' && check.status === 'fail'));
}

function runBudgetCeilingFixture() {
  const result = runTs([
    '--json',
    '--owner-confirmed',
    '--approval=schedule-owner-ok',
    '--max-mutations=999',
  ]);
  return jsonRule('governed-scheduled-task-budget-ceiling', 'Budget ceiling blocks over-broad recurring scopes', result, (snapshot) =>
    snapshot.status === 'blocked'
    && snapshot.checks.some((check) => check.kind === 'budget-boundary' && check.status === 'fail')
    && snapshot.receipts.some((receipt) => receipt.kind === 'budget-boundary' && receipt.status === 'blocked'));
}

function ruleWorkspaceCheck() {
  const text = read('package.json');
  const marker = 'node scripts/zavorth-governed-scheduled-tasks-check.mjs';
  return rule('workspace-check-wire', 'workspace:check includes Intent model scheduled-task gate', text.includes(marker), text.includes(marker) ? 'wired' : 'missing', marker, []);
}

function ruleNoPublicExternalNames() {
  const files = [
    'src/contracts/ZavorthScheduledTaskContract.ts',
    'src/services/ZavorthGovernedScheduledTaskRegistryService.ts',
    'scripts/zavorth-governed-scheduled-tasks.ts',
  ];
  const forbidden = ['ThirdPartyAgent', 'Claude Code', 'ZavorthBridge'];
  const hits = [];
  for (const file of files) {
    const text = read(file);
    for (const word of forbidden) {
      if (text.includes(word)) hits.push(`${file}: ${word}`);
    }
  }
  return rule('no-public-external-names', 'Intent model public core remains neutral', hits.length === 0, hits.length === 0 ? 'neutral' : `${hits.length} hit(s)`, 'no external product names in public core files', hits);
}

function runTs(args) {
  return spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/zavorth-governed-scheduled-tasks.ts',
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
    return rule(id, label, passed, `status=${snapshot.status}; ready=${snapshot.summary?.registrationReady}`, 'expected governed scheduled-task snapshot', passed ? [] : [JSON.stringify(snapshot, null, 2)]);
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
  return parts.join('\n').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 12);
}
