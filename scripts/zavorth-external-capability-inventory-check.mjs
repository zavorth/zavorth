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
  runInventoryFixture(),
  runInventoryBlockedFixture(),
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
  console.log('[zavorth-external-capability-inventory] checking Phase 0');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-external-capability-inventory] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 16)) console.log(`  - ${detail}`);
  }
}

if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthExternalCapabilityInventoryContract.ts',
    'src/services/ZavorthExternalCapabilityInventoryService.ts',
    'scripts/zavorth-external-capability-inventory.ts',
    'scripts/zavorth-external-capability-inventory-check.mjs',
    'tests/services/ZavorthExternalCapabilityInventoryService.test.ts',
    'docs/README.md',
    'docs/README.md',
    'package.json',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return {
    id: 'phase-0-files',
    label: 'Phase 0 inventory files exist',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: `${files.length - missing.length}/${files.length} file(s) present`,
    target: 'contract, service, CLI, check, tests, docs and package scripts are present',
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleContainsMarkers() {
  const checks = [
    ['src/contracts/ZavorthExternalCapabilityInventoryContract.ts', [
      'ZAVORTH_EXTERNAL_CAPABILITY_INVENTORY_CONTRACT_VERSION',
      'zavorth-external-capability-inventory/0',
      'acp-compatibility-fixture',
      'readOnlyProbe',
      'noImplementationBeyondReadOnlyInventory',
    ]],
    ['src/services/ZavorthExternalCapabilityInventoryService.ts', [
      'reference-runtime:error-classifier',
      'reference-runtime:skill-curator',
      'acp-compatible-sidecar:channel-gateway-normalization',
      'acp-compatible-sidecar:plugin-sdk-runtime',
      'acp-compatible-sidecar:qa-release-security',
      'acp-compatible-sidecar-src',
    ]],
    ['package.json', [
      'zavorth:external-capability-inventory',
      'zavorth:external-capability-inventory:check',
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
    id: 'phase-0-markers',
    label: 'Phase 0 inventory markers are present',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: missing.length === 0 ? 'all markers present' : `${missing.length} missing marker(s)`,
    target: 'inventory contract, WSL probe, docs and scripts markers are present',
    details: missing,
  };
}

function runInventoryFixture() {
  const result = spawnSync(process.execPath, [tsxCli, 'scripts/zavorth-external-capability-inventory.ts', '--json', '--require-pass'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return {
      id: 'phase-0-inventory-fixture',
      label: 'Inventory fixture passes',
      status: 'failed',
      observed: `exit ${result.status}`,
      target: 'default inventory snapshot is inventory-ready',
      details: [result.error?.message || result.stderr || result.stdout || 'no output'],
    };
  }
  const snapshot = parseJson(result.stdout);
  const probes = Array.isArray(snapshot?.sourceProbes) ? snapshot.sourceProbes : [];
  const ok = snapshot
    && snapshot.status === 'inventory-ready'
    && snapshot.contractVersion === 'zavorth-external-capability-inventory/0'
    && snapshot.safety?.executionPerformed === false
    && snapshot.freezePolicy?.noImplementationBeyondReadOnlyInventory === true
    && snapshot.decisionSummary?.total >= 14
    && probes.some((probe) => probe.runtimeId === 'acp-compatibility-fixture' && probe.required === false);
  return {
    id: 'phase-0-inventory-fixture',
    label: 'Inventory fixture passes',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.decisionSummary.total} item(s), ${snapshot.status}` : 'invalid inventory snapshot',
    target: 'default inventory snapshot is inventory-ready with optional compatibility probe and no execution',
    details: ok ? [] : [result.stdout],
  };
}

function runInventoryBlockedFixture() {
  const result = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-external-capability-inventory.ts',
    '--json',
    '--bridge-status',
    'blocked',
  ], {
    cwd: root,
    encoding: 'utf8',
  });
  const snapshot = parseJson(result.stdout);
  const ok = result.status === 0
    && snapshot
    && snapshot.status === 'blocked'
    && snapshot.bridgeStatus === 'blocked'
    && snapshot.freezePolicy?.nextPhaseRequiresContractLayer === true;
  return {
    id: 'phase-0-blocked-fixture',
    label: 'Inventory blocks when bridge is blocked',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.status}, bridge=${snapshot.bridgeStatus}` : `exit ${result.status}`,
    target: 'Phase 0 cannot advance while Phase 10 bridge is blocked',
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
