import { ModelPickerService } from '../../src/services/providers/catalog/ModelPickerService.js';
import {
  buildCliModelPicker,
  resolveCliUniversalModelLabel,
  resolveCliUniversalModelProfile,
} from '../../src/cli/ZavorthCliModelPickerHelpers.js';

describe('Zavorth CLI model picker helpers', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resolves CLI model labels through the shared ModelPickerService', () => {
    const buildPicker = jest.spyOn(ModelPickerService.prototype, 'buildPicker')
      .mockReturnValue({
        schemaVersion: 1,
        generatedAt: '2026-05-02T12:00:00.000Z',
        contract: {
          schemaVersion: 1,
          generatedAt: '2026-05-02T12:00:00.000Z',
          families: {
            schemaVersion: 1,
            generatedAt: '2026-05-02T12:00:00.000Z',
            families: [],
          },
          routes: {
            schemaVersion: 1,
            generatedAt: '2026-05-02T12:00:00.000Z',
            routes: [],
          },
          profiles: [],
          selected: {
            schemaVersion: 1,
            source: 'current-config',
            providerName: 'openai',
            providerLabel: 'OpenAI',
            modelName: 'gpt-4o',
            modelLabel: 'gpt-4o',
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
            capabilities: ['chat', 'streaming'],
            modalities: ['text'],
            limitations: [],
            identity: {
              familyId: 'openai',
              vendorId: 'openai',
              providerId: 'openai',
              routeId: 'openai',
              routeKind: 'official',
              modelId: 'gpt-4o',
              credentialRef: 'OPENAI_API_KEY',
              credentialKind: 'api_key',
              catalogSource: 'live_api',
            },
            explanation: ['Configuracao atual seleciona openai/gpt-4o.'],
          },
        },
        families: [{
          id: 'openai',
          label: 'OpenAI',
          summary: 'OpenAI cloud models',
          vendorId: 'openai',
          ready: true,
          readiness: 'ready',
          defaultModelName: 'gpt-4o',
          primaryRouteId: 'openai',
          capabilities: ['chat', 'streaming'],
          modalities: ['text'],
          explanation: ['Familia OpenAI.'],
          routes: [{
            id: 'openai',
            label: 'OpenAI API',
            providerId: 'openai',
            providerName: 'openai',
            routeKind: 'official',
            routeClass: 'official',
            readiness: 'ready',
            readinessCode: 'ready',
            ready: true,
            issue: null,
            credentialRefs: ['OPENAI_API_KEY'],
            baseUrlRef: null,
            catalogSource: 'live_api',
            discoverySupported: true,
            models: [{
              id: 'openai/gpt-4o',
              modelId: 'gpt-4o',
              label: 'gpt-4o',
              routeId: 'openai',
              familyId: 'openai',
              providerId: 'openai',
              source: 'live_api',
              primary: true,
              custom: false,
              imported: false,
              modalities: ['text'],
              capabilities: ['chat', 'streaming'],
            }],
            explanation: ['Rota OpenAI.', 'Catalogo veio de live_api.'],
          }],
        }],
        selected: {
          familyId: 'openai',
          routeId: 'openai',
          modelId: 'gpt-4o',
          providerId: 'openai',
          ready: true,
          explanation: ['Modelo selecionado: gpt-4o.'],
        },
        explanation: ['ModelPickerService montou familia, rota e modelo.'],
      } as any);

    expect(resolveCliUniversalModelLabel()).toBe('gpt-4o');
    expect(resolveCliUniversalModelProfile({ routingPolicy: 'gateway' })).toEqual(expect.objectContaining({
      providerLabel: 'OpenAI',
      modelLabel: 'gpt-4o',
      routingPolicy: 'gateway',
      routeId: 'openai',
      familyId: 'openai',
      supportsTools: true,
      supportsStreaming: true,
    }));
    expect(buildPicker).toHaveBeenCalledWith(expect.objectContaining({ includeAdvanced: true }));
  });

  it('lets the CLI pass family, route and model choices into the same picker', () => {
    const buildPicker = jest.spyOn(ModelPickerService.prototype, 'buildPicker')
      .mockReturnValue({
        schemaVersion: 1,
        generatedAt: '2026-05-02T12:00:00.000Z',
        contract: { selected: {} },
        families: [],
        selected: {
          familyId: 'anthropic',
          routeId: 'anthropic-api',
          modelId: 'claude-sonnet-4.5',
          providerId: 'anthropic',
          ready: true,
          explanation: [],
        },
        explanation: [],
      } as any);

    expect(buildCliModelPicker({
      selectedFamilyId: 'anthropic',
      selectedRouteId: 'anthropic-api',
      selectedModelId: 'claude-sonnet-4.5',
    }).selected).toEqual(expect.objectContaining({
      familyId: 'anthropic',
      routeId: 'anthropic-api',
      modelId: 'claude-sonnet-4.5',
    }));
    expect(buildPicker).toHaveBeenCalledWith(expect.objectContaining({
      includeAdvanced: true,
      selectedFamilyId: 'anthropic',
      selectedRouteId: 'anthropic-api',
      selectedModelId: 'claude-sonnet-4.5',
    }));
  });
});
