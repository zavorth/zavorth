#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const prefix = process.platform === 'win32' ? ['cmd', '/c'] : [];
const rules = [
  filesExist(),
  markersPresent(),
  lowFixture(),
  ultraFixture(),
  publicCliFixture(),
  jestFixture(),
  packageGate(),
];
const failed = rules.filter((rule) => rule.status === 'failed');

console.log('[zavorth-effort-control] checking public effort control');
for (const rule of rules) {
  console.log(`[zavorth-effort-control] ${rule.status === 'passed' ? 'ok' : 'fail'} ${rule.label}: ${rule.observed} | ${rule.target}`);
  for (const detail of rule.details.slice(0, 10)) console.log(`  - ${detail}`);
}
if (failed.length > 0) process.exitCode = 1;

function filesExist() {
  const files = [
    'src/contracts/ZavorthEffortControlContract.ts',
    'src/services/ZavorthEffortControlService.ts',
    'scripts/zavorth-effort-control.ts',
    'scripts/zavorth-effort-control-check.mjs',
    'tests/services/ZavorthEffortControlService.test.ts',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('files', 'Effort control files exist', missing.length === 0, `${missing.length}/${files.length}`, 'contract, service, CLI, check and tests are present', missing);
}

function markersPresent() {
  const checks = [
    ['src/contracts/ZavorthEffortControlContract.ts', [
      'zavorth-effort-control/1',
      'ultra-code',
      'noChainOfThoughtExposure',
      'costGuardRequired',
    ]],
    ['src/services/ZavorthEffortControlService.ts', [
      'ZavorthEffortControlService',
      'dynamicWorkflowsRecommended',
      'premium synthesis tier',
      'rawSecretsSerialized: false',
    ]],
    ['scripts/zavorth-effort-control.ts', ['--level', '--request', '--max-cents']],
    ['src/zavorth-cli.ts', ['runEffortControl', "command === 'effort'"]],
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
    for (const needle of needles) if (!text.includes(needle)) missing.push(`${file}: missing ${needle}`);
  }
  return rule('markers', 'Effort control markers exist', missing.length === 0, missing.length ? `${missing.length} missing` : 'all markers', 'levels, guardrails and CLI wiring are present', missing);
}

function lowFixture() {
  const result = runTs(['scripts/zavorth-effort-control.ts', 'low', '--request', 'summarize agora', '--json']);
  return jsonRule('low-json', 'Low effort emits cheap bounded JSON', result, (snapshot) =>
    snapshot.contractVersion === 'zavorth-effort-control/1'
    && snapshot.effectiveLevel === 'low'
    && snapshot.runtime.internalEffort === 'light'
    && snapshot.routing.workerModelClass === 'cheap'
    && snapshot.approval.required === false
    && snapshot.safety.noChainOfThoughtExposure === true);
}

function ultraFixture() {
  const result = runTs(['scripts/zavorth-effort-control.ts', 'ultra-code', '--request', 'revise repo token=secret-value', '--max-cents', '200', '--json']);
  return jsonRule('ultra-json', 'Ultra-code emits governed wide route JSON', result, (snapshot) =>
    snapshot.effectiveLevel === 'ultra-code'
    && snapshot.requestPreview.includes('[redacted]')
    && snapshot.routing.dynamicWorkflowsRecommended === true
    && snapshot.routing.synthesisModelClass === 'premium'
    && snapshot.approval.required === true
    && snapshot.commandPreview.dynamicWorkflow.includes('zavorth workflows'));
}

function publicCliFixture() {
  const result = runTs(['src/zavorth-cli.ts', 'effort', 'ultra-code', '--max-cents', '200', 'revise repo', '--json']);
  return jsonRule('public-cli', 'Public effort CLI skips flag values when building the request', result, (snapshot) =>
    snapshot.effectiveLevel === 'ultra-code'
    && snapshot.budget.maxCents === 200
    && snapshot.requestPreview === 'revise repo');
}

function jestFixture() {
  const result = spawnSync(prefix[0] || 'npx', [
    ...(prefix.length ? [prefix[1], 'npx', 'jest'] : ['jest']),
    'tests/services/ZavorthEffortControlService.test.ts',
    '--runInBand',
  ], { cwd: root, encoding: 'utf8' });
  return rule('jest', 'Effort control Jest suite passes', result.status === 0, `exit ${result.status ?? 'unknown'}`, 'unit tests pass', result.status === 0 ? [] : compact(result.stderr, result.stdout));
}

function packageGate() {
  const pkg = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
  const passed = pkg.includes('zavorth:effort-control:check') && pkg.includes('scripts/zavorth-effort-control-check.mjs');
  return rule('package-gate', 'Effort control is wired into package gates', passed, passed ? 'wired' : 'missing', 'package exposes check script and workspace gate can call it', []);
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
    return rule(id, label, passed, `level=${parsed.effectiveLevel}`, 'expected effort behavior', passed ? [] : [JSON.stringify(parsed, null, 2)]);
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
