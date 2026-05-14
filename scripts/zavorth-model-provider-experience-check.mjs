#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleContainsAll({
    id: 'contract',
    label: 'Product-facing provider experience contract exists',
    files: ['src/contracts/ZavorthModelProviderExperienceContract.ts'],
    needles: [
      'ZavorthModelProviderExperienceSnapshot',
      'fast_and_budget',
      'highest_intelligence',
      'local_private',
      'openai_compatible',
      'requiresPolicyBrokerForExternalUse',
    ],
  }),
  ruleContainsAll({
    id: 'service',
    label: 'Curated provider experience service exists',
    files: ['src/services/providers/catalog/ModelProviderExperienceService.ts'],
    needles: [
      'ESSENTIAL_TARGETS',
      'POWER_USER_TARGETS',
      'OpenAI-compatible endpoint',
      'capability_then_readiness_then_cost_privacy',
      'Use any model, but keep provider choice',
    ],
  }),
  ruleContainsAll({
    id: 'essential-providers',
    label: 'Essential providers are covered',
    files: [
      'src/services/providers/catalog/manifests/coreProviders.ts',
      'src/services/providers/catalog/manifests/aggregatorProviders.ts',
      'src/services/providers/catalog/manifests/localAndCustomProviders.ts',
    ],
    needles: [
      'id: \'openai\'',
      'id: \'anthropic\'',
      'id: \'gemini\'',
      'id: \'openrouter\'',
      'id: \'ollama\'',
      'id: \'custom-openai-compatible\'',
    ],
  }),
  ruleContainsAll({
    id: 'power-user-providers',
    label: 'Power-user providers are covered',
    files: [
      'src/services/providers/catalog/manifests/coreProviders.ts',
      'src/services/providers/catalog/manifests/p0ProviderActivationProviders.ts',
      'src/services/providers/catalog/manifests/longTailProviderActivationProviders.ts',
    ],
    needles: [
      'id: \'deepseek\'',
      'compatible(\'mistral\'',
      'compatible(\'groq\'',
      'compatible(\'together\'',
      'compatible(\'xai\'',
      'compatible(\'cerebras\'',
      'managedGateway(\'amazon-bedrock\'',
      'managedGateway(\'azure-openai\'',
    ],
  }),
  ruleContainsAll({
    id: 'cli-script',
    label: 'CLI/script projection exists',
    files: ['scripts/zavorth-model-provider-experience.ts', 'package.json'],
    needles: [
      'zavorth:model-provider-experience',
      'zavorth:model-provider-experience:json',
      'zavorth:model-provider-experience:check',
      'ModelProviderExperienceService',
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
  console.log('[model-provider-experience] checking curated model/provider UX');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[model-provider-experience] ${marker} ${rule.label}: ${rule.observed}`);
    for (const detail of rule.details.slice(0, 8)) {
      console.log(`  - ${detail}`);
    }
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function ruleContainsAll(input) {
  const combined = input.files.map((file) => read(file)).join('\n');
  const missing = [];
  for (const file of input.files) {
    if (!exists(file)) {
      missing.push(`missing ${file}`);
    }
  }
  for (const needle of input.needles) {
    if (!combined.includes(needle)) {
      missing.push(`missing ${needle}`);
    }
  }
  return {
    id: input.id,
    label: input.label,
    status: missing.length > 0 ? 'failed' : 'passed',
    observed: missing.length > 0 ? `${missing.length} missing marker(s)` : 'all markers present',
    details: missing,
  };
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) {
    return '';
  }
  return fs.readFileSync(absolute, 'utf8');
}
