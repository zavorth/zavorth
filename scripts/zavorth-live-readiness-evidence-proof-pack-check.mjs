#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const rules = [
  filesExist(),
  packageScriptsWired(),
  workspaceCheckWired(),
  runProofPackSnapshot(),
];
const failed = rules.filter((rule) => rule.status === 'failed');
const snapshot = { generatedAt: new Date().toISOString(), status: failed.length > 0 ? 'failed' : 'passed', rules };

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[zavorth-live-readiness-evidence-proof-pack] checking Phase 9');
  for (const item of rules) {
    console.log(`[zavorth-live-readiness-evidence-proof-pack] ${item.status === 'passed' ? 'ok' : 'fail'} ${item.label}: ${item.observed} | ${item.target}`);
    for (const detail of item.details.slice(0, 10)) console.log(`  - ${detail}`);
  }
}
if (failed.length > 0) process.exitCode = 1;

function filesExist() {
  const files = [
    'src/contracts/ZavorthLiveReadinessEvidenceProofPackContract.ts',
    'src/services/ZavorthLiveReadinessEvidenceProofPackService.ts',
    'scripts/zavorth-live-readiness-evidence-proof-pack.ts',
    'scripts/zavorth-live-readiness-evidence-proof-pack-check.mjs',
    'tests/services/ZavorthLiveReadinessEvidenceProofPackService.test.ts',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('files', 'Phase 9 files exist', missing.length === 0, `${files.length - missing.length}/${files.length}`, 'all files present', missing);
}

function packageScriptsWired() {
  const scripts = JSON.parse(read('package.json')).scripts || {};
  const markers = [
    'zavorth:live-readiness-evidence-proof-pack',
    'zavorth:live-readiness-evidence-proof-pack:json',
    'zavorth:live-readiness-evidence-proof-pack:check',
  ];
  const missing = markers.filter((marker) => !scripts[marker]);
  return rule('package-scripts', 'Package scripts are wired', missing.length === 0, missing.length === 0 ? 'all scripts' : `${missing.length} missing`, markers.join(', '), missing);
}

function workspaceCheckWired() {
  const workspace = String(JSON.parse(read('package.json')).scripts?.['workspace:check'] || '');
  const marker = 'zavorth:live-readiness-evidence-proof-pack:check';
  return rule('workspace-check', 'workspace:check includes Phase 9 gate', workspace.includes(marker), workspace.includes(marker) ? 'wired' : 'missing', marker, []);
}

function runProofPackSnapshot() {
  const result = spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/zavorth-live-readiness-evidence-proof-pack.ts',
    '--json',
    '--require-pass',
  ], { cwd: root, encoding: 'utf8', env: process.env });
  if (result.status !== 0) {
    return rule('snapshot', 'Proof pack snapshot runs', false, `exit ${result.status ?? 'unknown'}`, 'valid JSON with no blocked status', compact(result.stderr, result.stdout));
  }
  try {
    const data = JSON.parse(result.stdout);
    const pass = data.contractVersion === '2026-05-14.phase-9-live-readiness-evidence-proof-pack'
      && data.status !== 'blocked'
      && data.policy?.catalogSupportIsNotLiveProof === true
      && data.policy?.defaultRoutingRequiresLiveProof === true
      && data.policy?.smokeProofDoesNotUseExternalIo === true
      && data.summary?.rawSecretsSerialized === false
      && data.summary?.providerNetworkUsed === false
      && data.summary?.liveChannelSendPerformed === false;
    return rule('snapshot', 'Proof pack snapshot runs', pass, `status=${data.status}; entries=${data.summary?.entries}`, 'live readiness evidence with no false readiness or unsafe IO', pass ? [] : [JSON.stringify(data, null, 2)]);
  } catch (error) {
    return rule('snapshot', 'Proof pack snapshot runs', false, 'invalid JSON', 'valid JSON output', [String(error), ...compact(result.stderr, result.stdout)]);
  }
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function rule(id, label, passed, observed, target, details = []) {
  return { id, label, status: passed ? 'passed' : 'failed', observed, target, details };
}

function compact(...parts) {
  return parts.join('\n').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 12);
}
