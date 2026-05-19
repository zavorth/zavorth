#!/usr/bin/env node

import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const nodeBin = process.execPath;
const tsxCli = 'node_modules/tsx/dist/cli.mjs';
const jestCli = 'node_modules/jest/bin/jest.js';
const asJson = process.argv.includes('--json');
const rules = [
  filesExist(),
  markersPresent(),
  commandPasses('supremacy snapshot', [nodeBin, tsxCli, 'scripts/zavorth-supremacy-parity.ts', '--json'], validateSupremacy),
  commandPasses('provider parity', [nodeBin, tsxCli, 'scripts/zavorth-provider-parity.ts', '--json', '--require-pass'], validateProviderParity),
  commandPasses('gateway matrix', [nodeBin, tsxCli, 'scripts/zavorth-gateway-matrix.ts', '--json'], validateGatewayMatrix),
  commandPasses('execution backend matrix', [nodeBin, tsxCli, 'scripts/zavorth-execution-backends.ts', '--json'], validateExecutionBackends),
  jestPasses(),
];
const failed = rules.filter((rule) => rule.status === 'failed');
const snapshot = {
  generatedAt: new Date().toISOString(),
  surface: 'supremacy-parity-check',
  status: failed.length === 0 ? 'passed' : 'failed',
  summary: { rules: rules.length, passed: rules.length - failed.length, failed: failed.length },
  rules,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[zavorth-supremacy-parity] checking final parity pack');
  for (const rule of rules) {
    console.log(`[zavorth-supremacy-parity] ${rule.status === 'passed' ? 'ok' : 'fail'} ${rule.label}: ${rule.observed}`);
    for (const detail of rule.details.slice(0, 10)) console.log(`  - ${detail}`);
  }
}

if (failed.length > 0) process.exitCode = 1;

function filesExist() {
  const files = [
    'src/contracts/ZavorthSupremacyParityPackContract.ts',
    'src/services/ZavorthSupremacyParityPackService.ts',
    'scripts/zavorth-supremacy-parity.ts',
    'scripts/zavorth-supremacy-parity-check.mjs',
    'scripts/zavorth-provider-parity.ts',
    'scripts/zavorth-gateway-matrix.ts',
    'scripts/zavorth-execution-backends.ts',
    'tests/services/ZavorthSupremacyParityPackService.test.ts',
    'package.json',
  ];
  const missing = files.filter((file) => !fs.existsSync(file));
  return rule('files-exist', 'Supremacy files exist', missing.length === 0, `${files.length - missing.length}/${files.length}`, missing);
}

function markersPresent() {
  const checks = [
    ['src/contracts/ZavorthSupremacyParityPackContract.ts', [
      'zavorth-supremacy-parity-pack/1',
      'ZavorthGatewayMatrixChannel',
      'ZavorthExecutionBackendMatrixEntry',
      'ZavorthSkillEcosystemNativeCategory',
    ]],
    ['src/services/ZavorthSupremacyParityPackService.ts', [
      'alibaba-coding-plan',
      'azure-foundry',
      'copilot-acp',
      'qwen-oauth',
      'noBackendLiveByDefault: true',
      'noExternalCodeCopy: true',
      'noConceptualExternalReferences',
    ]],
    ['package.json', [
      'zavorth:supremacy-parity',
      'zavorth:supremacy-parity:check',
      'zavorth:gateway-matrix',
      'zavorth:execution-backends',
      'zavorth:provider-parity',
    ]],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    for (const needle of needles) {
      if (!text.includes(needle)) missing.push(`${file}: missing ${needle}`);
    }
  }
  return rule('markers', 'Supremacy markers present', missing.length === 0, missing.length === 0 ? 'all markers' : `${missing.length} missing`, missing);
}

