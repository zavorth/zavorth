#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'release-candidate-package-freeze-files',
    label: 'Release Candidate Package Freeze phase files exist',
    target: 'Contract, service, tests, runner, docs and package scripts are present',
    files: [
      'src/contracts/ReleaseCandidatePackageFreezeContract.ts',
      'src/services/ReleaseCandidatePackageFreezeService.ts',
      'tests/services/ReleaseCandidatePackageFreezeService.test.ts',
      'scripts/release-candidate-package-freeze.ts',
      'scripts/release-candidate-package-freeze-check.mjs',
      'docs/README.md',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'release-candidate-package-freeze-contract',
    label: 'Contract defines release candidate freeze vocabulary',
    target: 'Contract includes frozen package identity, artifacts, gates, receipts, commands and no-publish policy',
    files: ['src/contracts/ReleaseCandidatePackageFreezeContract.ts'],
    needles: [
      'ZAVORTH_RELEASE_CANDIDATE_PACKAGE_FREEZE_CONTRACT_VERSION',
      'ZAVORTH_RELEASE_CANDIDATE_FREEZE_ID',
      'zavorth@1.1.0-rc.1',
      'ReleaseCandidatePackageFreezeArtifact',
      'ReleaseCandidatePackageFreezeSnapshot',
      'npm-pack-dry-run-lock',
      'no-publish-policy-lock',
      'noNpmPublish: true',
      'noGitTagMoved: true',
      'secretValuesSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'release-candidate-package-freeze-service',
    label: 'Service freezes RC package from public launch smoke ledger',
    target: 'Service consumes Intent model5, locks package artifacts, forbids publish side effects and emits receipts',
    files: ['src/services/ReleaseCandidatePackageFreezeService.ts'],
    needles: [
      'ReleaseCandidatePackageFreezeService',
      'PublicLaunchSmokeEvidenceLedgerService',
      'ZAVORTH_RELEASE_CANDIDATE_FREEZE_ID',
      'package-manifest-lock',
      'npm-pack-dry-run-lock',
      'public-launch-smoke-ledger-lock',
      'rollback-plan-lock',
      'no-publish-side-effects',
      'Release candidate distribution rehearsal',
    ],
  }),
  ruleContainsAll({
    id: 'release-candidate-package-freeze-runner',
    label: 'Runner exposes text, JSON and require-frozen modes',
    target: 'Operator can render freeze evidence and fail when packageFrozen is false',
    files: ['scripts/release-candidate-package-freeze.ts'],
    needles: [
      'ReleaseCandidatePackageFreezeService',
      '--json',
      '--require-frozen',
      'formatFreezeText',
      'snapshot.summary.packageFrozen',
    ],
  }),
  ruleContainsAll({
    id: 'release-candidate-package-freeze-tests',
    label: 'Tests prove release candidate package freeze',
    target: 'Tests cover frozen package identity, artifacts, receipts, no-publish policy, commands and formatted output',
    files: ['tests/services/ReleaseCandidatePackageFreezeService.test.ts'],
    needles: [
      'freezes a release candidate package from the public launch smoke ledger',
      'releaseCandidateId: \'zavorth@1.1.0-rc.1\'',
      'artifacts: 11',
      'lockedArtifacts: 11',
      'receipts: 11',
      'packageFrozen: true',
      'keeps freeze side-effect free',
      'formats release candidate freeze text',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-release-candidate-package-freeze-gates',
    label: 'package exposes release candidate freeze gates',
    target: 'local QA can run freeze, JSON, static check and require-frozen modes',
    files: ['package.json'],
    needles: [
      'release-candidate-freeze',
      'release-candidate-freeze:json',
      'release-candidate-freeze:check',
      'qa:release-candidate-freeze',
      'scripts/release-candidate-package-freeze.ts',
      'scripts/release-candidate-package-freeze-check.mjs',
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
  console.log('[release-candidate-package-freeze] checking Intent model6');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[release-candidate-package-freeze] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
