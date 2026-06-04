#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'native-capability-closure-files',
    label: 'Native Capability Closure phase files exist',
    target: 'Contracts, service, tests, docs and package scripts are present',
    files: [
      'src/contracts/NativeCapabilityClosureContract.ts',
      'src/services/NativeCapabilityClosureService.ts',
      'tests/services/NativeCapabilityClosureService.test.ts',
      'scripts/native-capability-closure-check.mjs',
      'docs/README.md',
      'package.json',
    ],
  }),
  ruleFilesExist({
    id: 'native-capability-contract-files',
    label: 'Native capability contract files exist',
    target: 'Speech, voice, file, document, diagnostics, migration and wiki memory contracts are present',
    files: [
      'src/contracts/SpeechContract.ts',
      'src/contracts/VoiceSessionContract.ts',
      'src/contracts/FileTransferContract.ts',
      'src/contracts/DocumentExtractContract.ts',
      'src/contracts/DiagnosticsContract.ts',
      'src/contracts/MigrationContract.ts',
      'src/contracts/HybridMemoryContract.ts',
    ],
  }),
  ruleContainsAll({
    id: 'native-capability-closure-contract',
    label: 'Contract defines native capability closure vocabulary',
    target: 'Contract includes closure status, entries, summary, certification link and no-live-IO policy',
    files: ['src/contracts/NativeCapabilityClosureContract.ts'],
    needles: [
      'ZAVORTH_NATIVE_CAPABILITY_CLOSURE_CONTRACT_VERSION',
      'NativeCapabilityClosureStatus',
      'NativeCapabilityClosureEntry',
      'NativeCapabilityClosureSnapshot',
      'native-speech-contract',
      'native-voice-session-contract',
      'native-document-extract-contract',
      'Etapa 13 - Remaining Runtime Decisions',
      'liveExternalCallRequired: false',
      'filesystemWriteRequired: false',
      'secretValuesSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'speech-contract-vocabulary',
    label: 'Speech contract exposes canonical capability ids',
    target: 'speech.transcribe and speech.synthesize are contract-backed',
    files: ['src/contracts/SpeechContract.ts'],
    needles: ['speech.transcribe', 'speech.synthesize', 'receiptId'],
  }),
  ruleContainsAll({
    id: 'voice-session-contract-vocabulary',
    label: 'Voice session contract exposes canonical capability id',
    target: 'voice.session is contract-backed',
    files: ['src/contracts/VoiceSessionContract.ts'],
    needles: ['voice.session', 'receiptId'],
  }),
  ruleContainsAll({
    id: 'file-transfer-contract-vocabulary',
    label: 'File transfer contract exposes canonical capability id',
    target: 'file.transfer is contract-backed',
    files: ['src/contracts/FileTransferContract.ts'],
    needles: ['file.transfer', 'receiptId'],
  }),
  ruleContainsAll({
    id: 'document-extract-contract-vocabulary',
    label: 'Document extract contract exposes canonical capability id',
    target: 'document.extract is contract-backed',
    files: ['src/contracts/DocumentExtractContract.ts'],
    needles: ['document.extract', 'receiptId'],
  }),
  ruleContainsAll({
    id: 'diagnostics-contract-vocabulary',
    label: 'Diagnostics contract exposes canonical capability id',
    target: 'diagnostics.trace is contract-backed',
    files: ['src/contracts/DiagnosticsContract.ts'],
    needles: ['diagnostics.trace', 'receiptId'],
  }),
  ruleContainsAll({
    id: 'migration-contract-vocabulary',
    label: 'Migration contract exposes canonical capability id',
    target: 'migration.import is contract-backed',
    files: ['src/contracts/MigrationContract.ts'],
    needles: ['migration.import', 'receiptId'],
  }),
  ruleContainsAll({
    id: 'memory-wiki-contract-vocabulary',
    label: 'Memory wiki contract exposes canonical capability id',
    target: 'memory.wiki is contract-backed',
    files: ['src/contracts/HybridMemoryContract.ts'],
    needles: ['memory.wiki', 'receiptId'],
  }),
  ruleContainsAll({
    id: 'capability-normalization-promotes-contracts-service',
    label: 'Capability Normalization promotes contract-backed primitives',
    target: 'Formerly needs-review primitives point at native contract files',
    files: ['src/services/CapabilityNormalizationService.ts'],
    needles: [
      'SpeechContract.ts',
      'VoiceSessionContract.ts',
      'FileTransferContract.ts',
      'DocumentExtractContract.ts',
      'DiagnosticsContract.ts',
      'MigrationContract.ts',
      'native-contract',
    ],
  }),
  ruleContainsAll({
    id: 'capability-normalization-promotes-contracts-tests',
    label: 'Capability Normalization tests prove needs-review zero',
    target: 'Tests assert native-contract primitives are normalized after Intent model2',
    files: ['tests/services/CapabilityNormalizationService.test.ts'],
    needles: [
      'native-contract primitives normalized after Intent model2 closure',
      'no native-contract primitives remain in review',
    ],
  }),
  ruleContainsAll({
    id: 'native-capability-closure-service',
    label: 'Service proves native capability closure and certification handoff',
    target: 'Service counts closed source modules, closed primitives, remaining review gaps and P1 certification gaps',
    files: ['src/services/NativeCapabilityClosureService.ts'],
    needles: [
      'NativeCapabilityClosureService',
      'CLOSED_PRIMITIVES',
      'closedSourceModules',
      'closedPrimitives',
      'remainingCapabilityNeedsReview',
      'certificationP1Gaps',
      'native-memory-wiki-contract',
    ],
  }),
  ruleContainsAll({
    id: 'native-capability-closure-tests',
    label: 'Tests prove Native Capability Closure',
    target: 'Tests cover 19 source modules, 8 primitives, zero needs-review and reduced certification gaps',
    files: ['tests/services/NativeCapabilityClosureService.test.ts'],
    needles: [
      'closes formerly needs-review capability primitives with native contracts',
      'closedSourceModules: 19',
      'closedPrimitives: 8',
      'remainingCapabilityNeedsReview: 0',
      'hands off to certified consistency after remaining runtime decisions close',
      'sourceP1Gaps: 0',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-native-capability-closure-gates',
    label: 'package exposes Native Capability Closure gates',
    target: 'local QA can run native-capability-closure check',
    files: ['package.json'],
    needles: [
      'native-capability-closure:check',
      'qa:native-capability-closure',
      'scripts/native-capability-closure-check.mjs',
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
  console.log('[native-capability-closure] checking Intent model2');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[native-capability-closure] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
