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
  runReleaseCandidateFixture(),
  runReleaseCandidateBlockedFixture(),
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
  console.log('[zavorth-post291-release-candidate] checking Phase C');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-post291-release-candidate] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 16)) console.log(`  - ${detail}`);
  }
}

if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthPost291ReleaseCandidateContract.ts',
    'src/services/ZavorthPost291ReleaseCandidateService.ts',
    'scripts/zavorth-post291-release-candidate.ts',
    'scripts/zavorth-post291-release-candidate-check.mjs',
    'tests/services/ZavorthPost291ReleaseCandidateService.test.ts',
    'docs/README.md',
    'docs/README.md',
    'package.json',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return {
    id: 'phase-c-files',
    label: 'Phase C release candidate files exist',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: `${files.length - missing.length}/${files.length} file(s) present`,
    target: 'contract, service, CLI, check, tests, docs and package scripts are present',
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleContainsMarkers() {
  const checks = [
    ['src/contracts/ZavorthPost291ReleaseCandidateContract.ts', [
      'ZAVORTH_POST_291_RELEASE_CANDIDATE_CONTRACT_VERSION',
      'zavorth-post-291-release-candidate/C',
      'final-docs',
      'setup-presets',
      'command-center-polish',
      'release-checklist',
      'smoke-tests',
      'packaging',
      '302 plan complete',
    ]],
    ['src/services/ZavorthPost291ReleaseCandidateService.ts', [
      'buildReadinessReceipt',
      'buildReleaseChecklist',
      'buildPackagingReceipt',
      'all-release-candidate-readiness-items-present',
      'package-preview-ready-without-publish',
      'no-publish-tag-deploy-upload',
    ]],
    ['docs/README.md', [
      'phase-c-release-candidate-ready',
      'Zavorth Post-291 Release Candidate',
      '302 plan complete',
    ]],
    ['docs/README.md', [
      'phase-c-release-candidate-complete',
      'Zavorth Post-291 Release Candidate',
      'final docs',
      'setup presets',
      'Command Center polish',
      'release checklist',
      'smoke tests',
      'packaging',
      'no publish performed',
    ]],
    ['package.json', [
      'zavorth:post291-release-candidate',
      'zavorth:post291-release-candidate:check',
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
    id: 'phase-c-markers',
    label: 'Phase C release candidate markers are present',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: missing.length === 0 ? 'all markers present' : `${missing.length} missing marker(s)`,
    target: 'docs, setup, command center, checklist, smoke, package and no-publish markers are present',
    details: missing,
  };
}

function runReleaseCandidateFixture() {
  const result = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-post291-release-candidate.ts',
    '--json',
    '--require-pass',
  ], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return {
      id: 'phase-c-release-candidate-fixture',
      label: 'Release candidate fixture passes',
      status: 'failed',
      observed: `exit ${result.status}`,
      target: 'default release candidate snapshot is release-candidate-ready',
      details: [result.error?.message || result.stderr || result.stdout || 'no output'],
    };
  }
  const snapshot = parseJson(result.stdout);
  const ok = snapshot
    && snapshot.status === 'release-candidate-ready'
    && snapshot.contractVersion === 'zavorth-post-291-release-candidate/C'
    && snapshot.summary?.readinessItems === 6
    && snapshot.summary?.passedReadinessItems === 6
    && snapshot.summary?.blockedReadinessItems === 0
    && snapshot.summary?.packagingReady === 1
    && snapshot.summary?.publishPerformed === false
    && snapshot.summary?.tagCreated === false
    && snapshot.summary?.deployPerformed === false
    && snapshot.safety?.noPublishPerformed === true
    && snapshot.safety?.noGitTagCreated === true
    && snapshot.safety?.noDeployPerformed === true
    && snapshot.commands?.planStatus === '302 plan complete';
  return {
    id: 'phase-c-release-candidate-fixture',
    label: 'Release candidate fixture passes',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.status}, ${snapshot.summary.passedReadinessItems}/${snapshot.summary.readinessItems} readiness, plan=${snapshot.commands.planStatus}` : 'invalid release candidate snapshot',
    target: 'default snapshot is ready with all RC items and no publish/tag/deploy',
    details: ok ? [] : [result.stdout],
  };
}

function runReleaseCandidateBlockedFixture() {
  const result = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-post291-release-candidate.ts',
    '--json',
    '--live-canary-swarm-status',
    'blocked',
  ], {
    cwd: root,
    encoding: 'utf8',
  });
  const snapshot = parseJson(result.stdout);
  const ok = result.status === 0
    && snapshot
    && snapshot.status === 'blocked'
    && snapshot.previousLiveCanarySwarmStatus === 'blocked';
  return {
    id: 'phase-c-blocked-fixture',
    label: 'Release candidate blocks without Phase B readiness',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.status}, liveCanary=${snapshot.previousLiveCanarySwarmStatus}` : `exit ${result.status}`,
    target: 'Phase C cannot close while Phase B live canary swarm is blocked',
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
