#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'natural-setup-files',
    label: 'Natural Setup Assistant Preview engine files exist',
    target: 'contract, service, API facade, CLI, tests and docs are present',
    files: [
      'src/contracts/NaturalSetupAssistantContract.ts',
      'src/services/ZavorthNaturalSetupAssistantService.ts',
      'src/services/ZavorthNaturalSetupAssistantApiService.ts',
      'scripts/natural-setup.ts',
      'tests/services/ZavorthNaturalSetupAssistantService.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'natural-setup-contract-markers',
    label: 'Natural Setup contract is safety-first',
    target: 'contract includes intent, secret plan, readiness, conversation and safety fields',
    files: ['src/contracts/NaturalSetupAssistantContract.ts'],
    needles: [
      'NATURAL_SETUP_ASSISTANT_CONTRACT_VERSION',
      'NaturalSetupDetectedIntent',
      'NaturalSetupSecretPlan',
      'rawSecretValuesSerialized: false',
      'NaturalSetupReadiness',
      'NaturalSetupConversation',
      'liveActivation: false',
      'secretsSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'natural-setup-service-composes-hub-and-recipes',
    label: 'Natural Setup composes Capability Hub and Governance Recipes',
    target: 'assistant resolves plain language into a hub item and dry-run governance plan',
    files: ['src/services/ZavorthNaturalSetupAssistantService.ts'],
    needles: [
      'ZavorthCapabilityHubApiService',
      'ZavorthGovernanceRecipeApiService',
      'detectIntent',
      'resolveCapability',
      'buildSecretPlan',
      'buildReadiness',
      'renderReply',
      'previewOnly: true',
    ],
  }),
  ruleContainsAll({
    id: 'natural-setup-secret-safety-markers',
    label: 'Natural Setup does not serialize secrets',
    target: 'assistant redacts raw secret-looking input and only emits refs/previews',
    files: ['src/services/ZavorthNaturalSetupAssistantService.ts'],
    needles: [
      'SECRET_PATTERNS',
      'redactText',
      'previewSecret',
      'acceptedForPersistence: false',
      'persistenceMode',
      'rawSecretValuesSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'natural-setup-package-scripts',
    label: 'Natural Setup package scripts exist',
    target: 'npm scripts expose assistant CLI and gate',
    files: ['package.json'],
    needles: [
      'natural-setup',
      'natural-setup:check',
      'qa:natural-setup',
    ],
  }),
  ruleContainsAll({
    id: 'natural-setup-cli-flags',
    label: 'Natural Setup CLI flags exist',
    target: 'operator can pass text, inspect result and render JSON',
    files: ['scripts/natural-setup.ts'],
    needles: [
      '--text',
      '--inspect',
      '--json',
      '--capability',
      '--approval-id',
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
  console.log('[natural-setup] checking Preview engine');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[natural-setup] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
