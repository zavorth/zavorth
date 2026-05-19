#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'operational-parity-tooling-files',
    label: 'Operational parity tooling phase files exist',
    target: 'Contract, service, tests, doctor, docs and package scripts are present',
    files: [
      'src/contracts/OperationalParityToolingContract.ts',
      'src/services/OperationalParityToolingService.ts',
      'tests/services/OperationalParityToolingService.test.ts',
      'scripts/operational-parity-tooling-check.mjs',
      'scripts/parity-doctor.ts',
      'docs/README.md',
      'docs/README.md',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'operational-parity-tooling-contract',
    label: 'Contract defines operational parity vocabulary',
    target: 'Contract includes phases, gates, gaps, plugin inventory, commands, certification and read-only policy',
    files: ['src/contracts/OperationalParityToolingContract.ts'],
    needles: [
      'ZAVORTH_OPERATIONAL_PARITY_TOOLING_CONTRACT_VERSION',
      'OperationalParityPhaseId',
      'OperationalParityGate',
      'OperationalParityGap',
      'OperationalParityPluginInventoryItem',
      'OperationalParitySnapshot',
      'checkpoint-8-operational-tooling',
      'liveExternalCallRequired: false',
      'liveChannelSendRequired: false',
      'liveDeviceRequired: false',
      'liveMemoryWriteRequired: false',
      'filesystemReadRequired: false',
      'secretValuesSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'operational-parity-tooling-service',
    label: 'Service aggregates prior parity waves',
    target: 'Service builds one snapshot from capability normalization, provider, channel, satellite, memory and Plugin OS registry',
    files: ['src/services/OperationalParityToolingService.ts'],
    needles: [
      'OperationalParityToolingService',
      'CapabilityNormalizationService',
      'ProviderMeshParityService',
      'ChannelMeshParityService',
      'SatelliteAppParityService',
      'MemoryArtifactParityService',
      'PluginRegistryService',
      'buildSnapshot',
      'formatDoctorText',
      'provider-unsupported-runtime-adapters',
      'channel-template-routes',
      'satellite-native-wrapper-decision',
      'memory-wiki-template',
      'Etapa 9 - Certification',
    ],
  }),
  ruleContainsAll({
    id: 'operational-parity-doctor-script',
    label: 'Parity doctor script exposes operator report',
    target: 'Doctor supports text, JSON, require-pass and require-no-p0 modes',
    files: ['scripts/parity-doctor.ts'],
    needles: [
      'OperationalParityToolingService',
      '--json',
      '--require-pass',
      '--require-no-p0',
      'formatDoctorText',
      'snapshot.summary.p0Gaps',
    ],
  }),
  ruleContainsAll({
    id: 'operational-parity-tooling-tests',
    label: 'Tests prove operational parity aggregation',
    target: 'Tests cover phase rollup, Plugin OS inventory, gap grouping, policy and doctor formatting',
    files: ['tests/services/OperationalParityToolingService.test.ts'],
    needles: [
      'aggregates phases 1-8',
      'registers generated manifests',
      'groups remaining parity gaps without performing live IO',
      'formats a concise operator doctor report',
      'generatedPluginManifests: 72',
      'pluginCapabilities: 98',
      'openGaps: 0',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-operational-parity-gate',
    label: 'package exposes operational parity gates',
    target: 'local QA can run operational parity check and parity doctor',
    files: ['package.json'],
    needles: [
      'operational-parity-tooling:check',
      'qa:operational-parity-tooling',
      'scripts/operational-parity-tooling-check.mjs',
      'parity-doctor',
      'parity-doctor:json',
      'scripts/parity-doctor.ts',
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
  console.log('[operational-parity-tooling] checking Dashboard controls');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[operational-parity-tooling] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
