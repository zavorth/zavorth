#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const rules = [
  ruleFilesExist(),
  ruleMarkers(),
  runReadinessFixture(),
  ruleSurfaceCommandMarkers(),
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
  console.log('[zavorth-scheduled-task-daily-ops-readiness] checking Surface controls');
  printRules(rules, '[zavorth-scheduled-task-daily-ops-readiness]');
}
if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthScheduledTaskDailyOpsReadinessContract.ts',
    'src/services/ZavorthScheduledTaskDailyOpsReadinessService.ts',
    'scripts/zavorth-scheduled-task-daily-ops-readiness.ts',
    'scripts/zavorth-scheduled-task-daily-ops-readiness-check.mjs',
    'tests/domain/agent/ScheduledTaskDailyOpsReadinessService.test.ts',
    'docs/README.md',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('scheduled-task-daily-ops-files', 'Surface controls files exist', missing.length === 0, `${files.length ? missing.length}/${files.length}`, 'contract, service, CLI, check, tests and docs are present', missing);
}

function ruleMarkers() {
  const checks = [
    ['src/contracts/ZavorthScheduledTaskDailyOpsReadinessContract.ts', ['ZAVORTH_SCHEDULED_TASK_DAILY_OPS_READINESS_CONTRACT_VERSION', 'dailyUseReady', 'noZavorthControlVisualMutation']],
    ['src/services/ZavorthScheduledTaskDailyOpsReadinessService.ts', ['gate-7-scheduled-task-daily-ops-readiness', 'ZavorthScheduledTaskLiveTickCertificationService', 'allUserActionsGoThroughGovernedSurfaces']],
    ['scripts/zavorth-scheduled-task-daily-ops-readiness.ts', ['--task=', 'ZavorthScheduledTaskDailyOpsReadinessService']],
    ['src/sdk/contracts.ts', ['ZavorthScheduledTaskDailyOpsReadinessContract']],
    ['src/sdk/index.ts', ['ZavorthScheduledTaskDailyOpsReadinessService']],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    for (const needle of needles) {
      if (!text.includes(needle)) missing.push(`${file}: missing ${needle}`);
    }
  }
  return rule('scheduled-task-daily-ops-markers', 'Surface controls markers are wired', missing.length === 0, missing.length === 0 ? 'all markers' : `${missing.length} missing`, 'contract, service, CLI and SDK markers exist', missing);
}

function runReadinessFixture() {
  const result = runTs(['--json', '--now=2026-05-12T10:00:00.000Z']);
  return jsonRule('scheduled-task-daily-ops-fixture', 'Daily ops readiness fixture is usable', result, (snapshot) =>
    snapshot.status === 'attention'
    && snapshot.summary.dailyUseReady === true
    && snapshot.liveTickCertification.status === 'passed'
    && snapshot.summary.readySurfaces >= 10
    && snapshot.gates.some((gate) => gate.kind === 'host-task-readiness' && gate.status === 'warn')
    && snapshot.safety.noZavorthControlVisualMutation === true
    && snapshot.safety.noDirectDispatcherBypass === true);
}

function ruleSurfaceCommandMarkers() {
  const checks = [
    ['src/domain/surface/presentation/shared-surface/SharedSurfaceOperationsCommandPack.ts', ['/schedule', '/schedules', '/unschedule']],
    ['src/telegram/controllers/TelegramSchedulerController.ts', ['handleSchedule', 'handleReport', 'handleListSchedules', 'handleUnschedule', 'reapprove|renew']],
    ['src/services/ZavorthAutomationActionService.ts', ['automation-reapprove', "'reapprove'"]],
    ['src/services/ZavorthAutomationControlPlaneService.ts', ['operationalGuard', 'approvalExpiredTasks']],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    for (const needle of needles) {
      if (!text.includes(needle)) missing.push(`${file}: missing ${needle}`);
    }
  }
  return rule('scheduled-task-surface-command-markers', 'Daily ops commands are present in existing surfaces', missing.length === 0, missing.length === 0 ? 'all markers' : `${missing.length} missing`, 'shared, Telegram and automation control plane markers exist', missing);
}

function ruleWorkspaceCheck() {
  const text = read('package.json');
  const marker = 'node scripts/zavorth-scheduled-task-daily-ops-readiness-check.mjs';
  return rule('workspace-check-wire', 'workspace:check includes Surface controls daily ops readiness gate', text.includes(marker), text.includes(marker) ? 'wired' : 'missing', marker, []);
}

function runTs(args) {
  return spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/zavorth-scheduled-task-daily-ops-readiness.ts',
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
    return rule(id, label, passed, `status=${snapshot.status}; dailyUseReady=${snapshot.summary?.dailyUseReady}`, 'expected daily ops readiness snapshot', passed ? [] : [JSON.stringify(snapshot, null, 2), ...compact(result.stderr)]);
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
