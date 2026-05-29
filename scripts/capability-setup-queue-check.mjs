#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'capability-setup-queue-files',
    label: 'Capability Setup Queue ZavorthControl controls files exist',
    target: 'contract, service, API facade, CLI, tests and docs are present',
    files: [
      'src/contracts/CapabilitySetupQueueContract.ts',
      'src/services/ZavorthCapabilitySetupQueueService.ts',
      'src/services/ZavorthCapabilitySetupQueueApiService.ts',
      'scripts/capability-setup-queue.ts',
      'tests/services/ZavorthCapabilitySetupQueueService.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'capability-setup-queue-contract',
    label: 'Setup Queue contract is persistent and safe',
    target: 'contract exposes tickets, events, queue safety policy and no-secret markers',
    files: ['src/contracts/CapabilitySetupQueueContract.ts'],
    needles: [
      'CAPABILITY_SETUP_QUEUE_CONTRACT_VERSION',
      'CapabilitySetupQueueTicket',
      'CapabilitySetupQueueReceipt',
      'persistentQueue: true',
      'appendOnlyLedger: true',
      'rawSecretsSerialized: false',
      'liveActivationApplied: false',
    ],
  }),
  ruleContainsAll({
    id: 'capability-setup-queue-service-persists',
    label: 'Setup Queue service persists state and ledger',
    target: 'service composes setup conversation, persists inside root and appends receipts',
    files: ['src/services/ZavorthCapabilitySetupQueueService.ts'],
    needles: [
      'ZavorthCapabilitySetupConversationService',
      'statePath',
      'ledgerPath',
      'createTicket',
      'updateTicket',
      'appendLedger',
      'resolveInsideRoot',
      'rawSecretsSerialized: false',
      'liveActivationApplied: false',
    ],
  }),
  ruleContainsAll({
    id: 'capability-setup-queue-cli-flags',
    label: 'Setup Queue CLI flags exist',
    target: 'operator can create, update, show, list and filter tickets',
    files: ['scripts/capability-setup-queue.ts'],
    needles: [
      '--create',
      '--update',
      '--show',
      '--status',
      '--secret-ref',
      '--readiness-check',
      '--approval-id',
      '--json',
    ],
  }),
  ruleContainsAll({
    id: 'capability-setup-queue-package-scripts',
    label: 'Setup Queue package scripts exist',
    target: 'npm scripts expose queue CLI and phase gate',
    files: ['package.json'],
    needles: [
      'capability-setup-queue',
      'capability-setup-queue:check',
      'qa:capability-setup-queue',
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
  console.log('[capability-setup-queue] checking ZavorthControl controls');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[capability-setup-queue] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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

