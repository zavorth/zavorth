#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'capability-packs-files',
    label: 'Capability Packs Credential vault files exist',
    target: 'contract, service, API facade, CLI, tests and docs are present',
    files: [
      'src/contracts/CapabilityPackCatalogContract.ts',
      'src/services/ZavorthCapabilityPackCatalogService.ts',
      'src/services/ZavorthCapabilityPackCatalogApiService.ts',
      'scripts/capability-packs.ts',
      'tests/services/ZavorthCapabilityPackCatalogService.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'capability-packs-contract-policy',
    label: 'Capability Packs contract is local and safe',
    target: 'contract exposes official packs, no external roots, no live default and no serialized secrets',
    files: ['src/contracts/CapabilityPackCatalogContract.ts'],
    needles: [
      'CAPABILITY_PACK_CATALOG_CONTRACT_VERSION',
      'CapabilityPackDefinition',
      'officialPacksOnly: true',
      'externalRootsAllowed: false',
      'importsMustUseCapabilityImporter: true',
      'liveActivationByDefault: false',
      'secretsSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'capability-packs-service-official-packs',
    label: 'Capability Packs service includes official local packs',
    target: 'service contains channels, AI access, tool bridges and ops skill packs',
    files: ['src/services/ZavorthCapabilityPackCatalogService.ts'],
    needles: [
      'OFFICIAL_CAPABILITY_PACKS',
      'official-communication-channels',
      'official-ai-access',
      'official-tool-bridges',
      'official-ops-skills',
      'listManifests',
      'liveActivationByDefault: false',
    ],
  }),
  ruleContainsAll({
    id: 'capability-packs-activation-flow-contract',
    label: 'Activation Flow contract accepts packId',
    target: 'activation flow input can select an official pack',
    files: ['src/contracts/CapabilityActivationFlowContract.ts'],
    needles: [
      'packId',
    ],
  }),
  ruleContainsAll({
    id: 'capability-packs-activation-flow-service',
    label: 'Activation Flow consumes official packs',
    target: 'activation flow feeds pack manifests into importer',
    files: ['src/services/ZavorthCapabilityActivationFlowService.ts'],
    needles: [
      'ZavorthCapabilityPackCatalogService',
      'packManifests',
    ],
  }),
  ruleContainsAll({
    id: 'capability-packs-activation-flow-cli',
    label: 'Activation Flow CLI accepts --pack',
    target: 'operator can run activation flow from a pack id',
    files: ['scripts/capability-activation-flow.ts'],
    needles: [
      '--pack',
    ],
  }),
  ruleContainsAll({
    id: 'capability-packs-package-scripts',
    label: 'Capability Packs package scripts exist',
    target: 'npm scripts expose pack catalog CLI and gate',
    files: ['package.json'],
    needles: [
      'capability-packs',
      'capability-packs:check',
      'qa:capability-packs',
    ],
  }),
  ruleContainsAll({
    id: 'capability-packs-cli-flags',
    label: 'Capability Packs CLI flags exist',
    target: 'operator can list, inspect, filter and export manifest JSON',
    files: ['scripts/capability-packs.ts'],
    needles: [
      '--pack',
      '--category',
      '--manifest',
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
  console.log('[capability-packs] checking Credential vault');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[capability-packs] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
