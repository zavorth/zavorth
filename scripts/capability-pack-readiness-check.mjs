#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'capability-pack-readiness-files',
    label: 'Capability Pack Readiness Phase 6 files exist',
    target: 'contract, service, API facade, CLI, tests and docs are present',
    files: [
      'src/contracts/CapabilityPackReadinessContract.ts',
      'src/services/ZavorthCapabilityPackReadinessDoctorService.ts',
      'src/services/ZavorthCapabilityPackReadinessDoctorApiService.ts',
      'scripts/capability-pack-readiness.ts',
      'tests/services/ZavorthCapabilityPackReadinessDoctorService.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'capability-pack-readiness-contract-safety',
    label: 'Readiness contract is presence-only and safe',
    target: 'contract exposes checks without reading or serializing secret values',
    files: ['src/contracts/CapabilityPackReadinessContract.ts'],
    needles: [
      'CAPABILITY_PACK_READINESS_CONTRACT_VERSION',
      'CapabilityPackReadinessCheck',
      'readsSecretValues: false',
      'secretsSerialized: false',
      'checksPresenceOnly: true',
      'liveActivationApplied: false',
    ],
  }),
  ruleContainsAll({
    id: 'capability-pack-readiness-service-probes',
    label: 'Readiness doctor checks requirements and policy',
    target: 'doctor checks secret refs, env keys, binaries, manual steps, local routes and readiness checks',
    files: ['src/services/ZavorthCapabilityPackReadinessDoctorService.ts'],
    needles: [
      'secretChecks',
      'envChecks',
      'binaryChecks',
      'manualChecks',
      'localRouteChecks',
      'readinessChecks',
      'policyCheck',
      'readsSecretValues: false',
    ],
  }),
  ruleContainsAll({
    id: 'capability-pack-readiness-activation-contract',
    label: 'Activation Flow contract exposes readiness state',
    target: 'activation flow can represent waiting_readiness and readiness snapshot',
    files: ['src/contracts/CapabilityActivationFlowContract.ts'],
    needles: [
      'waiting_readiness',
      'packReadinessSnapshot',
    ],
  }),
  ruleContainsAll({
    id: 'capability-pack-readiness-activation-service',
    label: 'Activation Flow uses readiness doctor',
    target: 'activation flow checks target readiness before approval/live request',
    files: ['src/services/ZavorthCapabilityActivationFlowService.ts'],
    needles: [
      'ZavorthCapabilityPackReadinessDoctorService',
      'targetReadiness',
    ],
  }),
  ruleContainsAll({
    id: 'capability-pack-readiness-package-scripts',
    label: 'Readiness package scripts exist',
    target: 'npm scripts expose readiness doctor CLI and phase gate',
    files: ['package.json'],
    needles: [
      'capability-pack-readiness',
      'capability-pack-readiness:check',
      'qa:capability-pack-readiness',
    ],
  }),
  ruleContainsAll({
    id: 'capability-pack-readiness-cli-flags',
    label: 'Readiness CLI flags exist',
    target: 'operator can pass pack, target, refs, env, binaries, routes and JSON',
    files: ['scripts/capability-pack-readiness.ts'],
    needles: [
      '--pack',
      '--target',
      '--secret-ref',
      '--env-key',
      '--binary',
      '--local-route',
      '--json',
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
  console.log('[capability-pack-readiness] checking Phase 6');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[capability-pack-readiness] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
