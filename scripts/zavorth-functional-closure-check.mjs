#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'zavorth-functional-closure-gate-9-files',
    label: 'Certification matrix files exist',
    target: 'contract, zavorthControl, ledger updater, release gate, closure service, command, SDK export and tests are present',
    files: [
      'src/contracts/ZavorthFunctionalClosureContract.ts',
      'src/services/ZavorthFunctionalClosureZavorthControlService.ts',
      'src/services/ZavorthLedgerDecisionUpdaterService.ts',
      'src/services/ZavorthFunctionalReleaseGateService.ts',
      'src/services/ZavorthFunctionalClosureService.ts',
      'src/sdk/functional-closure.ts',
      'scripts/zavorth-functional-closure.ts',
      'tests/services/ZavorthFunctionalClosureService.test.ts',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'zavorth-functional-closure-contract',
    label: 'Contract captures full functional closure model',
    target: 'contract includes zavorthControl, decision updater, release gate, priorities and machine-readable receipts',
    files: ['src/contracts/ZavorthFunctionalClosureContract.ts'],
    needles: [
      'ZAVORTH_FUNCTIONAL_CLOSURE_CONTRACT_VERSION',
      'ZavorthFunctionalClosureZavorthControlSnapshot',
      'ZavorthLedgerDecisionUpdaterSnapshot',
      'ZavorthFunctionalReleaseGateSnapshot',
      'machineReadable: true',
      'allP0ClosedWithProof',
      'allP2ClosedWithOptionalPathOrNonGoal',
      'Functional absorption closure complete',
    ],
  }),
  ruleContainsAcross({
    id: 'zavorth-functional-closure-services',
    label: 'Closure services aggregate evidence and gates',
    target: 'services build zavorthControl rows, preview ledger updates only with receipts and block release regressions',
    files: [
      'src/services/ZavorthFunctionalClosureZavorthControlService.ts',
      'src/services/ZavorthLedgerDecisionUpdaterService.ts',
      'src/services/ZavorthFunctionalReleaseGateService.ts',
      'src/services/ZavorthFunctionalClosureService.ts',
    ],
    needles: [
      'Zavorth Functional Closure ZavorthControl',
      'neverUpdateWithoutReceipt',
      'p0MustBeReceiptBacked',
      'releaseAllowed',
      'gate-0-ledger-governance',
      'gate-8-skill-ecosystem',
      'gate-9-baseline-worker-chain',
    ],
  }),
  ruleContainsAll({
    id: 'zavorth-functional-closure-command',
    label: 'Command exposes closure and release gate',
    target: 'command supports text, JSON, release-gate and require-pass modes',
    files: ['scripts/zavorth-functional-closure.ts'],
    needles: [
      'ZavorthFunctionalClosureService',
      '--json',
      '--require-pass',
      '--release-gate',
      'formatSnapshotText',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-zavorth-functional-closure',
    label: 'package exposes Certification matrix gates',
    target: 'operators can inspect, inspect JSON, run check and QA from package scripts',
    files: ['package.json'],
    needles: [
      './sdk/functional-closure',
      'zavorth-functional-closure',
      'zavorth-functional-closure:json',
      'zavorth-functional-closure:check',
      'qa:zavorth-functional-closure',
    ],
  }),
  ruleContainsNoForbiddenNames(),
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
  console.log('[zavorth-functional-closure] checking Certification matrix');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-functional-closure] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
    'scripts/zavorth-functional-closure.ts',
    '--json',
    '--require-pass',
  ], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });

  if (result.status !== 0) {
    return {
      id: 'zavorth-functional-closure-runtime-receipt',
      label: 'Runtime Certification matrix receipt passes',
      status: 'failed',
      observed: `exit ${result.status ?? 'unknown'}`,
      target: 'Certification matrix command emits a passing full functional closure snapshot',
      details: compactDetails(result.error instanceof Error ? result.error.message : '', result.stderr, result.stdout),
    };
  }

  try {
    const receipt = JSON.parse(result.stdout);
    const pass = receipt.status === 'passed'
      && receipt.summary?.items >= 10
      && receipt.summary?.p0Items >= 5
      && receipt.summary?.p1Items >= 3
      && receipt.summary?.p2Items >= 1
      && receipt.summary?.failed === 0
      && receipt.summary?.releaseAllowed === true
      && receipt.summary?.machineReadableReceipt === true
      && receipt.summary?.liveExternalIoPerformed === false
      && receipt.summary?.secretValuesSerialized === false
      && receipt.releaseGate?.status === 'passed';
    return {
      id: 'zavorth-functional-closure-runtime-receipt',
      label: 'Runtime Certification matrix receipt passes',
      status: pass ? 'passed' : 'failed',
      observed: `status=${receipt.status}, items=${receipt.summary?.items}, releaseAllowed=${receipt.summary?.releaseAllowed}`,
      target: 'Certification matrix command emits a passing full functional closure snapshot',
      details: [
        `p0Items=${receipt.summary?.p0Items}`,
        `p1Items=${receipt.summary?.p1Items}`,
        `p2Items=${receipt.summary?.p2Items}`,
        `receipts=${receipt.summary?.receipts}`,
        `receiptBackedItems=${receipt.summary?.receiptBackedItems}`,
        `releaseGate=${receipt.releaseGate?.status}`,
        `blockers=${receipt.releaseGate?.blockers?.length}`,
        `next=${receipt.commands?.nextStep}`,
      ],
    };
  } catch (error) {
    return {
      id: 'zavorth-functional-closure-runtime-receipt',
      label: 'Runtime Certification matrix receipt passes',
      status: 'failed',
      observed: 'invalid JSON receipt',
      target: 'Certification matrix command emits a passing full functional closure snapshot',
      details: [error instanceof Error ? error.message : String(error), ...compactDetails(result.stderr, result.stdout)],
    };
  }
}

function ruleContainsNoForbiddenNames() {
