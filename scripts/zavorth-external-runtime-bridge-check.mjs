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
  runBridgeFixture(),
  runBridgeBlockedFixture(),
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
  console.log('[zavorth-external-runtime-bridge] checking Intent model0');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-external-runtime-bridge] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 16)) console.log(`  - ${detail}`);
  }
}

if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthExternalRuntimeBridgeContract.ts',
    'src/services/ZavorthExternalRuntimeBridgeService.ts',
    'scripts/zavorth-external-runtime-bridge.ts',
    'scripts/zavorth-external-runtime-bridge-check.mjs',
    'tests/services/ZavorthExternalRuntimeBridgeService.test.ts',
    'docs/README.md',
    'docs/README.md',
    'package.json',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return {
    id: 'checkpoint-10-files',
    label: 'Intent model0 bridge files exist',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: `${files.length - missing.length}/${files.length} file(s) present`,
    target: 'contract, service, CLI, check, tests, docs and package scripts are present',
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleContainsMarkers() {
  const checks = [
    ['src/contracts/ZavorthExternalRuntimeBridgeContract.ts', [
      'ZAVORTH_EXTERNAL_RUNTIME_BRIDGE_CONTRACT_VERSION',
      'natural-first-universal-external-runtime-bridge/11',
      'ZavorthAgentGateway',
      'Zavorth ReplyPipeline',
      'acpSupportIsProviderAgnostic',
      'noDefaultNamedCompatibilityBridge',
      'noImplementationPerformedByBridge',
    ]],
    ['src/services/ZavorthExternalRuntimeBridgeService.ts', [
      'external-capability-inventory',
      'error-classifier',
      'tool-call-repair',
      'safe-tool-parallelism',
      'skill-curator',
      'delegated-workers',
      'checkpoint-9-complete',
    ]],
    ['package.json', [
      'zavorth:external-runtime-bridge',
      'zavorth:external-runtime-bridge:check',
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
    id: 'checkpoint-10-markers',
    label: 'Intent model0 bridge markers are present',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: missing.length === 0 ? 'all markers present' : `${missing.length} missing marker(s)`,
    target: 'bridge contract, Natural First, docs and scripts markers are present',
    details: missing,
  };
}

function runBridgeFixture() {
  const result = spawnSync(process.execPath, [tsxCli, 'scripts/zavorth-external-runtime-bridge.ts', '--json', '--require-pass'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return {
      id: 'checkpoint-10-bridge-fixture',
      label: 'Bridge fixture passes',
      status: 'failed',
      observed: `exit ${result.status}`,
      target: 'default bridge snapshot is bridge-ready',
      details: [result.error?.message || result.stderr || result.stdout || 'no output'],
    };
  }
  const snapshot = parseJson(result.stdout);
  const ok = snapshot
    && snapshot.status === 'bridge-ready'
    && snapshot.contractVersion === 'natural-first-universal-external-runtime-bridge/11'
    && snapshot.gatewayPolicy?.naturalFirstClosed === true
    && snapshot.policy?.acpSupportIsProviderAgnostic === true
    && snapshot.policy?.noDefaultNamedCompatibilityBridge === true
    && snapshot.summary?.executionPerformed === false
    && snapshot.summary?.sourceRuntimeCodeExecuted === false
    && Array.isArray(snapshot.candidates)
    && snapshot.candidates.length >= 9;
  return {
    id: 'checkpoint-10-bridge-fixture',
    label: 'Bridge fixture passes',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.candidates.length} candidate(s), ${snapshot.status}` : 'invalid bridge snapshot',
    target: 'default bridge snapshot is bridge-ready with no execution',
    details: ok ? [] : [result.stdout],
  };
}

function runBridgeBlockedFixture() {
  const result = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-external-runtime-bridge.ts',
    '--json',
    '--natural-first-status',
    'checkpoint-8-complete',
  ], {
    cwd: root,
    encoding: 'utf8',
  });
  const snapshot = parseJson(result.stdout);
  const ok = result.status === 0
    && snapshot
    && snapshot.status === 'blocked'
    && snapshot.gatewayPolicy?.naturalFirstClosed === false;
  return {
    id: 'checkpoint-10-blocked-fixture',
    label: 'Bridge blocks before Natural First closure',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.status}, naturalFirstClosed=${snapshot.gatewayPolicy.naturalFirstClosed}` : `exit ${result.status}`,
    target: 'bridge is blocked if Natural First is not checkpoint-9 or checkpoint-10 complete',
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
