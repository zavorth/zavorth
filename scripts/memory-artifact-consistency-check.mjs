#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'memory-artifact-consistency-files',
    label: 'Memory/Artifact consistency gate files exist',
    target: 'Contract, service, tests, docs and package scripts are present',
    files: [
      'src/contracts/MemoryArtifactConsistencyContract.ts',
      'src/services/MemoryArtifactConsistencyService.ts',
      'tests/services/MemoryArtifactConsistencyService.test.ts',
      'docs/README.md',
      'docs/README.md',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'memory-artifact-consistency-contract',
    label: 'Contract defines Memory/Artifact consistency vocabulary',
    target: 'Contract includes surfaces, statuses, primitives, dry proof, source module mappings and read-only policy',
    files: ['src/contracts/MemoryArtifactConsistencyContract.ts'],
    needles: [
      'ZAVORTH_MEMORY_ARTIFACT_CONSISTENCY_CONTRACT_VERSION',
      'MemoryArtifactConsistencySurface',
      'MemoryArtifactConsistencyStatus',
      'MemoryArtifactPrimitive',
      'MemoryArtifactSourceModuleMapping',
      'MemoryArtifactConsistencyDryProof',
      'liveMemoryWriteRequired: false',
      'filesystemReadRequired: false',
      'secretValuesSerialized: false',
      'promotionRequiresExplicitAction: true',
      'reusedArtifactMustCiteOrigin: true',
    ],
  }),
  ruleContainsAll({
    id: 'memory-artifact-consistency-service',
    label: 'Service maps memory/artifact surfaces into governed dry-run entries',
    target: 'Service inspects current memory services, emits Plugin OS manifest, and proves Artifact Memory/receipts/replay without writes',
    files: ['src/services/MemoryArtifactConsistencyService.ts'],
    needles: [
      'MemoryArtifactConsistencyService',
      'ArtifactMemoryService',
      'MemoryWithReceiptsService',
      'RunArtifactReceiptReplayService',
      'memory.recall',
      'memory-lancedb',
      'zavorth.memory.artifact-plane',
      'memoryWritePerformed: false',
      'filesystemReadPerformed: false',
    ],
  }),
  ruleContainsAll({
    id: 'memory-artifact-consistency-catalog',
    label: 'Catalog declares Memory/Artifact primitives',
    target: 'Catalog owns primitive ids and wiki/vector template markers',
    files: ['src/services/MemoryArtifactConsistencyCatalog.ts'],
    needles: [
      'artifact.memory.index',
      'memory.receipt',
      'memory.vector.recall',
      'memory.wiki',
      'MemoryWikiService',
      'upsertPage',
      'searchPages',
    ],
  }),
  ruleContainsAll({
    id: 'memory-artifact-consistency-tests',
    label: 'Tests prove Memory/Artifact consistency behavior',
    target: 'Tests cover current consistency, private inventory mapping, dry proof, explicit gaps and Plugin OS manifest compatibility',
    files: ['tests/services/MemoryArtifactConsistencyService.test.ts'],
    needles: [
      'current Zavorth memory plane without writes',
      'private memory extension inventory',
      'Artifact Memory, Memory With Receipts, and Run Artifact Replay',
      'partial import/export memory support visible',
      'Memory/Artifact Plugin OS manifest',
      'memory-lancedb',
      'memory-wiki',
      'backend-ready',
      'thread-ownership',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-memory-artifact-consistency-gate',
    label: 'package exposes Memory/Artifact consistency gate',
    target: 'local QA can run memory-artifact-consistency:check and qa:memory-artifact-consistency',
    files: ['package.json'],
    needles: [
      'memory-artifact-consistency:check',
      'qa:memory-artifact-consistency',
      'scripts/memory-artifact-consistency-check.mjs',
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
  console.log('[memory-artifact-consistency] checking Surface controls');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[memory-artifact-consistency] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
