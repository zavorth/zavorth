#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'channel-mesh-consistency-files',
    label: 'Channel Mesh consistency gate files exist',
    target: 'Contract, service, tests, docs and package scripts are present',
    files: [
      'src/contracts/ChannelMeshConsistencyContract.ts',
      'src/services/ChannelMeshConsistencyService.ts',
      'tests/services/ChannelMeshConsistencyService.test.ts',
      'docs/README.md',
      'docs/README.md',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'channel-mesh-consistency-contract',
    label: 'Contract defines Channel Mesh consistency vocabulary',
    target: 'Contract includes status, transport strategy, credential policy, connector routes, simulations and snapshots',
    files: ['src/contracts/ChannelMeshConsistencyContract.ts'],
    needles: [
      'ZAVORTH_CHANNEL_MESH_CONSISTENCY_CONTRACT_VERSION',
      'ChannelMeshConsistencyStatus',
      'ChannelMeshConsistencyTransportStrategy',
      'ChannelMeshCredentialPolicy',
      'ChannelMeshConnectorRoute',
      'ChannelMeshConsistencySimulation',
      'secretValuesSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'channel-mesh-consistency-service',
    label: 'Service maps channel.message inventory into governed connector routes',
    target: 'Service uses normalization, gateway adapter registry, generated plugin manifests and dry simulations',
    files: ['src/services/ChannelMeshConsistencyService.ts'],
    needles: [
      'channel.message',
      'CapabilityNormalizationService',
      'GatewayChannelAdapterRegistryService',
      'buildEntry',
      'generatedPluginManifest',
      'buildSimulation',
      'liveSendRequired: false',
      'bluebubbles',
      'googlechat',
      'webhooks',
    ],
  }),
  ruleContainsAll({
    id: 'channel-mesh-consistency-tests',
    label: 'Tests prove channel consistency behavior',
    target: 'Tests cover native/adapter-backed, bridge/webhook templates, dry simulations, Plugin OS manifests and TLON bridge closure',
    files: ['tests/services/ChannelMeshConsistencyService.test.ts'],
    needles: [
      'private channel inventory',
      'bridge and webhook channels',
      'without live channel sends',
      'Plugin OS kernel',
      'TLON into a governed local bridge route',
      'bluebubbles',
      'googlechat',
      'tlon',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-channel-consistency-gate',
    label: 'package exposes Channel Mesh consistency gate',
    target: 'local QA can run channel-mesh-consistency:check and qa:channel-mesh-consistency',
    files: ['package.json'],
    needles: [
      'channel-mesh-consistency:check',
      'qa:channel-mesh-consistency',
      'scripts/channel-mesh-consistency-check.mjs',
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
  console.log('[channel-mesh-consistency] checking Credential vault');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[channel-mesh-consistency] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
