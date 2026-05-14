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
  runCertificationSwarmFixture(),
  runCertificationSwarmBlockedFixture(),
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
  console.log('[zavorth-post291-certification-swarm] checking Phase A');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-post291-certification-swarm] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 16)) console.log(`  - ${detail}`);
  }
}

if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthPost291CertificationSwarmContract.ts',
    'src/services/ZavorthPost291CertificationSwarmService.ts',
    'scripts/zavorth-post291-certification-swarm.ts',
    'scripts/zavorth-post291-certification-swarm-check.mjs',
    'tests/services/ZavorthPost291CertificationSwarmService.test.ts',
    'docs/README.md',
    'docs/README.md',
    'package.json',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return {
    id: 'phase-a-files',
    label: 'Phase A certification swarm files exist',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: `${files.length - missing.length}/${files.length} file(s) present`,
    target: 'contract, service, CLI, check, tests, docs and package scripts are present',
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleContainsMarkers() {
  const checks = [
    ['src/contracts/ZavorthPost291CertificationSwarmContract.ts', [
      'ZAVORTH_POST_291_CERTIFICATION_SWARM_CONTRACT_VERSION',
      'zavorth-post-291-certification-swarm/A',
      'security-hardening',
      'approval-policy-certification',
      'regression-gates',
      'observability-audit',
      'rollback-baseline',
      'subagent-lanes-ready',
      '302 Phase B - Live Canary Swarm',
    ]],
    ['src/services/ZavorthPost291CertificationSwarmService.ts', [
      'certifyLane',
      'certifyGate',
      'aggregateSwarm',
      'five-certification-lanes-ready',
      'no-live-provider-channel-tool-worker-activation',
      'noAutomaticCanaryPromotion',
    ]],
    ['docs/README.md', [
      '302 - Post-291 Zavorth Operationalization Plan',
      'phase-a-certification-swarm-ready',
      '302 Phase B - Live Canary Swarm',
      '302 Phase C - Release Candidate',
    ]],
    ['docs/README.md', [
      'phase-a-certification-swarm-complete',
      'Certification Swarm',
      'security hardening',
      'approval/policy certification',
      'regression gates',
      'observability/audit',
      'rollback baseline',
      'no live activation',
    ]],
    ['package.json', [
      'zavorth:post291-certification-swarm',
      'zavorth:post291-certification-swarm:check',
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
    id: 'phase-a-markers',
    label: 'Phase A certification markers are present',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: missing.length === 0 ? 'all markers present' : `${missing.length} missing marker(s)`,
    target: 'security, policy, regression, observability, rollback, no-live and next-phase markers are present',
    details: missing,
  };
}

function runCertificationSwarmFixture() {
  const result = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-post291-certification-swarm.ts',
    '--json',
    '--require-pass',
  ], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return {
      id: 'phase-a-certification-fixture',
      label: 'Certification swarm fixture passes',
      status: 'failed',
      observed: `exit ${result.status}`,
      target: 'default certification swarm snapshot is certification-swarm-ready',
      details: [result.error?.message || result.stderr || result.stdout || 'no output'],
    };
  }
  const snapshot = parseJson(result.stdout);
  const ok = snapshot
    && snapshot.status === 'certification-swarm-ready'
    && snapshot.contractVersion === 'zavorth-post-291-certification-swarm/A'
    && snapshot.summary?.certificationLanes === 5
    && snapshot.summary?.passedLanes === 5
    && snapshot.summary?.blockedLanes === 0
    && snapshot.summary?.passedGates === snapshot.summary?.gates
    && snapshot.summary?.liveActivationsStarted === 0
    && snapshot.safety?.noLiveActivation === true
    && snapshot.safety?.noProviderCallPerformed === true
    && snapshot.safety?.noToolExecutionPerformed === true
    && snapshot.aggregation?.parallelizationMode === 'subagent-lanes-ready'
    && snapshot.commands?.nextPhase === '302 Phase B - Live Canary Swarm';
  return {
    id: 'phase-a-certification-fixture',
    label: 'Certification swarm fixture passes',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.status}, ${snapshot.summary.passedLanes}/${snapshot.summary.certificationLanes} lanes, next=${snapshot.commands.nextPhase}` : 'invalid certification swarm snapshot',
    target: 'default snapshot is ready with five no-live certification lanes and Phase B next',
    details: ok ? [] : [result.stdout],
  };
}

function runCertificationSwarmBlockedFixture() {
  const result = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-post291-certification-swarm.ts',
    '--json',
    '--native-replacement-status',
    'blocked',
  ], {
    cwd: root,
    encoding: 'utf8',
  });
  const snapshot = parseJson(result.stdout);
  const ok = result.status === 0
    && snapshot
    && snapshot.status === 'blocked'
    && snapshot.previousNativeReplacementStatus === 'blocked';
  return {
    id: 'phase-a-blocked-fixture',
    label: 'Certification swarm blocks without Phase 8 readiness',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.status}, nativeReplacement=${snapshot.previousNativeReplacementStatus}` : `exit ${result.status}`,
    target: 'Phase A cannot start while Phase 8 native replacement closure is blocked',
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
