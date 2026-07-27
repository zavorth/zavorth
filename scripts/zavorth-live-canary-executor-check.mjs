#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const rules = [
  ruleFilesExist(),
  ruleMarkers(),
  runNeedsApplyGateFixture(),
  runReadyFixture(),
  runLocalExecutionFixture(),
  runMissingIdempotencyFixture(),
  runUnsupportedFixture(),
  ruleWorkspaceCheck(),
];
const failed = rules.filter((ruleItem) => ruleItem.status === 'failed');
const snapshot = {
  generatedAt: new Date().toISOString(),
  status: failed.length > 0 ? 'failed' : 'passed',
  rules,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[zavorth-live-canary-executor] checking Intent model0');
  printRules(rules, '[zavorth-live-canary-executor]');
}
if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthLiveCanaryControlledExecutorContract.ts',
    'src/services/ZavorthLiveCanaryControlledExecutorService.ts',
    'scripts/zavorth-live-canary-executor.ts',
    'scripts/zavorth-live-canary-executor-check.mjs',
    'tests/domain/agent/LiveCanaryControlledExecutorService.test.ts',
    'docs/README.md',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('live-canary-executor-files', 'Intent model0 files exist', missing.length === 0, `${files.length ? missing.length}/${files.length}`, 'contract, service, CLI, check, tests and docs are present', missing);
}

function ruleMarkers() {
  const checks = [
    ['src/contracts/ZavorthLiveCanaryControlledExecutorContract.ts', ['ZAVORTH_LIVE_CANARY_CONTROLLED_EXECUTOR_CONTRACT_VERSION', 'local_ack', 'provider_live_canary', 'idempotencyKeyRequiredForExecution']],
    ['src/services/ZavorthLiveCanaryControlledExecutorService.ts', ['gate-10-live-canary-controlled-executor', 'ZavorthLiveCanaryApplyGateRollbackDrillService', 'ZavorthProviderLiveCanaryService', 'supportsAdapter']],
    ['scripts/zavorth-live-canary-executor.ts', ['--execute-local', '--execute-provider', '--idempotency-key', '--operator-confirmed']],
    ['src/sdk/contracts.ts', ['ZavorthLiveCanaryControlledExecutorContract']],
    ['src/sdk/index.ts', ['ZavorthLiveCanaryControlledExecutorService']],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    for (const needle of needles) {
      if (!text.includes(needle)) missing.push(`${file}: missing ${needle}`);
    }
  }
  return rule('live-canary-executor-markers', 'Intent model0 markers are wired', missing.length === 0, missing.length === 0 ? 'all markers' : `${missing.length} missing`, 'executor, SDK and CLI markers exist', missing);
}

function runNeedsApplyGateFixture() {
  const result = runTs('scripts/zavorth-live-canary-executor.ts', ['--json']);
  return jsonRule('live-canary-executor-needs-gate', 'Executor requires Certification matrix apply gate first', result, (snapshot) =>
    snapshot.contractVersion === '2026-05-11.live-canary-controlled-executor-gate-10'
    && snapshot.status === 'needs-apply-gate'
    && snapshot.executionResult.status === 'not-run'
    && snapshot.safety.noImplicitExecutionFromChecks === true);
}

function runReadyFixture() {
  const result = runTs('scripts/zavorth-live-canary-executor.ts', readyArgs());
  return jsonRule('live-canary-executor-ready', 'Executor reports operator-ready before execution', result, (snapshot) =>
    snapshot.status === 'ready-for-execution'
    && snapshot.mode === 'operator-ready'
    && snapshot.summary.applyGateOpen === true
    && snapshot.summary.executionPerformed === false
    && snapshot.checks.some((check) => check.kind === 'explicit-execute' && check.status === 'warn'));
}

