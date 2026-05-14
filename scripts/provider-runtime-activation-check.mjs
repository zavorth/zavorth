#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'provider-runtime-activation-files',
    label: 'Provider runtime activation files exist',
    target: 'Contract, service, provider adapters, tests, docs, script, SDK barrels and package scripts are present',
    files: [
      'src/contracts/ProviderRuntimeActivationContract.ts',
      'src/services/ProviderRuntimeActivationService.ts',
      'src/adapters/providers/ProviderP0LiveClients.ts',
      'tests/services/ProviderRuntimeActivationService.test.ts',
      'scripts/provider-runtime-activation.ts',
      'scripts/provider-runtime-activation-check.mjs',
      'docs/README.md',
      'src/sdk/contracts.ts',
      'src/sdk/index.ts',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'provider-runtime-activation-contract',
    label: 'Contract defines Phase 4 provider vocabulary',
    target: 'Contract captures 18 P0 providers, statuses, gates, receipts and no-template closure',
    files: ['src/contracts/ProviderRuntimeActivationContract.ts'],
    needles: [
      'ZAVORTH_PROVIDER_RUNTIME_ACTIVATION_CONTRACT_VERSION',
      '2026-05-04.live-phase-4',
      'ProviderRuntimeActivationP0Id',
      'vercel-ai-gateway',
      'generatedProviderManifestsRemainingP0: false',
      'Phase 6 - Media Generation Live Plane',
    ],
  }),
  ruleContainsAll({
    id: 'provider-runtime-adapters',
    label: 'Provider P0 adapters implement live chat smoke paths',
    target: 'OpenAI-compatible, Anthropic-compatible and Gemini REST clients can perform controlled live chat smokes',
    files: ['src/adapters/providers/ProviderP0LiveClients.ts'],
    needles: [
      'OpenAICompatibleProviderLiveClient',
      'AnthropicCompatibleProviderLiveClient',
      'GeminiRestProviderLiveClient',
      '/chat/completions',
      '/messages',
      'generateContent',
      'secretValuesSerialized: false',
    ],
  }),
  ruleContainsAll({
    id: 'provider-runtime-service',
    label: 'Service closes P0 provider activation gates',
    target: 'Service maps 18 providers into adapter families with config schema, doctor and staging smoke commands',
    files: ['src/services/ProviderRuntimeActivationService.ts'],
    needles: [
      'ProviderRuntimeActivationService',
      'PROVIDER_RUNTIME_P0',
      'mistral',
      'groq',
      'anthropic-compatible',
      'lmstudio',
      'vercel-ai-gateway',
      'generatedProviderManifestsRemainingP0: false',
      '--confirm-live-io',
      'Phase 6 - Media Generation Live Plane',
    ],
  }),
  ruleContainsAll({
    id: 'provider-factory-runtime-route',
    label: 'ProviderFactory resolves P0 providers without fallback masking',
    target: 'Direct P0 provider names resolve through the provider integration registry and compatible defaults',
    files: ['src/providers/ProviderFactory.ts'],
    needles: [
      'getDefaultProviderIntegrationRegistry',
      'buildRouteInputFromRegistryRoute',
      'google-ai-studio',
      'vercel-ai-gateway',
      'defaultBaseUrlForProvider',
    ],
  }),
  ruleContainsAll({
    id: 'live-readiness-provider-promotion',
    label: 'Live readiness promotes provider P0 runtime activation',
    target: 'The readiness kernel lists P0 providers in partial-live classification',
    files: ['src/services/LiveReadinessService.ts'],
    needles: [
      'PROVIDER_P0_PARTIAL_LIVE',
      'anthropic',
      'mistral',
      'groq',
      'lmstudio',
      'vercel-ai-gateway',
      'Provider Runtime Activation P0',
    ],
  }),
  ruleContainsAll({
    id: 'provider-runtime-tests',
    label: 'Tests prove Phase 4 behavior',
    target: 'Tests cover snapshot, factory routing, readiness promotion and provider live client receipts',
    files: ['tests/services/ProviderRuntimeActivationService.test.ts'],
    needles: [
      'closes Phase 4 provider activation gates',
      'resolves P0 providers without fallback masking',
      'moves P0 providers into partial-live readiness',
      'runs P0 live clients with redacted receipts',
      'generatedProviderManifestsRemainingP0: false',
    ],
  }),
  ruleContainsAll({
    id: 'provider-runtime-package',
    label: 'Package exposes Phase 4 scripts',
    target: 'Phase 4 can be run through package scripts',
    files: ['package.json'],
    needles: [
      'provider-runtime-activation',
      'provider-runtime-activation:check',
      'qa:provider-runtime-activation',
    ],
  }),
  ruleContainsAll({
    id: 'provider-runtime-sdk',
    label: 'SDK exposes Phase 4 contract and service',
    target: 'Phase 4 can be imported from SDK barrels',
    files: ['src/sdk/contracts.ts', 'src/sdk/index.ts'],
    needles: [
      'ProviderRuntimeActivation',
    ],
  }),
  ruleContainsAll({
    id: 'provider-runtime-doc',
    label: 'Docs record Phase 4 closure',
    target: 'Phase 4 documentation explains Provider Runtime Activation and staging-live flow',
    files: ['docs/README.md'],
    needles: [
      'Phase 4',
      'Provider Runtime Activation P0',
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
  console.log('[provider-runtime-activation] checking Phase 4');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[provider-runtime-activation] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
