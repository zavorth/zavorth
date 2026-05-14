#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'runtime-family-closure-files',
    label: 'Runtime family closure files exist',
    target: 'Contract, service, focused runtime services, tests, docs and package scripts are present',
    files: [
      'src/contracts/RuntimeFamilyClosureContract.ts',
      'src/services/RuntimeFamilyClosureService.ts',
      'src/services/SpeechRuntimeService.ts',
      'src/services/VoiceSessionService.ts',
      'src/services/FileTransferService.ts',
      'src/services/DocumentExtractService.ts',
      'src/services/DiagnosticsTraceService.ts',
      'src/services/MigrationImportService.ts',
      'src/services/WebExtractService.ts',
      'tests/services/RuntimeFamilyClosureService.test.ts',
      'scripts/runtime-family-closure-check.mjs',
      'docs/README.md',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'runtime-family-closure-contract',
    label: 'Contract defines C6-C9 runtime closure vocabulary',
    target: 'Contract captures media, voice, web, docs, diagnostics and migration closure with no-live-IO policy',
    files: ['src/contracts/RuntimeFamilyClosureContract.ts'],
    needles: [
      'ZAVORTH_RUNTIME_FAMILY_CLOSURE_CONTRACT_VERSION',
      '2026-05-04.worker-6',
      'C6-media',
      'C7-voice',
      'C8-web',
      'C9-docs-diagnostics-migration',
      'RuntimeFamilyClosureReceipt',
      'liveExternalCallRequired: false',
      'artifactBodyReadRequired: false',
      'Worker 7 - final certification and documentation',
    ],
  }),
  ruleContainsAll({
    id: 'runtime-family-closure-service',
    label: 'Service emits runtime family proof entries',
    target: 'Service covers 12 primitives, modes, service paths, adapters, artifacts, receipts and dry-run harness proof',
    files: ['src/services/RuntimeFamilyClosureService.ts'],
    needles: [
      'RuntimeFamilyClosureService',
      'media.generate',
      'media.understand',
      'search.query',
      'web.extract',
      'speech.transcribe',
      'speech.synthesize',
      'voice.session',
      'file.transfer',
      'document.extract',
      'diagnostics.trace',
      'migration.import',
      'noLiveProviderCalls: true',
      'noLiveBrowserNetwork: true',
    ],
  }),
  ruleContainsAll({
    id: 'focused-runtime-services',
    label: 'Focused runtime services exist for previously contract-only paths',
    target: 'Support services produce deterministic plans/results for speech, voice, file, document, diagnostics, migration and web extraction',
    files: [
      'src/services/SpeechRuntimeService.ts',
      'src/services/VoiceSessionService.ts',
      'src/services/FileTransferService.ts',
      'src/services/DocumentExtractService.ts',
      'src/services/DiagnosticsTraceService.ts',
      'src/services/MigrationImportService.ts',
      'src/services/WebExtractService.ts',
    ],
    needles: [
      'export class',
    ],
  }),
  ruleContainsAll({
    id: 'normalization-runtime-targets',
    label: 'Capability normalization points runtime families at executable paths',
    target: 'web.extract and C7/C9 primitives point to concrete Worker 6 service targets',
    files: ['src/services/CapabilityNormalizationService.ts'],
    needles: [
      "primitiveId: 'web.extract'",
      "runtimeStatus: 'native-contract'",
      'src/services/WebExtractService.ts',
      'src/services/SpeechRuntimeService.ts',
      'src/services/VoiceSessionService.ts',
      'src/services/FileTransferService.ts',
      'src/services/DocumentExtractService.ts',
      'src/services/DiagnosticsTraceService.ts',
      'src/services/MigrationImportService.ts',
    ],
  }),
  ruleContainsAll({
    id: 'runtime-family-closure-tests',
    label: 'Tests prove runtime family closure behavior',
    target: 'Tests prove C6-C9 closure, web.extract promotion and deterministic runtime service paths',
    files: ['tests/services/RuntimeFamilyClosureService.test.ts'],
    needles: [
      'closes C6 through C9 with runtime family receipts and no live IO',
      'promotes web.extract to a native runtime proof target',
      'deterministic runtime service paths',
      'sourceModules: 40',
      'modeProofs: 44',
      'runtimeProofs: 12',
      'artifactBodyReadRequired: false',
    ],
  }),
  ruleContainsAll({
    id: 'runtime-family-closure-package',
    label: 'package exposes runtime family closure gate',
    target: 'local QA can run runtime-family-closure checks',
    files: ['package.json'],
    needles: [
      'runtime-family-closure:check',
      'qa:runtime-family-closure',
      'scripts/runtime-family-closure-check.mjs',
    ],
  }),
  ruleContainsAll({
    id: 'runtime-family-closure-doc',
    label: 'Private doc records Worker 6 closure',
    target: 'Documentation explains C6-C9 closure and next worker',
    files: ['docs/README.md'],
    needles: [
      'Worker 6',
      'Runtime Family Closure',
      'C6-media',
      'C7-voice',
      'C8-web',
      'C9-docs-diagnostics-migration',
      'sem chamadas externas reais',
      'Worker 7',
    ],
  }),
  ruleContainsAll({
    id: 'sdk-exposes-runtime-family-closure',
    label: 'SDK barrels expose runtime family closure',
    target: 'Module SDK contract/root surface includes Worker 6 contract and service',
    files: ['src/sdk/contracts.ts', 'src/sdk/index.ts'],
    needles: [
      'RuntimeFamilyClosure',
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
  console.log('[runtime-family-closure] checking Worker 6');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[runtime-family-closure] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
