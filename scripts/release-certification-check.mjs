#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'release-certification-files',
    label: 'Consistency certification gate files exist',
    target: 'Contract, service, tests, certifier, docs and package scripts are present',
    files: [
      'src/contracts/ReleaseCertificationContract.ts',
      'src/services/ReleaseCertificationService.ts',
      'tests/services/ReleaseCertificationService.test.ts',
      'scripts/release-certification-check.mjs',
      'scripts/release-certify.ts',
      'docs/README.md',
      'docs/README.md',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'release-certification-contract',
    label: 'Contract defines certification vocabulary',
    target: 'Contract includes profile, gate, waiver, receipt, source snapshot, recommendations and no-live-IO policy',
    files: ['src/contracts/ReleaseCertificationContract.ts'],
    needles: [
      'ZAVORTH_RELEASE_CERTIFICATION_CONTRACT_VERSION',
      'ReleaseCertificationProfile',
      'ReleaseCertificationStatus',
      'ReleaseCertificationGate',
      'ReleaseCertificationWaiver',
      'ReleaseCertificationReceipt',
      'ReleaseCertificationSnapshot',
      'P0 Gap Closure',
      'waiversMustBeExplicit: true',
      'secretValuesSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'release-certification-service',
    label: 'Service certifies the ZavorthControl controls doctor snapshot',
    target: 'Service consumes OperationalReadinessToolingService, builds gates, receipts, blockers, waivers and profile decisions',
    files: ['src/services/ReleaseCertificationService.ts'],
    needles: [
      'ReleaseCertificationService',
      'OperationalReadinessToolingService',
      'buildSnapshot',
      'formatCertificationText',
      'p0-gap-budget',
      'p1-gap-budget',
      'p2-decision-register',
      'plugin-registry-coverage',
      'safety-no-live-io',
      'secret-redaction',
      'command-gates-registered',
      'applyWaiver',
      'activeWaivers',
    ],
  }),
  ruleContainsAll({
    id: 'consistency-certifier-script',
    label: 'Consistency certifier script exposes operator report',
    target: 'Certifier supports text, JSON, profile, require-ready and require-no-blockers modes',
    files: ['scripts/release-certify.ts'],
    needles: [
      'ReleaseCertificationService',
      '--json',
      '--profile=',
      '--require-ready',
      '--require-no-blockers',
      'formatCertificationText',
    ],
  }),
  ruleContainsAll({
    id: 'release-certification-tests',
    label: 'Tests prove certification behavior',
    target: 'Tests cover certified private absorption, obsolete waivers, release-candidate profile and text formatting',
    files: ['tests/services/ReleaseCertificationService.test.ts'],
    needles: [
      'builds certified private absorption certification after remaining runtime decisions',
      'ignores obsolete explicit waivers when the P0 gate already passes',
      'tightens P1 gaps for release-candidate',
      'formats certification text',
      'sourceP0Gaps: 0',
      'sourceP1Gaps: 0',
      'sourceP2Gaps: 0',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-release-certification-gates',
    label: 'package exposes consistency certification gates',
    target: 'local QA can run consistency certification check and certifier',
    files: ['package.json'],
    needles: [
      'release-certification:check',
      'qa:release-certification',
      'scripts/release-certification-check.mjs',
      'release-certify',
      'release-certify:json',
      'scripts/release-certify.ts',
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
  console.log('[release-certification] checking Certification matrix');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[release-certification] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
