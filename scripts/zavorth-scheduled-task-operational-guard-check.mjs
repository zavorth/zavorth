#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const rules = [
  ruleFilesExist(),
  ruleMarkers(),
  runHealthyFixture(),
  runExpiredFixture(),
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
  console.log('[zavorth-scheduled-task-operational-guard] checking Credential vault');
  printRules(rules, '[zavorth-scheduled-task-operational-guard]');
}
if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthScheduledTaskOperationalGuardContract.ts',
    'src/services/ZavorthScheduledTaskOperationalGuardService.ts',
    'scripts/zavorth-scheduled-task-operational-guard.ts',
    'scripts/zavorth-scheduled-task-operational-guard-check.mjs',
    'tests/domain/agent/ScheduledTaskOperationalGuardService.test.ts',
    'docs/README.md',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('scheduled-task-operational-guard-files', 'Credential vault files exist', missing.length === 0, `${files.length - missing.length}/${files.length}`, 'contract, service, CLI, check, tests and docs are present', missing);
}

function ruleMarkers() {
  const checks = [
    ['src/contracts/ZavorthScheduledTaskOperationalGuardContract.ts', ['ZAVORTH_SCHEDULED_TASK_OPERATIONAL_GUARD_CONTRACT_VERSION', 'approvalExpiredTasks', 'explicitApplyRequiredForAutoPause']],
    ['src/services/ZavorthScheduledTaskOperationalGuardService.ts', ['checkpoint-5-renewal-expiry-auto-pause', 'approval_expired', 'auto_pause_recommended', 'noWorkloadExecution']],
    ['src/services/ZavorthAutomationActionService.ts', ["'reapprove'", 'automation-reapprove']],
    ['src/domain/surface/presentation/shared-surface/SharedSurfaceOperationsCommandPack.ts', ['reapprove|renew']],
    ['src/telegram/controllers/TelegramSchedulerController.ts', ['reapprove|renew']],
    ['src/services/ZavorthAutomationControlPlaneService.ts', ['operationalGuard', 'approvalExpiredTasks', 'autoPauseRecommendedTasks']],
    ['src/services/SchedulerService.ts', ['pauseTask(id: string, reason?: string | null)']],
    ['src/sdk/contracts.ts', ['ZavorthScheduledTaskOperationalGuardContract']],
    ['src/sdk/index.ts', ['ZavorthScheduledTaskOperationalGuardService']],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    for (const needle of needles) {
      if (!text.includes(needle)) missing.push(`${file}: missing ${needle}`);
    }
  }
  return rule('scheduled-task-operational-guard-markers', 'Credential vault markers are wired', missing.length === 0, missing.length === 0 ? 'all markers' : `${missing.length} missing`, 'contract, service, action, surface and control-plane markers exist', missing);
}

function runHealthyFixture() {
  const result = runTs(['--json', '--fixture-scheduler', '--now=2026-05-12T10:00:00.000Z']);
  return jsonRule('scheduled-task-operational-guard-healthy', 'Healthy fixture stays non-mutating', result, (snapshot) =>
    snapshot.status === 'healthy'
    && snapshot.summary.workloadExecutionPerformed === false
    && snapshot.summary.autoPausedTasks === 0);
}

function runExpiredFixture() {
  const result = runTs(['--json', '--fixture-scheduler', '--expired', '--now=2026-05-12T10:00:00.000Z']);
  return jsonRule('scheduled-task-operational-guard-expired', 'Expired approval is critical and recommends reapproval', result, (snapshot) =>
    snapshot.status === 'critical'
    && snapshot.summary.approvalExpiredTasks === 1
    && snapshot.tasks[0]?.recommendedCommand?.includes('/automations reapprove')
    && snapshot.summary.workloadExecutionPerformed === false);
}

function runAutoPauseFixture() {
  const result = runTs(['--json', '--fixture-scheduler', '--failing', '--apply-auto-pause', '--now=2026-05-12T10:00:00.000Z']);
  return jsonRule('scheduled-task-operational-guard-auto-pause', 'Apply auto-pause pauses noisy task only through SchedulerService', result, (snapshot) =>
    snapshot.status === 'critical'
    && snapshot.summary.autoPausedTasks === 1
    && snapshot.receipts.some((receipt) => receipt.kind === 'auto-pause-applied')
    && snapshot.summary.workloadExecutionPerformed === false);
}

function ruleWorkspaceCheck() {
  const text = read('package.json');
  const marker = 'node scripts/zavorth-scheduled-task-operational-guard-check.mjs';
  return rule('workspace-check-wire', 'workspace:check includes Credential vault operational guard gate', text.includes(marker), text.includes(marker) ? 'wired' : 'missing', marker, []);
}

function runTs(args) {
  return spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/zavorth-scheduled-task-operational-guard.ts',
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
    return rule(id, label, passed, `status=${snapshot.status}; autoPaused=${snapshot.summary?.autoPausedTasks}`, 'expected operational guard snapshot', passed ? [] : [JSON.stringify(snapshot, null, 2), ...compact(result.stderr)]);
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
