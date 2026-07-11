#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'capability-normalization-files',
    label: 'Capability Normalization gate files exist',
    target: 'Contract, service, tests, docs and package scripts are present',
    files: [
      'src/contracts/CapabilityNormalizationContract.ts',
      'src/services/CapabilityNormalizationService.ts',
      'tests/services/CapabilityNormalizationService.test.ts',
      'docs/README.md',
      'docs/README.md',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'normalization-contract',
    label: 'Contract defines normalization vocabulary',
    target: 'Contract includes primitive definitions, source mappings, manifest templates and snapshots',
    files: ['src/contracts/CapabilityNormalizationContract.ts'],
    needles: [
      'ZAVORTH_CAPABILITY_NORMALIZATION_CONTRACT_VERSION',
      'CapabilityPrimitiveDefinition',
      'CapabilitySourceMapping',
      'CapabilityManifestTemplate',
      'CapabilityNormalizationSnapshot',
      "'agent'",
      "'sandbox'",
    ],
  }),
  ruleContainsAll({
    id: 'normalization-service-primitives',
    label: 'Service defines canonical Zavorth primitives',
    target: 'Service covers media, search, provider, channel, voice, memory, file, document, diagnostics and QA primitives',
    files: ['src/services/CapabilityNormalizationService.ts'],
    needles: [
      'provider.call',
      'agent.runtime',
      'sandbox.remote',
      'channel.message',
      'media.generate',
      'media.understand',
      'search.query',
      'speech.transcribe',
      'voice.session',
      'file.transfer',
      'document.extract',
      'memory.vector',
      'diagnostics.trace',
      'qa.scenario',
      'buildManifestTemplate',
    ],
  }),
  ruleContainsAll({
    id: 'normalization-service-inventory',
    label: 'Service maps private module inventory',
    target: 'Service maps representative provider, channel, media, search, memory, diagnostics and QA source modules',
    files: ['src/services/CapabilityNormalizationService.ts'],
    needles: [
      'amazon-bedrock',
      'codex',
      'openshell',
      'discord',
      'image-generation-core',
      'media-understanding-core',
      'searxng',
      'memory-lancedb',
      'diagnostics-otel',
      'qa-lab',
      'DEFAULT_PRIVATE_CAPABILITY_SOURCE_MODULES',
    ],
  }),
  ruleContainsAll({
    id: 'normalization-tests',
    label: 'Tests prove normalization and Plugin OS template compatibility',
    target: 'Tests cover full inventory mapping, manifest registration, review status and unmapped modules',
    files: ['tests/services/CapabilityNormalizationService.test.ts'],
    needles: [
      'with no unmapped defaults',
      'can be registered by the Plugin OS kernel',
      'native-contract primitives normalized after Intent model2 closure',
      'unknown modules explicit',
      'PluginRegistryService',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-normalization-gate',
    label: 'package exposes Capability Normalization gate',
    target: 'local QA can run capability-normalization:check and qa:capability-normalization',
    files: ['package.json'],
    needles: [
      'capability-normalization:check',
      'qa:capability-normalization',
      'scripts/capability-normalization-check.mjs',
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
  console.log('[capability-normalization] checking Approval gate');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[capability-normalization] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
