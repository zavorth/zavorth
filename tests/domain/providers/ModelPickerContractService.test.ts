import {
  ModelPickerContractService,
} from '../../../src/domain/providers/index.js';
import type {
  ProviderCatalogEntry,
  ProviderControlPlaneSelection,
  ProviderProfile,
  ProviderProfileSelection,
} from '../../../src/services/ProviderControlPlaneService.js';
import {
  toModelFamilyCatalog,
  toSelectedModelProfile,
} from '../../../src/services/providers/catalog/ProviderCatalogCompat.js';

function provider(overrides: Partial<ProviderCatalogEntry>): ProviderCatalogEntry {
  return {
    id: 'gemini',
    kind: 'provider',
    label: 'Gemini',
    effectiveProviderName: 'gemini',
    aliases: [],
    visibility: 'public',
    mode: 'cloud',
    summary: 'Default provider.',
    currentModel: 'gemini-2.5-flash',
    requirements: ['GEMINI_API_KEY'],
    readiness: 'ready',
    ready: true,
    issue: null,
    ...overrides,
  };
}

function profile(overrides: Partial<ProviderProfile>): ProviderProfile {
  return {
    id: 'balanced',
    label: 'Balanced',
    summary: 'Balanced profile.',
    preferredOrder: ['gemini'],
    ...overrides,
  };
}

function createProviderControlPlane() {
  const providers = [
    provider({}),
    provider({
      id: 'gemma',
      kind: 'alias',
      label: 'Gemma via Gemini API',
      effectiveProviderName: 'gemini',
      mode: 'alias',
      currentModel: 'gemma-4-31b-it',
    }),
    provider({
      id: 'AIGateway',
      label: 'AIGateway',
      effectiveProviderName: 'AIGateway',
      mode: 'hybrid',
      currentModel: 'qwen-coder',
      readiness: 'needs_probe',
      ready: false,
      issue: 'gateway offline',
    }),
    provider({
      id: 'openai',
      label: 'OpenAI',
      effectiveProviderName: 'openai',
      currentModel: 'gpt-5.2',
    }),
  ];
  const profiles = [
    profile({}),
    profile({
      id: 'coding',
      label: 'Coding',
      summary: 'Coding profile.',
      preferredOrder: ['AIGateway', 'openai', 'gemini'],
    }),
  ];
  const gemmaSelection: ProviderControlPlaneSelection = {
    selectionKind: 'model',
    requestedTarget: 'gemma',
    replyLabel: 'Gemma 4',
    effectiveProviderName: 'gemini',
    modelName: 'gemma-4-31b-it',
  };
  const codingSelection: ProviderProfileSelection = {
    profile: profiles[1],
    target: providers[3],
    selection: {
      selectionKind: 'provider',
      requestedTarget: 'openai',
      replyLabel: 'OpenAI',
      effectiveProviderName: 'openai',
    },
    skippedCandidates: [
      {
        id: 'AIGateway',
        readiness: 'needs_probe',
        issue: 'gateway offline',
      },
    ],
  };

  return {
    listProviders: jest.fn(({ includeAdvanced }: { includeAdvanced?: boolean } = {}) => (
      includeAdvanced ? providers : providers.filter((entry) => entry.visibility === 'public')
    )),
    listProfiles: jest.fn(() => profiles),
    getCurrentConversationalProvider: jest.fn(() => 'gemini'),
    getCurrentConversationalModel: jest.fn(() => 'gemini-2.5-flash'),
    getCurrentModelForProvider: jest.fn((providerName: string) => {
      return providers.find((entry) => entry.effectiveProviderName === providerName)?.currentModel || null;
    }),
    resolveSelection: jest.fn((target: string) => (target === 'gemma' ? gemmaSelection : null)),
    resolveProfileSelection: jest.fn((profileId: string) => (profileId === 'coding' ? codingSelection : null)),
  };
}

