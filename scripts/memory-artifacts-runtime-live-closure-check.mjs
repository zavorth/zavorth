#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'memory-artifacts-runtime-live-files',
    label: 'Memory/artifacts/runtime live closure files exist',
    target: 'Contract, services, tests, docs, scripts, SDK barrels and package scripts are present',
    files: [
      'src/contracts/MemoryArtifactsRuntimeLiveClosureContract.ts',
      'src/services/MemoryArtifactsRuntimeLiveClosureService.ts',
      'src/services/MemoryArtifactsRuntimeLiveService.ts',
      'tests/services/MemoryArtifactsRuntimeLiveClosureService.test.ts',
      'scripts/memory-artifacts-runtime-live-closure.ts',
      'scripts/memory-artifacts-runtime-live-closure-check.mjs',
      'docs/README.md',
      'src/sdk/contracts.ts',
      'src/sdk/index.ts',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'memory-artifacts-runtime-contract',
    label: 'Contract defines Phase 12 vocabulary',
    target: 'Contract captures all 11 targets, capabilities, receipts and next phase handoff',
    files: ['src/contracts/MemoryArtifactsRuntimeLiveClosureContract.ts'],
    needles: [
      'ZAVORTH_MEMORY_ARTIFACTS_RUNTIME_LIVE_CLOSURE_CONTRACT_VERSION',
      '2026-05-05.live-phase-12',
      'memory-core',
      'active-memory',
      'memory-wiki',
      'memory-lancedb',
      'thread-ownership',
      'codex',
      'openshell',
      'llm-task',
      'vydra',
      'skill-workshop',
      'acpx',
      'memoryMarkedLiveWithoutWrite: false',
      'artifactsMarkedLiveWithoutReplay: false',
      'runtimeMarkedLiveWithoutExecutionProfile: false',
      'Phase 3 - Channel Live Activation Long Tail',
    ],
  }),
  ruleContainsAll({
    id: 'memory-artifacts-runtime-service',
    label: 'Live service proves memory, artifacts and runtime',
    target: 'Service writes/recalls/forgets memory, persists wiki, indexes/replays artifacts and executes controlled runtime',
    files: ['src/services/MemoryArtifactsRuntimeLiveService.ts'],
    needles: [
      'runMemoryProof',
      'runWikiPersistenceProof',
      'runArtifactIndexReplayProof',
      'runThreadOwnershipProof',
      'runRuntimeExecutorProof',
      'runTaskWorkspaceBridgeProof',
      'execFileAsync',
      'PluginRegistryService',
      'WorkflowRunService',
      'secretValuesSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'memory-artifacts-runtime-closure-service',
    label: 'Closure service maps all Phase 12 targets',
    target: 'Snapshot includes gates for memory, artifacts, ownership, runtime, workflow, plugin and bridge',
    files: ['src/services/MemoryArtifactsRuntimeLiveClosureService.ts'],
    needles: [
      'memory-core',
      'memory-lancedb',
      'thread-ownership',
      'codex',
      'openshell',
      'skill-workshop',
      'acpx',
      'memory-remember',
      'artifact-replay',
      'local-runtime-exec',
      'approval-gate',
    ],
  }),
  ruleContainsAll({
    id: 'memory-artifacts-runtime-readiness-live',
    label: 'Readiness promotes Phase 12 primitives',
    target: 'Memory, runtime, sandbox, task, workspace and bridge primitives become partial-live with Phase 12 gates',
    files: ['src/services/LiveReadinessService.ts'],
    needles: [
      'memory.vector',
      'memory.active',
      'memory.wiki',
      'sandbox.remote',
      'task.orchestrate',
      'workspace.command',
      'bridge.protocol',
      'Phase 12 - Memory, Artifacts, Runtime Executor',
    ],
  }),
  ruleContainsAll({
    id: 'memory-artifacts-runtime-normalization',
    label: 'Capability normalization points to Phase 12 runtime service',
    target: 'Memory, workspace and bridge primitives point to the Phase 12 service and contract',
    files: ['src/services/CapabilityNormalizationService.ts'],
    needles: [
      'memory.vector',
      'memory.active',
      'memory.wiki',
      'workspace.command',
      'bridge.protocol',
      'src/services/MemoryArtifactsRuntimeLiveService.ts',
      'src/contracts/MemoryArtifactsRuntimeLiveClosureContract.ts',
    ],
  }),
  ruleContainsAll({
    id: 'memory-artifacts-runtime-tests',
    label: 'Tests prove Phase 12 behavior',
    target: 'Tests cover snapshot, memory lifecycle, artifact replay, runtime execution and workspace/bridge gates',
    files: ['tests/services/MemoryArtifactsRuntimeLiveClosureService.test.ts'],
    needles: [
      'closes Phase 12 memory, artifacts and runtime gates',
      'writes recalls cites and forgets real memory entries',
      'indexes and replays real artifact bodies',
      'executes a controlled runtime profile',
      'persists task, plugin and ACP bridge receipts',
    ],
  }),
  ruleContainsAll({
    id: 'memory-artifacts-runtime-package',
    label: 'Package exposes Phase 12 scripts',
    target: 'Phase 12 can be run through package scripts',
    files: ['package.json'],
    needles: [
      'memory-artifacts-runtime-live-closure',
      'memory-artifacts-runtime-live-closure:check',
      'qa:memory-artifacts-runtime-live-closure',
    ],
  }),
  ruleContainsAll({
    id: 'memory-artifacts-runtime-sdk-contract',
    label: 'SDK exposes Phase 12 contract',
    target: 'Phase 12 contract is available from SDK contract barrel',
    files: ['src/sdk/contracts.ts'],
    needles: [
      'MemoryArtifactsRuntimeLiveClosureContract',
    ],
  }),
  ruleContainsAll({
    id: 'memory-artifacts-runtime-sdk-services',
    label: 'SDK exposes Phase 12 services',
    target: 'Phase 12 services are available from SDK service barrel',
    files: ['src/sdk/index.ts'],
    needles: [
      'MemoryArtifactsRuntimeLiveClosureService',
      'MemoryArtifactsRuntimeLiveService',
    ],
  }),
  ruleContainsAll({
    id: 'memory-artifacts-runtime-doc',
    label: 'Docs record Phase 12 closure',
    target: 'Documentation explains memory, artifact replay, runtime execution, approvals and handoff',
    files: ['docs/README.md'],
    needles: [
      'Phase 12',
      'Memory, Artifacts And Runtime Executor Live Closure',
      'memory-core',
      'artifact replay',
      'thread ownership',
      'runtime executor',
      'approval',
      'staging-live',
    ],
  }),
];

