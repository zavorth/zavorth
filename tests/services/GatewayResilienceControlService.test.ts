import { GatewayResilienceControlService } from '../../src/services/GatewayResilienceControlService';

describe('GatewayResilienceControlService', () => {
  it('builds a redacted snapshot with policy, configured providers, budget and receipts', async () => {
    const service = new GatewayResilienceControlService({
      providerConfig: {
        getProviders: jest.fn(async () => [
          {
            providerId: 'openai',
            type: 'openai',
            displayName: 'OpenAI',
            enabled: true,
            requiresApiKey: true,
            secretRef: 'secret_openai',
            defaultModel: 'gpt-5.2',
            createdAt: '',
            updatedAt: '',
          },
        ]),
      },
      now: () => new Date('2026-06-16T12:00:00.000Z'),
    });

    const snapshot = await service.buildSnapshot();

    expect(snapshot).toEqual(expect.objectContaining({
      ok: true,
      contractVersion: '2026-06-16.gateway-resilience-control.v1',
      generatedAt: '2026-06-16T12:00:00.000Z',
      budget: expect.objectContaining({ decision: 'allowed' }),
      health: expect.objectContaining({ configuredProviders: 1 }),
      providers: [
        expect.objectContaining({
          providerId: 'openai',
          configured: true,
          secretRef: '[redacted]',
        }),
      ],
    }));
    expect(JSON.stringify(snapshot)).not.toContain('secret_openai');
  });

  it('saves and resets the route policy', async () => {
    const service = new GatewayResilienceControlService({
      providerConfig: { getProviders: jest.fn(async () => []) },
    });

    const saved = await service.applyAction({
      action: 'savePolicy',
      policy: {
        enabled: true,
        primaryProviderId: 'openai',
        fallbackOrder: [{ providerId: 'gemini' }],
        timeoutMs: 5000,
        maxAttempts: 2,
      },
    });

    expect(saved.status).toBe('saved');
    expect(saved.resilience.policy).toEqual(expect.objectContaining({
      enabled: true,
      primaryProviderId: 'openai',
      fallbackOrder: [{ providerId: 'gemini' }],
      timeoutMs: 5000,
      maxAttempts: 2,
    }));

    const reset = await service.applyAction({ action: 'resetPolicy' });
    expect(reset.status).toBe('reset');
    expect(reset.resilience.policy.enabled).toBe(false);
  });

  it('tests a route through ProviderFallbackPolicyService and stores the routing receipt', async () => {
    const invokeWithFallback = jest.fn(async () => ({
      text: 'ok',
      routingReceiptId: 'provider-route:workspace-1:test',
      fallbackUsed: true,
      budgetDecision: 'allowed' as const,
      routingAttempts: [
        { providerId: 'openai', status: 'failed' as const, durationMs: 10, errorCode: 'timeout' },
        { providerId: 'gemini', status: 'succeeded' as const, durationMs: 12 },
      ],
    }));
    const service = new GatewayResilienceControlService({
      providerConfig: { getProviders: jest.fn(async () => []) },
      fallbackPolicy: { invokeWithFallback },
      now: () => new Date('2026-06-16T12:00:00.000Z'),
    });

    const result = await service.applyAction({
      action: 'testRoute',
      workspaceId: 'workspace-1',
      policy: {
        enabled: true,
        primaryProviderId: 'openai',
        fallbackOrder: [{ providerId: 'gemini' }],
        timeoutMs: 5000,
        maxAttempts: 2,
      },
    });

    expect(invokeWithFallback).toHaveBeenCalledWith(expect.objectContaining({
      providerId: 'openai',
      allowFallback: true,
      workspaceId: 'workspace-1',
      resiliencePolicy: expect.objectContaining({
        fallbackOrder: [{ providerId: 'gemini' }],
      }),
    }), expect.any(Array));
    expect(result.status).toBe('tested');
    expect(result.receipt).toEqual(expect.objectContaining({
      receiptId: 'provider-route:workspace-1:test',
      fallbackUsed: true,
      attempts: expect.arrayContaining([
        expect.objectContaining({ providerId: 'gemini', status: 'succeeded' }),
      ]),
    }));
  });
});
