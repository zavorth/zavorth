#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'capability-setup-guide-files',
    label: 'Capability Setup Guide Phase 7 files exist',
    target: 'contract, service, API facade, CLI, tests and docs are present',
    files: [
      'src/contracts/CapabilitySetupConversationContract.ts',
      'src/services/ZavorthCapabilitySetupConversationService.ts',
      'src/services/ZavorthCapabilitySetupConversationApiService.ts',
      'scripts/capability-setup-guide.ts',
      'tests/services/ZavorthCapabilitySetupConversationService.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'capability-setup-guide-contract',
    label: 'Setup Guide contract is conversational and safe',
    target: 'contract exposes audience, reply, tasks, secure requests and safety markers',
    files: ['src/contracts/CapabilitySetupConversationContract.ts'],
    needles: [
      'CAPABILITY_SETUP_CONVERSATION_CONTRACT_VERSION',
      'CapabilitySetupAudience',
      'CapabilitySetupSecureRequest',
      'rawValueAcceptedInChat: false',
      'noJargonByDefault: true',
      'rawSecretsSerialized: false',
      'liveActivationApplied: false',
    ],
  }),
  ruleContainsAll({
    id: 'capability-setup-guide-service-composes-flow',
    label: 'Setup Guide composes activation flow',
    target: 'service translates technical states into plain guidance without serializing secrets',
    files: ['src/services/ZavorthCapabilitySetupConversationService.ts'],
    needles: [
      'ZavorthCapabilityActivationFlowService',
      'toConversationStatus',
      'buildSecureRequests',
      'buildExplanationCards',
      'redact',
      'rawSecretsSerialized: false',
      'liveActivationApplied: false',
    ],
  }),
  ruleContainsAll({
    id: 'capability-setup-guide-package-scripts',
    label: 'Setup Guide package scripts exist',
    target: 'npm scripts expose setup guide CLI and phase gate',
    files: ['package.json'],
    needles: [
      'capability-setup-guide',
      'capability-setup-guide:check',
      'qa:capability-setup-guide',
    ],
  }),
  ruleContainsAll({
    id: 'capability-setup-guide-cli-flags',
    label: 'Setup Guide CLI flags exist',
    target: 'operator can pass pack, target, audience, checks and JSON',
    files: ['scripts/capability-setup-guide.ts'],
    needles: [
      '--pack',
      '--target',
      '--audience',
      '--secret-ref',
      '--readiness-check',
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
  console.log('[capability-setup-guide] checking Phase 7');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[capability-setup-guide] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
