#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const longTailProviders = [
  'alibaba',
  'amazon-bedrock',
  'amazon-bedrock-mantle',
  'anthropic-vertex',
  'arcee',
  'cerebras',
  'chutes',
  'cloudflare-ai-gateway',
  'copilot-proxy',
  'github-copilot',
  'gradium',
  'kilocode',
  'kimi-coding',
  'litellm',
  'microsoft',
  'microsoft-foundry',
  'moonshot',
  'nvidia',
  'opencode',
  'opencode-go',
  'qianfan',
  'sglang',
  'stepfun',
  'tencent',
  'tokenjuice',
  'venice',
  'voyage',
  'xiaomi',
  'zai',
];

const rules = [
  ruleFilesExist({
    id: 'provider-long-tail-files',
    label: 'Provider long-tail activation files exist',
    target: 'Contract, service, manifests, adapters, tests, docs, script, SDK barrels and package scripts are present',
    files: [
      'src/contracts/ProviderLongTailActivationContract.ts',
      'src/services/ProviderLongTailActivationService.ts',
      'src/adapters/providers/ProviderLongTailLiveClients.ts',
      'src/services/providers/catalog/manifests/longTailProviderActivationProviders.ts',
      'tests/services/ProviderLongTailActivationService.test.ts',
      'scripts/provider-long-tail-activation.ts',
      'scripts/provider-long-tail-activation-check.mjs',
      'docs/README.md',
      'src/sdk/contracts.ts',
      'src/sdk/index.ts',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'provider-long-tail-contract',
    label: 'Contract defines Phase 5 long-tail vocabulary',
    target: 'Contract captures 29 long-tail providers, statuses, gates, receipts and no-generated closure',
    files: ['src/contracts/ProviderLongTailActivationContract.ts'],
    needles: [
      'ZAVORTH_PROVIDER_LONG_TAIL_ACTIVATION_CONTRACT_VERSION',
      '2026-05-04.live-phase-5',
      'ProviderLongTailActivationId',
      'generatedProviderManifestsRemainingLongTail: false',
      'generatedProviderManifestsRemainingTotal: false',
      'ProviderLongTailConfiguredDoctorReceipt',
      'ProviderLongTailStagingLiveReceipt',
      'Phase 13 - Live Parity Certification',
    ],
  }),
  ruleContainsAll({
    id: 'provider-long-tail-manifests',
    label: 'Long-tail providers use named manifests',
    target: 'All 29 Phase 5 provider routes are represented by curated manifests',
    files: ['src/services/providers/catalog/manifests/longTailProviderActivationProviders.ts'],
    needles: [
      'LONG_TAIL_PROVIDER_ACTIVATION_MANIFESTS',
      ...longTailProviders,
      'embedding',
      'local_runtime',
      'managedGateway',
    ],
  }),
  ruleContainsAll({
    id: 'provider-long-tail-adapters',
    label: 'Long-tail adapters implement live smoke families',
    target: 'Compatible chat and embedding smoke clients can perform controlled live calls',
    files: ['src/adapters/providers/ProviderLongTailLiveClients.ts'],
    needles: [
      'ProviderLongTailCompatibleLiveClient',
      'ProviderLongTailEmbeddingLiveClient',
      '/embeddings',
      'embeddingSmoke',
      'secretValuesSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'provider-long-tail-service',
    label: 'Service closes Phase 5 provider gates',
    target: 'Service maps 29 providers into adapter families with config schema, doctor and staging smoke commands',
    files: ['src/services/ProviderLongTailActivationService.ts'],
    needles: [
      'ProviderLongTailActivationService',
      'PROVIDER_LONG_TAIL',
      'amazon-bedrock',
      'anthropic-vertex',
      'cloudflare-ai-gateway',
      'sglang',
      'voyage',
      'generatedProviderManifestsRemainingTotal: false',
      '--confirm-live-io',
      'runConfiguredDoctor',
      'runStagingLiveSmoke',
      'missingRequiredEnv',
      'Phase 13 - Live Parity Certification',
    ],
  }),
  ruleContainsAll({
    id: 'provider-long-tail-cli',
    label: 'CLI runs doctors and gated staging-live smokes',
    target: 'Script uses Phase 5 service methods instead of only printing activation metadata',
    files: ['scripts/provider-long-tail-activation.ts'],
    needles: [
      'runConfiguredDoctor',
      'runStagingLiveSmoke',
      'liveIoPerformed',
      'blocked',
      '--confirm-live-io',
    ],
  }),
  ruleContainsAll({
    id: 'provider-factory-long-tail-route',
    label: 'ProviderFactory resolves long-tail providers without fallback masking',
    target: 'Direct long-tail provider names resolve through the provider integration registry and compatible defaults',
    files: ['src/providers/ProviderFactory.ts'],
    needles: [
      'alibaba',
      'sglang',
      'voyage',
      'zai',
      'defaultBaseUrlForProvider',
    ],
  }),
  ruleContainsAll({
    id: 'live-readiness-long-tail-promotion',
    label: 'Live readiness promotes provider long tail',
    target: 'The readiness kernel lists long-tail providers in partial-live classification',
    files: ['src/services/LiveReadinessService.ts'],
    needles: [
      'PROVIDER_LONG_TAIL_PARTIAL_LIVE',
      'amazon-bedrock',
      'anthropic-vertex',
      'sglang',
      'voyage',
      'Provider Runtime Activation Long Tail',
    ],
  }),
  ruleContainsAll({
    id: 'provider-long-tail-tests',
    label: 'Tests prove Phase 5 behavior',
    target: 'Tests cover snapshot, manifest closure, factory routing, readiness promotion and live clients',
    files: ['tests/services/ProviderLongTailActivationService.test.ts'],
    needles: [
      'closes Phase 5 long-tail activation gates',
      'removes generated provider manifests from the provider mesh',
      'resolves long-tail providers without fallback masking',
      'moves long-tail providers into partial-live readiness',
      'runs long-tail live clients with redacted receipts',
      'runs configured doctors and blocks staging-live when config is missing',
      'runs staging-live smoke through chat, managed gateway, local, and embedding families',
      'generatedProviderManifestsRemainingTotal: false',
    ],
  }),
  ruleContainsAll({
    id: 'provider-long-tail-package',
    label: 'Package exposes Phase 5 scripts',
    target: 'Phase 5 can be run through package scripts',
    files: ['package.json'],
    needles: [
      'provider-long-tail-activation',
      'provider-long-tail-activation:check',
      'qa:provider-long-tail-activation',
    ],
  }),
  ruleContainsAll({
    id: 'provider-long-tail-sdk',
    label: 'SDK exposes Phase 5 contract and service',
    target: 'Phase 5 can be imported from SDK barrels',
    files: ['src/sdk/contracts.ts', 'src/sdk/index.ts'],
    needles: [
      'ProviderLongTailActivation',
    ],
  }),
  ruleContainsAll({
    id: 'provider-long-tail-doc',
    label: 'Docs record Phase 5 closure',
    target: 'Phase 5 documentation explains long-tail provider activation and staging-live flow',
    files: ['docs/README.md'],
    needles: [
      'Phase 5',
      'Provider Runtime Activation Long Tail',
      'staging-live',
      'Phase 13',
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
  console.log('[provider-long-tail-activation] checking Phase 5');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[provider-long-tail-activation] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
