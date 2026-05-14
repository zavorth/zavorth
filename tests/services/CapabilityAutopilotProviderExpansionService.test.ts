import { CapabilityAutopilotProviderExpansionService } from '../../src/services/CapabilityAutopilotProviderExpansionService';

const FIXED_NOW = new Date('2026-04-26T00:00:00.000Z');

function createService() {
  return new CapabilityAutopilotProviderExpansionService({
    now: () => FIXED_NOW,
  });
}

describe('CapabilityAutopilotProviderExpansionService', () => {
  it('builds a provider expansion snapshot across executor, provider, local runtime and channel targets', async () => {
    const service = createService();

    const snapshot = await service.buildExpansionSnapshot({
      targets: [
        { id: 'executor-gemini-cli', kind: 'capability', required: true },
        { id: 'gemini', kind: 'integration', required: true },
        { id: 'external-executor', kind: 'integration', required: true },
        { id: 'telegram', kind: 'integration', required: true },
      ],
    });

    expect(snapshot).toMatchObject({
      profile: 'capability-autopilot-provider-expansion',
      adapters: {
        executionGatewayRunner: 'available',
        fallbackSelection: 'available',
        autoFallbackExecuted: false,
      },
      coverage: {
        requiredTargets: 4,
        coveredRequiredTargets: 4,
        capabilityTargets: 1,
        integrationTargets: 3,
      },
    });
    expect(snapshot.coverage.remoteProviders).toBeGreaterThanOrEqual(1);
    expect(snapshot.coverage.localRuntimes).toBeGreaterThanOrEqual(1);
    expect(snapshot.coverage.channels).toBeGreaterThanOrEqual(1);
    expect(snapshot.entries.every((entry) => entry.explicitFallbackRequired)).toBe(true);
    expect(snapshot.entries.every((entry) => entry.autoFallbackExecuted === false)).toBe(true);
  });

  it('marks provider issues as configuration/readiness state instead of failing the expansion', async () => {
    const service = createService();

    const snapshot = await service.buildExpansionSnapshot({
      targets: [
        { id: 'openai', kind: 'integration', required: true },
        { id: 'openrouter', kind: 'integration', required: true },
      ],
    });

    expect(snapshot.coverage.coveredRequiredTargets).toBe(2);
    expect(snapshot.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'openai',
        kind: 'integration',
        category: 'provider',
        manifestFound: true,
      }),
      expect.objectContaining({
        id: 'openrouter',
        kind: 'integration',
        category: 'provider',
        manifestFound: true,
      }),
    ]));
    expect(snapshot.recommendations.some((entry) => entry.includes('need configuration'))).toBe(true);
  });
});