function runLocalExecutionFixture() {
  const args = readyArgs();
  args.push('--execute-local', '--idempotency-key=idem-123');
  const result = runTs('scripts/zavorth-live-canary-executor.ts', args);
  return jsonRule('live-canary-executor-local', 'local controlled canary executes without external IO', result, (snapshot) =>
    snapshot.status === 'executed'
    && snapshot.mode === 'controlled-live-execution'
    && snapshot.summary.executionPerformed === true
    && snapshot.summary.externalIoPerformed === false
    && snapshot.executionResult.executionReceiptId === 'gate-10-execution:gate-8-default-live-canary-adapter:idem-123'
    && snapshot.executionResult.rollbackReceiptId === 'gate-10-rollback:gate-8-default-live-canary-adapter:idem-123');
}

function runMissingIdempotencyFixture() {
  const args = readyArgs();
  args.push('--executor=local_ack', '--operator-confirmed');
  args.push('--execute-local');
  const filtered = args.filter((item) => !item.startsWith('--idempotency-key'));
  const result = runTs('scripts/zavorth-live-canary-executor.ts', filtered);
  return jsonRule('live-canary-executor-auto-idempotency', 'CLI auto-generates idempotency for explicit execution', result, (snapshot) =>
    snapshot.status === 'executed'
    && snapshot.executionRequest.idempotencyKey.startsWith('cli-')
    && snapshot.summary.executionPerformed === true);
}

function runUnsupportedFixture() {
  const args = readyArgs();
  args.push('--adapter=provider-adapter|api|provider_call|configured provider canary|read-only provider call|receipt rollback|owner-approved provider canary|dry-run|30000');
  args.push('--executor=local_ack', '--idempotency-key=idem-unsupported');
  const result = runTs('scripts/zavorth-live-canary-executor.ts', args);
  return jsonRule('live-canary-executor-unsupported', 'Unsupported adapter/executor pairs are blocked before execution', result, (snapshot) =>
    snapshot.status === 'unsupported-adapter'
    && snapshot.summary.adapterSupported === false
    && snapshot.executionResult.status === 'not-run'
    && snapshot.receipts.some((receipt) => receipt.kind === 'unsupported-adapter' && receipt.status === 'blocked'));
}

function readyArgs() {
  const args = ['--json', '--approval=approval-123', '--owner-confirmed', '--idempotency-key=idem-ready'];
  for (const evidence of canonicalEvidence()) args.push(`--evidence=${evidence}`);
  args.push('--final-trigger=trigger-123|true|APPLY ZAVORTH LIVE CANARY|owner|2026-05-11T12:00:00.000Z');
  args.push('--rollback-drill=rollback-drill-123|true|true|rollback drill passed|replay dry-run|rollback dry-run|rollback.log');
  return args;
}

function canonicalEvidence() {
  return [
    'e1|verification-required-subagents-skills|telegram|channel_transcript|true|operator saw verification action and fallback',
    'e2|approval-required-workspace-command|cli|cli_output|true|operator saw approval boundary',
    'e3|needs-setup-android-adb|whatsapp|channel_transcript|true|operator saw doctor fallback',
    'e4|ready-after-evidence|api|api_payload|true|operator saw ready answer action',
    'e5|blocked-raw-reasoning|discord|channel_transcript|true|operator saw blocked action',
  ];
}

function ruleWorkspaceCheck() {
  const text = read('package.json');
  const marker = 'node scripts/zavorth-live-canary-executor-check.mjs';
  return rule('workspace-check-wire', 'workspace:check includes Intent model0 gate', text.includes(marker), text.includes(marker) ? 'wired' : 'missing', marker, []);
}

function runTs(script, args) {
  return spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    script,
    ...args,
  ], { cwd: root, encoding: 'utf8', env: process.env });
}

function jsonRule(id, label, result, expect) {
  if (result.status !== 0 && !result.stdout.trim()) {
    return rule(id, label, false, `exit ${result.status ?? 'unknown'}`, 'valid JSON fixture', compact(result.stderr, result.stdout));
  }
  try {
    const snapshot = JSON.parse(result.stdout);
    const passed = expect(snapshot);
    return rule(id, label, passed, `status=${snapshot.status}; mode=${snapshot.mode}`, 'expected Intent model0 executor snapshot', passed ? [] : [JSON.stringify(snapshot, null, 2)]);
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
