#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'canary-execution-approval-ledger-files',
    label: 'Canary Execution Approval Ledger gate files exist',
    target: 'Contract, service, tests, runner, docs and package scripts are present',
    files: [
      'src/contracts/CanaryExecutionApprovalLedgerContract.ts',
      'src/services/CanaryExecutionApprovalLedgerService.ts',
      'tests/services/CanaryExecutionApprovalLedgerService.test.ts',
      'scripts/canary-execution-approval-ledger.ts',
      'scripts/canary-execution-approval-ledger-check.mjs',
      'docs/README.md',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'canary-execution-approval-ledger-contract',
    label: 'Contract defines approval ledger vocabulary',
    target: 'Contract includes RC identity, signature slots, artifacts, ledger entries, gates, receipts and no-launch policy',
    files: ['src/contracts/CanaryExecutionApprovalLedgerContract.ts'],
    needles: [
      'ZAVORTH_CANARY_EXECUTION_APPROVAL_LEDGER_CONTRACT_VERSION',
      'CanaryExecutionApprovalLedgerEntry',
      'CanaryExecutionApprovalLedgerSnapshot',
      'ready-for-signature',
      "effectiveDecision: 'hold'",
      'requiredSignatures',
      'rollbackCheckpointRequired: true',
      'auditSinkRequired: true',
      'supportBridgeRequired: true',
      'observabilityZavorthControlRequired: true',
      'noAutomaticExecution: true',
      'secretsSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'canary-execution-approval-ledger-service',
    label: 'Service builds approval ledger from canary dry-run plan',
    target: 'Service consumes Intent model9, prepares signature slots/artifacts, links release execution and locks launch/promotion',
    files: ['src/services/CanaryExecutionApprovalLedgerService.ts'],
    needles: [
      'CanaryExecutionApprovalLedgerService',
      'CanaryPlanDryRunHoldService',
      'canary-plan-dry-run-input',
      'release-execution-gate-hold',
      'release-approver-slot',
      'manual-operator-slot',
      'rollback-checkpoint-template',
      'audit-sink-template',
      'execution-launch-hold',
      'publication-and-promotion-held',
      'Canary launch rehearsal',
    ],
  }),
  ruleContainsAll({
    id: 'canary-execution-approval-ledger-runner',
    label: 'Runner exposes text, JSON and require-ledger-ready modes',
    target: 'Operator can render approval ledger evidence and fail when approvalLedgerReady is false',
    files: ['scripts/canary-execution-approval-ledger.ts'],
    needles: [
      'CanaryExecutionApprovalLedgerService',
      '--json',
      '--require-ledger-ready',
      'formatLedgerText',
      'snapshot.summary.approvalLedgerReady',
    ],
  }),
  ruleContainsAll({
    id: 'canary-execution-approval-ledger-tests',
    label: 'Tests prove canary execution approval ledger',
    target: 'Tests cover RC identity, ledger state, entry counts, signature slots, no-launch policy, commands and formatted output',
    files: ['tests/services/CanaryExecutionApprovalLedgerService.test.ts'],
    needles: [
      'builds an approval ledger from the canary dry-run plan',
      'entries: 14',
      'linkedEntries: 2',
      'approvalReadyEntries: 6',
      'operatorReadyEntries: 3',
      'lockedEntries: 3',
      'approvalLedgerReady: true',
      'keeps approval ledger unsigned and launch held',
      'formats canary execution approval ledger text',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-canary-execution-approval-ledger-gates',
    label: 'package exposes canary execution approval ledger gates',
    target: 'local QA can run ledger, JSON, static check and require-ledger-ready modes',
    files: ['package.json'],
    needles: [
      'canary-execution-approval-ledger',
      'canary-execution-approval-ledger:json',
      'canary-execution-approval-ledger:check',
      'qa:canary-execution-approval-ledger',
      'scripts/canary-execution-approval-ledger.ts',
      'scripts/canary-execution-approval-ledger-check.mjs',
    ],
  }),
];

const failed = rules.filter((rule) => rule.status === 'failed');
const snapshot = {
  generatedAt: new Date().toISOString(),
  status: failed.length > 0 ? 'failed' : 'passed',
  summary: {
    rules: rules.length,
    passed: rules.length - failed.length,
    failed: failed.length,
  },
  rules,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[canary-execution-approval-ledger] checking Preview engine0');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[canary-execution-approval-ledger] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 8)) {
      console.log(`  - ${detail}`);
    }
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function ruleFilesExist(input) {
  const missing = input.files.filter((file) => !exists(file));
  return {
    id: input.id,
    label: input.label,
    status: missing.length > 0 ? 'failed' : 'passed',
    observed: `${input.files.length - missing.length}/${input.files.length} file(s) present`,
    target: input.target,
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleContainsAll(input) {
  const missing = [];
  for (const file of input.files) {
    const contents = read(file);
    if (contents === null) {
      missing.push(`missing ${file}`);
      continue;
    }
    for (const needle of input.needles) {
      if (!contents.includes(needle)) {
        missing.push(`${file}: missing ${needle}`);
      }
    }
  }
  return {
    id: input.id,
    label: input.label,
    status: missing.length > 0 ? 'failed' : 'passed',
    observed: missing.length > 0 ? `${missing.length} missing marker(s)` : 'all markers present',
    target: input.target,
    details: missing,
  };
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) {
    return null;
  }
  return fs.readFileSync(absolute, 'utf8');
}
