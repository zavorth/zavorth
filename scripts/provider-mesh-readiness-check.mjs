#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'provider-mesh-readiness-files',
    label: 'Provider Mesh consistency gate files exist',
    target: 'Contract, service, tests, docs and package scripts are present',
    files: [
      'src/contracts/ProviderMeshReadinessContract.ts',
      'src/services/ProviderMeshReadinessService.ts',
      'tests/services/ProviderMeshReadinessService.test.ts',
      'docs/README.md',
      'docs/README.md',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'provider-mesh-readiness-contract',
    label: 'Contract defines Provider Mesh consistency vocabulary',
    target: 'Contract includes status, adapter strategy, credential policy, entries and snapshots',
    files: ['src/contracts/ProviderMeshReadinessContract.ts'],
    needles: [
      'ZAVORTH_PROVIDER_MESH_READINESS_CONTRACT_VERSION',
      'ProviderMeshReadinessStatus',
      'ProviderMeshReadinessAdapterStrategy',
      'ProviderMeshReadinessCredentialPolicy',
      'ProviderMeshReadinessProviderEntry',
      'ProviderMeshReadinessSnapshot',
      'secretValuesSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'provider-mesh-readiness-service',
    label: 'Service maps provider.call inventory into governed routes',
    target: 'Service uses normalization, provider registry, classifier, generated manifests and smoke gates',
    files: ['src/services/ProviderMeshReadinessService.ts'],
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
    id: 'provider-mesh-readiness-tests',
    label: 'Tests prove provider readiness behavior',
    target: 'Tests cover first-class, cataloged, local, Anthropic-compatible and Plugin OS manifest compatibility',
    files: ['tests/services/ProviderMeshReadinessService.test.ts'],
    needles: [
      'private provider inventory',
      'cataloged long-tail provider routes',
      'local adapter strategy',
      'Anthropic-compatible provider families',
      'Plugin OS kernel',
      'amazon-bedrock',
      'anthropic',
      'lmstudio',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-provider-certification-gate',
    label: 'package exposes Provider Mesh consistency gate',
    target: 'local QA can run provider-mesh-readiness:check and qa:provider-mesh-readiness',
    files: ['package.json'],
    needles: [
      'provider-mesh-readiness:check',
      'qa:provider-mesh-readiness',
      'scripts/provider-mesh-readiness-check.mjs',
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
  console.log('[provider-mesh-readiness] checking Connector registry');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[provider-mesh-readiness] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
