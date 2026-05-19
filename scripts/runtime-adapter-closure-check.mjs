#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'runtime-adapter-closure-files',
    label: 'Runtime adapter closure phase files exist',
    target: 'Contract, service, tests, docs and package scripts are present',
    files: [
      'src/contracts/RuntimeAdapterClosureContract.ts',
      'src/services/RuntimeAdapterClosureService.ts',
      'tests/services/RuntimeAdapterClosureService.test.ts',
      'scripts/runtime-adapter-closure-check.mjs',
      'docs/README.md',
      'docs/README.md',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'runtime-adapter-closure-contract',
    label: 'Contract defines runtime adapter closure vocabulary',
    target: 'Contract includes provider/channel closure entries, summaries, certification link and no-live-IO policy',
    files: ['src/contracts/RuntimeAdapterClosureContract.ts'],
    needles: [
      'ZAVORTH_RUNTIME_ADAPTER_CLOSURE_CONTRACT_VERSION',
      'RuntimeAdapterClosureStatus',
      'RuntimeAdapterClosureEntry',
      'RuntimeAdapterClosureSnapshot',
      'p1-provider-template',
      'p1-channel-webhook-template',
      'generic-provider-runtime',
      'bot-api-channel-runtime',
      'Etapa 12 - Native Capability Closure',
      'liveExternalCallRequired: false',
      'liveChannelSendRequired: false',
      'secretValuesSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'provider-mesh-runtime-closure-service',
    label: 'Provider Mesh promotes generated compatible runtimes out of templates',
    target: 'Generated compatible providers become generic-compatible when a runtime strategy exists',
    files: ['src/services/ProviderMeshParityService.ts'],
    needles: [
      'generic-compatible',
      'openai-compatible-runtime',
      'anthropic-compatible-runtime',
      'local-openai-compatible-runtime',
    ],
  }),
  ruleContainsAll({
    id: 'provider-mesh-runtime-closure-tests',
    label: 'Provider Mesh tests prove generated provider runtime closure',
    target: 'Tests cover OpenAI-compatible, Anthropic-compatible and local compatible examples',
    files: ['tests/services/ProviderMeshParityService.test.ts'],
    needles: [
      'generic-compatible',
      'amazon-bedrock',
      'anthropic-vertex',
      'lmstudio',
    ],
  }),
  ruleContainsAll({
    id: 'channel-mesh-runtime-closure-service',
    label: 'Channel Mesh promotes generated transport runtimes out of templates',
    target: 'Webhook, bot API and local bridge routes are adapter-backed when dry envelopes normalize',
    files: ['src/services/ChannelMeshParityService.ts'],
    needles: [
      'adapter-backed',
      'bot-api-template',
      'generic-webhook-template',
      'local-bridge',
    ],
  }),
  ruleContainsAll({
    id: 'channel-mesh-runtime-closure-tests',
    label: 'Channel Mesh tests prove generated channel runtime closure',
    target: 'Tests cover adapter-backed generated channels and TLON local bridge decision',
    files: ['tests/services/ChannelMeshParityService.test.ts'],
    needles: [
      'adapter-backed',
      'TLON into a governed local bridge route',
      'tlon',
    ],
  }),
  ruleContainsAll({
    id: 'runtime-adapter-closure-service',
    label: 'Service proves Intent model1 closure and certification handoff',
    target: 'Service counts closed provider/channel templates, remaining unsupported channels, and P1 certification gaps',
    files: ['src/services/RuntimeAdapterClosureService.ts'],
    needles: [
      'RuntimeAdapterClosureService',
      'providerTemplatesClosed',
      'channelTemplatesClosed',
      'remainingProviderTemplates',
      'remainingChannelUnsupported',
      'certificationP1Gaps',
      'CHANNEL_RUNTIME_STRATEGIES',
      'noLiveChannelSends',
    ],
  }),
  ruleContainsAll({
    id: 'runtime-adapter-closure-tests',
    label: 'Tests prove Runtime Adapter Closure',
    target: 'Tests cover closure counts, provider template zero, channel template zero and visible TLON decision',
    files: ['tests/services/RuntimeAdapterClosureService.test.ts'],
    needles: [
      'closes provider and channel template runtimes without live IO',
      'providerTemplatesClosed: 40',
      'channelTemplatesClosed: 15',
      'certificationP1Gaps: 0',
      'makes Provider Mesh report zero provider templates',
      'zero unsupported routes after TLON bridge closure',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-runtime-adapter-closure-gates',
    label: 'package exposes Runtime Adapter Closure gates',
    target: 'local QA can run runtime-adapter-closure check',
    files: ['package.json'],
    needles: [
      'runtime-adapter-closure:check',
      'qa:runtime-adapter-closure',
      'scripts/runtime-adapter-closure-check.mjs',
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
  console.log('[runtime-adapter-closure] checking Intent model1');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[runtime-adapter-closure] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
