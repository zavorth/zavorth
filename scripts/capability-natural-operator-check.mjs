#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'capability-natural-operator-files',
    label: 'Capability Natural Operator Intent model1 files exist',
    target: 'contract, service, API facade, console CLI integration, tests and docs are present',
    files: [
      'src/contracts/CapabilityNaturalOperatorContract.ts',
      'src/services/ZavorthCapabilityNaturalOperatorService.ts',
      'src/services/ZavorthCapabilityNaturalOperatorApiService.ts',
      'scripts/capability-console.ts',
      'tests/services/ZavorthCapabilityNaturalOperatorService.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'capability-natural-operator-contract',
    label: 'Natural Operator contract is safe and planning-only',
    target: 'contract exposes natural decisions, setup ticket, executor result and no-live policy',
    files: ['src/contracts/CapabilityNaturalOperatorContract.ts'],
    needles: [
      'CAPABILITY_NATURAL_OPERATOR_CONTRACT_VERSION',
      'CapabilityNaturalOperatorDecision',
      'create_setup_ticket',
      'prepare_activation_request',
      'rawSecretsSerialized: false',
      'liveActivationApplied: false',
      'naturalLanguageMayOnlyPlan: true',
    ],
  }),
  ruleContainsAll({
    id: 'capability-natural-operator-service-composes',
    label: 'Natural Operator composes phases 0-10',
    target: 'service routes language into setup assistant, console, queue and executor',
    files: ['src/services/ZavorthCapabilityNaturalOperatorService.ts'],
    needles: [
      'ZavorthNaturalSetupAssistantService',
      'ZavorthCapabilityConsoleService',
      'ZavorthCapabilitySetupQueueService',
      'ZavorthCapabilitySetupExecutorService',
      'inferPackId',
      'extractTicketId',
      'liveActivationApplied: false',
    ],
  }),
  ruleContainsAll({
    id: 'capability-console-natural-flags',
    label: 'Capability Console accepts natural language flags',
    target: 'existing public CLI supports natural operation without adding a new npm script',
    files: ['scripts/capability-console.ts'],
    needles: [
      'ZavorthCapabilityNaturalOperatorApiService',
      '--ask',
      '--text',
      '--ticket',
      '--owner-approval-id',
      '--no-create-ticket',
      'renderNaturalResult',
    ],
  }),
  ruleContainsAll({
    id: 'capability-natural-operator-workspace-gate',
    label: 'Natural Operator gate is wired directly into workspace check',
    target: 'workspace check calls direct node gate without adding public script names',
    files: ['package.json'],
    needles: [
      'capability-console',
      'node scripts/capability-natural-operator-check.mjs',
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
  console.log('[capability-natural-operator] checking Intent model1');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[capability-natural-operator] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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

