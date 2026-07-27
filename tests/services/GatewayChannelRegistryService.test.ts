import { GatewayChannelAdapterRegistryService } from '../../src/services/GatewayChannelAdapterRegistryService.js';
import { GatewayChannelRegistryService } from '../../src/services/GatewayChannelRegistryService.js';
import {
  DiscordRuntimeChannelAdapter,
  SlackRuntimeChannelAdapter,
  TelegramRuntimeChannelAdapter,
  WhatsAppRuntimeChannelAdapter,
  WebRuntimeChannelAdapter,
} from '../../src/services/GatewayRuntimeChannelAdapters.js';

describe('GatewayChannelRegistryService', () => {
  it('updates an existing registry with runtime adapters after bootstrap wiring completes', () => {
    const registry = new GatewayChannelRegistryService({
      now: () => new Date('2026-04-08T12:00:00.000Z'),
      hasDispatcher: true,
      canSpawnWeb: false,
      platformCapabilityService: {
        getCapabilities: () => [
          {
            platform: 'telegram',
            implementationState: 'full',
            readiness: 'ready',
            configured: true,
            transport: 'native',
            envKeys: [],
            notes: ['Telegram capability preflight.'],
          },
          {
            platform: 'discord',
            implementationState: 'partial',
            readiness: 'partial',
            configured: true,
            transport: 'local',
            envKeys: [],
            notes: ['Discord capability preflight.'],
          },
        ],
      },
    });

    expect(registry.getChannel('discord')).toEqual(
      expect.objectContaining({
        id: 'discord',
        readiness: 'partial',
        transport: 'local',
      }),
    );

    registry.setRuntimeAdapters([
      new TelegramRuntimeChannelAdapter({
        supportsRoleAwareBroadcast: true,
        isStarted: () => true,
        getIdentityHints: () => ({
          linkedBy: 'telegram-gateway',
          verificationMethod: 'telegram-bot-token',
        }),
      }, true),
      new DiscordRuntimeChannelAdapter({
        getIdentityHints: () => ({
          linkedBy: 'discord-native-gateway',
          verificationMethod: 'discord-bot-token',
        }),
        readStatus: () => ({
          mode: 'native',
          enabled: true,
          started: true,
          lastError: null,
        }),
      }, true),
    ]);

    const snapshot = registry.buildSnapshot();

    expect(snapshot.summary).toEqual({
      total: 3,
      ready: 3,
      partial: 0,
      planned: 0,
      disabled: 0,
    });
    expect(registry.getChannel('discord')).toEqual(
      expect.objectContaining({
        id: 'discord',
        readiness: 'ready',
        transport: 'native',
        notes: expect.arrayContaining(['Discord runtime operating in native mode.']),
      }),
    );
  });

  it('builds a canonical channel registry snapshot from explicit runtime adapters without duplicates', () => {
    const adapterRegistryService = new GatewayChannelAdapterRegistryService({
      hasDispatcher: true,
      canSpawnWeb: true,
      platformCapabilityService: {
        getCapabilities: () => [
          {
            platform: 'telegram',
            implementationState: 'partial',
            readiness: 'partial',
            configured: true,
            transport: 'local',
            envKeys: [],
            notes: ['Telegram inferido pelo capability catalog.'],
          },
          {
            platform: 'discord',
            implementationState: 'partial',
            readiness: 'partial',
            configured: true,
            transport: 'local',
            envKeys: [],
            notes: ['Discord inferido pelo capability catalog.'],
          },
          {
            platform: 'slack',
            implementationState: 'partial',
            readiness: 'partial',
            configured: true,
            transport: 'local',
            envKeys: [],
            notes: ['Slack inferido pelo capability catalog.'],
          },
          {
            platform: 'whatsapp',
            implementationState: 'partial',
            readiness: 'partial',
            configured: true,
            transport: 'local',
            envKeys: [],
            notes: ['WhatsApp inferido pelo capability catalog.'],
          },
        ],
      },
      runtimeAdapters: [
        new WebRuntimeChannelAdapter(true, true),
        new TelegramRuntimeChannelAdapter({
          supportsRoleAwareBroadcast: true,
          isStarted: () => true,
          getIdentityHints: () => ({
            linkedBy: 'telegram-bot-gateway',
            verificationMethod: 'telegram-bot-token',
          }),
        }, true),
        new DiscordRuntimeChannelAdapter({
          getIdentityHints: () => ({
            linkedBy: 'discord-native-gateway',
            verificationMethod: 'discord-bot-token',
          }),
          readStatus: () => ({
            mode: 'native',
            enabled: true,
            started: true,
            lastError: null,
          }),
        }, true),
        new SlackRuntimeChannelAdapter({
          getIdentityHints: () => ({
            linkedBy: 'slack-gateway',
            verificationMethod: 'slack-web-api',
          }),
          readStatus: () => ({
            mode: 'native',
            enabled: true,
            started: true,
            recipientsConfigured: 1,
            workspaceId: 'workspace-1',
            transport: 'native',
            lastError: null,
          }),
        }, true),
        new WhatsAppRuntimeChannelAdapter({
          getIdentityHints: () => ({
            linkedBy: 'whatsapp-gateway',
            verificationMethod: 'whatsapp-cloud-api',
          }),
          readStatus: () => ({
            mode: 'cloud-api',
            provider: 'cloud-api',
            enabled: true,
            started: true,
            recipientsConfigured: 1,
            providerConfigured: true,
            webhookConfigured: true,
            providerDecision: 'Cloud API conectada; inbound e outbound oficial estao actives.',
            phoneNumberId: '1234567890',
            lastError: null,
          }),
        }, true),
      ],
    });

    const registry = new GatewayChannelRegistryService({
      now: () => new Date('2026-04-05T12:00:00.000Z'),
      adapterRegistryService,
    });

    const snapshot = registry.buildSnapshot();
    const ids = snapshot.channels.map((entry) => entry.id);

    expect(snapshot.generatedAt).toBe('2026-04-05T12:00:00.000Z');
    expect(snapshot.summary).toEqual({
      total: 5,
      ready: 5,
      partial: 0,
      planned: 0,
      disabled: 0,
    });
    expect(ids).toEqual(expect.arrayContaining([
      'web',
      'telegram',
      'discord',
      'slack',
      'whatsapp',
    ]));
    expect(new Set(ids).size).toBe(ids.length);
    expect(registry.getChannel('slack')).toEqual(
      expect.objectContaining({
        id: 'slack',
        transport: 'native',
        features: expect.objectContaining({
          sessionSend: true,
          threads: true,
        }),
      }),
    );
    expect(registry.getChannel('whatsapp')).toEqual(
      expect.objectContaining({
        id: 'whatsapp',
        transport: 'webhook',
        features: expect.objectContaining({
          sessionSend: true,
          attachments: true,
        }),
      }),
    );
  });
});
