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
  runContractLayerFixture(),
  runContractLayerBlockedFixture(),
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
  console.log('[zavorth-external-contract-layer] checking Intent model');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-external-contract-layer] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 16)) console.log(`  - ${detail}`);
  }
}

if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthExternalContractLayerContract.ts',
    'src/services/ZavorthExternalContractLayerService.ts',
    'scripts/zavorth-external-contract-layer.ts',
    'scripts/zavorth-external-contract-layer-check.mjs',
    'tests/services/ZavorthExternalContractLayerService.test.ts',
    'docs/README.md',
    'docs/README.md',
    'package.json',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return {
    id: 'checkpoint-1-files',
    label: 'Intent model contract layer files exist',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: `${files.length - missing.length}/${files.length} file(s) present`,
    target: 'contract, service, CLI, check, tests, docs and package scripts are present',
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleContainsMarkers() {
  const checks = [
    ['src/contracts/ZavorthExternalContractLayerContract.ts', [
      'ZAVORTH_EXTERNAL_CONTRACT_LAYER_VERSION',
      'zavorth-external-contract-layer/1',
      'runtime',
      'capability',
      'worker',
      'source_identity_leak',
      'raw_secret_value',
      'ZavorthAgentGateway',
    ]],
    ['src/services/ZavorthExternalContractLayerService.ts', [
      'ZavorthExternalRuntimeDescriptorContract',
      'ZavorthExternalCapabilityEnvelopeContract',
      'ZavorthExternalToolEnvelopeContract',
      'ZavorthExternalWorkerEnvelopeContract',
      'acp-compatibility-fixture',
      'noSourceRuntimeCodeExecution',
      'noDirectToolExposure',
    ]],
    ['package.json', [
      'zavorth:external-contract-layer',
      'zavorth:external-contract-layer:check',
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
    id: 'checkpoint-1-markers',
    label: 'Intent model contract layer markers are present',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: missing.length === 0 ? 'all markers present' : `${missing.length} missing marker(s)`,
    target: 'contract layer, quarantine, structured errors, docs and scripts markers are present',
    details: missing,
  };
}

function runContractLayerFixture() {
  const result = spawnSync(process.execPath, [tsxCli, 'scripts/zavorth-external-contract-layer.ts', '--json', '--require-pass'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return {
      id: 'contract-layer-fixture',
      label: 'Contract layer fixture passes',
      status: 'failed',
      observed: `exit ${result.status}`,
      target: 'default contract layer snapshot is contract-layer-ready',
      details: [result.error?.message || result.stderr || result.stdout || 'no output'],
    };
  }
  const snapshot = parseJson(result.stdout);
  const ok = snapshot
    && snapshot.status === 'contract-layer-ready'
    && snapshot.contractVersion === 'zavorth-external-contract-layer/1'
    && snapshot.summary?.envelopeSchemas === 11
    && snapshot.summary?.runtimeDescriptors === 3
    && snapshot.summary?.blockedFixtures >= 3
    && snapshot.summary?.structuredErrors >= 4
    && snapshot.safety?.sourceRuntimeCodeExecuted === false
    && snapshot.safety?.liveExecutionPerformed === false;
  return {
    id: 'contract-layer-fixture',
    label: 'Contract layer fixture passes',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.summary.envelopeSchemas} schema(s), ${snapshot.status}` : 'invalid contract layer snapshot',
    target: 'default contract layer snapshot is ready with structured blocked fixtures and no execution',
    details: ok ? [] : [result.stdout],
  };
}

function runContractLayerBlockedFixture() {
  const result = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-external-contract-layer.ts',
    '--json',
    '--inventory-status',
    'blocked',
  ], {
    cwd: root,
    encoding: 'utf8',
  });
  const snapshot = parseJson(result.stdout);
  const ok = result.status === 0
    && snapshot
    && snapshot.status === 'blocked'
    && snapshot.previousInventoryStatus === 'blocked';
  return {
    id: 'checkpoint-1-blocked-fixture',
    label: 'Contract layer blocks without Security contract readiness',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.status}, inventory=${snapshot.previousInventoryStatus}` : `exit ${result.status}`,
    target: 'Intent model cannot advance while Security contract inventory is blocked',
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
