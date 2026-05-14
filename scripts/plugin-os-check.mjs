#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'plugin-os-files',
    label: 'Plugin OS phase files exist',
    target: 'Contract, sandbox, registry, tests, docs and package scripts are present',
    files: [
      'src/contracts/PluginManifestContract.ts',
      'src/services/PluginSandboxPolicyService.ts',
      'src/services/PluginRegistryService.ts',
      'tests/services/PluginRegistryService.test.ts',
      'docs/README.md',
      'docs/README.md',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'plugin-manifest-contract',
    label: 'Manifest contract defines Plugin OS vocabulary',
    target: 'Manifest includes API version, permissions, lifecycle, policy, registry entry and receipts',
    files: ['src/contracts/PluginManifestContract.ts'],
    needles: [
      'ZAVORTH_PLUGIN_OS_CONTRACT_VERSION',
      'ZAVORTH_PLUGIN_OS_API_VERSION',
      'ZAVORTH_PLUGIN_PERMISSION_KINDS',
      'ZavorthPluginManifest',
      'ZavorthPluginSandboxDecision',
      'ZavorthPluginReceipt',
    ],
  }),
  ruleContainsAll({
    id: 'plugin-sandbox-policy',
    label: 'Sandbox policy gates sensitive plugin actions',
    target: 'Policy blocks system scope and requires approval for network, secret, process and filesystem write',
    files: ['src/services/PluginSandboxPolicyService.ts'],
    needles: [
      'PluginSandboxPolicyService',
      'system scope',
      'external network permission requires approval',
      'filesystem write permission requires approval',
      'process spawn permission requires approval',
      'secret access requires approval',
    ],
  }),
  ruleContainsAll({
    id: 'plugin-registry-kernel',
    label: 'Registry supports lifecycle and invocation planning',
    target: 'Registry can register, install, enable, disable, uninstall, prepare invocation and invoke handlers',
    files: ['src/services/PluginRegistryService.ts'],
    needles: [
      'registerManifest',
      'install(',
      'enable(',
      'disable(',
      'uninstall(',
      'prepareInvocation',
      'invoke(',
      'PluginInvocationPlan',
      'PluginRuntimeHandler',
    ],
  }),
  ruleContainsAll({
    id: 'plugin-os-tests',
    label: 'Tests prove Plugin OS runtime behavior',
    target: 'Tests cover lifecycle, approval, blocked permissions and handler invocation',
    files: ['tests/services/PluginRegistryService.test.ts'],
    needles: [
      'registers a manifest',
      'requires approval for sensitive invocation',
      'executes through an injected handler',
      'blocks system-scope permissions',
      'evaluates sandbox decisions independently',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-plugin-os-gate',
    label: 'package exposes Plugin OS gate',
    target: 'local QA can run plugin-os:check and qa:plugin-os',
    files: ['package.json'],
    needles: [
      'plugin-os:check',
      'qa:plugin-os',
      'scripts/plugin-os-check.mjs',
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
  console.log('[plugin-os] checking Phase 2');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[plugin-os] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
