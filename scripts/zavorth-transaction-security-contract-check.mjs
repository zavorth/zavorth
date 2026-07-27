#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const rules = [
  ruleFilesExist(),
  ruleMarkers(),
  ruleCliSnapshot(),
  ruleBlockedLlmFixture(),
  ruleGovernedPaymentFixture(),
  ruleTests(),
];
const failed = rules.filter((rule) => rule.status === 'failed');
const snapshot = {
  generatedAt: new Date().toISOString(),
  status: failed.length > 0 ? 'failed' : 'passed',
  rules,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[transaction-plane-securityContract] checking Zavorth Transaction Plane Security contract');
  for (const item of rules) {
    console.log(`[transaction-plane-securityContract] ${item.status === 'passed' ? 'ok' : 'fail'} ${item.label}: ${item.observed} | ${item.target}`);
    for (const detail of item.details.slice(0, 12)) {
      console.log(`  - ${detail}`);
    }
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthTransactionPlaneContract.ts',
    'src/services/ZavorthTransactionPlanePolicyService.ts',
    'scripts/zavorth-transaction-plane.ts',
    'tests/contracts/ZavorthTransactionPlaneContract.test.ts',
    'tests/services/ZavorthTransactionPlanePolicyService.test.ts',
    'docs/README.md',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('securityContract-files', 'Security contract files exist', missing.length === 0, `${files.length ? missing.length}/${files.length}`, 'contract, service, CLI, docs and tests present', missing);
}

function ruleMarkers() {
  const checks = [
    ['src/contracts/ZavorthTransactionPlaneContract.ts', [
      'LLM may classify, explain and propose transaction parameters',
      'ZAVORTH_TRANSACTION_IRREVERSIBLE_ACTIONS',
      'ZAVORTH_TRANSACTION_CRITICAL_VALUE_MOVEMENT_ACTIONS',
      'explicit_human_approval_required',
      'raw_secret_exposure_blocked',
    ]],
    ['src/services/ZavorthTransactionPlanePolicyService.ts', [
      'liveExecutionAuthorizedByDefault: false',
      'llmDirectExecutionAllowed: false',
      'realMoneyRequiresExplicitApproval: true',
      'criticalValueMovementBlockedByDefault: true',
    ]],
    ['src/sdk/contracts.ts', ['ZavorthTransactionPlaneContract']],
    ['src/sdk/index.ts', ['ZavorthTransactionPlanePolicyService']],
    ['package.json', [
      'zavorth:transaction-plane',
      'zavorth:transaction-plane:json',
      'zavorth:transaction-plane:check',
    ]],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    for (const needle of needles) {
      if (!text.includes(needle)) {
        missing.push(`${file}: missing ${needle}`);
      }
    }
  }
  return rule('securityContract-markers', 'Security contract semantic markers exist', missing.length === 0, missing.length === 0 ? 'all markers' : `${missing.length} missing`, 'security contract exported and scripted', missing);
}

function ruleCliSnapshot() {
  const result = runTs('scripts/zavorth-transaction-plane.ts', ['--json']);
  return jsonRule('securityContract-cli-snapshot', 'CLI emits contract snapshot', result, (snapshot) =>
    snapshot.status === 'ready'
    && snapshot.securityContract?.llmDirectExecutionAllowed === false
    && snapshot.securityContract?.realMoneyRequiresExplicitApproval === true
    && Array.isArray(snapshot.contract?.irreversibleActions)
    && snapshot.contract.irreversibleActions.includes('payment-submit'));
}

function ruleBlockedLlmFixture() {
  const result = runTs('scripts/zavorth-transaction-plane.ts', [
    '--evaluate',
    '--json',
    '--actor=llm',
    '--action=purchase-submit',
    '--mode=live',
    '--typed-connector',
    '--trusted-connector',
    '--preview',
    '--approval=approved',
    '--ledger',
  ]);
  return jsonRule('securityContract-llm-blocked', 'LLM direct execution is blocked', result, (snapshot) =>
    snapshot.allowed === false
    && snapshot.blockers.includes('llm_direct_transaction_execution_blocked'));
}

function ruleGovernedPaymentFixture() {
  const result = runTs('scripts/zavorth-transaction-plane.ts', [
    '--evaluate',
    '--json',
    '--actor=zavorth-runtime',
    '--action=payment-submit',
    '--mode=live',
    '--typed-connector',
    '--trusted-connector',
    '--preview',
    '--approval=approved',
    '--ledger',
  ]);
  return jsonRule('securityContract-governed-payment', 'Governed runtime payment can pass policy', result, (snapshot) =>
    snapshot.allowed === true
    && snapshot.status === 'allowed'
    && snapshot.riskLevel === 'high');
}

function ruleTests() {
  const result = spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'jest', 'bin', 'jest.js'),
    'tests/contracts/ZavorthTransactionPlaneContract.test.ts',
    'tests/services/ZavorthTransactionPlanePolicyService.test.ts',
    '--runInBand',
  ], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });
  return rule('securityContract-tests', 'Security contract Jest tests pass', result.status === 0, `exit ${result.status ?? 'unknown'}`, 'jest green', compact(result.stderr, result.stdout));
}

function jsonRule(id, label, result, expect) {
  try {
    const snapshot = JSON.parse(result.stdout || '{}');
    const pass = expect(snapshot);
    return rule(id, label, pass, `exit=${result.status ?? 'unknown'} status=${snapshot.status ?? snapshot.allowed}`, 'expected JSON decision', pass ? [] : [JSON.stringify(snapshot, null, 2), ...compact(result.stderr)]);
  } catch (error) {
    return rule(id, label, false, 'invalid JSON', 'valid JSON fixture', [String(error), ...compact(result.stderr, result.stdout)]);
  }
}

function runTs(script, args) {
  return spawnSync(process.execPath, [path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), script, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function rule(id, label, passed, observed, target, details = []) {
  return { id, label, status: passed ? 'passed' : 'failed', observed, target, details };
}

function compact(...parts) {
  return parts
    .join('\n')
    .split(/\r...\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);
}
