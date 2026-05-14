import type { ChannelAdapterStatus, ChannelFeatureSet } from '../../src/contracts/ChannelMeshContract.js';
import { ChannelMeshParityService } from '../../src/services/ChannelMeshParityService.js';
import { PluginRegistryService } from '../../src/services/PluginRegistryService.js';

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
  notes: ['test adapter'],
  features: features(),
  ...overrides,
});

describe('ChannelMeshParityService Phase 5', () => {
  it('builds channel.message parity coverage for the private channel inventory', () => {
    const service = new ChannelMeshParityService({
      now: () => new Date('2026-05-04T15:00:00.000Z'),
      adapterStatuses: [
        adapter({ id: 'slack', label: 'Slack' }),
        adapter({ id: 'discord', label: 'Discord', readiness: 'partial', implementationState: 'partial' }),
        adapter({ id: 'telegram', label: 'Telegram' }),
      ],
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.primitiveId).toBe('channel.message');
    expect(snapshot.summary.sourceChannels).toBeGreaterThan(20);
    expect(snapshot.summary.generatedPluginManifests).toBe(snapshot.summary.sourceChannels);
    expect(snapshot.summary.secretValuesSerialized).toBe(false);
    expect(snapshot.summary.unmapped).toBe(0);
    expect(snapshot.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          normalizedSourceName: 'slack',
          status: 'native',
          canonicalChannelId: 'slack',
        }),
        expect.objectContaining({
          normalizedSourceName: 'discord',
          status: 'adapter-backed',
          canonicalChannelId: 'discord',
        }),
        expect.objectContaining({
          normalizedSourceName: 'feishu',
          status: 'adapter-backed',
        }),
      ]),
    );
  });

  it('maps bridge and webhook channels to explicit dry-run routes', () => {
    const service = new ChannelMeshParityService({
      adapterStatuses: [],
      sourceChannels: ['bluebubbles', 'googlechat', 'webhooks'],
    });

    expect(service.buildEntry('bluebubbles')).toEqual(
      expect.objectContaining({
        canonicalChannelId: 'imessage',
        status: 'adapter-backed',
        route: expect.objectContaining({
          transportStrategy: 'local-bridge',
        }),
        credentialPolicy: expect.objectContaining({
          authKind: 'device_pairing',
          secretValuesSerialized: false,
        }),
      }),
    );
    expect(service.buildEntry('googlechat')).toEqual(
      expect.objectContaining({
        canonicalChannelId: 'google-chat',
        status: 'adapter-backed',
        route: expect.objectContaining({
          webhookPath: '/api/webhooks/google-chat',
        }),
      }),
    );
    expect(service.buildEntry('webhooks')).toEqual(
      expect.objectContaining({
        canonicalChannelId: 'webhook',
        status: 'adapter-backed',
        route: expect.objectContaining({
          transportStrategy: 'generic-webhook-template',
          webhookPath: '/api/webhooks/channel',
        }),
      }),
    );
  });

  it('simulates inbound and outbound envelopes without live channel sends', () => {
    const entry = new ChannelMeshParityService({
      adapterStatuses: [],
      sourceChannels: ['whatsapp'],
    }).buildEntry('whatsapp');

    expect(entry.simulation).toEqual(
      expect.objectContaining({
        inbound: expect.objectContaining({
          channelId: 'whatsapp',
          normalized: true,
          metadata: expect.objectContaining({
            dryRun: true,
          }),
        }),
        outbound: expect.objectContaining({
          channelId: 'whatsapp',
          dryRun: true,
          attachmentsSupported: true,
        }),
      }),
    );
    expect(entry.smokeGate.liveSendRequired).toBe(false);
  });

  it('emits channel plugin manifests that register in the Plugin OS kernel', () => {
    const entry = new ChannelMeshParityService({
      adapterStatuses: [],
      sourceChannels: ['discord'],
    }).buildEntry('discord');
    const registry = new PluginRegistryService({
      now: () => new Date('2026-05-04T15:20:00.000Z'),
      manifests: [entry.generatedPluginManifest],
    });

    expect(entry.generatedPluginManifest.capabilities).toEqual([
      expect.objectContaining({
        id: 'channel.message',
        intent: 'channel_messaging',
      }),
    ]);
    expect(registry.install(entry.generatedPluginManifest.id, { approved: true }).status).toBe('applied');
    expect(registry.enable(entry.generatedPluginManifest.id, { approved: true }).status).toBe('applied');
    expect(registry.buildSnapshot().summary.enabled).toBe(1);
  });

  it('promotes TLON into a governed local bridge route after the runtime decision', () => {
    const entry = new ChannelMeshParityService({
      adapterStatuses: [],
      sourceChannels: ['tlon'],
    }).buildEntry('tlon');

    expect(entry.status).toBe('adapter-backed');
    expect(entry.route.transportStrategy).toBe('local-bridge');
    expect(entry.credentialPolicy.credentialRefs).toEqual(['TLON_PAIRING_REF']);
    expect(entry.smokeGate.liveSendRequired).toBe(false);
  });
});
