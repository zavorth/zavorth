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
  runSessionMemoryFixture(),
  runSessionMemoryBlockedFixture(),
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
  console.log('[zavorth-session-memory-continuation] checking Phase 6');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-session-memory-continuation] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 16)) console.log(`  - ${detail}`);
  }
}

if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthSessionMemoryContinuationContract.ts',
    'src/services/ZavorthSessionMemoryContinuationService.ts',
    'scripts/zavorth-session-memory-continuation.ts',
    'scripts/zavorth-session-memory-continuation-check.mjs',
    'tests/services/ZavorthSessionMemoryContinuationService.test.ts',
    'docs/README.md',
    'docs/README.md',
    'package.json',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return {
    id: 'phase-6-files',
    label: 'Phase 6 session memory files exist',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: `${files.length - missing.length}/${files.length} file(s) present`,
    target: 'contract, service, CLI, check, tests, docs and package scripts are present',
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleContainsMarkers() {
  const checks = [
    ['src/contracts/ZavorthSessionMemoryContinuationContract.ts', [
      'ZAVORTH_SESSION_MEMORY_CONTINUATION_CONTRACT_VERSION',
      'zavorth-session-memory-continuation/6',
      'privateFilteredBeforeContext',
      'restrictedFilteredBeforeMemory',
      'ZavorthAgentGateway',
      'provenanceRequired',
      'advisoryOnly',
    ]],
    ['src/services/ZavorthSessionMemoryContinuationService.ts', [
      'bridgeSessionHistory',
      'filterTranscriptForContext',
      'mapMemorySignals',
      'buildReplayHandoffSnapshot',
      'buildContinuationRequest',
      'private-restricted-filtered-before-context-memory',
      'memory-signals-provenance-backed-advisory-only',
    ]],
    ['docs/README.md', [
      'phase-6-sessions-memory-continuation-ready',
      '291 Phase 7 - Delegated Workers',
      'Zavorth Session Memory Continuation',
    ]],
    ['docs/README.md', [
      'phase-6-sessions-memory-continuation-complete',
      'Zavorth Session Memory Continuation',
      'privateFilteredBeforeContext',
      'ZavorthAgentGateway',
      'provenance',
      '291 Phase 7 - Delegated Workers',
    ]],
    ['package.json', [
      'zavorth:session-memory-continuation',
      'zavorth:session-memory-continuation:check',
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
    id: 'phase-6-markers',
    label: 'Phase 6 session memory markers are present',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: missing.length === 0 ? 'all markers present' : `${missing.length} missing marker(s)`,
    target: 'history bridge, privacy filter, memory signal, replay and continuation markers are present',
    details: missing,
  };
}

function runSessionMemoryFixture() {
  const result = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-session-memory-continuation.ts',
    '--json',
    '--require-pass',
  ], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return {
      id: 'phase-6-session-memory-fixture',
      label: 'Session memory continuation fixture passes',
      status: 'failed',
      observed: `exit ${result.status}`,
      target: 'default session memory snapshot is session-memory-continuation-ready',
      details: [result.error?.message || result.stderr || result.stdout || 'no output'],
    };
  }
  const snapshot = parseJson(result.stdout);
  const ok = snapshot
    && snapshot.status === 'session-memory-continuation-ready'
    && snapshot.contractVersion === 'zavorth-session-memory-continuation/6'
    && snapshot.summary?.transcriptItemsReceived >= 5
    && snapshot.summary?.publicContextItems >= 2
    && snapshot.summary?.privateRestrictedSecretItemsFiltered >= 3
    && snapshot.summary?.memorySignals >= 2
    && snapshot.summary?.provenanceBackedSignals === snapshot.summary?.memorySignals
    && snapshot.summary?.replayHandoffSnapshots === 1
    && snapshot.summary?.continuationGatewayRequests === 1
    && snapshot.summary?.memoryWritesPerformed === false
    && snapshot.summary?.hiddenMemoryAuthorityCreated === false
    && snapshot.safety?.continuationThroughGateway === true
    && snapshot.safety?.noPrivateContextLeak === true;
  return {
    id: 'phase-6-session-memory-fixture',
    label: 'Session memory continuation fixture passes',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.status}, ${snapshot.summary.memorySignals} signal(s), ${snapshot.summary.privateRestrictedSecretItemsFiltered} filtered item(s)` : 'invalid session memory snapshot',
    target: 'default snapshot is ready with privacy filtering, provenance-backed signals and gateway continuation',
    details: ok ? [] : [result.stdout],
  };
}

function runSessionMemoryBlockedFixture() {
  const result = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-session-memory-continuation.ts',
    '--json',
    '--channel-messaging-status',
    'blocked',
  ], {
    cwd: root,
    encoding: 'utf8',
  });
  const snapshot = parseJson(result.stdout);
  const ok = result.status === 0
    && snapshot
    && snapshot.status === 'blocked'
    && snapshot.previousChannelMessagingStatus === 'blocked';
  return {
    id: 'phase-6-blocked-fixture',
    label: 'Session memory continuation blocks without Phase 5 readiness',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.status}, channelMessaging=${snapshot.previousChannelMessagingStatus}` : `exit ${result.status}`,
    target: 'Phase 6 cannot advance while Phase 5 channel messaging is blocked',
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
