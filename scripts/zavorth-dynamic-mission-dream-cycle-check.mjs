#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  filesExist(),
  markersPresent(),
  missionCliFixture(),
  dreamCliFixture(),
  spineCliFixture(),
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
  for (const rule of rules) {
    console.log(`[zavorth-dynamic-mission-dream-cycle] ${rule.status === 'passed' ? 'ok' : 'fail'} ${rule.id}: ${rule.summary}`);
  }
}
if (failed.length > 0) process.exitCode = 1;

function filesExist() {
  const files = [
    'src/contracts/ZavorthDepthModeContract.ts',
    'src/contracts/ZavorthDynamicMissionHarnessContract.ts',
    'src/contracts/MnemosDreamCycleContract.ts',
    'src/services/ZavorthDepthModeService.ts',
    'src/services/ZavorthDynamicMissionHarnessService.ts',
    'src/services/MnemosDreamCycleService.ts',
    'scripts/zavorth-dynamic-mission-harness.ts',
    'scripts/mnemos-dream-cycle.ts',
    'tests/services/ZavorthDynamicMissionHarnessAndDreamCycle.test.ts',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('files', missing.length === 0, `${files.length - missing.length}/${files.length} files`, missing);
}

function markersPresent() {
  const checks = [
    ['src/services/ZavorthDynamicMissionHarnessService.ts', [
      'previewOnly',
      'noArbitraryCodeExecution',
      'depthCapsEnforced',
      'workflow-run-service',
      'materializeApprovedMission',
      'createRun',
      'adversarial-verification',
      'tournament',
    ]],
    ['src/services/MnemosDreamCycleService.ts', [
      'sourceStoreImmutable',
      'separateCandidateStore',
      'quarantine-secret',
      'sensitive-user-model',
      'approval required to apply candidate memories',
      'shouldRun',
      'schedulerDecisionOnly',
    ]],
    ['src/services/ZavorthDepthModeService.ts', [
      'budgetsHardCapped',
      'noDepthModeBypassesPolicy',
      'adversarial',
    ]],
    ['src/services/ZavorthNativeAutonomySpineService.ts', [
      'dynamic-mission-harness',
      'mnemos-dream-cycle',
      'mission preview approve',
      'dream review apply',
    ]],
    ['src/sdk/contracts.ts', [
      'ZavorthDynamicMissionHarnessContract',
      'MnemosDreamCycleContract',
      'ZavorthDepthModeContract',
    ]],
    ['src/sdk/index.ts', [
      'ZavorthDynamicMissionHarnessService',
      'MnemosDreamCycleService',
      'ZavorthDepthModeService',
    ]],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    for (const needle of needles) if (!text.includes(needle)) missing.push(`${file}: ${needle}`);
  }
  return rule('markers', missing.length === 0, missing.length ? `${missing.length} missing` : 'all markers', missing);
}

function missionCliFixture() {
  const result = runTs('scripts/zavorth-dynamic-mission-harness.ts', [
    '--json',
    '--objective=Audite com token=secret-value sk-test-123',
    '--mode=adversarial',
    '--effects=read,write,shell,network',
    '--patterns=fanout-and-synthesize,adversarial-verification,tournament',
  ]);
  return jsonRule('mission-cli', result, (snapshot) =>
    snapshot.version === 'dynamic-mission-harness/v1'
    && snapshot.status === 'needs-approval'
    && snapshot.workflow?.execution === 'preview-only'
    && snapshot.safety?.noArbitraryCodeExecution === true
    && snapshot.safety?.rawSecretsSerialized === false
    && !JSON.stringify(snapshot).includes('secret-value')
    && !JSON.stringify(snapshot).includes('sk-test-123'));
}

function dreamCliFixture() {
  const result = runTs('scripts/mnemos-dream-cycle.ts', [
    '--json',
    '--observation=Use token=super-secret for deploy',
    '--kind=procedure',
  ]);
  return jsonRule('dream-cli', result, (snapshot) =>
    snapshot.version === 'mnemos-dream-cycle/v1'
    && snapshot.status === 'needs-review'
    && snapshot.sourceStore?.immutable === true
    && snapshot.candidateStore?.status === 'candidate'
    && snapshot.safety?.sourceStoreImmutable === true
    && snapshot.safety?.rawSecretsSerialized === false
    && !JSON.stringify(snapshot).includes('super-secret'));
}

function spineCliFixture() {
  const result = runTs('scripts/zavorth-native-autonomy-spine.ts', [
    '--json',
    '--base-prompt=Prefer concise responses.',
    '--mission-objective=Validate release notes with adversarial review',
    '--mission-mode=adversarial',
    '--mission-effects=read,write,shell',
    '--dream-observation=User prefers concise responses.',
  ]);
  return jsonRule('spine-cli', result, (snapshot) =>
    snapshot.version === 'native-autonomy-spine/v1'
    && snapshot.dynamicMission?.version === 'dynamic-mission-harness/v1'
    && snapshot.dreamCycle?.version === 'mnemos-dream-cycle/v1'
    && snapshot.safety?.noArbitraryMissionExecution === true
    && snapshot.safety?.dreamCycleCandidateStoreOnly === true
    && snapshot.stages?.some((stage) => stage.id === 'dynamic-mission-harness')
    && snapshot.stages?.some((stage) => stage.id === 'mnemos-dream-cycle'));
}

function runTs(script, args) {
  return spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    script,
    ...args,
  ], { cwd: root, encoding: 'utf8', env: process.env });
}

function jsonRule(id, result, predicate) {
  if (!result.stdout.trim()) return rule(id, false, `empty output: ${result.stderr}`, []);
  try {
    const parsed = JSON.parse(result.stdout);
    return rule(id, Boolean(predicate(parsed)), `status=${parsed.status}`, [result.stderr]);
  } catch (error) {
    return rule(id, false, String(error), [result.stdout, result.stderr]);
  }
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function rule(id, passed, summary, details) {
  return { id, status: passed ? 'passed' : 'failed', summary, details };
}
