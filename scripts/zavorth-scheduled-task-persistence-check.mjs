#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const rules = [
  ruleFilesExist(),
  ruleMarkers(),
  runPreviewFixture(),
  runRegisterFixture(),
  runNeedsReapprovalFixture(),
  runNoSchedulerFixture(),
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
  console.log('[zavorth-scheduled-task-persistence] checking Phase 3');
  printRules(rules, '[zavorth-scheduled-task-persistence]');
}
if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthScheduledTaskPersistenceContract.ts',
    'src/services/ZavorthScheduledTaskPersistenceService.ts',
    'scripts/zavorth-scheduled-task-persistence.ts',
    'scripts/zavorth-scheduled-task-persistence-check.mjs',
    'tests/domain/agent/ScheduledTaskPersistenceService.test.ts',
    'docs/README.md',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('scheduled-task-persistence-files', 'Phase 3 files exist', missing.length === 0, `${files.length - missing.length}/${files.length}`, 'contract, service, CLI, check, tests and docs are present', missing);
}

function ruleMarkers() {
  const checks = [
    ['src/contracts/ZavorthScheduledTaskPersistenceContract.ts', ['ZAVORTH_SCHEDULED_TASK_PERSISTENCE_CONTRACT_VERSION', 'persisted', 'reapproved', 'storesGovernedScopeInGuardrails']],
    ['src/services/ZavorthScheduledTaskPersistenceService.ts', ['phase-3-persisted-scheduled-task-registration', 'scheduleTask', 'governedScheduledTask', 'updateTaskRuntimeMetadata']],
    ['src/services/SchedulerService.ts', ['governedScheduledTask', 'updateTaskRuntimeMetadata', 'SchedulerGovernedScheduledTaskMetadata']],
    ['src/storage/SchedulerRepository.ts', ['updateRuntimeMetadata']],
    ['scripts/zavorth-scheduled-task-persistence.ts', ['--action=', '--fixture-scheduler', '--owner-confirmed', '--approval=']],
    ['src/sdk/contracts.ts', ['ZavorthScheduledTaskPersistenceContract']],
    ['src/sdk/index.ts', ['ZavorthScheduledTaskPersistenceService']],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    for (const needle of needles) {
      if (!text.includes(needle)) missing.push(`${file}: missing ${needle}`);
    }
  }
  return rule('scheduled-task-persistence-markers', 'Phase 3 markers are wired', missing.length === 0, missing.length === 0 ? 'all markers' : `${missing.length} missing`, 'contract, service, scheduler, SDK and CLI markers exist', missing);
}

function runPreviewFixture() {
  const result = runTs(approvedArgs());
  return jsonRule('scheduled-task-persistence-preview', 'Preview prepares governed metadata without persistence', result, (snapshot) =>
    snapshot.contractVersion === '2026-05-12.persisted-scheduled-task-registration-phase-3'
    && snapshot.status === 'preview_ready'
    && snapshot.summary.runtimeReady === true
    && snapshot.summary.taskPersisted === false
    && snapshot.summary.executionPerformed === false
    && snapshot.governedMetadata.approvedScopeHash);
}

function runRegisterFixture() {
  const args = approvedArgs();
  args.push('--fixture-scheduler', '--action=register');
  const result = runTs(args);
  return jsonRule('scheduled-task-persistence-register', 'Register persists governed task through SchedulerService', result, (snapshot) =>
    snapshot.status === 'persisted'
    && snapshot.summary.schedulerAvailable === true
    && snapshot.summary.taskPersisted === true
    && snapshot.summary.taskGoverned === true
    && snapshot.task.guardrail_json.includes('governedScheduledTask')
    && snapshot.receipts.some((receipt) => receipt.kind === 'scheduler-task-created' && receipt.status === 'persisted'));
}

function runNeedsReapprovalFixture() {
  const result = runTs(['--json', '--fixture-scheduler', '--action=register']);
  return jsonRule('scheduled-task-persistence-needs-reapproval', 'Register without approval does not persist', result, (snapshot) =>
    snapshot.status === 'needs_reapproval'
    && snapshot.summary.taskPersisted === false
    && snapshot.summary.executionPerformed === false);
}

function runNoSchedulerFixture() {
  const args = approvedArgs();
  args.push('--action=register', '--no-scheduler');
  const result = runTs(args);
  return jsonRule('scheduled-task-persistence-no-scheduler', 'Register needs SchedulerService', result, (snapshot) =>
    snapshot.status === 'scheduler_unavailable'
    && snapshot.summary.schedulerAvailable === false
    && snapshot.summary.taskPersisted === false);
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
  const marker = 'node scripts/zavorth-scheduled-task-persistence-check.mjs';
  return rule('workspace-check-wire', 'workspace:check includes Phase 3 scheduled persistence gate', text.includes(marker), text.includes(marker) ? 'wired' : 'missing', marker, []);
}

function ruleNoPublicExternalNames() {
  const files = [
    'src/contracts/ZavorthScheduledTaskPersistenceContract.ts',
    'src/services/ZavorthScheduledTaskPersistenceService.ts',
    'scripts/zavorth-scheduled-task-persistence.ts',
  ];
  const forbidden = ['OpenClaw', 'Claude Code', 'ZavorthBridge'];
  const hits = [];
  for (const file of files) {
    const text = read(file);
    for (const word of forbidden) {
      if (text.includes(word)) hits.push(`${file}: ${word}`);
    }
  }
  return rule('no-public-external-names', 'Phase 3 public core remains neutral', hits.length === 0, hits.length === 0 ? 'neutral' : `${hits.length} hit(s)`, 'no external product names in public core files', hits);
}

function runTs(args) {
  return spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/zavorth-scheduled-task-persistence.ts',
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
    return rule(id, label, passed, `status=${snapshot.status}; persisted=${snapshot.summary?.taskPersisted}`, 'expected scheduled task persistence snapshot', passed ? [] : [JSON.stringify(snapshot, null, 2), ...compact(result.stderr)]);
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
