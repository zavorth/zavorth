#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'canary-plan-dry-run-hold-files',
    label: 'Canary Plan Dry-Run Hold gate files exist',
    target: 'Contract, service, tests, runner, docs and package scripts are present',
    files: [
      'src/contracts/CanaryPlanDryRunHoldContract.ts',
      'src/services/CanaryPlanDryRunHoldService.ts',
      'tests/services/CanaryPlanDryRunHoldService.test.ts',
      'scripts/canary-plan-dry-run-hold.ts',
      'scripts/canary-plan-dry-run-hold-check.mjs',
      'docs/README.md',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'canary-plan-dry-run-hold-contract',
    label: 'Contract defines canary dry-run and hold vocabulary',
    target: 'Contract includes RC identity, cohort, flag, observation, rollback, promotion hold, receipts and no-launch policy',
    files: ['src/contracts/CanaryPlanDryRunHoldContract.ts'],
    needles: [
      'ZAVORTH_CANARY_PLAN_DRY_RUN_HOLD_CONTRACT_VERSION',
      'CanaryPlanDryRunHoldControl',
      'CanaryPlanDryRunHoldSnapshot',
      'dry-run-ready',
      "effectiveDecision: 'hold'",
      'canaryCohortId',
      'featureFlagDefault',
      'observationWindowHours',
      'rollbackTriggerRequired: true',
      'noPromotionExecuted: true',
      'noAutomaticPromotion: true',
      'secretsSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'canary-plan-dry-run-hold-service',
    label: 'Service builds dry-run canary plan from pre-canary alignment',
    target: 'Service consumes Intent model8, links rollout plan, defines cohort/flag/observation/rollback and locks launch/promotion',
    files: ['src/services/CanaryPlanDryRunHoldService.ts'],
    needles: [
      'CanaryPlanDryRunHoldService',
      'PreCanaryGoNoGoAlignmentService',
      'pre-canary-alignment-input',
      'rollout-plan-dry-run-gate',
      'canary-cohort-plan',
      'feature-flag-default-off-plan',
      'observation-window-plan',
      'rollback-trigger-plan',
      'canary-launch-hold',
      'promotion-and-publication-held',
      'Canary execution approval ledger',
    ],
  }),
  ruleContainsAll({
    id: 'canary-plan-dry-run-hold-runner',
    label: 'Runner exposes text, JSON and require-dry-run-ready modes',
    target: 'Operator can render canary dry-run evidence and fail when canaryPlanDryRunReady is false',
    files: ['scripts/canary-plan-dry-run-hold.ts'],
    needles: [
      'CanaryPlanDryRunHoldService',
      '--json',
      '--require-dry-run-ready',
      'formatDryRunText',
      'snapshot.summary.canaryPlanDryRunReady',
    ],
  }),
  ruleContainsAll({
    id: 'canary-plan-dry-run-hold-tests',
    label: 'Tests prove canary plan dry-run and hold',
    target: 'Tests cover RC identity, cohort/flag/observation, control counts, no-launch policy, commands and formatted output',
    files: ['tests/services/CanaryPlanDryRunHoldService.test.ts'],
    needles: [
      'builds a canary dry-run plan from pre-canary go/no-go alignment',
      'controls: 14',
      'alignedControls: 2',
      'dryRunReadyControls: 6',
      'operatorReadyControls: 2',
      'lockedControls: 4',
      'canaryPlanDryRunReady: true',
      'keeps canary launch and promotion on hold',
      'formats canary plan dry-run text',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-canary-plan-dry-run-hold-gates',
    label: 'package exposes canary plan dry-run hold gates',
    target: 'local QA can run dry-run, JSON, static check and require-dry-run-ready modes',
    files: ['package.json'],
    needles: [
      'canary-plan-dry-run-hold',
      'canary-plan-dry-run-hold:json',
      'canary-plan-dry-run-hold:check',
      'qa:canary-plan-dry-run-hold',
      'scripts/canary-plan-dry-run-hold.ts',
      'scripts/canary-plan-dry-run-hold-check.mjs',
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
  console.log('[canary-plan-dry-run-hold] checking Intent model9');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[canary-plan-dry-run-hold] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
