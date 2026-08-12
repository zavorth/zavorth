import { ProviderStrategyService } from '../../src/services/ProviderStrategyService';

describe('ProviderStrategyService', () => {
  it('prefers the learned provider and model when workspace memory has strong history', () => {
    const service = new ProviderStrategyService({
      providerControlPlaneService: {
        recommendProfileForTask: () => ({
          profile: {
            id: 'coding',
            label: 'Coding',
            summary: 'Prioriza coding',
            preferredOrder: ['aigateway', 'openai', 'gemini'],
          },
          strategy: {
            providerName: 'aigateway',
            modelName: 'AIGateway-coder',
            fallbackOrder: ['openai', 'gemini'],
          },
          selectedModelProfile: {
            schemaVersion: 1,
            source: 'target-selection',
            providerName: 'aigateway',
            providerLabel: 'AIGateway',
            modelName: 'AIGateway-coder',
            modelLabel: 'AIGateway-coder',
            routeId: 'AIGateway',
            familyId: 'AIGateway',
            vendorId: 'zavorth',
            providerId: 'aigateway',
            routeKind: 'custom_compatible',
            credentialKind: 'local_endpoint',
            credentialRef: 'AIGateway_BASE_URL',
            catalogSource: 'runtime_config',
            readiness: 'ready',
            ready: true,
            fallbackOrder: ['openai', 'gemini'],
            fallbackRouteIds: ['openai', 'gemini'],
            capabilities: ['coding'],
            modalities: ['text'],
            limitations: [],
            identity: {
              familyId: 'AIGateway',
              vendorId: 'zavorth',
              providerId: 'aigateway',
              routeId: 'AIGateway',
              routeKind: 'custom_compatible',
              modelId: 'AIGateway-coder',
              credentialRef: 'AIGateway_BASE_URL',
              credentialKind: 'local_endpoint',
              catalogSource: 'runtime_config',
            },
            explanation: ['Familia selecionada: AIGateway.', 'Rota selecionada: AIGateway.'],
          },
          selectionExplanation: ['Familia selecionada: AIGateway.', 'Rota selecionada: AIGateway.'],
          fallbackProfiles: [],
        }),
      },
    });

    const decision = service.resolve({
      taskKind: 'code',
      taskSubtype: 'review',
      configuredProviderName: 'gemini',
      isProviderUsable: (name) => ['aigateway', 'openai', 'gemini'].includes(name),
      workspaceMemory: {
        task_subtype_llm_recommendations: [
          {
            kind: 'code',
            subtype: 'review',
            preferred_provider: 'AIGateway',
            preferred_model: 'AIGateway-coder',
            success_count: 4,
            confidence: 'high',
          },
        ],
      },
    });

    expect(decision).toEqual(
      expect.objectContaining({
        providerName: 'aigateway',
        modelName: 'AIGateway-coder',
        selectionSource: 'learned',
        profileId: 'coding',
        routeId: 'AIGateway',
        familyId: 'AIGateway',
      }),
    );
    expect(decision.rationale.join(' ')).toContain('Memoria operacional recomenda AIGateway/AIGateway-coder');
    expect(decision.rationale.join(' ')).toContain('Selecao canonica: familia AIGateway, rota AIGateway');
  });

  it('keeps the configured provider when there is no stronger signal', () => {
    const service = new ProviderStrategyService({
      providerControlPlaneService: {
        recommendProfileForTask: () => ({
          profile: {
            id: 'balanced',
            label: 'Balanced',
            summary: 'Equilibrado',
            preferredOrder: ['gemini', 'openai'],
          },
          strategy: {
            providerName: 'gemini',
            modelName: 'gemini-2.5-flash',
            fallbackOrder: ['openai'],
          },
        }),
      },
    });

    const decision = service.resolve({
      taskKind: 'research',
      taskSubtype: 'summarization',
      configuredProviderName: 'gemini',
      isProviderUsable: (name) => ['gemini', 'openai'].includes(name),
    });

    expect(decision.selectionSource).toBe('configured');
    expect(decision.providerName).toBe('gemini');
  });
});
