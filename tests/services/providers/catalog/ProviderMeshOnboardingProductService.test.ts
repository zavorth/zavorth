import {
  ProviderMeshOnboardingProductService,
} from '../../../../src/services/providers/catalog/ProviderMeshOnboardingProductService.js';
import type {
  AccessRouteCatalogEntry,
  ModelFamilyCatalogEntry,
  ModelPickerContract,
  SelectedModelProfile,
} from '../../../../src/services/providers/catalog/ProviderCatalogContracts.js';
import type { ModelPickerServiceResult } from '../../../../src/services/providers/catalog/ModelPickerService.js';
import type { ProviderIntegrationRouteManifest } from '../../../../src/services/providers/catalog/ProviderIntegrationManifest.js';

function family(overrides: Partial<ModelFamilyCatalogEntry>): ModelFamilyCatalogEntry {
  return {
    id: 'openai',
    label: 'OpenAI',
    summary: 'Provider family.',
    vendorId: 'openai',
    providerIds: ['openai'],
    defaultModelName: 'gpt-5.2',
    secondaryModelNames: ['gpt-5.2-mini'],
    fallbackModelNames: ['gpt-5.1'],
    primaryRouteId: 'openai',
    routeIds: ['openai'],
    visibility: 'public',
    readiness: 'ready',
    ready: true,
    issue: null,
    capabilities: ['chat', 'coding', 'tool_use'],
    modalities: ['text'],
    limitations: ['Custo faturado pelo provider.'],
    catalogSource: 'provider_catalog',
    ...overrides,
  };
}

function route(overrides: Partial<AccessRouteCatalogEntry>): AccessRouteCatalogEntry {
  return {
    id: 'openai',
    label: 'OpenAI',
    familyIds: ['openai'],
    vendorId: 'openai',
    providerId: 'openai',
    providerName: 'openai',
    routeKind: 'official',
    mode: 'cloud',
    aliases: ['openai'],
    requirements: ['OPENAI_API_KEY'],
    credentialKind: 'api_key',
    credentialRefs: ['OPENAI_API_KEY'],
    currentModelName: 'gpt-5.2',
    secondaryModelNames: ['gpt-5.2-mini'],
    fallbackModelNames: ['gpt-5.1'],
    readiness: 'ready',
    readinessCode: 'ready',
    ready: true,
    issue: null,
    routeClass: 'official',
    authConfigured: true,
    baseUrlRef: null,
    baseUrlConfigured: true,
    discoverySupported: true,
    connectionId: null,
    providerNodeId: null,
    proxyId: null,
    health: {
      status: 'healthy',
      message: 'ok',
      checkedAt: '2026-05-03T12:00:00.000Z',
    },
    explanation: ['OpenAI usa rota official.', 'credencial configurada; health healthy.', 'Rota pronta.'],
    capabilities: ['chat', 'coding', 'tool_use'],
    modalities: ['text'],
    limitations: ['Custo faturado pelo provider.'],
    fallbackRouteIds: ['openrouter'],
    catalogSource: 'provider_catalog',
    ...overrides,
  };
}

function selected(overrides: Partial<SelectedModelProfile>): SelectedModelProfile {
  return {
    schemaVersion: 1,
    source: 'current-config',
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
    catalogSource: 'provider_catalog',
    readiness: 'ready',
    ready: true,
    fallbackOrder: ['openrouter'],
    fallbackRouteIds: ['openrouter'],
    capabilities: ['chat', 'coding', 'tool_use'],
    modalities: ['text'],
    limitations: ['Custo faturado pelo provider.'],
    identity: {
      familyId: 'openai',
      vendorId: 'openai',
      providerId: 'openai',
      routeId: 'openai',
      routeKind: 'official',
      modelId: 'gpt-5.2',
      credentialRef: 'OPENAI_API_KEY',
      credentialKind: 'api_key',
      catalogSource: 'provider_catalog',
    },
    explanation: ['Selecao fixture.'],
    ...overrides,
  };
}

