#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'final-absorption-certification-files',
    label: 'Final absorption certification files exist',
    target: 'Contract, service, certifier, tests, docs, SDK exports and package scripts are present',
    files: [
      'src/contracts/FinalAbsorptionCertificationContract.ts',
      'src/services/FinalAbsorptionCertificationService.ts',
      'tests/services/FinalAbsorptionCertificationService.test.ts',
      'scripts/final-absorption-certification-check.mjs',
      'scripts/final-absorption-certify.ts',
      'docs/README.md',
      'src/sdk/contracts.ts',
      'src/sdk/index.ts',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'final-absorption-certification-contract',
    label: 'Contract defines Worker 7 certification vocabulary',
    target: 'Contract captures final status, evidence, receipts, source snapshots, precise claim, and no-live-IO policy',
    files: ['src/contracts/FinalAbsorptionCertificationContract.ts'],
    needles: [
      'ZAVORTH_FINAL_ABSORPTION_CERTIFICATION_CONTRACT_VERSION',
      '2026-05-04.worker-7',
      'tracked-private-inventory-certified',
      'worker-1-normalization',
      'worker-6-runtime-family',
      'public-launch-certification',
      'not-claimed-by-this-certificate',
      'liveEndToEndParityRequiresSeparateOperatorRun: true',
      'No next worker in this closure chain',
    ],
  }),
  ruleContainsAll({
    id: 'final-absorption-certification-service',
    label: 'Service aggregates Worker 1 through Worker 6 receipts',
    target: 'Service consumes normalization, Codex, OpenShell, SDK, provider/channel, runtime family, and public-launch certification snapshots',
    files: ['src/services/FinalAbsorptionCertificationService.ts'],
    needles: [
      'FinalAbsorptionCertificationService',
      'CapabilityNormalizationService',
      'CodexRuntimePlaneService',
      'OpenShellRemoteSandboxService',
      'ModuleSdkExportClosureService',
      'ProviderChannelSmokeProofService',
      'RuntimeFamilyClosureService',
      'ParityCertificationService',
      'profile: \'public-launch\'',
      'totalReceipts',
      'formatCertificationText',
    ],
  }),
  ruleContainsAll({
    id: 'final-absorption-certifier-script',
    label: 'Final certifier script exposes operator report',
    target: 'Certifier supports text, JSON and require-certified modes',
    files: ['scripts/final-absorption-certify.ts'],
    needles: [
      'FinalAbsorptionCertificationService',
      '--json',
      '--require-certified',
      'formatCertificationText',
    ],
  }),
  ruleContainsAll({
    id: 'final-absorption-certification-tests',
    label: 'Tests prove Worker 7 closure',
    target: 'Tests cover final certification counts, precise no-live claim, source snapshots and text formatting',
    files: ['tests/services/FinalAbsorptionCertificationService.test.ts'],
    needles: [
      'certifies Worker 1 through Worker 6 as one final closure chain',
      'keeps the final claim precise and no-live-IO',
      'formats a final operator report',
      'totalReceipts: 125',
      'not-claimed-by-this-certificate',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-final-absorption-certification',
    label: 'package exposes final absorption certification gates',
    target: 'local QA can run the final check and final certifier',
    files: ['package.json'],
    needles: [
      'final-absorption-certification:check',
      'qa:final-absorption-certification',
      'scripts/final-absorption-certification-check.mjs',
      'final-absorption-certify',
      'final-absorption-certify:json',
      'scripts/final-absorption-certify.ts',
    ],
  }),
  ruleContainsAll({
    id: 'sdk-exposes-final-absorption-certification',
    label: 'SDK barrels expose final absorption certification',
    target: 'Module SDK contract/root surface includes Worker 7 contract and service',
    files: ['src/sdk/contracts.ts', 'src/sdk/index.ts'],
    needles: [
      'FinalAbsorptionCertification',
    ],
  }),
  ruleContainsAll({
    id: 'final-absorption-certification-doc',
    label: 'Private doc records Worker 7 closure',
    target: 'Documentation explains final closure and the exact remaining live-E2E boundary',
    files: ['docs/README.md'],
    needles: [
      'Worker 7',
      'Final Absorption Certification',
      '125 normalized source modules',
      'tracked-private-inventory-certified',
      'not-claimed-by-this-certificate',
      'No next worker',
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
  console.log('[final-absorption-certification] checking Worker 7');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[final-absorption-certification] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
