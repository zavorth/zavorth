import { ChannelMeshParityService } from '../../src/services/ChannelMeshParityService.js';
import { ProviderMeshParityService } from '../../src/services/ProviderMeshParityService.js';
import { RuntimeAdapterClosureService } from '../../src/services/RuntimeAdapterClosureService.js';

describe('RuntimeAdapterClosureService Phase 11', () => {
  it('closes provider and channel template runtimes without live IO', () => {
    const snapshot = new RuntimeAdapterClosureService({
      now: () => new Date('2026-05-04T21:00:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-04.phase-11');
    expect(snapshot.status).toBe('closed');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        providerTemplatesClosed: 40,
        channelTemplatesClosed: 15,
        remainingProviderTemplates: 0,
        remainingProviderUnsupported: 0,
        remainingChannelTemplates: 0,
        remainingChannelUnsupported: 0,
        certificationP1Gaps: 0,
        certificationStatus: 'certified',
        releaseReady: true,
        liveExternalCallRequired: false,
        liveChannelSendRequired: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          surface: 'provider.call',
          id: 'amazon-bedrock',
          previousTier: 'p1-provider-template',
          closureStrategy: 'generic-provider-runtime',
          status: 'generic-compatible',
          remainingTier: 'none',
        }),
        expect.objectContaining({
          surface: 'provider.call',
          id: 'anthropic-vertex',
          closureStrategy: 'anthropic-provider-runtime',
        }),
        expect.objectContaining({
          surface: 'provider.call',
          id: 'lmstudio',
          closureStrategy: 'local-provider-runtime',
        }),
        expect.objectContaining({
          surface: 'channel.message',
          id: 'googlechat',
          previousTier: 'p1-channel-webhook-template',
          closureStrategy: 'webhook-channel-runtime',
          status: 'adapter-backed',
        }),
        expect.objectContaining({
          surface: 'channel.message',
          id: 'matrix',
          previousTier: 'p1-channel-bridge-template',
          closureStrategy: 'local-bridge-channel-runtime',
        }),
        expect.objectContaining({
          surface: 'channel.message',
          id: 'feishu',
          previousTier: 'p1-channel-bot-template',
          closureStrategy: 'bot-api-channel-runtime',
        }),
        expect.objectContaining({
          surface: 'channel.message',
          id: 'tlon',
          previousTier: 'p1-channel-bridge-template',
          closureStrategy: 'local-bridge-channel-runtime',
        }),
      ]),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        closureIsRuntimeClassificationOnly: true,
        noProviderCalls: true,
        noLiveChannelSends: true,
        noSecretsSerialized: true,
        unsupportedChannelsStayVisible: true,
      }),
    );
  });

  it('makes Provider Mesh report zero provider templates', () => {
    const providerSnapshot = new ProviderMeshParityService({
      now: () => new Date('2026-05-04T21:10:00.000Z'),
    }).buildSnapshot();

    expect(providerSnapshot.summary).toEqual(
      expect.objectContaining({
        sourceProviders: 47,
        genericCompatible: 41,
        templateReady: 0,
        unsupported: 0,
        unmapped: 0,
        generatedProviderManifests: 40,
        secretValuesSerialized: false,
      }),
    );
  });

  it('makes Channel Mesh report zero unsupported routes after TLON bridge closure', () => {
    const channelSnapshot = new ChannelMeshParityService({
      now: () => new Date('2026-05-04T21:20:00.000Z'),
    }).buildSnapshot();

    expect(channelSnapshot.summary).toEqual(
      expect.objectContaining({
        sourceChannels: 23,
        webhookTemplates: 0,
        bridgeTemplates: 0,
        templateReady: 0,
        unsupported: 0,
        unmapped: 0,
        secretValuesSerialized: false,
      }),
    );
    expect(channelSnapshot.summary.adapterBacked).toBeGreaterThanOrEqual(21);
    expect(channelSnapshot.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          normalizedSourceName: 'tlon',
          status: 'adapter-backed',
        }),
      ]),
    );
  });
});
