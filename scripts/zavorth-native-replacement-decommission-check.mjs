#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');

const rules = [
  ruleFilesExist(),
  ruleContainsMarkers(),
  runNativeReplacementFixture(),
  runNativeReplacementBlockedFixture(),
];

const failed = rules.filter((rule) => rule.status === 'failed');
const snapshot = {
  generatedAt: new Date().toISOString(),
  status: failed.length > 0 ? 'failed' : 'passed',
  summary: { rules: rules.length, passed: rules.length - failed.length, failed: failed.length },
  rules,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[zavorth-native-replacement-decommission] checking ZavorthControl controls');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-native-replacement-decommission] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 16)) console.log(`  - ${detail}`);
  }
}

if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthNativeReplacementDecommissionContract.ts',
    'src/services/ZavorthNativeReplacementDecommissionService.ts',
    'scripts/zavorth-native-replacement-decommission.ts',
    'scripts/zavorth-native-replacement-decommission-check.mjs',
    'tests/services/ZavorthNativeReplacementDecommissionService.test.ts',
    'docs/README.md',
    'docs/README.md',
    'package.json',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return {
    id: 'checkpoint-8-files',
    label: 'ZavorthControl controls native replacement files exist',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: `${files.length - missing.length}/${files.length} file(s) present`,
    target: 'contract, service, CLI, check, tests, docs and package scripts are present',
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleContainsMarkers() {
  const checks = [
    ['src/contracts/ZavorthNativeReplacementDecommissionContract.ts', [
      'ZAVORTH_NATIVE_REPLACEMENT_DECOMMISSION_CONTRACT_VERSION',
      'zavorth-native-replacement-decommission/8',
      'ZavorthNativeReplacementRegistryEntry',
      'ZavorthConsistencyTestHarnessReceipt',
      'ZavorthAdapterDependencyReductionReceipt',
      'ZavorthSourceAssumptionDecommissionReceipt',
      'optional-compatibility-boundary',
      'zavorthNativeWithoutSourceRuntime',
    ]],
    ['src/services/ZavorthNativeReplacementDecommissionService.ts', [
      'registerNativeReplacement',
      'buildConsistencyHarness',
      'reduceAdapterDependency',
      'decommissionSourceAssumption',
      'buildCompatibilityBoundary',
      'promoted-capabilities-run-without-source-runtime',
      'adapter-dependency-reduction-ready',
    ]],
    ['docs/README.md', [
      'native-replacement-decommission-ready',
      'Zavorth Native Replacement Decommission',
      '291 plan complete',
    ]],
    ['docs/README.md', [
      'native-replacement-decommission-complete',
      'Zavorth Native Replacement Decommission',
      'native replacement registry',
      'consistency tests',
      'adapter dependency reduction',
      'decommission gates',
      'optional compatibility boundaries',
      '291 plan complete',
    ]],
    ['package.json', [
      'zavorth:native-replacement-decommission',
      'zavorth:native-replacement-decommission:check',
    ]],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    if (text === null) {
      missing.push(`missing ${file}`);
      continue;
    }
    for (const needle of needles) {
      if (!text.includes(needle)) missing.push(`${file}: missing ${needle}`);
    }
  }
  return {
    id: 'checkpoint-8-markers',
    label: 'ZavorthControl controls native replacement markers are present',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: missing.length === 0 ? 'all markers present' : `${missing.length} missing marker(s)`,
    target: 'registry, consistency, adapter reduction, decommission and plan completion markers are present',
    details: missing,
  };
}

function runNativeReplacementFixture() {
  const result = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-native-replacement-decommission.ts',
    '--json',
    '--require-pass',
  ], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return {
      id: 'native-replacement-fixture',
      label: 'Native replacement fixture passes',
      status: 'failed',
      observed: `exit ${result.status}`,
      target: 'default native replacement snapshot is native-replacement-decommission-ready',
      details: [result.error?.message || result.stderr || result.stdout || 'no output'],
    };
  }
  const snapshot = parseJson(result.stdout);
  const ok = snapshot
    && snapshot.status === 'native-replacement-decommission-ready'
    && snapshot.contractVersion === 'zavorth-native-replacement-decommission/8'
    && snapshot.summary?.nativeReplacementRegistryEntries >= 4
    && snapshot.summary?.promotedNativeCapabilities >= 2
    && snapshot.summary?.consistencyHarnessesPassed >= 4
    && snapshot.summary?.adapterDependenciesReduced >= 2
    && snapshot.summary?.compatibilityBoundariesReady === 1
    && snapshot.summary?.sourceRuntimeRequiredForPromotedCapabilities === false
    && snapshot.summary?.hardAdapterDependenciesForPromotedCapabilities === 0
    && snapshot.safety?.zavorthNativeWithoutSourceRuntime === true
    && snapshot.safety?.adaptersOptionalCompatibilityOnly === true
    && snapshot.commands?.planStatus === '291 plan complete';
  return {
    id: 'native-replacement-fixture',
    label: 'Native replacement fixture passes',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.status}, ${snapshot.summary.promotedNativeCapabilities} promoted, plan=${snapshot.commands.planStatus}` : 'invalid native replacement snapshot',
    target: 'default snapshot is ready with native replacement registry, consistency, optional adapters and plan completion',
    details: ok ? [] : [result.stdout],
  };
}

function runNativeReplacementBlockedFixture() {
  const result = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-native-replacement-decommission.ts',
    '--json',
    '--delegated-worker-status',
    'blocked',
  ], {
    cwd: root,
    encoding: 'utf8',
  });
  const snapshot = parseJson(result.stdout);
  const ok = result.status === 0
    && snapshot
    && snapshot.status === 'blocked'
    && snapshot.previousDelegatedWorkerStatus === 'blocked';
  return {
    id: 'checkpoint-8-blocked-fixture',
    label: 'Native replacement blocks without Surface controls readiness',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.status}, delegatedWorker=${snapshot.previousDelegatedWorkerStatus}` : `exit ${result.status}`,
    target: 'ZavorthControl controls cannot close while Surface controls delegated workers are blocked',
    details: ok ? [] : [result.error?.message || result.stderr || result.stdout || 'no output'],
  };
}

function read(file) {
  try {
    return fs.readFileSync(path.join(root, file), 'utf8');
  } catch {
    return null;
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
