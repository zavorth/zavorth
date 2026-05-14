#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'remaining-runtime-decisions-files',
    label: 'Remaining Runtime Decisions phase files exist',
    target: 'Contract, service, tests, docs and package scripts are present',
    files: [
      'src/contracts/RemainingRuntimeDecisionsContract.ts',
      'src/services/RemainingRuntimeDecisionsService.ts',
      'tests/services/RemainingRuntimeDecisionsService.test.ts',
      'scripts/remaining-runtime-decisions-check.mjs',
      'docs/README.md',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'remaining-runtime-decisions-contract',
    label: 'Contract defines remaining runtime decision vocabulary',
    target: 'Contract includes decisions, entries, summary, certification handoff and no-live-IO policy',
    files: ['src/contracts/RemainingRuntimeDecisionsContract.ts'],
    needles: [
      'ZAVORTH_REMAINING_RUNTIME_DECISIONS_CONTRACT_VERSION',
      'RemainingRuntimeDecisionEntry',
      'tlon-local-bridge',
      'memory-wiki-runtime',
      'satellite-pwa-first',
      'memory-vector-store-backend',
      'certificationOpenGaps',
      'Release certification profile hardening',
      'secretValuesSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'remaining-runtime-decisions-service',
    label: 'Service proves all four decisions are closed',
    target: 'Service consumes channel, satellite, memory and certification snapshots and reports zero remaining gaps',
    files: ['src/services/RemainingRuntimeDecisionsService.ts'],
    needles: [
      'RemainingRuntimeDecisionsService',
      'closedDecisions',
      'remainingChannelUnsupported',
      'remainingSatelliteDecisions',
      'remainingMemoryTemplates',
      'remainingMemoryDecisions',
      'certificationOpenGaps',
      'MemoryVectorStore',
      'PWA-first',
    ],
  }),
  ruleContainsAll({
    id: 'remaining-runtime-tlon-closure',
    label: 'TLON is closed as a local bridge route',
    target: 'Channel Mesh exposes TLON through the governed local bridge route',
    files: ['src/services/ChannelMeshParityService.ts'],
    needles: ['local-bridge', "'tlon'", '_PAIRING_REF'],
  }),
  ruleContainsAll({
    id: 'remaining-runtime-memory-artifact-closure',
    label: 'Memory artifact parity closes wiki and vector backend decisions',
    target: 'Memory parity reports MemoryWikiService and MemoryVectorStore as backend-ready runtime decisions',
    files: ['src/services/MemoryArtifactParityService.ts'],
    needles: [
      'MemoryWikiService',
      'upsertPage',
      'searchPages',
      'MemoryVectorStore',
      'backendReadyWhenAllPresent: true',
    ],
  }),
  ruleContainsAll({
    id: 'remaining-runtime-memory-wiki-runtime',
    label: 'MemoryWikiService provides wiki upsert and search runtime',
    target: 'Wiki memory has Zavorth-native upsert/search methods and receipts',
    files: ['src/services/MemoryWikiService.ts'],
    needles: ['MemoryWikiService', 'upsertPage', 'searchPages', 'receiptId'],
  }),
  ruleContainsAll({
    id: 'remaining-runtime-satellite-wrapper-closure',
    label: 'Satellite native wrapper decision is signed',
    target: 'Satellite parity records PWA-first as the signed wrapper strategy',
    files: ['src/services/SatelliteAppParityService.ts'],
    needles: ['PWA-first is signed', 'nativeWrapperDecision', 'required: false'],
  }),
  ruleContainsAll({
    id: 'remaining-runtime-decisions-tests',
    label: 'Tests prove final runtime decisions and certification readiness',
    target: 'Tests cover four closed decisions, zero underlying gaps and certified parity',
    files: ['tests/services/RemainingRuntimeDecisionsService.test.ts'],
    needles: [
      'closes the four remaining runtime decisions',
      'closedDecisions: 4',
      'certificationOpenGaps: 0',
      'makes the underlying parity snapshots report zero gaps',
      'sourceP1Gaps: 0',
      'sourceP2Gaps: 0',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-remaining-runtime-decisions-gates',
    label: 'package exposes Remaining Runtime Decisions gates',
    target: 'local QA can run remaining-runtime-decisions check',
    files: ['package.json'],
    needles: [
      'remaining-runtime-decisions:check',
      'qa:remaining-runtime-decisions',
      'scripts/remaining-runtime-decisions-check.mjs',
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
  console.log('[remaining-runtime-decisions] checking Phase 13');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[remaining-runtime-decisions] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
