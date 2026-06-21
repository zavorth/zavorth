import { describe, it, expect } from 'vitest';
import type { SelectedModelProfile } from '../../../../src/contracts/ModelPickerContract.js';
import { ProviderCompatibilityClassifier } from '../../../../src/services/providers/catalog/ProviderCompatibilityClassifier.js';

function selected(overrides: Partial<SelectedModelProfile>): SelectedModelProfile {
  return {
    schemaVersion: 1,
    source: 'target-selection',
    providerName: 'openai',
    providerLabel: 'OpenAI',
    modelName: 'gpt-5.2',
    modelLabel: 'gpt-5.2',
    routeId: 'openai',
    familyId: 'openai',
    vendorId: 'openai',
    providerId: 'openai',
    routeKind: 'official',
    credentialKind: 'api_key',
    credentialRef: 'OPENAI_API_KEY',
    catalogSource: 'live_api',
    readiness: 'ready',
    ready: true,
    fallbackOrder: [],
    fallbackRouteIds: [],
    capabilities: ['chat', 'coding'],
    modalities: ['text'],
    limitations: [],
    identity: {
      familyId: 'openai',
      vendorId: 'openai',
      providerId: 'openai',
      routeId: 'openai',
      routeKind: 'official',
      modelId: 'gpt-5.2',
      credentialRef: 'OPENAI_API_KEY',
      credentialKind: 'api_key',
      catalogSource: 'live_api',
    },
    explanation: [],
    ...overrides,
  };
}

describe('ProviderCompatibilityClassifier', () => {
  it('preserves known first-class vendors as bespoke runtime providers', () => {
    const classification = new ProviderCompatibilityClassifier().classify(selected({}));

    expect(classification).toEqual(expect.objectContaining({
      kind: 'bespoke',
      runtimeAdapter: 'bespoke',
      firstClassProvider: true,
      runtimeSupported: true,
    }));
    expect(classification.explanation.join(' ')).toContain('first-class');
  });

  it('classifies long-tail custom routes as OpenAI-compatible', () => {
    const classification = new ProviderCompatibilityClassifier().classify(selected({
      providerName: 'openai-compatible-acme',
      providerLabel: 'Acme Models',
      routeId: 'openai-compatible-acme',
      familyId: 'acme',
      vendorId: 'acme',
      providerId: 'openai-compatible-acme',
      routeKind: 'custom_compatible',
      credentialRef: 'ACME_API_KEY',
      catalogSource: 'fallback_catalog',
    }));

    expect(classification).toEqual(expect.objectContaining({
      kind: 'openai_compatible',
      runtimeAdapter: 'openai_compatible',
      genericCompatible: true,
      baseUrlRequired: true,
      runtimeSupported: true,
    }));
  });

  it('keeps Anthropic-compatible routes explicit when no generic adapter exists', () => {
    const classification = new ProviderCompatibilityClassifier().classify(selected({
      providerName: 'anthropic',
      providerLabel: 'Anthropic API',
      routeId: 'anthropic',
      familyId: 'claude',
      vendorId: 'anthropic',
      providerId: 'anthropic',
      routeKind: 'official',
      credentialRef: 'ANTHROPIC_API_KEY',
      catalogSource: 'provider_catalog',
    }));

    expect(classification).toEqual(expect.objectContaining({
      kind: 'anthropic_compatible',
      runtimeAdapter: 'anthropic_compatible',
      runtimeSupported: true,
    }));
  });
});
