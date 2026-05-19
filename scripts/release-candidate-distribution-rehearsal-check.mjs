#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'release-candidate-distribution-rehearsal-files',
    label: 'Release Candidate Distribution Rehearsal phase files exist',
    target: 'Contract, service, tests, runner, docs and package scripts are present',
    files: [
      'src/contracts/ReleaseCandidateDistributionRehearsalContract.ts',
      'src/services/ReleaseCandidateDistributionRehearsalService.ts',
      'tests/services/ReleaseCandidateDistributionRehearsalService.test.ts',
      'scripts/release-candidate-distribution-rehearsal.ts',
      'scripts/release-candidate-distribution-rehearsal-check.mjs',
      'docs/README.md',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'release-candidate-distribution-rehearsal-contract',
    label: 'Contract defines RC distribution rehearsal vocabulary',
    target: 'Contract includes RC identity, rehearsal steps, gates, receipts, commands and no-remote-mutation policy',
    files: ['src/contracts/ReleaseCandidateDistributionRehearsalContract.ts'],
    needles: [
      'ZAVORTH_RELEASE_CANDIDATE_DISTRIBUTION_REHEARSAL_CONTRACT_VERSION',
      'ReleaseCandidateDistributionRehearsalStep',
      'ReleaseCandidateDistributionRehearsalSnapshot',
      'npm-rc-publish-dry-run',
      'github-release-draft-plan',
      'no-publish-lock',
      'noNpmPublish: true',
      'noGithubReleaseCreated: true',
      'noRemoteMutationByDefault: true',
      'secretValuesSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'release-candidate-distribution-rehearsal-service',
    label: 'Service rehearses RC distribution from frozen package',
    target: 'Service consumes Intent model6, models dry-run/operator steps, forbids publication side effects and emits receipts',
    files: ['src/services/ReleaseCandidateDistributionRehearsalService.ts'],
    needles: [
      'ReleaseCandidateDistributionRehearsalService',
      'ReleaseCandidatePackageFreezeService',
      'pack-dry-run-rehearsal',
      'npm-rc-publish-dry-run',
      'github-release-draft-plan',
      'rollback-and-installer-rehearsed',
      'no-publication-side-effects',
      'Pre-canary go/no-go alignment',
    ],
  }),
  ruleContainsAll({
    id: 'release-candidate-distribution-rehearsal-runner',
    label: 'Runner exposes text, JSON and require-rehearsed modes',
    target: 'Operator can render rehearsal evidence and fail when rehearsalReady is false',
    files: ['scripts/release-candidate-distribution-rehearsal.ts'],
    needles: [
      'ReleaseCandidateDistributionRehearsalService',
      '--json',
      '--require-rehearsed',
      'formatRehearsalText',
      'snapshot.summary.rehearsalReady',
    ],
  }),
  ruleContainsAll({
    id: 'release-candidate-distribution-rehearsal-tests',
    label: 'Tests prove release candidate distribution rehearsal',
    target: 'Tests cover RC identity, dry/operator steps, receipts, no-mutation policy, commands and formatted output',
    files: ['tests/services/ReleaseCandidateDistributionRehearsalService.test.ts'],
    needles: [
      'rehearses distribution from the frozen release candidate package',
      'steps: 12',
      'dryReadySteps: 8',
      'operatorReadySteps: 4',
      'receipts: 12',
      'rehearsalReady: true',
      'keeps distribution rehearsal side-effect free',
      'formats release candidate distribution rehearsal text',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-release-candidate-distribution-rehearsal-gates',
    label: 'package exposes RC distribution rehearsal gates',
    target: 'local QA can run rehearsal, JSON, static check and require-rehearsed modes',
    files: ['package.json'],
    needles: [
      'release-candidate-distribution-rehearsal',
      'release-candidate-distribution-rehearsal:json',
      'release-candidate-distribution-rehearsal:check',
      'qa:release-candidate-distribution-rehearsal',
      'scripts/release-candidate-distribution-rehearsal.ts',
      'scripts/release-candidate-distribution-rehearsal-check.mjs',
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
  console.log('[release-candidate-distribution-rehearsal] checking Intent model7');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[release-candidate-distribution-rehearsal] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
