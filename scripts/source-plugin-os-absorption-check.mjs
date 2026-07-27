#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'source-plugin-os-gate-1-files',
    label: 'Intent model files exist',
    target: 'contract, adapter, matrix, doctor, absorption service, command, tests and package scripts are present',
    files: [
      'src/contracts/SourcePluginPackageContract.ts',
      'src/services/SourcePluginPackageAdapterService.ts',
      'src/services/SourcePluginSdkCompatibilityMatrixService.ts',
      'src/services/SourcePluginRuntimeDoctorService.ts',
      'src/services/SourcePluginOsAbsorptionService.ts',
      'scripts/source-plugin-os-absorption.ts',
      'tests/services/SourcePluginOsAbsorptionService.test.ts',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'source-plugin-package-contract',
    label: 'Contract captures package absorption vocabulary',
    target: 'contract includes package matrix, adapter receipts, runtime doctor and Intent model snapshot',
    files: ['src/contracts/SourcePluginPackageContract.ts'],
    needles: [
      'ZAVORTH_SOURCE_PLUGIN_PACKAGE_ABSORPTION_CONTRACT_VERSION',
      'SOURCE_INTERNAL_PLUGIN_PACKAGES',
      'SourcePluginPackageAdapterReceipt',
      'SourcePluginSdkCompatibilityMatrixSnapshot',
      'SourcePluginRuntimeDoctorSnapshot',
      'SourcePluginOsAbsorptionSnapshot',
    ],
  }),
  ruleContainsAll({
    id: 'source-plugin-package-adapter',
    label: 'Adapter converts Source-like package metadata',
    target: 'adapter reads source compat/build fields and returns a Zavorth Plugin OS manifest plus receipt',
    files: ['src/services/SourcePluginPackageAdapterService.ts'],
    needles: [
      'convertPackageJson',
      'normalizeCompatibility',
      'source.compat.pluginApi',
      'source.build.sourceVersion',
      'ZAVORTH_PLUGIN_OS_API_VERSION',
      'noSourceImportPathShim',
    ],
  }),
  ruleContainsAll({
    id: 'source-plugin-package-matrix',
    label: 'Matrix scans Source package SDK surface',
    target: 'matrix inspects memory-host-sdk, plugin-package-contract, plugin-sdk and sdk package exports',
    files: ['src/services/SourcePluginSdkCompatibilityMatrixService.ts'],
    needles: [
      '@source/plugin-sdk',
      '@source/plugin-package-contract',
      '@source/sdk',
      '@source/memory-host-sdk',
      'declaredExports',
      'classifyExportFamily',
    ],
  }),
  ruleContainsAll({
    id: 'source-plugin-runtime-doctor',
    label: 'Runtime doctor emits lifecycle receipts without external execution',
    target: 'doctor adapts manifest, runs install/enable/invoke policy paths, and records receipts',
    files: ['src/services/SourcePluginRuntimeDoctorService.ts'],
    needles: [
      'doctorPackageJson',
      'installWithoutApproval',
      'installWithApproval',
      'enableWithApproval',
      'invokeWithoutApproval',
      'executionPerformed: false',
    ],
  }),
  ruleContainsAll({
    id: 'source-plugin-absorption-service',
    label: 'Absorption service combines matrix and doctor',
    target: 'Intent model snapshot proves package scan, manifest conversion, policy and receipts',
    files: ['src/services/SourcePluginOsAbsorptionService.ts'],
    needles: [
      'buildSnapshot',
      'formatSnapshotText',
      'Preview engine - Agent Runtime Bridge Pack',
      'noSourceSourceCopy',
      'artifactFirstReceipts',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-source-plugin-os-gate',
    label: 'package exposes Intent model gates',
    target: 'operators can inspect, inspect JSON, run check and QA gate',
    files: ['package.json'],
    needles: [
      'source-plugin-os-absorption',
      'source-plugin-os-absorption:json',
      'source-plugin-os-absorption:check',
      'qa:source-plugin-os-absorption',
    ],
  }),
  runRuntimeRule(),
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
  console.log('[source-plugin-os-absorption] checking Intent model');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[source-plugin-os-absorption] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 12)) {
      console.log(`  - ${detail}`);
    }
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function runRuntimeRule() {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-source-plugin-os-check-'));
  const sourceRoot = path.join(fixtureRoot, 'source');
  createSourcePackageFixture(sourceRoot);
  const result = spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/source-plugin-os-absorption.ts',
    '--json',
    '--require-pass',
    '--source-root',
    sourceRoot,
  ], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });
  fs.rmSync(fixtureRoot, { recursive: true, force: true });

  if (result.status !== 0) {
    return {
      id: 'source-plugin-os-runtime-receipt',
      label: 'Runtime receipt passes',
      status: 'failed',
      observed: `exit ${result.status ?? 'unknown'}`,
      target: 'Intent model command emits a passing snapshot against the current Source checkout',
      details: compactDetails(result.error instanceof Error ? result.error.message : '', result.stderr, result.stdout),
    };
  }

  try {
    const receipt = JSON.parse(result.stdout);
    return {
      id: 'source-plugin-os-runtime-receipt',
      label: 'Runtime receipt passes',
      status: receipt.status === 'passed' ? 'passed' : 'failed',
      observed: `status=${receipt.status}, packages=${receipt.summary?.packagesFound}, exports=${receipt.summary?.declaredExports}, manifests=${receipt.summary?.manifestsConverted}`,
      target: 'Intent model command emits a passing snapshot against the current Source checkout',
      details: [
        `lifecycleReceipts=${receipt.summary?.lifecycleReceipts}`,
        `approvalsRequired=${receipt.summary?.approvalsRequired}`,
        `runtimeExecutionPerformed=${receipt.summary?.runtimeExecutionPerformed}`,
        `next=${receipt.commands?.nextAction}`,
      ],
    };
  } catch (error) {
    return {
      id: 'source-plugin-os-runtime-receipt',
      label: 'Runtime receipt passes',
      status: 'failed',
      observed: 'invalid JSON receipt',
      target: 'Intent model command emits a passing snapshot against the current Source checkout',
      details: [error instanceof Error ? error.message : String(error), ...compactDetails(result.stderr, result.stdout)],
    };
  }
}

function createSourcePackageFixture(sourceRoot) {
  createSourcePackage(sourceRoot, 'plugin-sdk', '@source/plugin-sdk', {
    './plugin-entry': './src/plugin-entry.ts',
    './provider-entry': './src/provider-entry.ts',
    './runtime-doctor': './src/runtime-doctor.ts',
  });
  createSourcePackage(sourceRoot, 'plugin-package-contract', '@source/plugin-package-contract', {
    '.': './src/index.ts',
  });
  createSourcePackage(sourceRoot, 'sdk', '@source/sdk', {
    '.': './dist/index.mjs',
  });
  createSourcePackage(sourceRoot, 'memory-host-sdk', '@source/memory-host-sdk', {
    './runtime': './src/runtime.ts',
    './query': './src/query.ts',
  });
}

function createSourcePackage(sourceRoot, directoryName, packageName, exportsField) {
  const packageRoot = path.join(sourceRoot, 'packages', directoryName);
  fs.mkdirSync(packageRoot, { recursive: true });
  fs.writeFileSync(path.join(packageRoot, 'package.json'), JSON.stringify({
    name: packageName,
    version: '0.0.0-private',
    type: 'module',
    exports: exportsField,
  }, null, 2));
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

function compactDetails(...values) {
  return values
    .flatMap((value) => String(value || '').split(/\r...\n/g))
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);
}
