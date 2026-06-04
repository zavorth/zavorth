import { describe, expect, it } from '@jest/globals';
import { ZavorthProviderActivationService } from '../../src/services/ZavorthProviderActivationService.js';

describe('ZavorthProviderActivationService', () => {
  it('builds a governed activation matrix for provider live proof and adapters', async () => {
    const service = new ZavorthProviderActivationService({
      now: () => new Date('2026-05-17T12:00:00.000Z'),
    });

    const snapshot = await service.buildSnapshot({ includeAdvanced: true });

    expect(snapshot.surface).toBe('provider-activation');
    expect(snapshot.summary.routes).toBeGreaterThanOrEqual(70);
    expect(snapshot.summary.nativeAdapters).toBeGreaterThan(0);
    expect(snapshot.summary.openAiCompatibleAdapters).toBeGreaterThan(0);
    expect(snapshot.summary.mediaSpecificAdapters).toBeGreaterThan(0);
    expect(snapshot.summary.executionReady).toBe(snapshot.summary.routes);
    expect(snapshot.summary.needsConnector).toBe(0);
    expect(snapshot.liveProofPlan.some((entry) => entry.command.includes('zavorth providers live --provider'))).toBe(true);
    expect(snapshot.adapterMatrix.native).toEqual(expect.arrayContaining(['gemini', 'openai']));
    expect(snapshot.connectorBacklog).toEqual([]);
    expect(snapshot.safety).toMatchObject({
      noRawProviderSecrets: true,
      noHiddenLiveNetworkCalls: true,
      liveProofRequiresExplicitOperatorAction: true,
      nonCompatibleProvidersNeedTypedConnector: true,
      dashboardCannotExecuteProviderCalls: true,
    });
  });
});