function registryRoute(routeId: string, providerId = routeId): ProviderIntegrationRouteManifest {
  return {
    routeId,
    label: routeId,
    vendorId: providerId,
    providerId,
    providerName: providerId,
    familyIds: [providerId],
    routeKind: 'official',
    mode: 'cloud',
    aliases: [routeId, providerId],
    authKind: 'api_key',
    credentialRefs: [`${providerId.toUpperCase()}_API_KEY`],
    capabilities: ['chat'],
    modalities: ['text'],
    models: [{ modelId: `${providerId}-model`, label: `${providerId}-model`, primary: true }],
    fallbackRouteIds: [],
    visibility: 'public',
    catalogSource: 'provider_catalog',
    limitations: [],
  };
}

function createPickerResult(): ModelPickerServiceResult {
  const openaiRoute = route({});
  const openrouterRoute = route({
    id: 'openrouter',
    label: 'OpenRouter',
    familyIds: ['openrouter'],
    vendorId: 'openrouter',
    providerId: 'openrouter',
    providerName: 'openrouter',
    routeKind: 'aggregator',
    routeClass: 'aggregator',
    aliases: ['openrouter'],
    requirements: ['OPENROUTER_API_KEY'],
    credentialRefs: ['OPENROUTER_API_KEY'],
    currentModelName: 'openrouter/auto',
    secondaryModelNames: [],
    fallbackModelNames: ['openrouter/fallback'],
    readiness: 'needs_config',
    readinessCode: 'missing_auth',
    ready: false,
    issue: 'Falta configurar OPENROUTER_API_KEY.',
    authConfigured: false,
    health: {
      status: 'unknown',
      message: null,
      checkedAt: null,
    },
    capabilities: ['chat', 'research', 'long_context'],
    limitations: ['Custo e latencia variam por modelo upstream.'],
    fallbackRouteIds: ['openai'],
    catalogSource: 'fallback_catalog',
  });
  const ollamaRoute = route({
    id: 'ollama',
    label: 'Ollama',
    familyIds: ['ollama'],
    vendorId: 'ollama',
    providerId: 'ollama',
    providerName: 'ollama',
    routeKind: 'local_runtime',
    routeClass: 'local',
    mode: 'local',
    aliases: ['ollama'],
    requirements: ['OLLAMA_BASE_URL'],
    credentialKind: 'local_endpoint',
    credentialRefs: ['OLLAMA_BASE_URL'],
    currentModelName: 'llama3.1',
    secondaryModelNames: [],
    fallbackModelNames: [],
    capabilities: ['chat', 'coding', 'local'],
    limitations: ['Depende dos recursos da maquina local.'],
    fallbackRouteIds: ['openai'],
    catalogSource: 'local_catalog',
  });
  const families = [
    family({}),
    family({
      id: 'openrouter',
      label: 'OpenRouter',
      vendorId: 'openrouter',
      providerIds: ['openrouter'],
      defaultModelName: 'openrouter/auto',
      secondaryModelNames: [],
      fallbackModelNames: ['openrouter/fallback'],
      primaryRouteId: 'openrouter',
      routeIds: ['openrouter'],
      readiness: 'needs_config',
      ready: false,
      issue: 'Falta configurar OPENROUTER_API_KEY.',
      capabilities: ['chat', 'research', 'long_context'],
      limitations: ['Custo e latencia variam por modelo upstream.'],
      catalogSource: 'fallback_catalog',
    }),
    family({
      id: 'ollama',
      label: 'Ollama',
      vendorId: 'ollama',
      providerIds: ['ollama'],
      defaultModelName: 'llama3.1',
      secondaryModelNames: [],
      fallbackModelNames: [],
      primaryRouteId: 'ollama',
      routeIds: ['ollama'],
      capabilities: ['chat', 'coding', 'local'],
      limitations: ['Depende dos recursos da maquina local.'],
      catalogSource: 'local_catalog',
    }),
  ];
  const contract: ModelPickerContract = {
    schemaVersion: 1,
    generatedAt: '2026-05-03T12:00:00.000Z',
    families: {
      schemaVersion: 1,
      generatedAt: '2026-05-03T12:00:00.000Z',
      families,
    },
    routes: {
      schemaVersion: 1,
      generatedAt: '2026-05-03T12:00:00.000Z',
      routes: [openaiRoute, openrouterRoute, ollamaRoute],
    },
    profiles: [{
      id: 'coding',
      label: 'Coding',
      summary: 'Coding profile.',
      preferredOrder: ['openai', 'openrouter', 'ollama'],
    }],
    selected: selected({}),
  };

  return {
    schemaVersion: 1,
    generatedAt: '2026-05-03T12:00:00.000Z',
    contract,
    families: [],
    selected: {
      familyId: 'openai',
      routeId: 'openai',
      modelId: 'gpt-5.2',
      providerId: 'openai',
      ready: true,
      explanation: ['fixture'],
    },
    explanation: ['fixture'],
  };
}

