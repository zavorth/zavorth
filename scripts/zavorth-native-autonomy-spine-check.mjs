#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  filesExist(),
  markersPresent(),
  cliFixture(),
  languageFixture(),
  workspaceWire(),
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
    console.log(`[zavorth-native-autonomy-spine] ${rule.status === 'passed' ? 'ok' : 'fail'} ${rule.id}: ${rule.summary}`);
  }
}
if (failed.length > 0) process.exitCode = 1;

function filesExist() {
  const files = [
    'src/contracts/ZavorthNativeAutonomySpineContract.ts',
    'src/services/ZavorthExperienceLearningDaemonService.ts',
    'src/services/ZavorthSkillForgeRuntimeService.ts',
    'src/services/ZavorthChannelLiveCertificationService.ts',
    'src/services/ZavorthExecutionBackendProviderService.ts',
    'src/contracts/ZavorthDepthModeContract.ts',
    'src/contracts/ZavorthDynamicMissionHarnessContract.ts',
    'src/contracts/MnemosDreamCycleContract.ts',
    'src/services/ZavorthDepthModeService.ts',
    'src/services/ZavorthDynamicMissionHarnessService.ts',
    'src/services/MnemosDreamCycleService.ts',
    'src/services/ZavorthNativeAutonomySpineService.ts',
    'src/runtime/agent/AgentRunService.ts',
    'scripts/zavorth-native-autonomy-spine.ts',
    'scripts/zavorth-dynamic-mission-harness.ts',
    'scripts/mnemos-dream-cycle.ts',
    'scripts/zavorth-native-autonomy-spine-check.mjs',
    'tests/services/ZavorthNativeAutonomySpineService.test.ts',
    'tests/services/ZavorthDynamicMissionHarnessAndDreamCycle.test.ts',
    'tests/runtime/agent/AgentRunService.test.ts',
    'docs/native-autonomy-spine.md',
    'docs/dynamic-mission-harness.md',
    'docs/mnemos-dream-cycle.md',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('files', missing.length === 0, `${files.length - missing.length}/${files.length} files`, missing);
}

function markersPresent() {
  const checks = [
    ['src/services/ZavorthExperienceLearningDaemonService.ts', [
      'redactionBeforeClassification',
      'psychologicalInferencesNeverGreen',
      'policyChangesNeverGreen',
    ]],
    ['src/services/ZavorthSkillForgeRuntimeService.ts', [
      'noDirectSkillFileWrites',
      'executableSupportFilesHeldForApproval',
      'materialized: false',
    ]],
    ['src/services/ZavorthChannelLiveCertificationService.ts', [
      'stopRequiredBeforeLiveRoute',
      'stubsNeverDefaultRoute',
      'defaultRouteAllowed',
      'certifyFromChannelMesh',
      'readinessProof',
    ]],
    ['src/services/ZavorthExecutionBackendProviderService.ts', [
      'noLiveMutationWithoutProof',
      'unprovenBackendDryRunOnly',
      'costEstimateRequired',
      'certifyFromTerminalBackendSnapshot',
      'proofOverrides',
    ]],
    ['src/services/ZavorthNativeAutonomySpineService.ts', [
      'pre-turn-recall',
      'post-turn-learning',
      'skill-forge',
      'dynamic-mission-harness',
      'mnemos-dream-cycle',
      'mission preview approve',
      'dream review apply',
      'channel-certification',
      'backend-provider',
      'learn forget',
    ]],
    ['src/services/ZavorthDynamicMissionHarnessService.ts', [
      'previewOnly',
      'noArbitraryCodeExecution',
      'depthCapsEnforced',
      'materializeApprovedMission',
      'createRun',
      'workflow-run-service',
    ]],
    ['src/services/MnemosDreamCycleService.ts', [
      'sourceStoreImmutable',
      'separateCandidateStore',
      'quarantine-secret',
      'approval required to apply candidate memories',
      'shouldRun',
      'schedulerDecisionOnly',
    ]],
    ['src/services/ZavorthDepthModeService.ts', [
      'budgetsHardCapped',
      'noDepthModeBypassesPolicy',
      'adversarial',
    ]],
    ['src/runtime/agent/AgentRunService.ts', [
      'nativeAutonomySpine',
      'applyNativeAutonomySpine',
      'Native autonomy spine reviewed turn',
    ]],
    ['src/zavorth-control/app/api/experience/experienceRouteSupport.ts', [
      'ZavorthNativeAutonomySpineService',
      'nativeAutonomySpine',
      'nativeRunStore: runStore',
    ]],
    ['src/services/experience/ExperienceCoreService.ts', [
      'buildNativeAutonomySpineProjection',
      'rawSecretsSerialized',
      'learningCandidates',
      'skillDrafts',
    ]],
    ['src/services/ZavorthLearningPlaneService.ts', [
      'nativeRunStore',
      'native-autonomy-spine',
      'toNativeRunCandidates',
      'redactSensitiveText',
    ]],
    ['tests/services/ZavorthLearningPlaneService.test.ts', [
      'projects native autonomy spine turn learning',
      'without raw secrets',
    ]],
    ['tests/services/ZavorthNativeAutonomySpineService.test.ts', [
      'assimilates channel mesh readiness',
      'assimilates terminal backend snapshots',
      'dynamic-mission-harness',
      'mnemos-dream-cycle',
    ]],
    ['tests/services/ZavorthDynamicMissionHarnessAndDreamCycle.test.ts', [
      'preview-only adversarial mission plan',
      'durable workflow run without executing workers',
      'separate candidate store',
      'quarantines sensitive psychology',
    ]],
    ['tests/services/experience/ExperienceCoreService.test.ts', [
      'projects native autonomy spine status',
      'without raw prompts',
    ]],
    ['tests/runtime/agent/AgentRunService.test.ts', [
      'can attach the native autonomy spine after a successful turn',
      'without leaking raw secrets',
    ]],
    ['src/sdk/contracts.ts', [
      'ZavorthNativeAutonomySpineContract',
      'ZavorthDynamicMissionHarnessContract',
      'MnemosDreamCycleContract',
      'ZavorthDepthModeContract',
    ]],
    ['src/sdk/index.ts', [
      'ZavorthExperienceLearningDaemonService',
      'ZavorthSkillForgeRuntimeService',
      'ZavorthChannelLiveCertificationService',
      'ZavorthExecutionBackendProviderService',
      'ZavorthDynamicMissionHarnessService',
      'MnemosDreamCycleService',
      'ZavorthDepthModeService',
      'ZavorthNativeAutonomySpineService',
    ]],
    ['package.json', [
      'zavorth:native-autonomy-spine',
      'zavorth:native-autonomy-spine:check',
      'zavorth:dynamic-mission-harness',
      'mnemos:dream-cycle',
    ]],
    ['docs/native-autonomy-spine.md', [
      'Native Autonomy Spine',
      'turno concluido',
      'Skill Forge',
      'Dynamic Mission Harness',
      'Mnemos Dream Cycle',
      'Channel live certification',
      'Execution backend provider',
    ]],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    for (const needle of needles) if (!text.includes(needle)) missing.push(`${file}: ${needle}`);
  }
  return rule('markers', missing.length === 0, missing.length ? `${missing.length} missing` : 'all markers', missing);
}

function cliFixture() {
  const result = runTs('scripts/zavorth-native-autonomy-spine.ts', [
    '--json',
    '--base-prompt=Sempre use 3 bullets. token=secret-token sk-test-123',
    '--channel=telegram',
    '--backend=docker',
  ]);
  return jsonRule('cli-fixture', result, (snapshot) =>
    snapshot.version === 'native-autonomy-spine/v1'
    && snapshot.status === 'ready'
    && snapshot.summary?.organicLearningReady === true
    && snapshot.summary?.skillForgeReady === true
    && snapshot.summary?.dynamicMissionReady === true
    && snapshot.summary?.dreamCycleReady === true
    && snapshot.summary?.liveChannelReady === true
    && snapshot.summary?.backendProviderReady === true
    && snapshot.stages?.map((stage) => stage.id).join(',') === 'pre-turn-recall,post-turn-learning,skill-forge,dynamic-mission-harness,mnemos-dream-cycle,channel-certification,backend-provider,review-center'
    && snapshot.safety?.rawSecretsSerialized === false
    && snapshot.safety?.noLiveMutationWithoutProof === true
    && snapshot.safety?.noArbitraryMissionExecution === true
    && snapshot.safety?.dreamCycleCandidateStoreOnly === true
    && !JSON.stringify(snapshot).includes('secret-token')
    && !JSON.stringify(snapshot).includes('sk-test-123'));
}

function languageFixture() {
  const result = runTs('scripts/zavorth-native-autonomy-spine.ts', [
    '--base-prompt=Prefer short answers. token=secret-token',
  ]);
  const text = `${result.stdout}\n${result.stderr}`;
  return rule(
    'language',
    result.status === 0
      && text.includes('Zavorth Native Autonomy Spine')
      && text.includes('review center')
      && !/transaction plane|policy broker|quarantine/i.test(text)
      && !text.includes('secret-token'),
    result.status === 0 ? 'plain product language' : `exit=${result.status}`,
    [text],
  );
}

function workspaceWire() {
  const text = read('package.json');
  const marker = 'npm run zavorth:native-autonomy-spine:check --silent';
  return rule('workspace-wire', text.includes(marker), text.includes(marker) ? 'wired' : 'missing workspace gate', []);
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