function commandPasses(label, command, validator) {
  const result = spawnSync(command[0], command.slice(1), { cwd: root, encoding: 'utf8' });
  const parsed = parseJson(result.stdout);
  const errors = result.status === 0 ? [
    ...validateNoRawSecrets(label, result.stdout),
    ...validator(parsed),
  ] : [result.error?.message || result.stderr || result.stdout || `exit ${result.status}`];
  return rule(label.replace(/\s+/g, '-'), label, errors.length === 0, errors.length === 0 ? 'passed' : 'failed', errors);
}

function validateSupremacy(snapshot) {
  const errors = [];
  if (snapshot?.surface !== 'supremacy-parity-pack') errors.push('wrong surface');
  if (snapshot?.summary?.missingProviderParityRoutes?.length !== 0) errors.push('missing provider parity routes');
  if (snapshot?.summary?.gatewayChannels < 9) errors.push('gateway matrix incomplete');
  if (snapshot?.summary?.executionBackends < 7) errors.push('execution backend matrix incomplete');
  if (snapshot?.summary?.nativeSkillCategories < 10) errors.push('skill categories incomplete');
  if (snapshot?.safety?.noSkillMutationWithoutApproval !== true) errors.push('skill approval invariant missing');
  if (snapshot?.safety?.noExternalBackendLiveWithoutExplicitConfig !== true) errors.push('backend invariant missing');
  return errors;
}

function validateProviderParity(snapshot) {
  const errors = [];
  if (snapshot?.status !== 'passed') errors.push('provider parity not passed');
  if (snapshot?.missingRoutes?.length !== 0) errors.push('missing parity routes');
  if (snapshot?.routeCount < 80) errors.push('route count below parity target');
  if (snapshot?.noRawSecretsSerialized !== true) errors.push('secret invariant missing');
  return errors;
}

function validateGatewayMatrix(snapshot) {
  const errors = [];
  if (!Array.isArray(snapshot?.channels) || snapshot.channels.length < 9) errors.push('channels incomplete');
  if (snapshot?.safety?.allSensitiveActionsUseApprovalResolver !== true) errors.push('approval resolver invariant missing');
  if (snapshot?.safety?.notConfiguredIsExplicit !== true) errors.push('not-configured invariant missing');
  return errors;
}

function validateExecutionBackends(snapshot) {
  const errors = [];
  if (!Array.isArray(snapshot?.entries) || snapshot.entries.length < 7) errors.push('backends incomplete');
  if (!snapshot.entries.every((entry) => entry.liveByDefault === false)) errors.push('backend live-by-default violation');
  if (snapshot?.safety?.secretDumpBlocked !== true) errors.push('secret dump invariant missing');
  return errors;
}

function validateNoRawSecrets(label, text) {
  const secretPatterns = [
    /\bsk-[A-Za-z0-9_-]{20,}\b/,
    /\bhf_[A-Za-z0-9]{20,}\b/,
    /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
    /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/,
    /\bAIza[0-9A-Za-z_-]{25,}\b/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\bya29\.[0-9A-Za-z_-]{20,}\b/,
    /\b[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{16,}\b/,
  ];
  return secretPatterns.some((pattern) => pattern.test(text))
    ? [`${label} serialized a raw secret-like token`]
    : [];
}

function jestPasses() {
  const result = spawnSync(nodeBin, [
    jestCli,
    'tests/services/ZavorthSupremacyParityPackService.test.ts',
    'tests/services/providers/catalog/ZavorthProviderParityPack.test.ts',
    'tests/services/ZavorthCliTuiPolishService.test.ts',
    'tests/services/ZavorthSkillCuratorLiveLoopService.test.ts',
    'tests/services/ZavorthSkillEcosystemPackService.test.ts',
    '--runInBand',
  ], { cwd: root, encoding: 'utf8' });
  return rule('jest', 'Focused Jest suites', result.status === 0, result.status === 0 ? 'passed' : 'failed', result.status === 0 ? [] : [result.error?.message || result.stderr || result.stdout]);
}

function rule(id, label, ok, observed, details = []) {
  return { id, label, status: ok ? 'passed' : 'failed', observed, details };
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
