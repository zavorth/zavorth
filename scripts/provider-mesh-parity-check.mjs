#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'provider-mesh-parity-files',
    label: 'Provider Mesh parity phase files exist',
    target: 'Contract, service, tests, docs and package scripts are present',
    files: [
      'src/contracts/ProviderMeshParityContract.ts',
      'src/services/ProviderMeshParityService.ts',
      'tests/services/ProviderMeshParityService.test.ts',
      'docs/README.md',
      'docs/README.md',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'provider-mesh-parity-contract',
    label: 'Contract defines Provider Mesh parity vocabulary',
    target: 'Contract includes status, adapter strategy, credential policy, entries and snapshots',
    files: ['src/contracts/ProviderMeshParityContract.ts'],
    needles: [
      'ZAVORTH_PROVIDER_MESH_PARITY_CONTRACT_VERSION',
      'ProviderMeshParityStatus',
      'ProviderMeshParityAdapterStrategy',
      'ProviderMeshParityCredentialPolicy',
      'ProviderMeshParityProviderEntry',
      'ProviderMeshParitySnapshot',
      'secretValuesSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'provider-mesh-parity-service',
    label: 'Service maps provider.call inventory into governed routes',
    target: 'Service uses normalization, provider registry, classifier, generated manifests and smoke gates',
    files: ['src/services/ProviderMeshParityService.ts'],
    needles: [
      'provider.call',
      'CapabilityNormalizationService',
      'ProviderIntegrationRegistry',
      'ProviderCompatibilityClassifier',
      'createMinimalProviderIntegrationManifest',
      'buildEntry',
      'generatedPluginManifest',
      'ProviderFactory.resolveRuntimeTarget',
    ],
  }),
  ruleContainsAll({
    id: 'provider-mesh-parity-tests',
    label: 'Tests prove provider parity behavior',
    target: 'Tests cover first-class, generated, local, Anthropic-compatible and Plugin OS manifest compatibility',
    files: ['tests/services/ProviderMeshParityService.test.ts'],
    needles: [
      'private provider inventory',
      'long-tail provider manifests',
      'local adapter strategy',
      'Anthropic-compatible provider families',
      'Plugin OS kernel',
      'amazon-bedrock',
      'anthropic-vertex',
      'lmstudio',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-provider-parity-gate',
    label: 'package exposes Provider Mesh parity gate',
    target: 'local QA can run provider-mesh-parity:check and qa:provider-mesh-parity',
    files: ['package.json'],
    needles: [
      'provider-mesh-parity:check',
      'qa:provider-mesh-parity',
      'scripts/provider-mesh-parity-check.mjs',
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
  console.log('[provider-mesh-parity] checking Phase 4');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[provider-mesh-parity] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