describe('ProviderMeshOnboardingProductService', () => {
  it('builds C7 capability-first onboarding from the shared model picker contract', () => {
    const picker = createPickerResult();
    const service = new ProviderMeshOnboardingProductService({
      modelPickerService: {
        buildPicker: jest.fn(() => picker),
      },
      registry: {
        listRoutes: jest.fn(() => [
          registryRoute('openai'),
          registryRoute('openrouter'),
          registryRoute('ollama'),
        ]),
      },
    });

    const result = service.buildProduct({ requestedCapability: 'coding' });
    const snapshot = result.providerMeshOnboarding;
    const coding = snapshot.capabilities.find((entry) => entry.capability === 'coding');

    expect(result.picker).toBe(picker);
    expect(snapshot.status).toBe('ready');
    expect(snapshot.firstQuestion).toEqual(expect.objectContaining({
      id: 'capability',
    }));
    expect(snapshot.selectedCapability).toEqual(expect.objectContaining({
      capability: 'coding',
    }));
    expect(coding).toEqual(expect.objectContaining({
      ready: true,
      routeIds: expect.arrayContaining(['openai', 'ollama']),
      familyIds: expect.arrayContaining(['openai', 'ollama']),
      modelIds: expect.arrayContaining(['gpt-5.2', 'llama3.1']),
      costModel: 'provider_billed',
      latencyModel: 'provider_network',
      catalogSources: expect.arrayContaining(['provider_catalog', 'local_catalog']),
    }));
    expect(coding?.authHealth.readyRouteIds).toEqual(expect.arrayContaining(['openai', 'ollama']));
    expect(coding?.fallbackRouteIds).toEqual(expect.arrayContaining(['openrouter']));
    expect(snapshot.conceptSeparation).toEqual(expect.objectContaining({
      family: true,
      vendor: true,
      provider: true,
      route: true,
      model: true,
      credential: true,
    }));
    expect(snapshot.surfaceParity.consumers).toEqual(expect.arrayContaining([
      'onboarding',
      'providers_page',
      'control',
      'cli',
      'runtime_factory',
    ]));
    expect(snapshot.acceptance).toEqual({
      asksByCapability: true,
      suggestsFamiliesRoutesModels: true,
      validatesAuthAndHealth: true,
      registersFallback: true,
      explainsCostLatencyLimitations: true,
      saysCatalogSource: true,
      sameContractAcrossSurfaces: true,
    });
  });

  it('marks providers without a picker route as incomplete integrations', () => {
    const picker = createPickerResult();
    const service = new ProviderMeshOnboardingProductService({
      modelPickerService: {
        buildPicker: jest.fn(() => picker),
      },
      registry: {
        listRoutes: jest.fn(() => [
          registryRoute('openai'),
          registryRoute('openrouter'),
          registryRoute('ollama'),
          registryRoute('missing-route', 'missing-provider'),
        ]),
      },
    });

    const snapshot = service.buildSnapshot({ requestedCapability: 'research' });

    expect(snapshot.status).toBe('partial');
    expect(snapshot.incompleteProviders).toEqual([
      expect.objectContaining({
        providerId: 'missing-provider',
        routeId: 'missing-route',
      }),
    ]);
    expect(snapshot.acceptance.sameContractAcrossSurfaces).toBe(false);
  });
});
