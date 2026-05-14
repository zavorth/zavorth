import {
  createWave1ProviderWebSearchFetchFixtures,
  normalizeWave1ProviderWebSearchFetchContracts,
} from '../../../src/runtime/external-agents/index.js';

describe('Wave 1 provider web search/fetch fixture parity', () => {
  it('maps search/fetch metadata to Zavorth network policy while live fetch stays blocked', () => {
    const fixtures = createWave1ProviderWebSearchFetchFixtures();
    const normalization = normalizeWave1ProviderWebSearchFetchContracts(fixtures);

    expect(fixtures.map((fixture) => fixture.fixtureCase)).toEqual([
      'web-search-fetch-policy-metadata',
      'web-search-fetch-live-network-blocked',
    ]);
    expect(JSON.stringify(fixtures)).toContain('https://providers.external-executor.invalid/search');
    expect(normalization).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWebSearchFetchProviderContracts/v1',
      providerWebSearchFetchRuntimeIntroduced: false,
      providerWebSearchFetchExecutionAuthority: false,
      sourceWebSdkLoaded: false,
      sourceFetcherLoaded: false,
      sourceBrowserNetworkLoaded: false,
      sourceNetworkAuthority: false,
      sourceEndpointIdsStoredAsEvidenceOnly: true,
      liveNetworkCallsAllowed: false,
      webSearchRequiresApproval: true,
      networkFetchBlocked: true,
      toolExposurePolicyInput: {
        requestedTools: ['web.search', 'network_fetch'],
        requireApprovalFor: ['web.search'],
        blockedTools: ['network_fetch'],
        blockedToolReason: 'provider-web-fetch-live-network-blocked',
      },
      executionGate: expect.objectContaining({
        providerSdkLoaded: false,
        liveProviderCallsAttempted: false,
        sourceModulesCopied: false,
        rawSecretsRead: false,
      }),
    }));
    expect(normalization.contracts).toEqual([
      expect.objectContaining({
        providerId: 'zavorth-provider:wave1-web',
        modes: ['search', 'fetch'],
        networkPolicy: {
          allowedDomains: ['docs.example.invalid', 'support.example.invalid'],
          resultShapes: ['summary', 'document', 'citation'],
          webSearchRequiresApproval: true,
          networkFetchBlocked: true,
          liveNetworkCallsAllowed: false,
          sourceNetworkAuthority: false,
          sourceEndpointStoredAsEvidenceOnly: true,
        },
        liveNetworkCallsAttempted: false,
        sourceFetcherExecuted: false,
        sourceFetcherLoaded: false,
        sourceBrowserNetworkLoaded: false,
        nativeContract: 'ZavorthWebSearchFetchProviderContract/v1',
      }),
      expect.objectContaining({
        modes: ['fetch'],
        networkPolicy: expect.objectContaining({
          allowedDomains: [],
          webSearchRequiresApproval: true,
          networkFetchBlocked: true,
          liveNetworkCallsAllowed: false,
          sourceNetworkAuthority: false,
          sourceEndpointStoredAsEvidenceOnly: true,
        }),
        liveNetworkCallsAttempted: false,
        sourceFetcherExecuted: false,
        sourceFetcherLoaded: false,
        sourceBrowserNetworkLoaded: false,
      }),
    ]);
    expect(normalization.toolExposureProfile.tools).toEqual([
      expect.objectContaining({
        id: 'web.search',
        risk: 'attention',
        requiresApproval: true,
      }),
    ]);
    expect(normalization.toolExposureProfile.blockedTools).toEqual([
      expect.objectContaining({
        id: 'network_fetch',
        reason: 'provider-web-fetch-live-network-blocked',
      }),
    ]);
    expect(JSON.stringify(normalization.contracts)).not.toContain('external-executor');
    expect(JSON.stringify(normalization.contracts)).not.toContain('https://providers.');
  });
});
