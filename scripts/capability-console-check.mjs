#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'capability-console-files',
    label: 'Capability Console Phase 10 files exist',
    target: 'contract, service, API facade, CLI, tests and docs are present',
    files: [
      'src/contracts/CapabilityConsoleContract.ts',
      'src/services/ZavorthCapabilityConsoleService.ts',
      'src/services/ZavorthCapabilityConsoleApiService.ts',
      'scripts/capability-console.ts',
      'tests/services/ZavorthCapabilityConsoleService.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'capability-console-contract',
    label: 'Capability Console contract is a single safe surface',
    target: 'contract exposes consolidated snapshots and safety policy',
    files: ['src/contracts/CapabilityConsoleContract.ts'],
    needles: [
      'CAPABILITY_CONSOLE_CONTRACT_VERSION',
      'CapabilityConsoleSnapshot',
      'singleUserSurface: true',
      'rawSecretsSerialized: false',
      'liveActivationApplied: false',
      'ownerApprovalBeforeLive: true',
      'approvalSurface',
    ],
  }),
  ruleContainsAll({
    id: 'capability-console-service-composes',
    label: 'Capability Console composes phases 0-9',
    target: 'service aggregates hub, packs, readiness, queue and executor requests',
    files: ['src/services/ZavorthCapabilityConsoleService.ts'],
    needles: [
      'ZavorthCapabilityHubService',
      'ZavorthCapabilityPackCatalogService',
      'ZavorthCapabilityPackReadinessDoctorService',
      'ZavorthCapabilitySetupQueueService',
      'ZavorthCapabilitySetupExecutorService',
      'commandHints',
      'Preview e approval',
      'aplicar rascunho <planId>',
    ],
  }),
  ruleContainsAll({
    id: 'capability-console-cli-flags',
    label: 'Capability Console CLI flags exist',
    target: 'operator can switch views, filter pack/target/status and render JSON',
    files: ['scripts/capability-console.ts'],
    needles: [
      '--view',
      '--pack',
      '--target',
      '--status',
      '--secret-ref',
      '--readiness-check',
      '--json',
    ],
  }),
  ruleContainsAll({
    id: 'capability-console-package-and-workspace',
    label: 'Capability Console is exposed without exceeding public script budget',
    target: 'one public CLI script plus direct workspace gate',
    files: ['package.json'],
    needles: [
      'capability-console',
      'node scripts/capability-console-check.mjs',
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
  console.log('[capability-console] checking Phase 10');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[capability-console] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
