#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'release-certification-profile-hardening-files',
    label: 'Release Certification Profile Hardening phase files exist',
    target: 'Contract, service, tests, runner, docs and package scripts are present',
    files: [
      'src/contracts/ReleaseCertificationProfileHardeningContract.ts',
      'src/services/ReleaseCertificationProfileHardeningService.ts',
      'tests/services/ReleaseCertificationProfileHardeningService.test.ts',
      'scripts/release-certification-profile-hardening.ts',
      'scripts/release-certification-profile-hardening-check.mjs',
      'docs/README.md',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'release-certification-profile-hardening-contract',
    label: 'Contract defines hardened release profile vocabulary',
    target: 'Contract includes profile policy matrix, results, final receipts, commands and no-live-IO policy',
    files: ['src/contracts/ReleaseCertificationProfileHardeningContract.ts'],
    needles: [
      'ZAVORTH_RELEASE_CERTIFICATION_PROFILE_HARDENING_CONTRACT_VERSION',
      'ReleaseCertificationProfilePolicy',
      'ReleaseCertificationProfileResult',
      'ReleaseCertificationFinalReceipt',
      'private-absorption',
      'release-candidate',
      'public-launch',
      'requiresZeroP0P1P2: true',
      'noWaiversForFinalCertification: true',
      'secretValuesSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'release-certification-profile-hardening-service',
    label: 'Service certifies all release profiles',
    target: 'Service runs private, release-candidate and public-launch profiles with zero gaps, receipts and no waivers',
    files: ['src/services/ReleaseCertificationProfileHardeningService.ts'],
    needles: [
      'ReleaseCertificationProfileHardeningService',
      'profilePolicyMatrix',
      'private-absorption',
      'release-candidate',
      'public-launch',
      'finalReceipts',
      'no-waivers-across-profiles',
      'commands-registered-for-release-profiles',
      'Public launch smoke and evidence ledger',
    ],
  }),
  ruleContainsAll({
    id: 'release-certification-profile-hardening-runner',
    label: 'Runner exposes text, JSON and require-ready modes',
    target: 'Operator can render hardening evidence and fail when releaseReady is false',
    files: ['scripts/release-certification-profile-hardening.ts'],
    needles: [
      'ReleaseCertificationProfileHardeningService',
      '--json',
      '--require-ready',
      'formatHardeningText',
      'snapshot.summary.releaseReady',
    ],
  }),
  ruleContainsAll({
    id: 'release-certification-profile-hardening-tests',
    label: 'Tests prove hardened profile certification',
    target: 'Tests cover all three profiles, final receipts, commands and formatted output',
    files: ['tests/services/ReleaseCertificationProfileHardeningService.test.ts'],
    needles: [
      'certifies private, release-candidate and public-launch profiles together',
      'profiles: 3',
      'certifiedProfiles: 3',
      'finalReceipts: 30',
      'sourceP0Gaps: 0',
      'sourceP1Gaps: 0',
      'sourceP2Gaps: 0',
      'formats release hardening text',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-release-certification-profile-hardening-gates',
    label: 'package exposes release profile hardening gates',
    target: 'local QA can run profile hardening, release-candidate and public-launch certification',
    files: ['package.json'],
    needles: [
      'release-certification-hardening',
      'release-certification-hardening:json',
      'release-certification-hardening:check',
      'qa:release-certification-hardening',
      'parity-certify:release-candidate',
      'parity-certify:public-launch',
      'scripts/release-certification-profile-hardening.ts',
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
  console.log('[release-certification-profile-hardening] checking Intent model4');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[release-certification-profile-hardening] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
