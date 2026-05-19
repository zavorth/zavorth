#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const rules = [
  filesExist(),
  packageScriptsWired(),
  workspaceCheckWired(),
  runCertificationSnapshot(),
];
const failed = rules.filter((rule) => rule.status === 'failed');
const snapshot = { generatedAt: new Date().toISOString(), status: failed.length > 0 ? 'failed' : 'passed', rules };

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[zavorth-end-to-end-mission-flow-public-runtime-certification] checking Dashboard controls');
  for (const item of rules) {
    console.log(`[zavorth-end-to-end-mission-flow-public-runtime-certification] ${item.status === 'passed' ? 'ok' : 'fail'} ${item.label}: ${item.observed} | ${item.target}`);
    for (const detail of item.details.slice(0, 10)) console.log(`  - ${detail}`);
  }
}
if (failed.length > 0) process.exitCode = 1;

function filesExist() {
  const files = [
    'src/contracts/ZavorthEndToEndMissionFlowPublicRuntimeCertificationContract.ts',
    'src/services/ZavorthEndToEndMissionFlowPublicRuntimeCertificationService.ts',
    'scripts/zavorth-end-to-end-mission-flow-public-runtime-certification.ts',
    'scripts/zavorth-end-to-end-mission-flow-public-runtime-certification-check.mjs',
    'tests/services/ZavorthEndToEndMissionFlowPublicRuntimeCertificationService.test.ts',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('files', 'Dashboard controls files exist', missing.length === 0, `${files.length - missing.length}/${files.length}`, 'all files present', missing);
}

function packageScriptsWired() {
  const scripts = JSON.parse(read('package.json')).scripts || {};
  const markers = [
    'zavorth:end-to-end-mission-flow-public-runtime-certification',
    'zavorth:end-to-end-mission-flow-public-runtime-certification:json',
    'zavorth:end-to-end-mission-flow-public-runtime-certification:check',
  ];
  const missing = markers.filter((marker) => !scripts[marker]);
  return rule('package-scripts', 'Package scripts are wired', missing.length === 0, missing.length === 0 ? 'all scripts' : `${missing.length} missing`, markers.join(', '), missing);
}

function workspaceCheckWired() {
  const workspace = String(JSON.parse(read('package.json')).scripts?.['workspace:check'] || '');
  const marker = 'zavorth:end-to-end-mission-flow-public-runtime-certification:check';
  return rule('workspace-check', 'workspace:check includes Dashboard controls gate', workspace.includes(marker), workspace.includes(marker) ? 'wired' : 'missing', marker, []);
}

function runCertificationSnapshot() {
  const result = spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/zavorth-end-to-end-mission-flow-public-runtime-certification.ts',
    '--json',
    '--require-pass',
  ], { cwd: root, encoding: 'utf8', env: process.env });
  if (result.status !== 0) {
    return rule('snapshot', 'Certification snapshot runs', false, `exit ${result.status ?? 'unknown'}`, 'valid JSON with no blocked status', compact(result.stderr, result.stdout));
  }
  try {
    const data = JSON.parse(result.stdout);
    const pass = data.contractVersion === '2026-05-14.checkpoint-8-end-to-end-mission-flow-public-runtime-certification'
      && data.status !== 'blocked'
      && data.summary?.previewFirst === true
      && data.summary?.receiptReady === true
      && data.summary?.missionTraceable === true
      && data.summary?.providerReadinessHonest === true
      && data.summary?.channelReadinessHonest === true
      && data.summary?.publicRuntimeCanBypassPolicy === false
      && data.summary?.rawSecretsSerialized === false
      && data.safety?.noRuntimeBypassFromPublicSurfaces === true;
    return rule('snapshot', 'Certification snapshot runs', pass, `status=${data.status}; entries=${data.summary?.entries}`, 'end-to-end mission flow certification without runtime bypass', pass ? [] : [JSON.stringify(data, null, 2)]);
  } catch (error) {
    return rule('snapshot', 'Certification snapshot runs', false, 'invalid JSON', 'valid JSON output', [String(error), ...compact(result.stderr, result.stdout)]);
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
