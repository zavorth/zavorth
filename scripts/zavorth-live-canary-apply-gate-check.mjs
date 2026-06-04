#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const rules = [
  ruleFilesExist(),
  ruleMarkers(),
  runNeedsAdapterReviewFixture(),
  runFinalTriggerFixture(),
  runRollbackDrillFixture(),
  runControlledApplyFixture(),
  runSensitiveTargetFixture(),
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
  console.log('[zavorth-live-canary-apply-gate] checking Certification matrix');
  printRules(rules, '[zavorth-live-canary-apply-gate]');
}
if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthLiveCanaryApplyGateRollbackDrillContract.ts',
    'src/services/ZavorthLiveCanaryApplyGateRollbackDrillService.ts',
    'scripts/zavorth-live-canary-apply-gate.ts',
    'scripts/zavorth-live-canary-apply-gate-check.mjs',
    'tests/domain/agent/LiveCanaryApplyGateRollbackDrillService.test.ts',
    'docs/README.md',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('live-canary-apply-gate-files', 'Certification matrix files exist', missing.length === 0, `${files.length - missing.length}/${files.length}`, 'contract, service, CLI, check, tests and docs are present', missing);
}

function ruleMarkers() {
  const checks = [
    ['src/contracts/ZavorthLiveCanaryApplyGateRollbackDrillContract.ts', ['ZAVORTH_LIVE_CANARY_APPLY_GATE_ROLLBACK_DRILL_CONTRACT_VERSION', 'APPLY ZAVORTH LIVE CANARY', 'requiresSeparateLiveInvocation', 'rollbackDrillRequiredBeforeLive']],
    ['src/services/ZavorthLiveCanaryApplyGateRollbackDrillService.ts', ['checkpoint-9-live-canary-apply-gate-rollback-drill', 'ZavorthLiveCanaryExecutionAdapterReviewService', 'liveActionExecutorBundled: false', 'containsSensitiveTarget']],
    ['scripts/zavorth-live-canary-apply-gate.ts', ['--final-trigger', '--final-phrase', '--rollback-drill', '--default-final-phrase']],
    ['src/sdk/contracts.ts', ['ZavorthLiveCanaryApplyGateRollbackDrillContract']],
    ['src/sdk/index.ts', ['ZavorthLiveCanaryApplyGateRollbackDrillService']],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    for (const needle of needles) {
      if (!text.includes(needle)) missing.push(`${file}: missing ${needle}`);
    }
  }
  return rule('live-canary-apply-gate-markers', 'Certification matrix markers are wired', missing.length === 0, missing.length === 0 ? 'all markers' : `${missing.length} missing`, 'apply gate, SDK and CLI markers exist', missing);
}

function runNeedsAdapterReviewFixture() {
  const result = runTs('scripts/zavorth-live-canary-apply-gate.ts', ['--json']);
  return jsonRule('live-canary-apply-needs-review', 'Apply gate requires adapter review first', result, (snapshot) =>
    snapshot.contractVersion === '2026-05-11.live-canary-apply-gate-rollback-drill-checkpoint-9'
    && snapshot.status === 'needs-adapter-review'
    && snapshot.mode === 'adapter-review-gate'
    && snapshot.authorizationPacket.applyGateOpen === false
    && snapshot.safety.noLiveActionExecuted === true
    && snapshot.safety.separateExecutorRequired === true);
}

function runFinalTriggerFixture() {
  const args = baseReviewedArgs();
  args.push('--rollback-drill=rollback-drill-123|true|true|rollback drill passed|replay dry-run|rollback dry-run|rollback.log');
  const result = runTs('scripts/zavorth-live-canary-apply-gate.ts', args);
  return jsonRule('live-canary-apply-final-trigger', 'Apply gate requires exact final trigger', result, (snapshot) =>
    snapshot.status === 'approval-required'
    && snapshot.mode === 'approval-gate'
    && snapshot.summary.finalTriggerAccepted === false
    && snapshot.authorizationPacket.executionAuthorized === false
    && snapshot.receipts.some((receipt) => receipt.kind === 'final-trigger-boundary' && receipt.status === 'requires-approval'));
}

function runRollbackDrillFixture() {
  const args = baseReviewedArgs();
  args.push('--final-trigger=trigger-123|true|APPLY ZAVORTH LIVE CANARY|owner|2026-05-11T12:00:00.000Z');
  const result = runTs('scripts/zavorth-live-canary-apply-gate.ts', args);
  return jsonRule('live-canary-apply-rollback-drill', 'Apply gate requires rollback drill', result, (snapshot) =>
    snapshot.status === 'rollback-drill-required'
    && snapshot.mode === 'rollback-drill-gate'
    && snapshot.summary.rollbackDrillAccepted === false
    && snapshot.authorizationPacket.executionAuthorized === false);
}

function runControlledApplyFixture() {
  const args = readyArgs();
  const result = runTs('scripts/zavorth-live-canary-apply-gate.ts', args);
  return jsonRule('live-canary-apply-ready', 'Apply gate issues short-lived authorization without execution', result, (snapshot) =>
    snapshot.status === 'ready-for-controlled-apply'
    && snapshot.mode === 'controlled-apply-gate'
    && snapshot.summary.failedChecks === 0
    && snapshot.authorizationPacket.applyGateOpen === true
    && snapshot.authorizationPacket.executionAuthorized === true
    && snapshot.authorizationPacket.executionPerformed === false
    && snapshot.authorizationPacket.liveActionExecutorBundled === false
    && snapshot.authorizationPacket.requiresSeparateLiveInvocation === true
    && snapshot.authorizationPacket.authorizationReceiptId === 'checkpoint-9-authorization:checkpoint-8-default-live-canary-adapter:trigger-123');
}

function runSensitiveTargetFixture() {
  const args = readyArgs();
  args.push('--adapter=metadata-adapter|api|webhook_call|http://169.254.169.254/latest/meta-data|call metadata endpoint|cancel call|owner-approved live canary review|dry-run command|30000');
  const result = runTs('scripts/zavorth-live-canary-apply-gate.ts', args);
  return jsonRule('live-canary-apply-sensitive-target', 'Sensitive live targets are blocked before authorization', result, (snapshot) =>
    snapshot.status === 'blocked'
    && snapshot.authorizationPacket.executionAuthorized === false
    && snapshot.checks.some((check) => check.kind === 'execution-scope' && check.status === 'fail'));
}

function baseReviewedArgs() {
  const args = ['--json', '--approval=approval-123', '--owner-confirmed'];
  for (const evidence of canonicalEvidence()) args.push(`--evidence=${evidence}`);
  return args;
}

function readyArgs() {
  const args = baseReviewedArgs();
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
  const marker = 'node scripts/zavorth-live-canary-apply-gate-check.mjs';
  return rule('workspace-check-wire', 'workspace:check includes Certification matrix gate', text.includes(marker), text.includes(marker) ? 'wired' : 'missing', marker, []);
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
    return rule(id, label, passed, `status=${snapshot.status}; mode=${snapshot.mode}`, 'expected Certification matrix apply gate snapshot', passed ? [] : [JSON.stringify(snapshot, null, 2)]);
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
