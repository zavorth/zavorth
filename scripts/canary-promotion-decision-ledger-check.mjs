#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'canary-promotion-decision-ledger-files',
    label: 'Canary Promotion Decision Ledger gate files exist',
    target: 'Contract, service, tests, runner, docs and package scripts are present',
    files: [
      'src/contracts/CanaryPromotionDecisionLedgerContract.ts',
      'src/services/CanaryPromotionDecisionLedgerService.ts',
      'tests/services/CanaryPromotionDecisionLedgerService.test.ts',
      'scripts/canary-promotion-decision-ledger.ts',
      'scripts/canary-promotion-decision-ledger-check.mjs',
      'docs/README.md',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'canary-promotion-decision-ledger-contract',
    label: 'Contract defines promotion decision ledger vocabulary',
    target: 'Contract includes decision entries, gates, receipts, commands and no-promotion/no-rollback policy',
    files: ['src/contracts/CanaryPromotionDecisionLedgerContract.ts'],
    needles: [
      'ZAVORTH_CANARY_PROMOTION_DECISION_LEDGER_CONTRACT_VERSION',
      'CanaryPromotionDecisionEntry',
      'CanaryPromotionDecisionLedgerSnapshot',
      'ready-for-signed-evidence',
      'availableDecisions',
      'await-live-evidence',
      'signedMonitoringEvidenceRequired: true',
      'manualPromotionApprovalRequired: true',
      'finalClosureRequiredBeforeRelease: true',
      'secretsSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'canary-promotion-decision-ledger-service',
    label: 'Service builds promotion decision ledger from monitoring rollback gate',
    target: 'Service consumes Preview engine2, prepares expand/pause/rollback decision paths, and keeps execution/publish/promotion locked',
    files: ['src/services/CanaryPromotionDecisionLedgerService.ts'],
    needles: [
      'CanaryPromotionDecisionLedgerService',
      'CanaryMonitoringRollbackGateService',
      'monitoring-rollback-gate-input',
      'signed-monitoring-evidence-slot',
      'expand-decision-path',
      'pause-decision-path',
      'rollback-decision-path',
      'cohort-expansion-command-shape',
      'promotion-execution-lock',
      'Final canary release closure',
    ],
  }),
  ruleContainsAll({
    id: 'canary-promotion-decision-ledger-runner',
    label: 'Runner exposes text, JSON and require-ledger-ready modes',
    target: 'Operator can render promotion decision evidence and fail when promotionDecisionLedgerReady is false',
    files: ['scripts/canary-promotion-decision-ledger.ts'],
    needles: [
      'CanaryPromotionDecisionLedgerService',
      '--json',
      '--require-ledger-ready',
      'formatLedgerText',
      'snapshot.summary.promotionDecisionLedgerReady',
    ],
  }),
  ruleContainsAll({
    id: 'canary-promotion-decision-ledger-tests',
    label: 'Tests prove canary promotion decision ledger',
    target: 'Tests cover RC identity, ledger state, entry counts, no-promotion policy, commands and formatted output',
    files: ['tests/services/CanaryPromotionDecisionLedgerService.test.ts'],
    needles: [
      'builds a promotion decision ledger from the canary monitoring rollback gate',
      'entries: 16',
      'linkedEntries: 2',
      'decisionReadyEntries: 8',
      'operatorReadyEntries: 3',
      'lockedEntries: 3',
      'promotionDecisionLedgerReady: true',
      'keeps promotion decision ledger dry-run only and execution held',
      'formats canary promotion decision ledger text',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-canary-promotion-decision-ledger-gates',
    label: 'package exposes canary promotion decision ledger gates',
    target: 'local QA can run ledger, JSON, static check and require-ledger-ready modes',
    files: ['package.json'],
    needles: [
      'canary-promotion-decision-ledger',
      'canary-promotion-decision-ledger:json',
      'canary-promotion-decision-ledger:check',
      'qa:canary-promotion-decision-ledger',
      'scripts/canary-promotion-decision-ledger.ts',
      'scripts/canary-promotion-decision-ledger-check.mjs',
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
  console.log('[canary-promotion-decision-ledger] checking Preview engine3');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[canary-promotion-decision-ledger] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
