#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'live-readiness-files',
    label: 'Live readiness kernel files exist',
    target: 'Contract, service, tests, docs, SDK barrels and package scripts are present',
    files: [
      'src/contracts/LiveReadinessContract.ts',
      'src/services/LiveReadinessService.ts',
      'tests/services/LiveReadinessService.test.ts',
      'scripts/live-readiness-check.mjs',
      'docs/README.md',
      'src/sdk/contracts.ts',
      'src/sdk/index.ts',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'live-readiness-contract',
    label: 'Contract defines live readiness vocabulary',
    target: 'Contract captures dry-audit profile, live statuses, gates, receipts and Phase 2 handoff',
    files: ['src/contracts/LiveReadinessContract.ts'],
    needles: [
      'ZAVORTH_LIVE_READINESS_CONTRACT_VERSION',
      '2026-05-04.live-phase-1',
      'dry-audit',
      'live-ready',
      'partial-live',
      'configured-only',
      'dry-run-only',
      'template-only',
      'planned',
      'LiveReadinessGate',
      'LiveReadinessReceipt',
      'liveExternalCallRequiredToBuildSnapshot: false',
      'Phase 2 - Channel Live Activation P0',
    ],
  }),
  ruleContainsAll({
    id: 'live-readiness-service',
    label: 'Service builds no-live-IO readiness snapshots',
    target: 'Service consumes normalization, provider mesh, channel mesh and runtime-family closure to classify every source module',
    files: ['src/services/LiveReadinessService.ts'],
    needles: [
      'LiveReadinessService',
      'CapabilityNormalizationService',
      'ProviderMeshParityService',
      'ChannelMeshParityService',
      'RuntimeFamilyClosureService',
      'CHANNEL_TEMPLATE_ONLY',
      'CHANNEL_DRY_RUN_ONLY',
      'RUNTIME_DRY_RUN_ONLY',
      'generatedProviderManifest',
      'noLiveIoDuringReadinessKernel: true',
      'templatesCannotBeCertifiedAsLive: true',
      'dryRunCannotBeCertifiedAsLive: true',
      'Phase 2 - Channel Live Activation P0',
    ],
  }),
  ruleContainsAll({
    id: 'live-readiness-tests',
    label: 'Tests prove truthful readiness categories',
    target: 'Tests cover full inventory, channels, providers, runtime families, receipts, gaps and blocked unmapped entries',
    files: ['tests/services/LiveReadinessService.test.ts'],
    needles: [
      'builds a truthful no-live-IO readiness snapshot for the full tracked surface',
      'sourceModules).toBe(125)',
      'telegram',
      'signal',
      'msteams',
      'feishu',
      'openai',
      'amazon-bedrock',
      'deepgram',
      'unknown-private-module',
      'xoxb-',
    ],
  }),
  ruleContainsAll({
    id: 'live-readiness-package',
    label: 'package exposes live readiness gate',
    target: 'local QA can run live-readiness checks and focused tests',
    files: ['package.json'],
    needles: [
      'live-readiness:check',
      'qa:live-readiness',
      'scripts/live-readiness-check.mjs',
      'tests/services/LiveReadinessService.test.ts',
    ],
  }),
  ruleContainsAll({
    id: 'live-readiness-sdk',
    label: 'SDK barrels expose live readiness kernel',
    target: 'Module SDK can import the contract and service',
    files: ['src/sdk/contracts.ts', 'src/sdk/index.ts'],
    needles: [
      'LiveReadiness',
    ],
  }),
  ruleContainsAll({
    id: 'live-readiness-doc',
    label: 'Private doc records Phase 1 closure',
    target: 'Documentation explains the kernel, its categories, and the next phase',
    files: ['docs/README.md'],
    needles: [
      'Phase 1',
      'Live Readiness Kernel',
      'no live IO',
      'live-ready',
      'partial-live',
      'template-only',
      'dry-run-only',
      'Phase 2',
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
  console.log('[live-readiness] checking Phase 1');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[live-readiness] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