describe('ModelPickerContractService', () => {
  it('builds a shared picker contract from the provider control plane', () => {
    const providerControlPlane = createProviderControlPlane();
    const service = new ModelPickerContractService({
      now: () => new Date('2026-05-02T12:00:00.000Z'),
      providerControlPlane,
    });

    const contract = service.buildContract();

    expect(contract.schemaVersion).toBe(1);
    expect(contract.generatedAt).toBe('2026-05-02T12:00:00.000Z');
    expect(contract.families.families.map((entry) => entry.id)).toEqual(['gemini', 'gemma', 'AIGateway', 'openai']);
    expect(contract.routes.routes.find((entry) => entry.id === 'openai')).toEqual(expect.objectContaining({
      providerName: 'openai',
      currentModelName: 'gpt-5.2',
      ready: true,
    }));
    expect(contract.selected).toEqual(expect.objectContaining({
      source: 'current-config',
      providerName: 'gemini',
      modelName: 'gemini-2.5-flash',
      ready: true,
      vendorId: 'google',
      providerId: 'gemini',
      routeKind: 'official',
      credentialKind: 'api_key',
      capabilities: expect.arrayContaining(['chat', 'vision', 'multimodal']),
      modalities: expect.arrayContaining(['text', 'image']),
    }));
    expect(contract.selected.identity).toEqual(expect.objectContaining({
      familyId: 'gemini',
      vendorId: 'google',
      providerId: 'gemini',
      routeId: 'gemini',
      routeKind: 'official',
      credentialRef: 'GEMINI_API_KEY',
      credentialKind: 'api_key',
    }));
  });

  it('explains explicit model target selections', () => {
    const providerControlPlane = createProviderControlPlane();
    const service = new ModelPickerContractService({
      now: () => new Date('2026-05-02T12:00:00.000Z'),
      providerControlPlane,
    });

    const contract = service.buildContract({ selectedTarget: 'gemma' });

    expect(contract.selected).toEqual(expect.objectContaining({
      source: 'target-selection',
      providerName: 'gemini',
      modelName: 'gemma-4-31b-it',
      readiness: 'ready',
    }));
    expect(contract.selected.explanation.join(' ')).toContain('Gemma 4');
  });

  it('keeps profile fallback order and skipped candidates explainable', () => {
    const providerControlPlane = createProviderControlPlane();
    const service = new ModelPickerContractService({
      now: () => new Date('2026-05-02T12:00:00.000Z'),
      providerControlPlane,
    });

    const contract = service.buildContract({ profileId: 'coding' });

    expect(contract.selected).toEqual(expect.objectContaining({
      source: 'profile-selection',
      providerName: 'openai',
      modelName: 'gpt-5.2',
      fallbackOrder: ['AIGateway', 'openai', 'gemini'],
    }));
    expect(contract.selected.explanation.join(' ')).toContain('AIGateway: gateway offline');
  });

  it('serializes the canonical catalog without losing family, route, model and credential identity', () => {
    const providerControlPlane = createProviderControlPlane();
    const service = new ModelPickerContractService({
      now: () => new Date('2026-05-02T12:00:00.000Z'),
      providerControlPlane,
    });

    const serialized = JSON.parse(JSON.stringify(service.buildContract({ includeAdvanced: true })));

    expect(serialized.families.families.find((entry: any) => entry.id === 'gemma')).toEqual(expect.objectContaining({
      vendorId: 'google',
      providerIds: ['gemini'],
      primaryRouteId: 'gemma',
      defaultModelName: 'gemma-4-31b-it',
      catalogSource: 'static',
    }));
    expect(serialized.routes.routes.find((entry: any) => entry.id === 'AIGateway')).toEqual(expect.objectContaining({
      vendorId: 'zavorth',
      providerId: 'aigateway',
      routeKind: 'custom_compatible',
      credentialKind: 'local_endpoint',
      limitations: expect.arrayContaining(['gateway offline', 'Exige probe de runtime antes de selecao automatica.']),
    }));
  });

  it('selects candidates by capability through the shared picker result contract', () => {
    const providerControlPlane = createProviderControlPlane();
    const service = new ModelPickerContractService({
      now: () => new Date('2026-05-02T12:00:00.000Z'),
      providerControlPlane,
    });

    const result = service.selectModel({
      requestedCapability: 'coding',
      preferredProfileId: 'coding',
      includeAdvanced: true,
    });

    expect(result.schemaVersion).toBe(1);
    expect(result.candidates.map((entry) => entry.routeId)).toContain('openai');
    expect(result.selected).toEqual(expect.objectContaining({
      providerName: 'openai',
      routeId: 'openai',
      ready: true,
      capabilities: expect.arrayContaining(['coding']),
    }));
    expect(result.explanation.join(' ')).toContain('coding');
  });

  it('keeps provider catalog compatibility shims independent from the service class', () => {
    const providers = [
      provider({}),
      provider({
        id: 'openrouter',
        label: 'OpenRouter',
        effectiveProviderName: 'openrouter',
        currentModel: 'openrouter/auto',
        requirements: ['OPENROUTER_API_KEY'],
      }),
    ];
    const catalog = toModelFamilyCatalog(providers, '2026-05-02T12:00:00.000Z');
    const selected = toSelectedModelProfile({
      source: 'target-selection',
      providers,
      fallbackOrder: ['openrouter', 'gemini'],
      explanation: ['Selecao solicitada: OpenRouter.'],
      modelName: 'openrouter/auto',
      selection: {
        selectionKind: 'provider',
        requestedTarget: 'openrouter',
        replyLabel: 'OpenRouter',
        effectiveProviderName: 'openrouter',
      },
    });

    expect(catalog.families.find((entry) => entry.id === 'openrouter')).toEqual(expect.objectContaining({
      vendorId: 'openrouter',
      capabilities: expect.arrayContaining(['research']),
    }));
    expect(selected).toEqual(expect.objectContaining({
      providerName: 'openrouter',
      routeKind: 'aggregator',
      fallbackRouteIds: ['gemini'],
    }));
  });
});
