import { GatewayChannelAdapterRegistryService } from '../../src/services/GatewayChannelAdapterRegistryService.js';
import {
  DiscordRuntimeChannelAdapter,
  IMessageRuntimeChannelAdapter,
  SignalRuntimeChannelAdapter,
  SlackRuntimeChannelAdapter,
  TelegramRuntimeChannelAdapter,
  WhatsAppRuntimeChannelAdapter,
  WebRuntimeChannelAdapter,
} from '../../src/services/GatewayRuntimeChannelAdapters.js';

describe('GatewayChannelAdapterRegistryService', () => {
  it('overlays runtime descriptors onto canonical adapters', () => {
    const registry = new GatewayChannelAdapterRegistryService({
      hasDispatcher: false,
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
            notes: ['Telegram base.'],
          },
          {
            platform: 'discord',
            implementationState: 'partial',
            readiness: 'partial',
            configured: true,
            transport: 'local',
            envKeys: [],
            notes: ['Discord base.'],
          },
        ],
      },
      runtimeDescriptors: [
        {
          id: 'web',
          notes: ['Runtime web anexado ao gateway.'],
          features: {
            sessionSend: true,
            sessionSpawn: true,
          },
        },
        {
          id: 'telegram',
          notes: ['Gateway do Telegram anexado ao mesh operacional do Zavorth.'],
          features: {
            groupPolicy: true,
            identityHints: true,
          },
        },
        {
          id: 'discord',
          readiness: 'ready',
          implementationState: 'full',
          transport: 'native',
          notes: ['Discord runtime operating in native mode.'],
          features: {
            attachments: true,
            threads: true,
            identityHints: true,
          },
        },
      ],
    });

    const web = registry.getAdapter('web');
    const telegram = registry.getAdapter('telegram');
    const discord = registry.getAdapter('discord');

    expect(web).toEqual(
      expect.objectContaining({
        id: 'web',
        features: expect.objectContaining({
          sessionSend: true,
          sessionSpawn: true,
        }),
        notes: expect.arrayContaining(['Runtime web anexado ao gateway.']),
      }),
    );
    expect(telegram).toEqual(
      expect.objectContaining({
        id: 'telegram',
        readiness: 'ready',
        notes: expect.arrayContaining([
          'Telegram base.',
          'Gateway do Telegram anexado ao mesh operacional do Zavorth.',
        ]),
        features: expect.objectContaining({
          groupPolicy: true,
          identityHints: true,
        }),
      }),
    );
    expect(discord).toEqual(
      expect.objectContaining({
        id: 'discord',
        readiness: 'ready',
        implementationState: 'full',
        transport: 'native',
        notes: expect.arrayContaining([
          'Discord base.',
          'Discord runtime operating in native mode.',
        ]),
        features: expect.objectContaining({
          attachments: true,
          threads: true,
          identityHints: true,
        }),
      }),
    );
  });

  it('accepts runtime descriptor contracts as overlays', () => {
    const registry = new GatewayChannelAdapterRegistryService({
      platformCapabilityService: {
        getCapabilities: () => [],
      },
      runtimeDescriptors: [
        {
          id: 'discord',
          describeRuntimeChannel: () => ({
            id: 'discord',
            label: 'Discord',
            readiness: 'ready',
            implementationState: 'partial',
            transport: 'bridge',
            configured: true,
            notes: ['Bridge runtime anexado.'],
            features: {
              outbound: true,
              identityHints: true,
            },
          }),
        },
      ],
    });

    expect(registry.getAdapter('discord')).toEqual(
      expect.objectContaining({
        id: 'discord',
        label: 'Discord',
        readiness: 'ready',
        implementationState: 'partial',
        transport: 'bridge',
        configured: true,
        notes: ['Bridge runtime anexado.'],
        features: expect.objectContaining({
          outbound: true,
          identityHints: true,
        }),
      }),
    );
  });

  it('prefers explicit runtime adapters for web, telegram and discord', () => {
    const registry = new GatewayChannelAdapterRegistryService({
      hasDispatcher: false,
      canSpawnWeb: false,
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
      ],
    });

    expect(registry.getAdapter('web')).toEqual(
      expect.objectContaining({
        id: 'web',
        features: expect.objectContaining({
          sessionSend: true,
          sessionSpawn: true,
        }),
      }),
    );
    expect(registry.getAdapter('telegram')).toEqual(
      expect.objectContaining({
        id: 'telegram',
        readiness: 'ready',
        transport: 'native',
        notes: expect.arrayContaining([
          'Gateway do Telegram anexado ao mesh operacional do Zavorth.',
        ]),
        features: expect.objectContaining({
          sessionSend: true,
          groupPolicy: true,
          identityHints: true,
        }),
      }),
    );
    expect(registry.getAdapter('discord')).toEqual(
      expect.objectContaining({
        id: 'discord',
        readiness: 'ready',
        implementationState: 'full',
        transport: 'native',
        notes: expect.arrayContaining([
          'Gateway do Discord anexado ao mesh operacional do Zavorth.',
          'Discord runtime operating in native mode.',
        ]),
        features: expect.objectContaining({
          sessionSend: true,
          threads: true,
          attachments: true,
          identityHints: true,
        }),
      }),
    );
  });

  it('supports explicit slack runtime adapters as first-class mesh entries', () => {
    const registry = new GatewayChannelAdapterRegistryService({
      hasDispatcher: true,
      canSpawnWeb: false,
      platformCapabilityService: {
        getCapabilities: () => [
          {
            platform: 'slack',
            implementationState: 'partial',
            readiness: 'partial',
            configured: true,
            transport: 'local',
            envKeys: [],
            notes: ['Slack inferido pelo capability catalog.'],
          },
        ],
      },
      runtimeAdapters: [
        new SlackRuntimeChannelAdapter({
          getIdentityHints: () => ({
            linkedBy: 'slack-gateway',
            verificationMethod: 'slack-web-api',
          }),
          readStatus: () => ({
            mode: 'native',
            enabled: true,
            started: true,
            recipientsConfigured: 2,
            workspaceId: 'workspace-1',
            transport: 'native',
            lastError: null,
          }),
        }, true),
      ],
    });

    expect(registry.getAdapter('slack')).toEqual(
      expect.objectContaining({
        id: 'slack',
        readiness: 'ready',
        implementationState: 'full',
        transport: 'native',
        notes: expect.arrayContaining([
          'Gateway do Slack anexado ao mesh operacional do Zavorth.',
          'Slack runtime operating in native mode through Web API.',
          'Slack workspace configured in workspace-1.',
        ]),
        features: expect.objectContaining({
          sessionSend: true,
          attachments: true,
          threads: true,
          groupPolicy: true,
          identityHints: true,
        }),
      }),
    );
  });

  it('supports explicit whatsapp runtime adapters as first-class mesh entries', () => {
    const registry = new GatewayChannelAdapterRegistryService({
      hasDispatcher: true,
      canSpawnWeb: false,
      platformCapabilityService: {
        getCapabilities: () => [
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
            providerDecision: 'Cloud API conectada; webhook verification, inbound e outbound oficial estao actives.',
            phoneNumberId: '1234567890',
            webhookConfigured: true,
            lastError: null,
          }),
        }, true),
      ],
    });

    expect(registry.getAdapter('whatsapp')).toEqual(
      expect.objectContaining({
        id: 'whatsapp',
        readiness: 'ready',
        implementationState: 'full',
        transport: 'webhook',
        notes: expect.arrayContaining([
          'Gateway do WhatsApp anexado ao mesh operacional do Zavorth.',
          'Runtime do WhatsApp operando pela Cloud API da Meta.',
          'Cloud API conectada; webhook verification, inbound e outbound oficial estao actives.',
          'Phone number id configured in 1234567890.',
        ]),
        features: expect.objectContaining({
          sessionSend: true,
          inbound: true,
          outbound: true,
          attachments: true,
          groupPolicy: true,
          identityHints: true,
        }),
      }),
    );
  });

  it('surfaces Signal and iMessage bridge health as first-class governed channel entries', () => {
    const registry = new GatewayChannelAdapterRegistryService({
      hasDispatcher: true,
      canSpawnWeb: false,
      platformCapabilityService: {
        getCapabilities: () => [],
      },
      runtimeAdapters: [
        new SignalRuntimeChannelAdapter({
          getIdentityHints: () => ({
            linkedBy: 'signal-gateway',
            verificationMethod: 'signal-cli-json-rpc',
          }),
          readStatus: () => ({
            enabled: true,
            started: true,
            recipientsConfigured: 2,
            providerConfigured: true,
            lastError: null,
            transport: 'bridge',
          }),
        }, true),
        new IMessageRuntimeChannelAdapter({
          getIdentityHints: () => ({
            linkedBy: 'imessage-gateway',
            verificationMethod: 'mac-node-host',
          }),
          readStatus: () => ({
            enabled: true,
            started: true,
            recipientsConfigured: 1,
            providerConfigured: true,
            readOnly: true,
            lastError: null,
            transport: 'bridge',
          }),
        }, true),
      ],
    });

    const signal = registry.getAdapter('signal');
    const imessage = registry.getAdapter('imessage');

    expect(signal).toEqual(expect.objectContaining({
      id: 'signal',
      readiness: 'ready',
      transport: 'bridge',
      features: expect.objectContaining({
        localBridge: true,
        doctor: true,
        richReplies: true,
        sessionSend: true,
      }),
      statusRows: expect.arrayContaining([
        expect.objectContaining({ label: 'Bridge', value: 'configurada' }),
        expect.objectContaining({ label: 'Recipients', value: '2' }),
      ]),
    }));
    expect(imessage).toEqual(expect.objectContaining({
      id: 'imessage',
      readiness: 'ready',
      transport: 'bridge',
      riskLevel: 'experimental',
      features: expect.objectContaining({
        localBridge: true,
        approvals: true,
        richReplies: true,
        sessionSend: true,
      }),
      statusRows: expect.arrayContaining([
        expect.objectContaining({ label: 'Bridge', value: 'configurada' }),
        expect.objectContaining({ label: 'Read-only', value: 'yes' }),
        expect.objectContaining({ label: 'Recipients', value: '1' }),
      ]),
    }));
  });
});
