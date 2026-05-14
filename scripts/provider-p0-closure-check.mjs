#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'provider-p0-closure-files',
    label: 'Provider P0 closure phase files exist',
    target: 'Contract, service, tests, docs and package scripts are present',
    files: [
      'src/contracts/ProviderP0ClosureContract.ts',
      'src/services/ProviderP0ClosureService.ts',
      'tests/services/ProviderP0ClosureService.test.ts',
      'scripts/provider-p0-closure-check.mjs',
      'docs/README.md',
      'docs/README.md',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'provider-p0-closure-contract',
    label: 'Contract defines Provider P0 closure vocabulary',
    target: 'Contract includes closure status, entries, summary, certification link and no-live-call policy',
    files: ['src/contracts/ProviderP0ClosureContract.ts'],
    needles: [
      'ZAVORTH_PROVIDER_P0_CLOSURE_CONTRACT_VERSION',
      'ProviderP0ClosureStatus',
      'ProviderP0ClosureEntry',
      'ProviderP0ClosureSnapshot',
      'unsupported_anthropic',
      'anthropic-compatible-runtime',
      'Fase 11 - P1 Provider Adapter Runtime',
      'liveExternalCallRequired: false',
      'secretValuesSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'provider-compatibility-classifier',
    label: 'Classifier promotes Anthropic-compatible routes out of P0 unsupported',
    target: 'Classifier exposes anthropic-compatible runtime support without live provider calls',
    files: ['src/services/providers/catalog/ProviderCompatibilityClassifier.ts'],
    needles: [
      'anthropic_compatible',
      'runtimeAdapter: \'anthropic_compatible\'',
      'runtimeSupported: true',
      'Runtime bridge deve usar adapter Anthropic-compatible',
    ],
  }),
  ruleContainsAll({
    id: 'provider-mesh-parity-service',
    label: 'Provider Mesh maps Anthropic-compatible runtime strategy',
    target: 'Service maps classifier output to anthropic-compatible-runtime and keeps templates visible',
    files: ['src/services/ProviderMeshParityService.ts', 'src/contracts/ProviderMeshParityContract.ts'],
    needles: [
      'anthropic-compatible-runtime',
      'ProviderMeshParityAdapterStrategy',
    ],
  }),
  ruleContainsAll({
    id: 'provider-p0-closure-service',
    label: 'Service proves P0 closure and certification handoff',
    target: 'Service checks anthropic and anthropic-vertex, provider unsupported count, and certification P0 count',
    files: ['src/services/ProviderP0ClosureService.ts'],
    needles: [
      'ProviderP0ClosureService',
      'CLOSED_PROVIDER_IDS',
      'anthropic',
      'anthropic-vertex',
      'remainingProviderP0',
      'certificationP0Gaps',
      'p1-template',
    ],
  }),
  ruleContainsAll({
    id: 'provider-p0-closure-tests',
    label: 'Tests prove Provider P0 closure',
    target: 'Tests cover two closed providers, zero unsupported Provider Mesh count, and final certification readiness',
    files: ['tests/services/ProviderP0ClosureService.test.ts'],
    needles: [
      'closes the two provider P0 gaps',
      'Provider Mesh report zero unsupported providers',
      'unblocks P0 certification and inherits final release readiness',
      'closedProviders: 2',
      'remainingProviderP0: 0',
      'sourceP0Gaps: 0',
      'sourceP1Gaps: 0',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-provider-p0-closure-gates',
    label: 'package exposes Provider P0 closure gates',
    target: 'local QA can run provider-p0-closure check',
    files: ['package.json'],
    needles: [
      'provider-p0-closure:check',
      'qa:provider-p0-closure',
      'scripts/provider-p0-closure-check.mjs',
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
  console.log('[provider-p0-closure] checking Phase 10');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[provider-p0-closure] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
