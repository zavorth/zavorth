#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'capability-setup-executor-files',
    label: 'Capability Setup Executor Phase 9 files exist',
    target: 'contract, service, API facade, CLI, tests and docs are present',
    files: [
      'src/contracts/CapabilitySetupExecutorContract.ts',
      'src/services/ZavorthCapabilitySetupExecutorService.ts',
      'src/services/ZavorthCapabilitySetupExecutorApiService.ts',
      'scripts/capability-setup-executor.ts',
      'tests/services/ZavorthCapabilitySetupExecutorService.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'capability-setup-executor-contract',
    label: 'Setup Executor contract is owner-gated',
    target: 'contract exposes activation request, owner approval and no-live safety markers',
    files: ['src/contracts/CapabilitySetupExecutorContract.ts'],
    needles: [
      'CAPABILITY_SETUP_EXECUTOR_CONTRACT_VERSION',
      'CapabilitySetupActivationRequest',
      'ownerApprovalBeforeLive: true',
      'rawSecretsSerialized: false',
      'liveActivationApplied: false',
      'externalRootsAllowed: false',
      'requestLedgerAppendOnly: true',
    ],
  }),
  ruleContainsAll({
    id: 'capability-setup-executor-service-composes',
    label: 'Setup Executor composes queue and activation flow',
    target: 'service consumes ready queue tickets and records activation request ledger',
    files: ['src/services/ZavorthCapabilitySetupExecutorService.ts'],
    needles: [
      'ZavorthCapabilitySetupQueueService',
      'ZavorthCapabilityActivationFlowService',
      'requestLedgerPath',
      'ownerApprovalId',
      'confirmOwnerControlledActivation',
      'appendActivationRequest',
      'liveActivationApplied: false',
    ],
  }),
  ruleContainsAll({
    id: 'capability-setup-executor-cli-flags',
    label: 'Setup Executor CLI flags exist',
    target: 'operator can execute dry-run, confirmed request and list ledger',
    files: ['scripts/capability-setup-executor.ts'],
    needles: [
      '--ticket',
      '--owner-approval-id',
      '--confirm-owner-controlled-activation',
      '--execute',
      '--limit',
      '--json',
    ],
  }),
  ruleContainsAll({
    id: 'capability-setup-executor-package-scripts',
    label: 'Setup Executor package scripts exist',
    target: 'npm scripts expose executor CLI and phase gate',
    files: ['package.json'],
    needles: [
      'capability-setup-executor',
      'capability-setup-executor:check',
      'qa:capability-setup-executor',
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
  console.log('[capability-setup-executor] checking Phase 9');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[capability-setup-executor] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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

