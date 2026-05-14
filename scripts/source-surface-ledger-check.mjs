#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const fileRules = [
  ruleFilesExist({
    id: 'source-surface-ledger-phase-0-files',
    label: 'Phase 0 files exist',
    target: 'contract, scanner, diff, planner, ledger service, command, tests and package scripts are present',
    files: [
      'src/contracts/SourceSurfaceLedgerContract.ts',
      'src/services/SourceSurfaceLedgerService.ts',
      'src/services/SourceSurfaceScannerService.ts',
      'src/services/SourceSurfaceDiffService.ts',
      'src/services/SourceAbsorptionPlannerService.ts',
      'scripts/source-surface-ledger.ts',
      'tests/services/SourceSurfaceLedgerService.test.ts',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'source-surface-ledger-contract-markers',
    label: 'Contract defines executable surface governance vocabulary',
    target: 'contract includes categories, decisions, diff, planner and receipt types',
    files: ['src/contracts/SourceSurfaceLedgerContract.ts'],
    needles: [
      'ZAVORTH_SOURCE_SURFACE_LEDGER_CONTRACT_VERSION',
      'SourceSurfaceLedgerEntry',
      'SourceDiscoveredSurface',
      'SourceSurfaceDiffSnapshot',
      'SourceAbsorptionPlannerSnapshot',
      'SourceSurfaceLedgerReceipt',
    ],
  }),
  ruleContainsAll({
    id: 'source-surface-ledger-runtime-markers',
    label: 'Ledger service emits executable receipts',
    target: 'service layer loads the ledger, scans Source, detects drift and produces Phase 0 receipts',
    files: ['src/services/SourceSurfaceLedgerService.ts'],
    needles: ['buildReceipt', 'validateLedger', 'formatReceiptText', 'SourceSurfaceScannerService'],
  }),
  ruleContainsAll({
    id: 'source-surface-scanner-markers',
    label: 'Scanner discovers Source surface families',
    target: 'scanner covers apps, packages, src, scripts, workflows, skills and runtime dependencies',
    files: ['src/services/SourceSurfaceScannerService.ts'],
    needles: ['scan(sourceRoot', 'scanDirectoryChildren', 'scanScriptGroups', 'scanRuntimeDependencies'],
  }),
  ruleContainsAll({
    id: 'source-surface-diff-markers',
    label: 'Diff blocks unclassified surfaces',
    target: 'diff reports unclassified, missing and evidence-changed surfaces',
    files: ['src/services/SourceSurfaceDiffService.ts'],
    needles: ['unclassified', 'missingFromCheckout', 'evidenceChanged', 'Discovered Source surface has no ledger decision'],
  }),
  ruleContainsAll({
    id: 'source-absorption-planner-markers',
    label: 'Planner maps ledger entries to phases',
    target: 'planner groups items by phase, target and owner decision',
    files: ['src/services/SourceAbsorptionPlannerService.ts'],
    needles: ['buildPlan', 'phaseForTarget', 'ownerDecisionRequired', 'native-capability'],
  }),
  ruleContainsAll({
    id: 'source-surface-ledger-package-scripts',
    label: 'package exposes Phase 0 gates',
    target: 'operators can inspect, inspect JSON, run check and QA gate',
    files: ['package.json'],
    needles: [
      'source-surface-ledger',
      'source-surface-ledger:json',
      'source-surface-ledger:check',
      'qa:source-surface-ledger',
    ],
  }),
];

const runtimeRule = runRuntimeRule();
const rules = [...fileRules, runtimeRule];
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
  console.log('[source-surface-ledger] checking Phase 0');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[source-surface-ledger] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 12)) {
      console.log(`  - ${detail}`);
    }
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function runRuntimeRule() {
  const result = spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/source-surface-ledger.ts',
    '--json',
    '--require-pass',
  ], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });

  if (result.status !== 0) {
    return {
      id: 'source-surface-ledger-runtime-receipt',
      label: 'Runtime receipt passes',
      status: 'failed',
      observed: `exit ${result.status ?? 'unknown'}`,
      target: 'Phase 0 command emits a passing receipt against the current Source checkout',
      details: compactDetails(result.error instanceof Error ? result.error.message : '', result.stderr, result.stdout),
    };
  }

  try {
    const receipt = JSON.parse(result.stdout);
    return {
      id: 'source-surface-ledger-runtime-receipt',
      label: 'Runtime receipt passes',
      status: receipt.status === 'passed' ? 'passed' : 'failed',
      observed: `status=${receipt.status}, entries=${receipt.summary?.total}, discovered=${receipt.summary?.discoveredSurfaces}, unclassified=${receipt.summary?.unclassifiedSurfaces}`,
      target: 'Phase 0 command emits a passing receipt against the current Source checkout',
      details: [
        `classified=${receipt.summary?.classifiedSurfaces}`,
        `missing=${receipt.summary?.missingLedgerSurfaces}`,
        `evidenceChanged=${receipt.summary?.evidenceChangedSurfaces}`,
        `ownerDecisionRequired=${receipt.summary?.ownerDecisionRequired}`,
      ],
    };
  } catch (error) {
    return {
      id: 'source-surface-ledger-runtime-receipt',
      label: 'Runtime receipt passes',
      status: 'failed',
      observed: 'invalid JSON receipt',
      target: 'Phase 0 command emits a passing receipt against the current Source checkout',
      details: [error instanceof Error ? error.message : String(error), ...compactDetails(result.stderr, result.stdout)],
    };
  }
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
    .flatMap((value) => String(value || '').split(/\r?\n/g))
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);
}
