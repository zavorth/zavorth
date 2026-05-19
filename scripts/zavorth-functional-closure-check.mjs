#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'zavorth-functional-closure-checkpoint-9-files',
    label: 'Certification matrix files exist',
    target: 'contract, dashboard, ledger updater, release gate, closure service, command, SDK export and tests are present',
    files: [
      'src/contracts/ZavorthFunctionalClosureContract.ts',
      'src/services/ZavorthFunctionalClosureDashboardService.ts',
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
    target: 'contract includes dashboard, decision updater, release gate, priorities and machine-readable receipts',
    files: ['src/contracts/ZavorthFunctionalClosureContract.ts'],
    needles: [
      'ZAVORTH_FUNCTIONAL_CLOSURE_CONTRACT_VERSION',
      'ZavorthFunctionalClosureDashboardSnapshot',
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
    target: 'services build dashboard rows, preview ledger updates only with receipts and block release regressions',
    files: [
      'src/services/ZavorthFunctionalClosureDashboardService.ts',
      'src/services/ZavorthLedgerDecisionUpdaterService.ts',
      'src/services/ZavorthFunctionalReleaseGateService.ts',
      'src/services/ZavorthFunctionalClosureService.ts',
    ],
    needles: [
      'Zavorth Functional Closure Dashboard',
      'neverUpdateWithoutReceipt',
      'p0MustBeReceiptBacked',
      'releaseAllowed',
      'checkpoint-0-ledger-governance',
      'checkpoint-8-skill-ecosystem',
      'checkpoint-9-baseline-worker-chain',
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
  const forbiddenWord = String.fromCharCode(111, 112, 101, 110, 99, 108, 97, 119);
  const searchRoots = ['src', 'scripts', 'tests', 'package.json'];
  const details = [];
  for (const relative of searchRoots) {
    const absolute = path.join(root, relative);
    for (const file of listFiles(absolute)) {
      const text = fs.readFileSync(file, 'utf8');
      if (containsForbiddenBranding(path.basename(file), forbiddenWord) || containsForbiddenBranding(text, forbiddenWord)) {
        details.push(path.relative(root, file).replace(/\\/g, '/'));
      }
    }
  }
  return {
    id: 'zavorth-functional-closure-no-forbidden-source-name',
    label: 'No forbidden source branding outside reports',
    status: details.length > 0 ? 'failed' : 'passed',
    observed: details.length > 0 ? `${details.length} file(s) with forbidden source branding` : 'no forbidden source branding in code/scripts/tests/package',
    target: 'new Certification matrix code and public surfaces use Zavorth-owned names only',
    details,
  };
}

function containsForbiddenBranding(value, forbiddenWord) {
  return String(value || '').toLowerCase().includes(forbiddenWord);
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

function ruleContainsAcross(input) {
  const contentsByFile = input.files.map((file) => ({
    file,
    contents: read(file),
  }));
  const missingFiles = contentsByFile
    .filter((entry) => entry.contents === null)
    .map((entry) => `missing ${entry.file}`);
  const missingNeedles = input.needles
    .filter((needle) => !contentsByFile.some((entry) => entry.contents?.includes(needle)))
    .map((needle) => `missing ${needle}`);
  const missing = [...missingFiles, ...missingNeedles];
  return {
    id: input.id,
    label: input.label,
    status: missing.length > 0 ? 'failed' : 'passed',
    observed: missing.length > 0 ? `${missing.length} missing marker(s)` : 'all markers present across files',
    target: input.target,
    details: missing,
  };
}

function listFiles(absolute) {
  if (!fs.existsSync(absolute)) return [];
  if (fs.statSync(absolute).isFile()) return [absolute];
  const files = [];
  const stack = [absolute];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'docs') continue;
      const child = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(child);
      } else if (/\.(ts|tsx|js|jsx|mjs|cjs|json)$/.test(entry.name) || entry.name === 'package.json') {
        files.push(child);
      }
    }
  }
  return files;
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
