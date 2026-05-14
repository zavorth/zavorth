import type {
  AccessRouteCatalogEntry,
  ModelFamilyCatalogEntry,
  ModelPickerContract,
} from '../../../../src/contracts/ModelPickerContract.js';
import { ModelSelectionService } from '../../../../src/services/providers/catalog/ModelSelectionService.js';

function family(overrides: Partial<ModelFamilyCatalogEntry>): ModelFamilyCatalogEntry {
  return {
    id: 'anthropic',
    label: 'Anthropic',
    summary: 'Claude family.',
    vendorId: 'anthropic',
    providerIds: ['anthropic'],
    defaultModelName: 'claude-sonnet-4.5',
    secondaryModelNames: ['claude-haiku-4.5'],
    fallbackModelNames: ['claude-3.5-sonnet'],
    primaryRouteId: 'anthropic-api',
    routeIds: ['anthropic-api'],
    visibility: 'public',
    readiness: 'ready',
    ready: true,
    issue: null,
    capabilities: ['chat', 'coding'],
    modalities: ['text'],
    limitations: [],
    catalogSource: 'provider_catalog',
    ...overrides,
  };
}

function route(overrides: Partial<AccessRouteCatalogEntry>): AccessRouteCatalogEntry {
  return {
    id: 'anthropic-api',
    label: 'Anthropic API',
    familyIds: ['anthropic'],
    vendorId: 'anthropic',
    providerId: 'anthropic',
    providerName: 'anthropic',
    routeKind: 'official',
    mode: 'cloud',
    aliases: ['claude'],
    requirements: ['ANTHROPIC_API_KEY'],
    credentialKind: 'api_key',
    credentialRefs: ['ANTHROPIC_API_KEY'],
    currentModelName: 'claude-sonnet-4.5',
    secondaryModelNames: ['claude-haiku-4.5'],
    fallbackModelNames: ['claude-3.5-sonnet'],
    readiness: 'ready',
    readinessCode: 'ready',
    ready: true,
    issue: null,
    routeClass: 'official',
    capabilities: ['chat', 'coding'],
    modalities: ['text'],
    limitations: [],
    fallbackRouteIds: ['openai'],
    catalogSource: 'provider_catalog',
    ...overrides,
  };
}

function contract(): ModelPickerContract {
  const anthropic = family({});
  const openaiFamily = family({
    id: 'openai',
    label: 'OpenAI',
    vendorId: 'openai',
    providerIds: ['openai'],
    defaultModelName: 'gpt-5.2',
    secondaryModelNames: [],
    fallbackModelNames: [],
    primaryRouteId: 'openai',
    routeIds: ['openai'],
    capabilities: ['chat', 'coding', 'reasoning'],
    catalogSource: 'live_api',
  });
  const anthropicRoute = route({});
  const openaiRoute = route({
    id: 'openai',
    label: 'OpenAI API',
    familyIds: ['openai'],
    vendorId: 'openai',
    providerId: 'openai',
    providerName: 'openai',
    aliases: [],
    requirements: ['OPENAI_API_KEY'],
    credentialRefs: ['OPENAI_API_KEY'],
    currentModelName: 'gpt-5.2',
    secondaryModelNames: [],
    fallbackModelNames: [],
    fallbackRouteIds: [],
    catalogSource: 'live_api',
    capabilities: ['chat', 'coding', 'reasoning'],
  });

  return {
    schemaVersion: 1,
    generatedAt: '2026-05-03T12:00:00.000Z',
    families: {
      schemaVersion: 1,
      generatedAt: '2026-05-03T12:00:00.000Z',
      families: [anthropic, openaiFamily],
    },
    routes: {
      schemaVersion: 1,
      generatedAt: '2026-05-03T12:00:00.000Z',
      routes: [anthropicRoute, openaiRoute],
    },
    profiles: [],
    selected: {
      schemaVersion: 1,
      source: 'current-config',
      providerName: 'openai',
      providerLabel: 'OpenAI API',
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
      explanation: ['Configuracao atual seleciona OpenAI.'],
    },
  };
}

describe('ModelSelectionService', () => {
  it('resolves a SelectedModelProfile from family, route and model ids', () => {
    const result = new ModelSelectionService().resolve({
      contract: contract(),
      selectedFamilyId: 'anthropic',
      selectedRouteId: 'anthropic-api',
      selectedModelId: 'claude-sonnet-4.5',
    });

    expect(result.primary).toEqual(expect.objectContaining({
      source: 'target-selection',
      familyId: 'anthropic',
      routeId: 'anthropic-api',
      providerName: 'anthropic',
      modelName: 'claude-sonnet-4.5',
      readiness: 'ready',
    }));
    expect(result.secondary.map((entry) => entry.modelName)).toContain('claude-haiku-4.5');
    expect(result.fallbacks.map((entry) => entry.routeId)).toContain('openai');
    expect(result.explanation.join(' ')).toContain('Familia selecionada');
    expect(result.explanation.join(' ')).toContain('Modelo principal');
  });

  it('keeps compatibility fields for current provider/model callers', () => {
    const result = new ModelSelectionService().resolve({
      contract: contract(),
      selectedTarget: 'openai',
      fallbackOrder: ['anthropic'],
    });

    expect(result.compatibility).toEqual(expect.objectContaining({
      providerName: 'openai',
      modelName: 'gpt-5.2',
    }));
    expect(result.compatibility.fallbackOrder).toContain('anthropic');
  });
});
