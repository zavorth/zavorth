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
  runNativeEngineFixture(),
  runNativeEngineBlockedFixture(),
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
  console.log('[zavorth-native-engine-absorption] checking Preview engine');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-native-engine-absorption] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 16)) console.log(`  - ${detail}`);
  }
}

if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthNativeEngineAbsorptionContract.ts',
    'src/services/ZavorthNativeEngineAbsorptionService.ts',
    'scripts/zavorth-native-engine-absorption.ts',
    'scripts/zavorth-native-engine-absorption-check.mjs',
    'tests/services/ZavorthNativeEngineAbsorptionService.test.ts',
    'docs/README.md',
    'docs/README.md',
    'package.json',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return {
    id: 'checkpoint-2-files',
    label: 'Preview engine native engine files exist',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: `${files.length - missing.length}/${files.length} file(s) present`,
    target: 'contract, service, CLI, check, tests, docs and package scripts are present',
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleContainsMarkers() {
  const checks = [
    ['src/contracts/ZavorthNativeEngineAbsorptionContract.ts', [
      'ZAVORTH_NATIVE_ENGINE_ABSORPTION_CONTRACT_VERSION',
      'zavorth-native-engine-absorption/2',
      'error-recovery-classifier',
      'tool-call-argument-repair',
      'safe-tool-parallelism',
      'procedural-memory-signal',
      'skill-library-curation',
      'noSkillMutationPerformed',
    ]],
    ['src/services/ZavorthNativeEngineAbsorptionService.ts', [
      'classifyError',
      'repairToolArguments',
      'planToolParallelism',
      'buildProceduralMemorySignal',
      'previewSkillCuration',
      'sourceRuntimeDependency: false',
    ]],
    ['docs/README.md', [
      'native-engine-ready',
      '291 Approval gate - Sidecar Adapter',
      'Zavorth Native Engine Absorption',
    ]],
    ['docs/README.md', [
      'native-engine-absorption-complete',
      'Zavorth Native Engine Absorption',
      'no source runtime dependency',
      '291 Approval gate - Sidecar Adapter',
    ]],
    ['package.json', [
      'zavorth:native-engine-absorption',
      'zavorth:native-engine-absorption:check',
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
    id: 'checkpoint-2-markers',
    label: 'Preview engine native engine markers are present',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: missing.length === 0 ? 'all markers present' : `${missing.length} missing marker(s)`,
    target: 'native engine features, no source dependency, docs and scripts markers are present',
    details: missing,
  };
}

function runNativeEngineFixture() {
  const result = spawnSync(process.execPath, [tsxCli, 'scripts/zavorth-native-engine-absorption.ts', '--json', '--require-pass'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return {
      id: 'native-engine-fixture',
      label: 'Native engine fixture passes',
      status: 'failed',
      observed: `exit ${result.status}`,
      target: 'default native engine snapshot is native-engine-ready',
      details: [result.error?.message || result.stderr || result.stdout || 'no output'],
    };
  }
  const snapshot = parseJson(result.stdout);
  const ok = snapshot
    && snapshot.status === 'native-engine-ready'
    && snapshot.contractVersion === 'zavorth-native-engine-absorption/2'
    && snapshot.summary?.features === 5
    && snapshot.summary?.receipts === 5
    && snapshot.summary?.sourceRuntimeDependency === false
    && snapshot.safety?.toolExecutionPerformed === false
    && snapshot.safety?.skillMutationsPerformed === false
    && snapshot.fixtureReceipts?.skillCuration?.safety?.dryRunOnly === true;
  return {
    id: 'native-engine-fixture',
    label: 'Native engine fixture passes',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.summary.features} feature(s), ${snapshot.status}` : 'invalid native engine snapshot',
    target: 'default native engine snapshot is ready with receipts and no execution',
    details: ok ? [] : [result.stdout],
  };
}

function runNativeEngineBlockedFixture() {
  const result = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-native-engine-absorption.ts',
    '--json',
    '--contract-layer-status',
    'blocked',
  ], {
    cwd: root,
    encoding: 'utf8',
  });
  const snapshot = parseJson(result.stdout);
  const ok = result.status === 0
    && snapshot
    && snapshot.status === 'blocked'
    && snapshot.previousContractLayerStatus === 'blocked';
  return {
    id: 'checkpoint-2-blocked-fixture',
    label: 'Native engine blocks without Intent model readiness',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.status}, contractLayer=${snapshot.previousContractLayerStatus}` : `exit ${result.status}`,
    target: 'Preview engine cannot advance while Intent model contract layer is blocked',
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
