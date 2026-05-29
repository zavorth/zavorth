#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'parity-certification-files',
    label: 'Parity certification phase files exist',
    target: 'Contract, service, tests, certifier, docs and package scripts are present',
    files: [
      'src/contracts/ParityCertificationContract.ts',
      'src/services/ParityCertificationService.ts',
      'tests/services/ParityCertificationService.test.ts',
      'scripts/parity-certification-check.mjs',
      'scripts/parity-certify.ts',
      'docs/README.md',
      'docs/README.md',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'parity-certification-contract',
    label: 'Contract defines certification vocabulary',
    target: 'Contract includes profile, gate, waiver, receipt, source snapshot, recommendations and no-live-IO policy',
    files: ['src/contracts/ParityCertificationContract.ts'],
    needles: [
      'ZAVORTH_PARITY_CERTIFICATION_CONTRACT_VERSION',
      'ParityCertificationProfile',
      'ParityCertificationStatus',
      'ParityCertificationGate',
      'ParityCertificationWaiver',
      'ParityCertificationReceipt',
      'ParityCertificationSnapshot',
      'Etapa 10 - P0 Gap Closure',
      'waiversMustBeExplicit: true',
      'secretValuesSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'parity-certification-service',
    label: 'Service certifies the ZavorthControl controls doctor snapshot',
    target: 'Service consumes OperationalParityToolingService, builds gates, receipts, blockers, waivers and profile decisions',
    files: ['src/services/ParityCertificationService.ts'],
    needles: [
      'ParityCertificationService',
      'OperationalParityToolingService',
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
    id: 'parity-certifier-script',
    label: 'Parity certifier script exposes operator report',
    target: 'Certifier supports text, JSON, profile, require-ready and require-no-blockers modes',
    files: ['scripts/parity-certify.ts'],
    needles: [
      'ParityCertificationService',
      '--json',
      '--profile=',
      '--require-ready',
      '--require-no-blockers',
      'formatCertificationText',
    ],
  }),
  ruleContainsAll({
    id: 'parity-certification-tests',
    label: 'Tests prove certification behavior',
    target: 'Tests cover certified private absorption, obsolete waivers, release-candidate profile and text formatting',
    files: ['tests/services/ParityCertificationService.test.ts'],
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
    id: 'package-exposes-parity-certification-gates',
    label: 'package exposes parity certification gates',
    target: 'local QA can run parity certification check and certifier',
    files: ['package.json'],
    needles: [
      'parity-certification:check',
      'qa:parity-certification',
      'scripts/parity-certification-check.mjs',
      'parity-certify',
      'parity-certify:json',
      'scripts/parity-certify.ts',
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
  console.log('[parity-certification] checking Certification matrix');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[parity-certification] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
