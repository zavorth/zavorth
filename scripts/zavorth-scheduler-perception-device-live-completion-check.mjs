#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const rules = [
  filesExist(),
  packageScriptsWired(),
  workspaceCheckWired(),
  runCompletionSnapshot(),
];
const failed = rules.filter((rule) => rule.status === 'failed');
const snapshot = { generatedAt: new Date().toISOString(), status: failed.length > 0 ? 'failed' : 'passed', rules };

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[zavorth-scheduler-perception-device-live-completion] checking Phase 7');
  for (const item of rules) {
    console.log(`[zavorth-scheduler-perception-device-live-completion] ${item.status === 'passed' ? 'ok' : 'fail'} ${item.label}: ${item.observed} | ${item.target}`);
    for (const detail of item.details.slice(0, 10)) console.log(`  - ${detail}`);
  }
}
if (failed.length > 0) process.exitCode = 1;

function filesExist() {
  const files = [
    'src/contracts/ZavorthSchedulerPerceptionDeviceLiveCompletionContract.ts',
    'src/services/ZavorthSchedulerPerceptionDeviceLiveCompletionService.ts',
    'scripts/zavorth-scheduler-perception-device-live-completion.ts',
    'scripts/zavorth-scheduler-perception-device-live-completion-check.mjs',
    'tests/services/ZavorthSchedulerPerceptionDeviceLiveCompletionService.test.ts',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('files', 'Phase 7 files exist', missing.length === 0, `${files.length - missing.length}/${files.length}`, 'all files present', missing);
}

function packageScriptsWired() {
  const scripts = JSON.parse(read('package.json')).scripts || {};
  const markers = [
    'zavorth:scheduler-perception-device-live-completion',
    'zavorth:scheduler-perception-device-live-completion:json',
    'zavorth:scheduler-perception-device-live-completion:check',
  ];
  const missing = markers.filter((marker) => !scripts[marker]);
  return rule('package-scripts', 'Package scripts are wired', missing.length === 0, missing.length === 0 ? 'all scripts' : `${missing.length} missing`, markers.join(', '), missing);
}

function workspaceCheckWired() {
  const workspace = String(JSON.parse(read('package.json')).scripts?.['workspace:check'] || '');
  const marker = 'zavorth:scheduler-perception-device-live-completion:check';
  return rule('workspace-check', 'workspace:check includes Phase 7 gate', workspace.includes(marker), workspace.includes(marker) ? 'wired' : 'missing', marker, []);
}

function runCompletionSnapshot() {
  const result = spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/zavorth-scheduler-perception-device-live-completion.ts',
    '--json',
    '--require-pass',
  ], { cwd: root, encoding: 'utf8', env: process.env });
  if (result.status !== 0) {
    return rule('snapshot', 'Completion snapshot runs', false, `exit ${result.status ?? 'unknown'}`, 'valid JSON with no blocked status', compact(result.stderr, result.stdout));
  }
  try {
    const data = JSON.parse(result.stdout);
    const pass = data.contractVersion === '2026-05-14.phase-7-scheduler-perception-device-live-completion'
      && data.status !== 'blocked'
      && data.summary?.schedulerDailyUseReady === true
      && data.summary?.perceptionReadOnlyReady === true
      && data.summary?.deviceCompanionReady === true
      && data.liveCompletion?.androidAdbRequiresHostAuthorization === true
      && data.safety?.noTerminalAutomationBypass === true
      && data.summary?.rawSecretsSerialized === false;
    return rule('snapshot', 'Completion snapshot runs', pass, `status=${data.status}; entries=${data.summary?.entries}`, 'scheduler/perception/device completion without unsafe defaults', pass ? [] : [JSON.stringify(data, null, 2)]);
  } catch (error) {
    return rule('snapshot', 'Completion snapshot runs', false, 'invalid JSON', 'valid JSON output', [String(error), ...compact(result.stderr, result.stdout)]);
  }
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function rule(id, label, passed, observed, target, details = []) {
  return { id, label, status: passed ? 'passed' : 'failed', observed, target, details };
}

function compact(...parts) {
  return parts.join('\n').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 12);
}
