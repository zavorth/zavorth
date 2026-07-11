#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'pre-canary-go-no-go-alignment-files',
    label: 'Pre-Canary Go/No-Go Alignment gate files exist',
    target: 'Contract, service, tests, runner, docs and package scripts are present',
    files: [
      'src/contracts/PreCanaryGoNoGoAlignmentContract.ts',
      'src/services/PreCanaryGoNoGoAlignmentService.ts',
      'tests/services/PreCanaryGoNoGoAlignmentService.test.ts',
      'scripts/pre-canary-go-no-go-alignment.ts',
      'scripts/pre-canary-go-no-go-alignment-check.mjs',
      'docs/README.md',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'pre-canary-go-no-go-alignment-contract',
    label: 'Contract defines pre-canary go/no-go vocabulary',
    target: 'Contract includes RC identity, decision state, controls, gates, receipts, commands and no-canary policy',
    files: ['src/contracts/PreCanaryGoNoGoAlignmentContract.ts'],
    needles: [
      'ZAVORTH_PRE_CANARY_GO_NO_GO_ALIGNMENT_CONTRACT_VERSION',
      'PreCanaryGoNoGoAlignmentControl',
      'PreCanaryGoNoGoAlignmentSnapshot',
      'ready-for-decision',
      "effectiveDecision: 'hold'",
      'canaryStartAuthorized: false',
      'explicitApprovalRequired: true',
      'rollbackOwnerRequired: true',
      'incidentOwnerRequired: true',
      'secretsSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'pre-canary-go-no-go-alignment-service',
    label: 'Service aligns pre-canary go/no-go from distribution rehearsal',
    target: 'Service consumes Intent model7, links runtime gates, prepares owners and keeps canary disabled',
    files: ['src/services/PreCanaryGoNoGoAlignmentService.ts'],
    needles: [
      'PreCanaryGoNoGoAlignmentService',
      'ReleaseCandidateDistributionRehearsalService',
      'distribution-rehearsal-input',
      'release-candidate-pre-canary-gate-link',
      'approver-role-assignment',
      'rollback-owner-assignment',
      'incident-owner-assignment',
      'decision-ledger-template',
      'canary-start-lock',
      'no-publication-regression',
      'Canary plan dry-run and hold',
    ],
  }),
  ruleContainsAll({
    id: 'pre-canary-go-no-go-alignment-runner',
    label: 'Runner exposes text, JSON and require-aligned modes',
    target: 'Operator can render alignment evidence and fail when alignmentReady is false',
    files: ['scripts/pre-canary-go-no-go-alignment.ts'],
    needles: [
      'PreCanaryGoNoGoAlignmentService',
      '--json',
      '--require-aligned',
      'formatAlignmentText',
      'snapshot.summary.alignmentReady',
    ],
  }),
  ruleContainsAll({
    id: 'pre-canary-go-no-go-alignment-tests',
    label: 'Tests prove pre-canary go/no-go alignment',
    target: 'Tests cover RC identity, decision hold, control counts, no-canary policy, commands and formatted output',
    files: ['tests/services/PreCanaryGoNoGoAlignmentService.test.ts'],
    needles: [
      'aligns pre-canary go/no-go from the rehearsed release candidate',
      'controls: 12',
      'alignedControls: 5',
      'operatorReadyControls: 4',
      'lockedControls: 3',
      'alignmentReady: true',
      'keeps go/no-go aligned without authorizing canary start',
      'formats pre-canary go/no-go alignment text',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-pre-canary-go-no-go-alignment-gates',
    label: 'package exposes pre-canary go/no-go alignment gates',
    target: 'local QA can run alignment, JSON, static check and require-aligned modes',
    files: ['package.json'],
    needles: [
      'pre-canary-go-no-go-alignment',
      'pre-canary-go-no-go-alignment:json',
      'pre-canary-go-no-go-alignment:check',
      'qa:pre-canary-go-no-go-alignment',
      'scripts/pre-canary-go-no-go-alignment.ts',
      'scripts/pre-canary-go-no-go-alignment-check.mjs',
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
  console.log('[pre-canary-go-no-go-alignment] checking Intent model8');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[pre-canary-go-no-go-alignment] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
