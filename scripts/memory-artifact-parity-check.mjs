#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'memory-artifact-parity-files',
    label: 'Memory/Artifact parity phase files exist',
    target: 'Contract, service, tests, docs and package scripts are present',
    files: [
      'src/contracts/MemoryArtifactParityContract.ts',
      'src/services/MemoryArtifactParityService.ts',
      'tests/services/MemoryArtifactParityService.test.ts',
      'docs/README.md',
      'docs/README.md',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'memory-artifact-parity-contract',
    label: 'Contract defines Memory/Artifact parity vocabulary',
    target: 'Contract includes surfaces, statuses, primitives, dry proof, source module mappings and read-only policy',
    files: ['src/contracts/MemoryArtifactParityContract.ts'],
    needles: [
      'ZAVORTH_MEMORY_ARTIFACT_PARITY_CONTRACT_VERSION',
      'MemoryArtifactParitySurface',
      'MemoryArtifactParityStatus',
      'MemoryArtifactPrimitive',
      'MemoryArtifactSourceModuleMapping',
      'MemoryArtifactParityDryProof',
      'liveMemoryWriteRequired: false',
      'filesystemReadRequired: false',
      'secretValuesSerialized: false',
      'promotionRequiresExplicitAction: true',
      'reusedArtifactMustCiteOrigin: true',
    ],
  }),
  ruleContainsAll({
    id: 'memory-artifact-parity-service',
    label: 'Service maps memory/artifact surfaces into governed dry-run entries',
    target: 'Service inspects current memory services, emits Plugin OS manifest, and proves Artifact Memory/receipts/replay without writes',
    files: ['src/services/MemoryArtifactParityService.ts'],
    needles: [
      'MemoryArtifactParityService',
      'ArtifactMemoryService',
      'MemoryWithReceiptsService',
      'RunArtifactReceiptReplayService',
      'artifact.memory.index',
      'memory.receipt',
      'memory.recall',
      'memory.vector.recall',
      'memory.wiki',
      'MemoryWikiService',
      'upsertPage',
      'searchPages',
      'memory-lancedb',
      'zavorth.memory.artifact-plane',
      'memoryWritePerformed: false',
      'filesystemReadPerformed: false',
    ],
  }),
  ruleContainsAll({
    id: 'memory-artifact-parity-tests',
    label: 'Tests prove Memory/Artifact parity behavior',
    target: 'Tests cover current parity, private inventory mapping, dry proof, explicit gaps and Plugin OS manifest compatibility',
    files: ['tests/services/MemoryArtifactParityService.test.ts'],
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
    id: 'package-exposes-memory-artifact-parity-gate',
    label: 'package exposes Memory/Artifact parity gate',
    target: 'local QA can run memory-artifact-parity:check and qa:memory-artifact-parity',
    files: ['package.json'],
    needles: [
      'memory-artifact-parity:check',
      'qa:memory-artifact-parity',
      'scripts/memory-artifact-parity-check.mjs',
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
  console.log('[memory-artifact-parity] checking Phase 7');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[memory-artifact-parity] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
