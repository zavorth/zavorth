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
  runLiveCanarySwarmFixture(),
  runLiveCanarySwarmBlockedFixture(),
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
  console.log('[zavorth-post291-live-canary-swarm] checking Phase B');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-post291-live-canary-swarm] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 16)) console.log(`  - ${detail}`);
  }
}

if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthPost291LiveCanarySwarmContract.ts',
    'src/services/ZavorthPost291LiveCanarySwarmService.ts',
    'scripts/zavorth-post291-live-canary-swarm.ts',
    'scripts/zavorth-post291-live-canary-swarm-check.mjs',
    'tests/services/ZavorthPost291LiveCanarySwarmService.test.ts',
    'docs/README.md',
    'docs/README.md',
    'package.json',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return {
    id: 'phase-b-files',
    label: 'Phase B live canary swarm files exist',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: `${files.length - missing.length}/${files.length} file(s) present`,
    target: 'contract, service, CLI, check, tests, docs and package scripts are present',
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleContainsMarkers() {
  const checks = [
    ['src/contracts/ZavorthPost291LiveCanarySwarmContract.ts', [
      'ZAVORTH_POST_291_LIVE_CANARY_SWARM_CONTRACT_VERSION',
      'zavorth-post-291-live-canary-swarm/B',
      'provider',
      'channel',
      'tool-execution',
      'worker-activation',
      'manual-approval-required',
      '302 Phase C - Release Candidate',
    ]],
    ['src/services/ZavorthPost291LiveCanarySwarmService.ts', [
      'prepareCanary',
      'buildActivationTicket',
      'buildRollbackReceipt',
      'buildSequenceReceipt',
      'four-live-canaries-prepared',
      'sequence-order-provider-channel-tool-worker',
      'no-live-provider-channel-tool-worker-effects',
    ]],
    ['docs/README.md', [
      'phase-b-live-canary-swarm-ready',
      'Zavorth Post-291 Live Canary Swarm',
      '302 Phase C - Release Candidate',
    ]],
    ['docs/README.md', [
      'phase-b-live-canary-swarm-complete',
      'Zavorth Post-291 Live Canary Swarm',
      'provider canary',
      'channel canary',
      'tool execution canary',
      'worker activation canary',
      'rollback receipts',
      'no live activation performed',
    ]],
    ['package.json', [
      'zavorth:post291-live-canary-swarm',
      'zavorth:post291-live-canary-swarm:check',
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
    id: 'phase-b-markers',
    label: 'Phase B live canary markers are present',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: missing.length === 0 ? 'all markers present' : `${missing.length} missing marker(s)`,
    target: 'canary, sequence, approval, rollback, no-live and next-phase markers are present',
    details: missing,
  };
}

function runLiveCanarySwarmFixture() {
  const result = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-post291-live-canary-swarm.ts',
    '--json',
    '--require-pass',
  ], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return {
      id: 'phase-b-live-canary-fixture',
      label: 'Live canary swarm fixture passes',
      status: 'failed',
      observed: `exit ${result.status}`,
      target: 'default live canary swarm snapshot is live-canary-swarm-ready',
      details: [result.error?.message || result.stderr || result.stdout || 'no output'],
    };
  }
  const snapshot = parseJson(result.stdout);
  const ok = snapshot
    && snapshot.status === 'live-canary-swarm-ready'
    && snapshot.contractVersion === 'zavorth-post-291-live-canary-swarm/B'
    && snapshot.summary?.canariesPrepared === 4
    && snapshot.summary?.providerCanaries === 1
    && snapshot.summary?.channelCanaries === 1
    && snapshot.summary?.toolCanaries === 1
    && snapshot.summary?.workerCanaries === 1
    && snapshot.summary?.activationTickets === 4
    && snapshot.summary?.dryRunPreviewsReady === 4
    && snapshot.summary?.rollbackReceiptsReady === 4
    && snapshot.summary?.ownerApprovalsRequired === 4
    && snapshot.summary?.liveActivationsPerformed === 0
    && snapshot.safety?.noLiveActivationPerformed === true
    && snapshot.safety?.noAutomaticPromotion === true
    && snapshot.commands?.nextPhase === '302 Phase C - Release Candidate';
  return {
    id: 'phase-b-live-canary-fixture',
    label: 'Live canary swarm fixture passes',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.status}, ${snapshot.summary.canariesPrepared} canaries, next=${snapshot.commands.nextPhase}` : 'invalid live canary swarm snapshot',
    target: 'default snapshot is ready with four approval-gated canaries, rollback receipts and no live effects',
    details: ok ? [] : [result.stdout],
  };
}

function runLiveCanarySwarmBlockedFixture() {
  const result = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-post291-live-canary-swarm.ts',
    '--json',
    '--certification-swarm-status',
    'blocked',
  ], {
    cwd: root,
    encoding: 'utf8',
  });
  const snapshot = parseJson(result.stdout);
  const ok = result.status === 0
    && snapshot
    && snapshot.status === 'blocked'
    && snapshot.previousCertificationSwarmStatus === 'blocked';
  return {
    id: 'phase-b-blocked-fixture',
    label: 'Live canary swarm blocks without Phase A readiness',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.status}, certificationSwarm=${snapshot.previousCertificationSwarmStatus}` : `exit ${result.status}`,
    target: 'Phase B cannot start while Phase A certification swarm is blocked',
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
