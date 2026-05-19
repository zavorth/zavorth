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
  runDelegatedWorkerFixture(),
  runDelegatedWorkerBlockedFixture(),
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
  console.log('[zavorth-delegated-worker-bridge] checking Surface controls');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-delegated-worker-bridge] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 16)) console.log(`  - ${detail}`);
  }
}

if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthDelegatedWorkerBridgeContract.ts',
    'src/services/ZavorthDelegatedWorkerBridgeService.ts',
    'scripts/zavorth-delegated-worker-bridge.ts',
    'scripts/zavorth-delegated-worker-bridge-check.mjs',
    'tests/services/ZavorthDelegatedWorkerBridgeService.test.ts',
    'docs/README.md',
    'docs/README.md',
    'package.json',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return {
    id: 'checkpoint-7-files',
    label: 'Surface controls delegated worker files exist',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: `${files.length - missing.length}/${files.length} file(s) present`,
    target: 'contract, service, CLI, check, tests, docs and package scripts are present',
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleContainsMarkers() {
  const checks = [
    ['src/contracts/ZavorthDelegatedWorkerBridgeContract.ts', [
      'ZAVORTH_DELEGATED_WORKER_BRIDGE_CONTRACT_VERSION',
      'zavorth-delegated-worker-bridge/7',
      'zavorth-gateway-delegated-only',
      'cancel-task-and-return-status',
      'sourceWorkerLaunchBlocked',
      'delegated-worker-result',
    ]],
    ['src/services/ZavorthDelegatedWorkerBridgeService.ts', [
      'normalizeWorkerDescriptor',
      'buildDelegatedTaskEnvelope',
      'buildTimeoutCancellation',
      'blockSourceWorkerLaunch',
      'buildLifecycleDryRun',
      'mapExecutorResult',
      'source-worker-launch-blocked-until-later-gate',
    ]],
    ['docs/README.md', [
      'delegated-workers-ready',
      '291 Dashboard controls - Native Replacement And Decommission',
      'Zavorth Delegated Worker Bridge',
    ]],
    ['docs/README.md', [
      'delegated-workers-complete',
      'Zavorth Delegated Worker Bridge',
      'zavorth-gateway-delegated-only',
      'dry-run',
      'artifact/event/status',
      '291 Dashboard controls - Native Replacement And Decommission',
    ]],
    ['package.json', [
      'zavorth:delegated-worker-bridge',
      'zavorth:delegated-worker-bridge:check',
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
    id: 'checkpoint-7-markers',
    label: 'Surface controls delegated worker markers are present',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: missing.length === 0 ? 'all markers present' : `${missing.length} missing marker(s)`,
    target: 'worker descriptor, delegated envelope, timeout, launch gate, lifecycle and result markers are present',
    details: missing,
  };
}

function runDelegatedWorkerFixture() {
  const result = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-delegated-worker-bridge.ts',
    '--json',
    '--require-pass',
  ], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return {
      id: 'checkpoint-7-delegated-worker-fixture',
      label: 'Delegated worker bridge fixture passes',
      status: 'failed',
      observed: `exit ${result.status}`,
      target: 'default delegated worker snapshot is delegated-worker-bridge-ready',
      details: [result.error?.message || result.stderr || result.stdout || 'no output'],
    };
  }
  const snapshot = parseJson(result.stdout);
  const ok = snapshot
    && snapshot.status === 'delegated-worker-bridge-ready'
    && snapshot.contractVersion === 'zavorth-delegated-worker-bridge/7'
    && snapshot.summary?.workerDescriptors >= 2
    && snapshot.summary?.delegatedTaskEnvelopes === 1
    && snapshot.summary?.dryRunLifecycleReceipts === 1
    && snapshot.summary?.timeoutPolicies === 1
    && snapshot.summary?.cancellationPolicies === 1
    && snapshot.summary?.sourceWorkerLaunchesBlocked === 1
    && snapshot.summary?.executorResultsMapped === 1
    && snapshot.summary?.artifactEventsReturned >= 1
    && snapshot.summary?.liveWorkersStarted === 0
    && snapshot.safety?.dispatchMode === 'zavorth-gateway-delegated-only'
    && snapshot.safety?.noWorkerLaunchPerformed === true;
  return {
    id: 'checkpoint-7-delegated-worker-fixture',
    label: 'Delegated worker bridge fixture passes',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.status}, ${snapshot.summary.workerDescriptors} worker(s), ${snapshot.summary.artifactEventsReturned} artifact event(s)` : 'invalid delegated worker snapshot',
    target: 'default snapshot is ready with gateway-only dispatch, dry-run lifecycle, blocked source launch and result mapping',
    details: ok ? [] : [result.stdout],
  };
}

function runDelegatedWorkerBlockedFixture() {
  const result = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-delegated-worker-bridge.ts',
    '--json',
    '--session-memory-status',
    'blocked',
  ], {
    cwd: root,
    encoding: 'utf8',
  });
  const snapshot = parseJson(result.stdout);
  const ok = result.status === 0
    && snapshot
    && snapshot.status === 'blocked'
    && snapshot.previousSessionMemoryStatus === 'blocked';
  return {
    id: 'checkpoint-7-blocked-fixture',
    label: 'Delegated worker bridge blocks without Runtime gateway readiness',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.status}, sessionMemory=${snapshot.previousSessionMemoryStatus}` : `exit ${result.status}`,
    target: 'Surface controls cannot advance while Runtime gateway session memory is blocked',
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
