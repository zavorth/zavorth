#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const prefix = process.platform === 'win32' ? ['cmd', '/c'] : [];
const rules = [
  filesExist(),
  markersPresent(),
  jsonFixture(),
  blockedFixture(),
  launchFixture(),
  publicCliCompatibilityFixture(),
  jestFixture(),
  workspaceGate(),
];
const failed = rules.filter((rule) => rule.status === 'failed');

console.log('[zavorth-dynamic-workflows] checking governed dynamic workflows');
for (const rule of rules) {
  console.log(`[zavorth-dynamic-workflows] ${rule.status === 'passed' ? 'ok' : 'fail'} ${rule.label}: ${rule.observed} | ${rule.target}`);
  for (const detail of rule.details.slice(0, 10)) console.log(`  - ${detail}`);
}
if (failed.length > 0) process.exitCode = 1;

function filesExist() {
  const files = [
    'src/contracts/ZavorthDynamicWorkflowContract.ts',
    'src/services/ZavorthDynamicWorkflowService.ts',
    'scripts/zavorth-dynamic-workflows.ts',
    'scripts/zavorth-dynamic-workflows-check.mjs',
    'tests/services/ZavorthDynamicWorkflowService.test.ts',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('files', 'Dynamic workflow files exist', missing.length === 0, `${files.length ? missing.length}/${files.length}`, 'contract, service, CLI, check and tests are present', missing);
}

function markersPresent() {
  const checks = [
    ['src/contracts/ZavorthDynamicWorkflowContract.ts', [
      'zavorth-dynamic-workflows/1',
      'zavorth-dynamic-workflow-plan/v1',
      'arbitraryJavaScriptGenerated: false',
      'stopWhenExceeded: true',
    ]],
    ['src/services/ZavorthDynamicWorkflowService.ts', [
      'ZavorthDynamicWorkflowService',
      'launchSwarm',
      'workerModelClass',
      'synthesisModelClass',
      'noArbitraryCodeExecution',
      'budgetHardCapEnforced',
    ]],
    ['scripts/zavorth-dynamic-workflows.ts', ['--fanout', '--worker-model', '--synthesis-model', '--max-cents', 'launch', '--approval-id']],
    ['tests/services/ZavorthDynamicWorkflowService.test.ts', ['cheap fanout', 'strong synthesis', 'materializes an approved preview']],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const filePath = path.join(root, file);
    if (!fs.existsSync(filePath)) {
      missing.push(`${file}: file not found`);
      continue;
    }
    let text = '';
    try {
      text = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      missing.push(`${file}: read failed (${error?.message || String(error)})`);
      continue;
    }
    for (const needle of needles) {
      if (!text.includes(needle)) missing.push(`${file}: missing ${needle}`);
    }
  }
  return rule('markers', 'Dynamic workflow markers exist', missing.length === 0, missing.length ? `${missing.length} missing` : 'all markers', 'plan, budget, no-JS and launch markers are present', missing);
}

function jsonFixture() {
  const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dynamic-workflows-check-'));
  const result = runTs(['scripts/zavorth-dynamic-workflows.ts', '--objective', 'analyze 80 files', '--fanout', '80', '--max-concurrency', '12', '--max-cents', '75', '--worker-model', 'cheap', '--synthesis-model', 'premium', '--storage-dir', storageDir, '--json']);
  return jsonRule('json-fixture', 'Dynamic workflow CLI emits governed preview JSON', result, (snapshot) =>
    snapshot.contractVersion === 'zavorth-dynamic-workflows/1'
    && snapshot.status === 'needs-approval'
    && snapshot.scale.effectiveFanout === 80
    && snapshot.routing.workers.modelClass === 'cheap'
    && snapshot.routing.synthesis.modelClass === 'premium'
    && snapshot.orchestration.arbitraryJavaScriptGenerated === false
    && snapshot.safety.noArbitraryCodeExecution === true
    && snapshot.previewRegistry.status === 'saved');
}

function blockedFixture() {
  const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dynamic-workflows-check-'));
  const result = runTs(['scripts/zavorth-dynamic-workflows.ts', '--objective', 'pesquisa without limite', '--fanout', '500', '--max-concurrency', '60', '--max-cents', '1', '--worker-model', 'premium', '--synthesis-model', 'premium', '--storage-dir', storageDir, '--json']);
  return jsonRule('blocked-fixture', 'Dynamic workflow blocks excessive fanout and budget', result, (snapshot) =>
    snapshot.status === 'blocked'
    && snapshot.blockedReasons.includes('requested fanout exceeds hard cap')
    && snapshot.blockedReasons.includes('requested concurrency exceeds hard cap')
    && snapshot.blockedReasons.includes('estimated cost exceeds approved budget')
    && snapshot.materialization.ready === false);
}

function launchFixture() {
  const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dynamic-workflows-check-'));
  const preview = runTs(['scripts/zavorth-dynamic-workflows.ts', '--objective', 'audit 24 files', '--fanout', '24', '--max-concurrency', '6', '--max-cents', '80', '--worker-model', 'cheap', '--synthesis-model', 'premium', '--storage-dir', storageDir, '--json']);
  if (preview.status !== 0) {
    return rule('launch-fixture', 'Dynamic workflow launch materializes saved previews with approval', false, `preview exit ${preview.status ?? 'unknown'}`, 'preview saved and launch materialized', compact(preview.stderr, preview.stdout));
  }
  let snapshot;
  try {
    snapshot = JSON.parse(preview.stdout);
  } catch (error) {
    return rule('launch-fixture', 'Dynamic workflow launch materializes saved previews with approval', false, 'invalid preview JSON', 'preview saved and launch materialized', [String(error)]);
  }
  const blocked = runTs(['scripts/zavorth-dynamic-workflows.ts', 'launch', snapshot.workflowId, '--storage-dir', storageDir, '--json']);
  const launched = runTs(['scripts/zavorth-dynamic-workflows.ts', 'launch', snapshot.workflowId, '--approval-id', snapshot.approval.approvalId, '--storage-dir', storageDir, '--json']);
  try {
    const blockedJson = JSON.parse(blocked.stdout);
    const launchedJson = JSON.parse(launched.stdout);
    const passed = blockedJson.status === 'blocked'
      && blockedJson.reason === 'approval required before materializing dynamic workflow'
      && launchedJson.status === 'materialized'
      && launchedJson.safety.noDirectExecutionAuthority === true
      && launchedJson.safety.budgetPassedToSwarm === true
      && JSON.stringify(launchedJson).includes('secret-value') === false;
    return rule('launch-fixture', 'Dynamic workflow launch materializes saved previews with approval', passed, `blocked=${blockedJson.status}, launch=${launchedJson.status}`, 'blocked without approval, materialized with approval', passed ? [] : [JSON.stringify({ blockedJson, launchedJson }, null, 2)]);
  } catch (error) {
    return rule('launch-fixture', 'Dynamic workflow launch materializes saved previews with approval', false, 'invalid launch JSON', 'valid launch JSON', [String(error), ...compact(blocked.stderr, blocked.stdout, launched.stderr, launched.stdout)]);
  }
}

function publicCliCompatibilityFixture() {
  const help = runTs(['src/zavorth-cli.ts', 'workflows', '--help']);
  const status = runTs(['src/zavorth-cli.ts', 'workflows', 'status', '--json']);
  let statusJson = null;
  try {
    statusJson = JSON.parse(status.stdout);
  } catch {
    statusJson = null;
  }
  const passed = help.status === 0
    && help.stdout.includes('Zavorth Dynamic Workflows')
    && (status.status === 0 || status.status === 1)
    && statusJson
    && statusJson.contractVersion !== 'zavorth-dynamic-workflows/1';
  return rule('public-cli', 'Public CLI keeps dynamic help and legacy workflow queue status distinct', passed, `help=${help.status ?? 'unknown'}, status=${status.status ?? 'unknown'}`, 'workflows --help explains Dynamic Workflows; workflows status remains queue status', passed ? [] : compact(help.stderr, help.stdout, status.stderr, status.stdout));
}

function jestFixture() {
  const result = spawnSync(prefix[0] || 'npx', [
    ...(prefix.length ? [prefix[1], 'npx', 'jest'] : ['jest']),
    'tests/services/ZavorthDynamicWorkflowService.test.ts',
    '--runInBand',
  ], { cwd: root, encoding: 'utf8' });
  return rule('jest', 'Dynamic workflow Jest suite passes', result.status === 0, `exit ${result.status ?? 'unknown'}`, 'unit tests pass', result.status === 0 ? [] : compact(result.stderr, result.stdout));
}

function workspaceGate() {
  const pkg = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
  const passed = pkg.includes('zavorth:dynamic-workflows:check') && pkg.includes('scripts/zavorth-dynamic-workflows-check.mjs');
  return rule('workspace-gate', 'Dynamic workflows are wired into package gates', passed, passed ? 'wired' : 'missing', 'package exposes check script and workspace gate can call it', []);
}

function runTs(args) {
  return spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    ...args,
  ], { cwd: root, encoding: 'utf8' });
}

function jsonRule(id, label, result, expect) {
  if (result.status !== 0) return rule(id, label, false, `exit ${result.status ?? 'unknown'}`, 'valid JSON fixture', compact(result.stderr, result.stdout));
  try {
    const parsed = JSON.parse(result.stdout);
    const passed = expect(parsed);
    return rule(id, label, passed, `status=${parsed.status}`, 'expected dynamic workflow behavior', passed ? [] : [JSON.stringify(parsed, null, 2)]);
  } catch (error) {
    return rule(id, label, false, 'invalid JSON', 'valid JSON fixture', [String(error), ...compact(result.stderr, result.stdout)]);
  }
}

function rule(id, label, passed, observed, target, details = []) {
  return { id, label, status: passed ? 'passed' : 'failed', observed, target, details };
}

function compact(...parts) {
  return parts.join('\n').split(/\r...\n/).map((line) => line.trim()).filter(Boolean).slice(0, 12);
}
