#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'capability-import-files',
    label: 'Capability Importer Approval gate files exist',
    target: 'contract, service, API facade, CLI, tests and docs are present',
    files: [
      'src/contracts/CapabilityImportContract.ts',
      'src/services/ZavorthCapabilityImportService.ts',
      'src/services/ZavorthCapabilityImportApiService.ts',
      'scripts/capability-import.ts',
      'tests/services/ZavorthCapabilityImportService.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'capability-import-contract-safety',
    label: 'Capability Import contract is canonical and safe',
    target: 'contract requires canonical root, dry-run, no live activation and no serialized secrets',
    files: ['src/contracts/CapabilityImportContract.ts'],
    needles: [
      'CAPABILITY_IMPORT_CONTRACT_VERSION',
      'CapabilityImportManifest',
      'CapabilityImportPolicy',
      'externalCapabilityRootsAllowed: false',
      'importsMustNormalizeToCapabilityHub: true',
      'dryRunOnly: true',
      'liveActivation: false',
      'secretsSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'capability-import-service-normalizes',
    label: 'Capability Import service normalizes into Capability Hub',
    target: 'importer validates manifests, rejects raw secrets and emits CapabilityHubItem records',
    files: ['src/services/ZavorthCapabilityImportService.ts'],
    needles: [
      'CapabilityHubItem',
      'validateManifest',
      'validateItem',
      'toCapabilityHubItem',
      'SECRET_VALUE_PATTERNS',
      'canonicalRootOnly: true',
      'liveAllowed: false',
      'defaultEnabled: false',
    ],
  }),
  ruleContainsAll({
    id: 'capability-import-hub-integration',
    label: 'Capability Hub consumes imported items',
    target: 'Hub composes importer output instead of creating a parallel catalog',
    files: ['src/services/ZavorthCapabilityHubService.ts'],
    needles: [
      'ZavorthCapabilityImportService',
      'CapabilityImportLike',
      'capabilityImportService',
      'safeImportedItems',
    ],
  }),
  ruleContainsAll({
    id: 'capability-import-package-scripts',
    label: 'Capability Import package scripts exist',
    target: 'npm scripts expose importer CLI and phase gate',
    files: ['package.json'],
    needles: [
      'capability-import',
      'capability-import:check',
      'qa:capability-import',
    ],
  }),
  ruleContainsAll({
    id: 'capability-import-cli-flags',
    label: 'Capability Import CLI flags exist',
    target: 'operator can import a canonical-root file, print sample and render JSON',
    files: ['scripts/capability-import.ts'],
    needles: [
      '--file',
      '--sample',
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
  console.log('[capability-import] checking Approval gate');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[capability-import] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
