#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'final-canary-release-closure-files',
    label: 'Final Canary Release Closure phase files exist',
    target: 'Contract, service, tests, runner, docs and package scripts are present',
    files: [
      'src/contracts/FinalCanaryReleaseClosureContract.ts',
      'src/services/FinalCanaryReleaseClosureService.ts',
      'tests/services/FinalCanaryReleaseClosureService.test.ts',
      'scripts/final-canary-release-closure.ts',
      'scripts/final-canary-release-closure-check.mjs',
      'docs/README.md',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'final-canary-release-closure-contract',
    label: 'Contract defines final closure vocabulary',
    target: 'Contract includes closure items, gates, receipts, commands and Phase 24 sequence closure policy',
    files: ['src/contracts/FinalCanaryReleaseClosureContract.ts'],
    needles: [
      'ZAVORTH_FINAL_CANARY_RELEASE_CLOSURE_CONTRACT_VERSION',
      'FinalCanaryReleaseClosureItem',
      'FinalCanaryReleaseClosureSnapshot',
      'closed-dry-run',
      "phaseRange: '20-24'",
      'noFurtherAutomatedPhase: true',
      'sequenceClosesAtPhase24: true',
      'separateManualReleaseDecisionRequired: true',
      'closesCanaryDryRunSequence: true',
      'secretsSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'final-canary-release-closure-service',
    label: 'Service closes canary dry-run sequence from promotion decision ledger',
    target: 'Service consumes Phase 23, links phases 20-24, prepares handoff evidence, and keeps every live side effect locked',
    files: ['src/services/FinalCanaryReleaseClosureService.ts'],
    needles: [
      'FinalCanaryReleaseClosureService',
      'CanaryPromotionDecisionLedgerService',
      'promotion-decision-ledger-input',
      'phase-20-approval-ledger-link',
      'phase-21-launch-rehearsal-link',
      'phase-22-monitoring-rollback-link',
      'phase-23-promotion-decision-link',
      'side-effect-zeroing-evidence',
      'manual-release-decision-handoff',
      'Canary dry-run sequence complete at Phase 24',
    ],
  }),
  ruleContainsAll({
    id: 'final-canary-release-closure-runner',
    label: 'Runner exposes text, JSON and require-closure-ready modes',
    target: 'Operator can render final closure evidence and fail when finalCanaryReleaseClosureReady is false',
    files: ['scripts/final-canary-release-closure.ts'],
    needles: [
      'FinalCanaryReleaseClosureService',
      '--json',
      '--require-closure-ready',
      'formatClosureText',
      'snapshot.summary.finalCanaryReleaseClosureReady',
    ],
  }),
  ruleContainsAll({
    id: 'final-canary-release-closure-tests',
    label: 'Tests prove final canary release closure',
    target: 'Tests cover RC identity, closure state, item counts, no-side-effect policy, commands and formatted output',
    files: ['tests/services/FinalCanaryReleaseClosureService.test.ts'],
    needles: [
      'builds final closure from the canary promotion decision ledger',
      'items: 16',
      'linkedItems: 2',
      'closureReadyItems: 8',
      'operatorReadyItems: 3',
      'lockedItems: 3',
      'finalCanaryReleaseClosureReady: true',
      'keeps final closure dry-run only and ends the automated phase chain',
      'formats final canary release closure text',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-final-canary-release-closure-gates',
    label: 'package exposes final canary release closure gates',
    target: 'local QA can run closure, JSON, static check and require-closure-ready modes',
    files: ['package.json'],
    needles: [
      'final-canary-release-closure',
      'final-canary-release-closure:json',
      'final-canary-release-closure:check',
      'qa:final-canary-release-closure',
      'scripts/final-canary-release-closure.ts',
      'scripts/final-canary-release-closure-check.mjs',
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
  console.log('[final-canary-release-closure] checking Phase 24');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[final-canary-release-closure] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
