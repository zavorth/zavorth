#!/usr/bin/env node
/**
 * W8 — focused Skill + Worker mesh QA pack (not the whole monorepo).
 * Covers contracts, install pipeline, trust, executor bind, mesh, router, discovery, exposure.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const tests = [
  // W0
  'tests/contracts/ZavorthSkillWorkerMeshContract.test.ts',
  // W1
  'tests/services/SkillInstallPipelineService.test.ts',
  // W2
  'tests/services/SkillTrustScoreService.test.ts',
  // W3
  'tests/services/SkillExecutorBindingService.test.ts',
  'tests/services/SkillToolRegistryBridge.test.ts',
  // W4
  'tests/services/WorkerMeshService.test.ts',
  'tests/tools/AgentManagerTool.test.ts',
  // W5
  'tests/services/WorkerDelegationRouterService.test.ts',
  // W6
  'tests/services/SkillWorkerDiscoveryService.test.ts',
  // W7
  'tests/runtime/agent/ToolExposureProfile.test.ts',
  'tests/services/PluginOsAgentReadiness.test.ts',
  // W8 integration demo
  'tests/services/SkillWorkerMeshDemo.test.ts',
];

function run(cmd, args, cwd = root) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    windowsHide: true,
    env: process.env,
  });
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log('Skill + Worker mesh QA pack (W8)');
console.log(`root: ${root}`);
console.log(`tests: ${tests.length}`);

run(process.execPath, [
  path.join(root, 'node_modules', 'jest', 'bin', 'jest.js'),
  ...tests,
  '--runInBand',
  '--detectOpenHandles',
]);

// Brand-agnostic regression (product surface only)
run(process.execPath, ['scripts/skill-worker-brand-denylist-check.mjs']);

// Hermetic demo smoke (J1 skill + J2 worker)
run(process.execPath, ['scripts/skill-worker-mesh-demo.mjs']);

console.log('\nSkill + Worker mesh QA pack: OK');
console.log('W9 gate: see docs/product/skill-worker-mesh-qa-gate.md');
