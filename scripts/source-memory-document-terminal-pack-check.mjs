#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'source-memory-document-terminal-checkpoint-5-files',
    label: 'Credential vault files exist',
    target: 'contract, memory backend, document adapters, search/fetch service, shell policy, terminal runtime, command and tests are present',
    files: [
      'src/contracts/SourceMemoryDocumentTerminalPackContract.ts',
      'src/adapters/memory/SqliteVecMemoryBackend.ts',
      'src/adapters/documents/PdfExtractionAdapter.ts',
      'src/adapters/documents/ReadabilityExtractionAdapter.ts',
      'src/services/SourceDocumentExtractionService.ts',
      'src/services/SourceSearchFetchService.ts',
      'src/services/ShellSafetyClassifier.ts',
      'src/services/GovernedTerminalRuntime.ts',
      'src/services/SourceMemoryDocumentTerminalPackService.ts',
      'scripts/source-memory-document-terminal-pack.ts',
      'tests/services/SourceMemoryDocumentTerminalPackService.test.ts',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'source-memory-document-terminal-contract',
    label: 'Contract captures memory, document, search and terminal vocabulary',
    target: 'contract includes sqlite vector memory, PDF/Readability artifacts, proxy receipts, shell safety and terminal receipts',
    files: ['src/contracts/SourceMemoryDocumentTerminalPackContract.ts'],
    needles: [
      'MemoryKnowledgeWriteReceipt',
      'MemoryKnowledgeQueryReceipt',
      'DocumentExtractionArtifact',
      'SearchFetchReceipt',
      'ProxyRoutingPolicyReceipt',
      'ShellSafetyReceipt',
      'GovernedTerminalReceipt',
      'sqlite-vec',
      '@mozilla/readability',
      'node-pty',
      'Runtime gateway - Native Companion And Device Capability Pack',
    ],
  }),
  ruleContainsAll({
    id: 'source-memory-backend-functional',
    label: 'Memory backend writes and queries replayable vector records',
    target: 'SqliteVecMemoryBackend persists records, emits receipts and can query by deterministic vectors',
    files: ['src/adapters/memory/SqliteVecMemoryBackend.ts'],
    needles: [
      'SqliteVecMemoryBackend',
      'better-sqlite3',
      'zavorth_memory_records',
      'enc:v1:',
      'aes-256-gcm',
      'decryptAtRestIfNeeded',
      'atRestEncrypted: true',
      'fullFileEncrypted',
      'fullFileEncryptionStatus',
      'applySqlCipherPragmas',
      'verifyFullFileEncryptionProof',
      'SQLCipher driver unavailable',
      'PRAGMA secure_delete = ON; VACUUM;',
      'vectorize',
      'cosineSimilarity',
      'artifactFirst: true',
      'replayable: true',
    ],
  }),
  ruleContainsAcross({
    id: 'source-document-extraction-functional',
    label: 'PDF and HTML extraction create artifacts',
    target: 'PDF and Readability adapters produce artifact-first receipts without live IO',
    files: [
      'src/adapters/documents/PdfExtractionAdapter.ts',
      'src/adapters/documents/ReadabilityExtractionAdapter.ts',
      'src/services/SourceDocumentExtractionService.ts',
    ],
    needles: [
      'PdfExtractionAdapter',
      'fallback-pdf-text-scan',
      'ReadabilityExtractionAdapter',
      '@mozilla/readability',
      'artifact-created',
      'runSmoke',
    ],
  }),
  ruleContainsAcross({
    id: 'source-search-terminal-governed',
    label: 'Search/fetch and terminal are governed',
    target: 'live network and terminal execution require explicit flags, approval and scoped cwd roots',
    files: [
      'src/services/SourceSearchFetchService.ts',
      'src/services/ShellSafetyClassifier.ts',
      'src/services/GovernedTerminalRuntime.ts',
      'src/services/SourceMemoryDocumentTerminalPackService.ts',
    ],
    needles: [
      '--confirm-live-network',
      'Terminal execution is disabled until policy explicitly allows it.',
      'dangerousShellRequiresApproval',
      'scopedCwdRootsRequired',
      'download-pipe-execute',
      'liveProcessSpawned: false',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-source-memory-document-terminal-pack',
    label: 'package exposes Credential vault gates and parser dependencies',
    target: 'operators can inspect, inspect JSON, run check/QA and parser deps are direct',
    files: ['package.json'],
    needles: [
      'source-memory-document-terminal-pack',
      'source-memory-document-terminal-pack:json',
      'source-memory-document-terminal-pack:check',
      'qa:source-memory-document-terminal-pack',
      'pdfjs-dist',
      '@mozilla/readability',
      'jsdom',
    ],
  }),
  runRuntimeRule(),
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
  console.log('[source-memory-document-terminal-pack] checking Credential vault');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[source-memory-document-terminal-pack] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 12)) {
      console.log(`  - ${detail}`);
    }
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function runRuntimeRule() {
  const result = spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/source-memory-document-terminal-pack.ts',
    '--json',
    '--require-pass',
  ], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });

  if (result.status !== 0) {
    return {
      id: 'source-memory-document-terminal-runtime-receipt',
      label: 'Runtime Credential vault receipt passes',
      status: 'failed',
      observed: `exit ${result.status ?? 'unknown'}`,
      target: 'Credential vault command emits a passing memory/document/search/terminal snapshot',
      details: compactDetails(result.error instanceof Error ? result.error.message : '', result.stderr, result.stdout),
    };
  }

  try {
    const receipt = JSON.parse(result.stdout);
    return {
      id: 'source-memory-document-terminal-runtime-receipt',
      label: 'Runtime Credential vault receipt passes',
      status: receipt.status === 'passed' ? 'passed' : 'failed',
      observed: `status=${receipt.status}, documentArtifacts=${receipt.summary?.documentArtifacts}, terminalReceipts=${receipt.summary?.terminalReceipts}`,
      target: 'Credential vault command emits a passing memory/document/search/terminal snapshot',
      details: [
        `packagesPresentInSource=${receipt.summary?.packagesPresentInSource}`,
        `packagesImplementedInZavorth=${receipt.summary?.packagesImplementedInZavorth}`,
        `memoryReceipts=${receipt.summary?.memoryReceipts}`,
        `dangerousCommandsBlocked=${receipt.summary?.dangerousCommandsBlocked}`,
        `liveNetworkPerformed=${receipt.summary?.liveNetworkPerformed}`,
        `liveProcessSpawnedByDefault=${receipt.summary?.liveProcessSpawnedByDefault}`,
        `next=${receipt.commands?.nextStage}`,
      ],
    };
  } catch (error) {
    return {
      id: 'source-memory-document-terminal-runtime-receipt',
      label: 'Runtime Credential vault receipt passes',
      status: 'failed',
      observed: 'invalid JSON receipt',
      target: 'Credential vault command emits a passing memory/document/search/terminal snapshot',
      details: [error instanceof Error ? error.message : String(error), ...compactDetails(result.stderr, result.stdout)],
    };
  }
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

function ruleContainsAcross(input) {
  const contentsByFile = input.files.map((file) => ({
    file,
    contents: read(file),
  }));
  const missingFiles = contentsByFile
    .filter((entry) => entry.contents === null)
    .map((entry) => `missing ${entry.file}`);
  const missingNeedles = input.needles
    .filter((needle) => !contentsByFile.some((entry) => entry.contents?.includes(needle)))
    .map((needle) => `missing ${needle}`);
  const missing = [...missingFiles, ...missingNeedles];
  return {
    id: input.id,
    label: input.label,
    status: missing.length > 0 ? 'failed' : 'passed',
    observed: missing.length > 0 ? `${missing.length} missing marker(s)` : 'all markers present across files',
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

function compactDetails(...values) {
  return values
    .flatMap((value) => String(value || '').split(/\r?\n/g))
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);
}