const failed = rules.filter((rule) => rule.status === 'failed');
const snapshot = {
  generatedAt: new Date().toISOString(),
  status: failed.length > 0 ? 'failed' : 'passed',
  summary: {
    rules: rules.length,
    passed: rules.length - failed.length,
    failed: failed.length,
  },
  rules,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[memory-artifacts-runtime-live-closure] checking Phase 12');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[memory-artifacts-runtime-live-closure] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 8)) {
      console.log(`  - ${detail}`);
    }
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function ruleFilesExist(input) {
  const missing = input.files.filter((file) => !exists(file));
  return {
    id: input.id,
    label: input.label,
    status: missing.length > 0 ? 'failed' : 'passed',
    observed: `${input.files.length - missing.length}/${input.files.length} file(s) present`,
    target: input.target,
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleContainsAll(input) {
  const missing = [];
  for (const file of input.files) {
    const contents = read(file);
    if (contents === null) {
      missing.push(`missing ${file}`);
      continue;
    }
    for (const needle of input.needles) {
      if (!contents.includes(needle)) {
        missing.push(`${file}: missing ${needle}`);
      }
    }
  }
  return {
    id: input.id,
    label: input.label,
    status: missing.length > 0 ? 'failed' : 'passed',
    observed: missing.length > 0 ? `${missing.length} missing marker(s)` : 'all markers present',
    target: input.target,
    details: missing,
  };
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) {
    return null;
  }
  return fs.readFileSync(absolute, 'utf8');
}
