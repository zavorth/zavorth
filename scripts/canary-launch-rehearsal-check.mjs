#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'canary-launch-rehearsal-files',
    label: 'Canary Launch Rehearsal phase files exist',
    target: 'Contract, service, tests, runner, docs and package scripts are present',
    files: [
      'src/contracts/CanaryLaunchRehearsalContract.ts',
      'src/services/CanaryLaunchRehearsalService.ts',
      'tests/services/CanaryLaunchRehearsalService.test.ts',
      'scripts/canary-launch-rehearsal.ts',
      'scripts/canary-launch-rehearsal-check.mjs',
      'docs/README.md',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'canary-launch-rehearsal-contract',
    label: 'Contract defines launch rehearsal vocabulary',
    target: 'Contract includes launch rehearsal steps, gates, receipts, commands and no-side-effect policy',
    files: ['src/contracts/CanaryLaunchRehearsalContract.ts'],
    needles: [
      'ZAVORTH_CANARY_LAUNCH_REHEARSAL_CONTRACT_VERSION',
      'CanaryLaunchRehearsalStep',
      'CanaryLaunchRehearsalSnapshot',
      'unsigned-fixture',
      'launchAuthorized: false',
      'signedLedgerRequiredForRealLaunch: true',
      'launchRehearsalRequiredBeforeRealCanary: true',
      'observabilityHandoffRequired: true',
      'supportBridgeRequired: true',
      'secretsSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'canary-launch-rehearsal-service',
    label: 'Service builds canary launch rehearsal from approval ledger',
    target: 'Service consumes Preview engine0, rehearses launch command/rollback/observation, and keeps launch/publish/promotion locked',
    files: ['src/services/CanaryLaunchRehearsalService.ts'],
    needles: [
      'CanaryLaunchRehearsalService',
      'CanaryExecutionApprovalLedgerService',
      'approval-ledger-input',
      'held-release-execution-gate',
      'signed-ledger-path-rehearsal',
      'launch-command-shape-rehearsal',
      'rollback-checkpoint-rehearsal',
      'kill-switch-rehearsal',
      'canary-launch-lock',
      'publication-and-promotion-held',
      'Canary monitoring and rollback gate',
    ],
  }),
  ruleContainsAll({
    id: 'canary-launch-rehearsal-runner',
    label: 'Runner exposes text, JSON and require-rehearsed modes',
    target: 'Operator can render launch rehearsal evidence and fail when launchRehearsalReady is false',
    files: ['scripts/canary-launch-rehearsal.ts'],
    needles: [
      'CanaryLaunchRehearsalService',
      '--json',
      '--require-rehearsed',
      'formatRehearsalText',
      'snapshot.summary.launchRehearsalReady',
    ],
  }),
  ruleContainsAll({
    id: 'canary-launch-rehearsal-tests',
    label: 'Tests prove canary launch rehearsal',
    target: 'Tests cover RC identity, rehearsal state, step counts, no-launch policy, commands and formatted output',
    files: ['tests/services/CanaryLaunchRehearsalService.test.ts'],
    needles: [
      'builds a launch rehearsal from the canary execution approval ledger',
      'steps: 15',
      'linkedSteps: 2',
      'rehearsalReadySteps: 8',
      'operatorReadySteps: 2',
      'lockedSteps: 3',
      'launchRehearsalReady: true',
      'keeps launch rehearsal dry-run only and launch held',
      'formats canary launch rehearsal text',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-canary-launch-rehearsal-gates',
    label: 'package exposes canary launch rehearsal gates',
    target: 'local QA can run rehearsal, JSON, static check and require-rehearsed modes',
    files: ['package.json'],
    needles: [
      'canary-launch-rehearsal',
      'canary-launch-rehearsal:json',
      'canary-launch-rehearsal:check',
      'qa:canary-launch-rehearsal',
      'scripts/canary-launch-rehearsal.ts',
      'scripts/canary-launch-rehearsal-check.mjs',
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
  console.log('[canary-launch-rehearsal] checking Preview engine1');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[canary-launch-rehearsal] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
