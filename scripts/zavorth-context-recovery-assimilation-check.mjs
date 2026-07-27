#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const rules = [
  ruleFilesExist(),
  ruleMarkers(),
  runContextFixture(),
  runRecoveryFixture(),
  runApprovalFixture(),
  runBlockedFixture(),
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
  console.log('[zavorth-context-recovery-assimilation] checking Approval gate');
  printRules(rules, '[zavorth-context-recovery-assimilation]');
}
if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthContextRecoveryAssimilationContract.ts',
    'src/services/ZavorthContextRecoveryAssimilationService.ts',
    'scripts/zavorth-context-recovery-assimilation.ts',
    'scripts/zavorth-context-recovery-assimilation-check.mjs',
    'tests/domain/agent/ContextRecoveryAssimilationService.test.ts',
    'docs/README.md',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('context-recovery-files', 'Approval gate files exist', missing.length === 0, `${files.length ? missing.length}/${files.length}`, 'contract, service, CLI, check, tests and docs are present', missing);
}

function ruleMarkers() {
  const checks = [
    ['src/contracts/ZavorthContextRecoveryAssimilationContract.ts', ['ZAVORTH_CONTEXT_RECOVERY_ASSIMILATION_CONTRACT_VERSION', 'ledgerBeatsRecall', 'retryOnlyWhenEvidenceChanges', 'rawMemorySerialized']],
    ['src/services/ZavorthContextRecoveryAssimilationService.ts', ['gate-3-context-memory-error-recovery', 'ZavorthReasoningActionPatternService', 'avoidSameFailingToolUntilEvidenceChanges', 'ledger remains authoritative']],
    ['scripts/zavorth-context-recovery-assimilation.ts', ['--failure', '--memory', '--event', '--json']],
    ['src/sdk/contracts.ts', ['ZavorthContextRecoveryAssimilationContract']],
    ['src/sdk/index.ts', ['ZavorthContextRecoveryAssimilationService']],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    for (const needle of needles) {
      if (!text.includes(needle)) missing.push(`${file}: missing ${needle}`);
    }
  }
  return rule('context-recovery-markers', 'Approval gate markers are wired', missing.length === 0, missing.length === 0 ? 'all markers' : `${missing.length} missing`, 'context, recovery, SDK and CLI markers exist', missing);
}

function runContextFixture() {
  const result = runTs('scripts/zavorth-context-recovery-assimilation.ts', [
    '--json',
    '--text=continue auditing with delegated review',
    '--event=User asked for safe read-only audit',
    '--memory=mem-1|Workspace uses governed subagents|fixture|0.9|warm',
  ]);
  return jsonRule('context-recovery-context-fixture', 'Compact context pack builds', result, (snapshot) =>
    snapshot.contractVersion === '2026-05-11.context-memory-error-recovery-gate-3'
    && snapshot.status === 'ready'
    && snapshot.contextPack.rawMemorySerialized === false
    && snapshot.safety.ledgerBeatsRecall === true
    && snapshot.summary.hot >= 1
    && snapshot.summary.warm >= 1
    && snapshot.receipts.some((item) => item.kind === 'gate-3-context-pack'));
}

function runRecoveryFixture() {
  const result = runTs('scripts/zavorth-context-recovery-assimilation.ts', [
    '--json',
    '--text=continue verifying the result',
    '--failure=provider timeout while observing page',
    '--failure-tool=browser.observe',
    '--failure-attempt=1',
  ]);
  return jsonRule('context-recovery-retry-fixture', 'Recoverable failure has bounded retry', result, (snapshot) =>
    snapshot.status === 'recovery-ready'
    && snapshot.failure.kind === 'provider_error'
    && snapshot.recovery.retryAllowed === true
    && snapshot.recovery.retryBudgetRemaining === 1
    && snapshot.recovery.avoidSameFailingToolUntilEvidenceChanges === true);
}

function runApprovalFixture() {
  const result = runTs('scripts/zavorth-context-recovery-assimilation.ts', [
    '--json',
    '--text=edit files and run a PowerShell command',
  ]);
  return jsonRule('context-recovery-approval-fixture', 'Preview engine approval boundary is inherited', result, (snapshot) =>
    snapshot.status === 'approval-required'
    && snapshot.failure.kind === 'approval_missing'
    && snapshot.receipts.some((item) => item.kind === 'approval-boundary' && item.status === 'requires-approval'));
}

function runBlockedFixture() {
  const result = runTs('scripts/zavorth-context-recovery-assimilation.ts', [
    '--json',
    '--text=continue',
    '--failure=secret token leaked by tool output',
    '--failure-tool=tool.read',
  ]);
  return jsonRule('context-recovery-blocked-fixture', 'Secret-risk recovery is blocked', result, (snapshot) =>
    snapshot.status === 'blocked'
    && snapshot.failure.kind === 'secret_risk'
    && snapshot.safety.secretsSerialized === false
    && snapshot.recovery.nextAction === 'stop_and_report'
    && snapshot.receipts.some((item) => item.kind === 'blocked-retry'));
}

function ruleWorkspaceCheck() {
  const text = read('package.json');
  const marker = 'node scripts/zavorth-context-recovery-assimilation-check.mjs';
  return rule('workspace-check-wire', 'workspace:check includes Approval gate gate', text.includes(marker), text.includes(marker) ? 'wired' : 'missing', marker, []);
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
    return rule(id, label, passed, `status=${snapshot.status}; failure=${snapshot.failure?.kind ?? 'n/a'}`, 'expected Approval gate recovery snapshot', passed ? [] : [JSON.stringify(snapshot, null, 2)]);
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
