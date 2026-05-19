#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'capability-hub-foundation-files',
    label: 'Capability Hub Security contract files exist',
    target: 'contract, service, API facade, CLI, tests and docs are present',
    files: [
      'src/contracts/CapabilityHubContract.ts',
      'src/services/ZavorthCapabilityHubService.ts',
      'src/services/ZavorthCapabilityHubApiService.ts',
      'scripts/capability-hub.ts',
      'tests/services/ZavorthCapabilityHubService.test.ts',
      'docs/capability-plugins.md',
    ],
  }),
  ruleContainsAll({
    id: 'capability-hub-contract',
    label: 'Capability Hub contract is canonical',
    target: 'hub exposes contract version, root policy, item kinds, readiness and governance fields',
    files: ['src/contracts/CapabilityHubContract.ts'],
    needles: [
      'CAPABILITY_HUB_CONTRACT_VERSION',
      'CapabilityHubItemKind',
      'CapabilityHubReadiness',
      'CapabilityHubGovernance',
      'externalCapabilityRootsAllowed: false',
      'secretsSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'capability-hub-service-composes-existing-planes',
    label: 'Capability Hub composes existing planes',
    target: 'hub indexes runtime capabilities, channels, integrations, providers, MCP, skills and recipes',
    files: ['src/services/ZavorthCapabilityHubService.ts'],
    needles: [
      'CapabilityRegistry',
      'GatewayChannelRegistryService',
      'IntegrationHubService',
      'SkillCatalogService',
      'SkillRecipeService',
      'runtime-capability',
      'channel',
      'integration',
      'provider',
      'mcp',
      'skill',
      'recipe',
    ],
  }),
  ruleContainsAll({
    id: 'capability-hub-package-scripts',
    label: 'Capability Hub package scripts exist',
    target: 'npm scripts expose hub report and phase gate',
    files: ['package.json'],
    needles: [
      'capability-hub',
      'capability-hub:check',
      'qa:capability-hub',
    ],
  }),
  ruleContainsAll({
    id: 'capability-hub-cli-flags',
    label: 'Capability Hub CLI flags exist',
    target: 'operator can search, inspect and render JSON',
    files: ['scripts/capability-hub.ts'],
    needles: [
      '--inspect',
      '--search',
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
  console.log('[capability-hub] checking Security contract');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[capability-hub] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
