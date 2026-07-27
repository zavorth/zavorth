#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'provider-channel-smoke-proof-files',
    label: 'Provider/channel smoke proof files exist',
    target: 'Contract, service, tests, docs and package scripts are present',
    files: [
      'src/contracts/ProviderChannelSmokeProofContract.ts',
      'src/services/ProviderChannelSmokeProofService.ts',
      'tests/services/ProviderChannelSmokeProofService.test.ts',
      'scripts/provider-channel-smoke-proof-check.mjs',
      'docs/README.md',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'provider-channel-smoke-contract',
    label: 'Contract defines provider/channel smoke proof vocabulary',
    target: 'Contract captures dry-live harness, receipts, no-live-IO policy and next worker handoff',
    files: ['src/contracts/ProviderChannelSmokeProofContract.ts'],
    needles: [
      'ZAVORTH_PROVIDER_CHANNEL_SMOKE_PROOF_CONTRACT_VERSION',
      '2026-05-04.worker-5',
      'dry-live-harness',
      'operator-live-ready',
      'ProviderSmokeProof',
      'ChannelSmokeProof',
      'ProviderChannelSmokeReceipt',
      'liveExternalCallRequired: false',
      'liveChannelSendRequired: false',
      'Worker 6 - media/voice/web/docs diagnostics closure',
    ],
  }),
  ruleContainsAll({
    id: 'provider-channel-smoke-service',
    label: 'Service builds deterministic provider/channel smoke receipts',
    target: 'Service consumes Provider Mesh and Channel Mesh consistency, emits provider/channel proofs, blocks unsupported entries and avoids live IO',
    files: ['src/services/ProviderChannelSmokeProofService.ts'],
    needles: [
      'ProviderChannelSmokeProofService',
      'ProviderMeshReadinessService',
      'ChannelMeshConsistencyService',
      'buildProviderProof',
      'buildChannelProof',
      'provider-request-envelope',
      'channel-inbound-normalization',
      'channel-outbound-plan',
      'noProviderNetworkCalls: true',
      'noLiveChannelSends: true',
      'liveModeRequiresOperatorApproval: true',
    ],
  }),
  ruleContainsAll({
    id: 'provider-channel-smoke-tests',
    label: 'Tests prove provider/channel smoke behavior',
    target: 'Tests cover full tracked inventories, provider strategies, channel strategies, blocked receipts and no secret values',
    files: ['tests/services/ProviderChannelSmokeProofService.test.ts'],
    needles: [
      'closes provider and channel local/live smoke proof for the tracked inventories',
      'first-class, generic and local providers',
      'native, webhook and local bridge channels',
      'blocks explicit unsupported provider or unmapped channel entries',
      'providerBlocked: 0',
      'channelBlocked: 0',
      'AMAZON_BEDROCK_API_KEY',
      'IMESSAGE_PAIRING_REF',
      'sk-',
    ],
  }),
  ruleContainsAll({
    id: 'provider-channel-smoke-package',
    label: 'package exposes provider/channel smoke proof gate',
    target: 'local QA can run provider-channel-smoke-proof checks',
    files: ['package.json'],
    needles: [
      'provider-channel-smoke-proof:check',
      'qa:provider-channel-smoke-proof',
      'scripts/provider-channel-smoke-proof-check.mjs',
    ],
  }),
  ruleContainsAll({
    id: 'provider-channel-smoke-doc',
    label: 'Private doc records Worker 5 closure',
    target: 'Documentation explains provider/channel local/live smoke closure and next worker',
    files: ['docs/README.md'],
    needles: [
      'Worker 5',
      'Provider Channel Smoke Proof',
      'dry-live-harness',
      'without chamadas externas reais',
      'without real channel sends',
      'Worker 6',
    ],
  }),
  ruleContainsAll({
    id: 'sdk-contracts-exposes-smoke-proof',
    label: 'SDK contracts barrel exposes smoke proof contract',
    target: 'Module SDK contract surface includes Worker 5 public contract',
    files: ['src/sdk/contracts.ts', 'src/sdk/index.ts'],
    needles: [
      'ProviderChannelSmokeProof',
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
  console.log('[provider-channel-smoke-proof] checking Worker 5');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[provider-channel-smoke-proof] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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

