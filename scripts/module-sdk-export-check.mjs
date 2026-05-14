#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'module-sdk-export-files',
    label: 'Module SDK export closure files exist',
    target: 'Contract, public SDK barrels, service, tests, docs and package scripts are present',
    files: [
      'src/contracts/ModuleSdkExportContract.ts',
      'src/sdk/index.ts',
      'src/sdk/module/index.ts',
      'src/sdk/contracts.ts',
      'src/sdk/plugin-os.ts',
      'src/sdk/capabilities.ts',
      'src/sdk/runtime-codex.ts',
      'src/sdk/runtime-openshell.ts',
      'src/sdk/version.ts',
      'src/services/ModuleSdkExportClosureService.ts',
      'tests/services/ModuleSdkExportClosureService.test.ts',
      'scripts/module-sdk-export-check.mjs',
      'docs/README.md',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'module-sdk-export-contract',
    label: 'Contract records native SDK/export closure policy',
    target: 'Contract captures native SDK decision, no Source shim, public subpaths and next worker handoff',
    files: ['src/contracts/ModuleSdkExportContract.ts'],
    needles: [
      'ZAVORTH_MODULE_SDK_EXPORT_CONTRACT_VERSION',
      '2026-05-04.worker-4',
      'zavorth-native-sdk',
      'not-source-compatible-shim',
      'ModuleSdkSurfaceId',
      'compatibilityShimProvided: false',
      'sourceImportPathsSupported: false',
      'noSourceSdkShim',
      'Worker 5 - provider/channel live smoke proof',
    ],
  }),
  ruleContainsAll({
    id: 'module-sdk-authoring-api',
    label: 'Module authoring SDK exposes Zavorth-native helpers',
    target: 'SDK helps authors define modules, manifests, capabilities, permissions and receipts',
    files: ['src/sdk/module/index.ts'],
    needles: [
      'defineZavorthModule',
      'createZavorthModuleManifest',
      'createZavorthCapabilityBinding',
      'createZavorthPermission',
      'createZavorthModuleReceipt',
      'normalizeZavorthModuleId',
      'ZAVORTH_PLUGIN_OS_API_VERSION',
    ],
  }),
  ruleContainsAll({
    id: 'module-sdk-public-barrels',
    label: 'Public SDK barrels expose stable Zavorth subpaths',
    target: 'SDK exports module, contracts, Plugin OS, capabilities, Codex runtime, OpenShell runtime and version surfaces',
    files: [
      'src/sdk/index.ts',
      'src/sdk/contracts.ts',
      'src/sdk/plugin-os.ts',
      'src/sdk/capabilities.ts',
      'src/sdk/runtime-codex.ts',
      'src/sdk/runtime-openshell.ts',
    ],
    needles: [
      'export *',
    ],
  }),
  ruleContainsAll({
    id: 'module-sdk-version-api',
    label: 'Version entrypoint exposes SDK identity',
    target: 'Version surface publishes a Zavorth Module SDK API version and release channel',
    files: ['src/sdk/version.ts'],
    needles: [
      'ZAVORTH_MODULE_SDK_VERSION',
      'ZAVORTH_MODULE_SDK_API_VERSION',
      'zavorth.module-sdk.v1',
      'ZAVORTH_MODULE_SDK_RELEASE_CHANNEL',
    ],
  }),
  ruleContainsAll({
    id: 'module-sdk-closure-service',
    label: 'Closure service summarizes package export parity',
    target: 'Service reports 8 Zavorth public subpaths, 299 Source package exports approx, 296 plugin SDK entrypoints approx and no compatibility shim',
    files: ['src/services/ModuleSdkExportClosureService.ts'],
    needles: [
      'ModuleSdkExportClosureService',
      'SOURCE_PACKAGE_EXPORTS_APPROX = 299',
      'SOURCE_PLUGIN_SDK_ENTRYPOINTS_APPROX = 296',
      'sdk-root',
      'module-authoring',
      'codex-runtime',
      'openshell-sandbox',
      'compatibilityShimProvided: false',
      'sourceImportPathsSupported: false',
      'stable contract-first module subpaths',
      'Worker 5 - provider/channel live smoke proof',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-module-sdk',
    label: 'package exposes native Module SDK subpaths and gates',
    target: 'package exports stable Zavorth SDK subpaths and exposes module-sdk-export checks',
    files: ['package.json'],
    needles: [
      '"./sdk"',
      '"./sdk/module"',
      '"./sdk/contracts"',
      '"./sdk/plugin-os"',
      '"./sdk/capabilities"',
      '"./sdk/runtime/codex"',
      '"./sdk/runtime/openshell"',
      '"./sdk/version"',
      'module-sdk-export:check',
      'qa:module-sdk-export',
      'scripts/module-sdk-export-check.mjs',
    ],
  }),
  ruleContainsAll({
    id: 'module-sdk-export-tests',
    label: 'Tests prove SDK/export closure behavior',
    target: 'Tests cover snapshot closure, package exports, SDK helpers and Plugin OS registry compatibility',
    files: ['tests/services/ModuleSdkExportClosureService.test.ts'],
    needles: [
      'closes Plugin SDK and package export parity through a Zavorth-native SDK',
      'exposes stable package exports for the Module SDK',
      'creates native module manifests that register in Plugin OS',
      'defines module handlers without Source import-path compatibility',
      'publicSubpaths: 8',
      'sourcePackageExportsApprox: 299',
      'sourcePluginSdkEntrypointsApprox: 296',
      'compatibilityShimProvided: false',
    ],
  }),
  ruleContainsAll({
    id: 'module-sdk-private-doc',
    label: 'Private doc records Worker 4 closure',
    target: 'Documentation explains native SDK/export decision and next worker',
    files: ['docs/README.md'],
    needles: [
      'Worker 4',
      'Module SDK Export Closure',
      'zavorth-native-sdk',
      'nao fornece shim de import path',
      './sdk/runtime/codex',
      './sdk/runtime/openshell',
      'Worker 5',
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
  console.log('[module-sdk-export] checking Worker 4');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[module-sdk-export] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
  const target = path.join(root, relativePath);
  if (!fs.existsSync(target)) {
    return null;
  }
  return fs.readFileSync(target, 'utf8');
}
