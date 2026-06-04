#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'operational-readiness-tooling-files',
    label: 'Operational readiness tooling phase files exist',
    target: 'Contract, service, tests, doctor, docs and package scripts are present',
    files: [
      'src/contracts/OperationalReadinessToolingContract.ts',
      'src/services/OperationalReadinessToolingService.ts',
      'tests/services/OperationalReadinessToolingService.test.ts',
      'scripts/operational-readiness-tooling-check.mjs',
      'scripts/release-readiness-doctor.ts',
      'docs/README.md',
      'docs/README.md',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'operational-readiness-tooling-contract',
    label: 'Contract defines operational readiness vocabulary',
    target: 'Contract includes phases, gates, gaps, plugin inventory, commands, certification and read-only policy',
    files: ['src/contracts/OperationalReadinessToolingContract.ts'],
    needles: [
      'ZAVORTH_OPERATIONAL_READINESS_TOOLING_CONTRACT_VERSION',
      'OperationalReadinessPhaseId',
      'OperationalReadinessGate',
      'OperationalReadinessGap',
      'OperationalReadinessPluginInventoryItem',
      'OperationalReadinessSnapshot',
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
    id: 'operational-readiness-tooling-service',
    label: 'Service aggregates prior consistency cycles',
    target: 'Service builds one snapshot from capability normalization, provider, channel, satellite, memory and Plugin OS registry',
    files: ['src/services/OperationalReadinessToolingService.ts'],
    needles: [
      'OperationalReadinessToolingService',
      'CapabilityNormalizationService',
      'ProviderMeshReadinessService',
      'ChannelMeshConsistencyService',
      'SatelliteAppConsistencyService',
      'MemoryArtifactConsistencyService',
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
    id: 'operational-release-readiness-doctor-script',
    label: 'Consistency doctor script exposes operator report',
    target: 'Doctor supports text, JSON, require-pass and require-no-p0 modes',
    files: ['scripts/release-readiness-doctor.ts'],
    needles: [
      'OperationalReadinessToolingService',
      '--json',
      '--require-pass',
      '--require-no-p0',
      'formatDoctorText',
      'snapshot.summary.p0Gaps',
    ],
  }),
  ruleContainsAll({
    id: 'operational-readiness-tooling-tests',
    label: 'Tests prove operational readiness aggregation',
    target: 'Tests cover phase rollup, Plugin OS inventory, gap grouping, policy and doctor formatting',
    files: ['tests/services/OperationalReadinessToolingService.test.ts'],
    needles: [
      'aggregates phases 1-8',
      'registers generated manifests',
      'groups remaining consistency gaps without performing live IO',
      'formats a concise operator doctor report',
      'generatedPluginManifests: expect.any(Number)',
      'pluginCapabilities: expect.any(Number)',
      'toBeGreaterThanOrEqual(72)',
      'toBeGreaterThanOrEqual(98)',
      'openGaps: 0',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-operational-consistency-gate',
    label: 'package exposes operational readiness gates',
    target: 'local QA can run operational readiness check and consistency doctor',
    files: ['package.json'],
    needles: [
      'operational-readiness-tooling:check',
      'qa:operational-readiness-tooling',
      'scripts/operational-readiness-tooling-check.mjs',
      'release-readiness-doctor',
      'release-readiness-doctor:json',
      'scripts/release-readiness-doctor.ts',
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
  console.log('[operational-readiness-tooling] checking ZavorthControl controls');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[operational-readiness-tooling] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
