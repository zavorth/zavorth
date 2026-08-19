import type { ChannelAdapterStatus, ChannelFeatureSet } from '../../src/contracts/ChannelMeshContract.js';
import { ProviderChannelSmokeProofService } from '../../src/services/ProviderChannelSmokeProofService.js';
import { ProviderMeshReadinessService } from '../../src/services/ProviderMeshReadinessService.js';
import { ChannelMeshConsistencyService } from '../../src/services/ChannelMeshConsistencyService.js';

const features = (overrides: Partial<ChannelFeatureSet> = {}): ChannelFeatureSet => ({
  inbound: true,
  outbound: true,
  sessionList: true,
  sessionHistory: true,
  sessionSend: true,
  sessionSpawn: false,
  attachments: true,
  threads: true,
  groupPolicy: true,
  identityHints: true,
  approvals: true,
  rateLimit: true,
  webhook: false,
  localBridge: false,
  doctor: true,
  ...overrides,
});

const adapter = (overrides: Partial<ChannelAdapterStatus>): ChannelAdapterStatus => ({
  id: 'slack',
  label: 'Slack',
  readiness: 'ready',
  implementationState: 'full',
  configured: true,
  transport: 'native',
  notes: ['worker 5 test adapter'],
  features: features(),
  ...overrides,
});

describe('ProviderChannelSmokeProofService Worker 5', () => {
  it('closes provider and channel mock/live smoke proof for the tracked inventories', () => {
    const snapshot = new ProviderChannelSmokeProofService({
      now: () => new Date('2026-05-04T23:55:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-04.worker-5');
    expect(snapshot.status).toBe('closed');
    expect(snapshot.mode).toBe('dry-live-harness');
    expect(snapshot.summary.providers).toBeGreaterThan(40);
    expect(snapshot.summary.channels).toBeGreaterThan(20);
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        providerBlocked: 0,
        channelBlocked: 0,
        liveExternalCallRequired: false,
        liveChannelSendRequired: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.summary.providerSmokeProofs).toBe(snapshot.summary.providers);
    expect(snapshot.summary.channelSmokeProofs).toBe(snapshot.summary.channels);
    expect(snapshot.summary.receipts).toBe(snapshot.summary.providers + snapshot.summary.channels);
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        noProviderNetworkCalls: true,
        noLiveChannelSends: true,
        noSecretsSerialized: true,
        mockHarnessIsDeterministic: true,
        liveModeRequiresOperatorApproval: true,
        artifactsAndReceiptsRequired: true,
      }),
    );
  });

  it('builds provider smoke receipts for first-class, generic and local providers', () => {
    const service = new ProviderChannelSmokeProofService();
    const providerMesh = new ProviderMeshReadinessService();

    const openai = service.buildProviderProof(providerMesh.buildEntry('openai'));
    const amazonBedrock = service.buildProviderProof(providerMesh.buildEntry('amazon-bedrock'));
    const lmstudio = service.buildProviderProof(providerMesh.buildEntry('lmstudio'));

    expect(openai).toEqual(
      expect.objectContaining({
        normalizedSourceName: 'openai',
        status: 'local-proven',
        adapterStrategy: 'bespoke-runtime',
        receipt: expect.objectContaining({
          status: 'passed',
          artifactKind: 'provider.smoke.artifact',
          receiptKind: 'provider.smoke.receipt',
          noLiveIo: true,
        }),
      }),
    );
    expect(amazonBedrock).toEqual(
      expect.objectContaining({
        normalizedSourceName: 'amazon-bedrock',
        status: 'local-proven',
        adapterStrategy: 'openai-compatible-runtime',
        credentialRefs: ['AMAZON_BEDROCK_API_KEY', 'AMAZON_BEDROCK_BASE_URL'],
      }),
    );
    expect(lmstudio).toEqual(
      expect.objectContaining({
        normalizedSourceName: 'lmstudio',
        status: 'local-proven',
        adapterStrategy: 'local-openai-compatible-runtime',
        requestEnvelope: expect.objectContaining({
          dryRun: true,
          providerId: 'lmstudio',
        }),
      }),
    );
    expect(openai.steps.map((step) => step.kind)).toEqual([
      'runtime-target-resolution',
      'credential-policy-redaction',
      'provider-request-envelope',
      'provider-artifact-receipt',
    ]);
    expect(JSON.stringify([openai, amazonBedrock, lmstudio])).not.toContain('sk-');
  });

  it('builds channel smoke receipts for native, webhook and local bridge channels', () => {
    const channelMesh = new ChannelMeshConsistencyService({
      adapterStatuses: [
        adapter({ id: 'slack', label: 'Slack' }),
      ],
      sourceChannels: ['slack', 'googlechat', 'bluebubbles'],
    });
    const service = new ProviderChannelSmokeProofService({
      channelMeshConsistencyService: channelMesh,
    });

    const slack = service.buildChannelProof(channelMesh.buildEntry('slack'));
    const googleChat = service.buildChannelProof(channelMesh.buildEntry('googlechat'));
    const bluebubbles = service.buildChannelProof(channelMesh.buildEntry('bluebubbles'));

    expect(slack).toEqual(
      expect.objectContaining({
        normalizedSourceName: 'slack',
        canonicalChannelId: 'slack',
        status: 'local-proven',
        transportStrategy: 'native-runtime',
      }),
    );
    expect(googleChat).toEqual(
      expect.objectContaining({
        normalizedSourceName: 'googlechat',
        canonicalChannelId: 'google-chat',
        status: 'local-proven',
        transportStrategy: 'webhook-runtime',
      }),
    );
    expect(bluebubbles).toEqual(
      expect.objectContaining({
        normalizedSourceName: 'bluebubbles',
        canonicalChannelId: 'imessage',
        status: 'local-proven',
        transportStrategy: 'local-bridge',
        credentialRefs: ['IMESSAGE_PAIRING_REF'],
      }),
    );
    expect(slack.steps.map((step) => step.kind)).toEqual([
      'channel-inbound-normalization',
      'channel-outbound-plan',
      'credential-policy-redaction',
      'channel-delivery-receipt',
    ]);
    expect(slack.outboundEnvelope.dryRun).toBe(true);
    expect(slack.receipt.noLiveIo).toBe(true);
  });

  it('blocks explicit unsupported provider or unmapped channel entries without hiding the receipt', () => {
    const providerMesh = new ProviderMeshReadinessService({
      sourceProviders: ['telegram'],
    });
    const channelMesh = new ChannelMeshConsistencyService({
      sourceChannels: ['openai'],
      adapterStatuses: [],
    });
    const service = new ProviderChannelSmokeProofService();

    const provider = service.buildProviderProof(providerMesh.buildEntry('telegram'));
    const channel = service.buildChannelProof(channelMesh.buildEntry('openai'));

    expect(provider.status).toBe('blocked');
    expect(provider.receipt).toEqual(
      expect.objectContaining({
        status: 'blocked',
        noLiveIo: true,
      }),
    );
    expect(channel.status).toBe('blocked');
    expect(channel.receipt).toEqual(
      expect.objectContaining({
        status: 'blocked',
        noLiveIo: true,
      }),
    );
  });
});

