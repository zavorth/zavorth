#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const rules = [
  ruleFilesExist(),
  ruleMarkers(),
  runDryRunFixture(),
];
const failed = rules.filter((rule) => rule.status === 'failed');
const snapshot = { generatedAt: new Date().toISOString(), status: failed.length > 0 ? 'failed' : 'passed', rules };

if (asJson) console.log(JSON.stringify(snapshot, null, 2));
else {
  console.log('[zavorth-provider-live-canary] checking provider live canary');
  for (const item of rules) {
    console.log(`[zavorth-provider-live-canary] ${item.status === 'passed' ? 'ok' : 'fail'} ${item.label}: ${item.observed} | ${item.target}`);
    for (const detail of item.details.slice(0, 8)) console.log(`  - ${detail}`);
  }
}
if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthProviderLiveCanaryContract.ts',
    'src/services/ZavorthProviderLiveCanaryService.ts',
    'scripts/zavorth-provider-live-canary.ts',
    'tests/services/ZavorthProviderLiveCanaryService.test.ts',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('provider-live-canary-files', 'Provider live canary files exist', missing.length === 0, `${files.length - missing.length}/${files.length}`, 'contract, service, script and tests', missing);
}

function ruleMarkers() {
  const checks = [
    ['src/contracts/ZavorthProviderLiveCanaryContract.ts', ['provider-live-canary', 'noSecretValuesSerialized', 'singleWorkerOnly']],
    ['src/services/ZavorthProviderLiveCanaryService.ts', ['ZAVORTH_LIVE_SUBAGENT_CANARY_OK', 'maxLiveWorkers: 1', 'maxToolCalls: 0', 'No configured provider credentials']],
    ['scripts/zavorth-provider-live-canary.ts', ['--run-live', '--require-pass', '--timeout-ms']],
    ['package.json', ['zavorth:provider-live-canary', 'zavorth:provider-live-canary:check']],
  ];
  const missing = [];
  for (const [file, markers] of checks) {
    const content = fs.readFileSync(path.join(root, file), 'utf8');
    for (const marker of markers) {
      if (!content.includes(marker)) missing.push(`${file}: missing ${marker}`);
    }
  }
  return rule('provider-live-canary-markers', 'Provider live canary markers exist', missing.length === 0, missing.length === 0 ? 'all markers' : `${missing.length} missing`, 'safe live canary markers', missing);
}

function runDryRunFixture() {
  const result = spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/zavorth-provider-live-canary.ts',
    '--json',
  ], { cwd: root, encoding: 'utf8', env: process.env });
  if (result.status !== 0) {
    return rule('provider-live-canary-dry-run', 'Dry-run returns JSON without live call', false, `exit ${result.status ?? 'unknown'}`, 'valid JSON dry-run', compact(result.stderr, result.stdout));
  }
  try {
    const snapshot = JSON.parse(result.stdout);
    const passed = snapshot.mode === 'dry-run'
      && snapshot.live.executed === false
      && snapshot.guarantees.noSecretValuesSerialized === true;
    return rule('provider-live-canary-dry-run', 'Dry-run returns JSON without live call', passed, `status=${snapshot.status}; mode=${snapshot.mode}`, 'dry-run no external canary', passed ? [] : [JSON.stringify(snapshot, null, 2)]);
  } catch (error) {
    return rule('provider-live-canary-dry-run', 'Dry-run returns JSON without live call', false, 'invalid JSON', 'valid JSON dry-run', [String(error), ...compact(result.stderr, result.stdout)]);
  }
}

function rule(id, label, passed, observed, target, details = []) {
  return { id, label, status: passed ? 'passed' : 'failed', observed, target, details };
}

function compact(...parts) {
  return parts.join('\n').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 10);
}
