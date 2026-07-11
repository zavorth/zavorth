#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'capability-activation-flow-files',
    label: 'Capability Activation Flow Connector registry files exist',
    target: 'contract, service, API facade, CLI, tests and docs are present',
    files: [
      'src/contracts/CapabilityActivationFlowContract.ts',
      'src/services/ZavorthCapabilityActivationFlowService.ts',
      'src/services/ZavorthCapabilityActivationFlowApiService.ts',
      'scripts/capability-activation-flow.ts',
      'tests/services/ZavorthCapabilityActivationFlowService.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'capability-activation-flow-contract-safety',
    label: 'Activation Flow contract is dry-run and approval first',
    target: 'contract exposes import, setup, steps, receipts, policy and no live apply',
    files: ['src/contracts/CapabilityActivationFlowContract.ts'],
    needles: [
      'CAPABILITY_ACTIVATION_FLOW_CONTRACT_VERSION',
      'CapabilityActivationFlowStatus',
      'CapabilityActivationFlowStep',
      'CapabilityActivationFlowReceipt',
      'dryRunOnly: true',
      'liveActivationApplied: false',
      'secretsSerialized: false',
      'ownerApprovalBeforeLive: true',
    ],
  }),
  ruleContainsAll({
    id: 'capability-activation-flow-composes-phases',
    label: 'Activation Flow composes Importer, Hub, Natural Setup and Governance',
    target: 'service connects previous phases without applying live activation',
    files: ['src/services/ZavorthCapabilityActivationFlowService.ts'],
    needles: [
      'ZavorthCapabilityImportService',
      'ZavorthCapabilityHubApiService',
      'ZavorthNaturalSetupAssistantService',
      'ZavorthGovernanceRecipeApiService',
      'resolveStatus',
      'buildSteps',
      'buildReceipts',
      'liveActivationApplied: false',
    ],
  }),
  ruleContainsAll({
    id: 'capability-activation-flow-package-scripts',
    label: 'Activation Flow package scripts exist',
    target: 'npm scripts expose activation flow CLI and gate',
    files: ['package.json'],
    needles: [
      'capability-activation-flow',
      'capability-activation-flow:check',
      'qa:capability-activation-flow',
    ],
  }),
  ruleContainsAll({
    id: 'capability-activation-flow-cli-flags',
    label: 'Activation Flow CLI flags exist',
    target: 'operator can pass target, manifest file, text, approval and JSON',
    files: ['scripts/capability-activation-flow.ts'],
    needles: [
      '--target',
      '--file',
      '--text',
      '--approval-id',
      '--json',
      'readCanonicalFile',
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
  console.log('[capability-activation-flow] checking Connector registry');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[capability-activation-flow] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
