#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'media-generation-live-plane-files',
    label: 'Media generation live plane files exist',
    target: 'Contract, service, adapters, tests, docs, script, SDK barrels and package scripts are present',
    files: [
      'src/contracts/MediaGenerationLivePlaneContract.ts',
      'src/services/MediaGenerationLivePlaneService.ts',
      'src/adapters/media/MediaGenerationLiveAdapters.ts',
      'tests/services/MediaGenerationLivePlaneService.test.ts',
      'scripts/media-generation-live-plane.ts',
      'scripts/media-generation-live-plane-check.mjs',
      'docs/README.md',
      'src/sdk/contracts.ts',
      'src/sdk/index.ts',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'media-generation-live-contract',
    label: 'Contract defines Runtime gateway vocabulary',
    target: 'Contract captures modalities, targets, gates, receipts and next phase handoff',
    files: ['src/contracts/MediaGenerationLivePlaneContract.ts'],
    needles: [
      'ZAVORTH_MEDIA_GENERATION_LIVE_PLANE_CONTRACT_VERSION',
      '2026-05-04.live-gate-6',
      'image-generation-core',
      'video-generation-core',
      'audioRoutedToStage7: true',
      'Surface controls - Speech, TTS And Voice Live Plane',
    ],
  }),
  ruleContainsAll({
    id: 'media-generation-live-adapters',
    label: 'Adapters implement image and async media generation',
    target: 'Direct image and async job adapters support artifact-first outputs, polling, status and cancellation',
    files: ['src/adapters/media/MediaGenerationLiveAdapters.ts'],
    needles: [
      'DirectImageGenerationLiveAdapter',
      'AsyncMediaJobGenerationLiveAdapter',
      'getJobStatus',
      'cancelJob',
      'normalizeMediaOutputs',
      'providerEvidence',
    ],
  }),
  ruleContainsAll({
    id: 'media-generation-live-service',
    label: 'Service closes Runtime gateway gates',
    target: 'Service maps eight media generation targets with modality coverage and staging-live commands',
    files: ['src/services/MediaGenerationLivePlaneService.ts'],
    needles: [
      'MediaGenerationLivePlaneService',
      'MEDIA_GENERATION_TARGETS',
      'fal',
      'runway',
      'comfy',
      'minimax',
      'byteplus',
      'volcengine',
      'audioRoutedToStage7: true',
      '--confirm-live-io',
    ],
  }),
  ruleContainsAll({
    id: 'media-generation-live-tests',
    label: 'Tests prove Runtime gateway behavior',
    target: 'Tests cover snapshot, artifact storage, direct image adapter and async video adapter',
    files: ['tests/services/MediaGenerationLivePlaneService.test.ts'],
    needles: [
      'closes Runtime gateway media generation gates',
      'stores direct image output as a GeneratedMediaArtifact',
      'stores async video output as a GeneratedMediaArtifact',
      'exposes job status and cancellation receipts',
      'audioRoutedToStage7: true',
    ],
  }),
  ruleContainsAll({
    id: 'media-generation-live-package',
    label: 'Package exposes Runtime gateway scripts',
    target: 'Runtime gateway can be run through package scripts',
    files: ['package.json'],
    needles: [
      'media-generation-live-plane',
      'media-generation-live-plane:check',
      'qa:media-generation-live-plane',
    ],
  }),
  ruleContainsAll({
    id: 'media-generation-live-sdk',
    label: 'SDK exposes Runtime gateway contract and service',
    target: 'Runtime gateway can be imported from SDK barrels',
    files: ['src/sdk/contracts.ts', 'src/sdk/index.ts'],
    needles: [
      'MediaGenerationLivePlane',
    ],
  }),
  ruleContainsAll({
    id: 'media-generation-live-doc',
    label: 'Docs record Runtime gateway closure',
    target: 'Runtime gateway documentation explains media generation live plane and staging-live flow',
    files: ['docs/README.md'],
    needles: [
      'Runtime gateway',
      'Media Generation Live Plane',
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
  console.log('[media-generation-live-plane] checking Runtime gateway');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[media-generation-live-plane] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
