import {
  BotHttpChannelLiveClient,
  LocalBridgeChannelLiveClient,
  WebhookChannelLiveClient,
} from '../../src/adapters/channels/ChannelLongTailLiveClients.js';
import { ChannelLongTailActivationService } from '../../src/services/ChannelLongTailActivationService.js';

import { LiveReadinessService } from '../../src/services/LiveReadinessService.js';

const response = (payload: Record<string, unknown>, init: { status?: number } = {}) =>
  new Response(JSON.stringify(payload), {
    status: init.status || 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });

describe('ChannelLongTailActivationService Approval gate', () => {
  it('closes Approval gate long-tail activation gates without live IO', () => {
    const snapshot = new ChannelLongTailActivationService({
      now: () => new Date('2026-05-04T20:00:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-04.live-checkpoint-3');
    expect(snapshot.phase).toBe('Approval gate - Channel Live Activation Long Tail');
    expect(snapshot.status).toBe('closed');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        channels: 25,
        partialLive: 25,
        configuredOnly: 0,
        blocked: 0,
        templateOnlyRemaining: false,
        plannedRemaining: false,
        webhookFamily: 8,
        botHttpFamily: 7,
        relayHttpFamily: 4,
        localBridgeFamily: 4,
        appleBridgeFamily: 2,
        configSchemas: 25,
        configuredDoctors: 25,
        stagingLiveSmokeCommands: 25,
        redactedReceipts: 25,
        liveIoRequiredByStage3Check: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        noLiveIoDuringStage3Check: true,
        stagingLiveRequiresExplicitOperatorCommand: true,
        familyAdaptersPreferredOverOneOffCopies: true,
        allowlistsRequiredBeforeLiveSend: true,
        noSecretsSerialized: true,
      }),
    );
  });

  it('gives every long-tail channel config, doctor, smoke command and receipt', () => {
    const snapshot = new ChannelLongTailActivationService().buildSnapshot();
    const expected = [
      'bluebubbles',
      'clickclack',
      'feishu',
      'google-meet',
      'googlechat',
      'home-assistant',
      'imessage',
      'irc',
      'line',
      'matrix',
      'mattermost',
      'nextcloud-talk',
      'nostr',
      'qqbot',
      'sms',
      'synology-chat',
      'tlon',
      'twitch',
      'voice-call',
      'webhooks',
      'wecom',
      'weixin',
      'yuanbao',
      'zalo',
      'zalouser',
    ];

    expect(snapshot.entries.map((entry) => entry.channelId).sort()).toEqual(expected);
    for (const entry of snapshot.entries) {
      expect(entry.status).toBe('partial-live');
      expect(entry.configSchema.requiredEnv.length).toBeGreaterThan(0);
      expect(entry.doctorCommand).toContain('--profile configured');
      expect(entry.stagingLiveSmokeCommand).toContain('--confirm-live-io');
      expect(entry.gates.map((gate) => gate.kind)).toEqual([
        'family-adapter',
        'config-schema',
        'configured-doctor',
        'inbound-mock',
        'outbound-mock',
        'staging-live-smoke',
        'allowlist-policy',
        'redacted-receipt',
      ]);
      expect(entry.receipt).toEqual(
        expect.objectContaining({
          status: 'partial-live',
          liveIoPerformed: false,
          stagingLiveRequiresExplicitCommand: true,
          secretValuesSerialized: false,
        }),
      );
    }
  });

  it('moves long-tail channels out of template-only and planned readiness', () => {
    const readiness = new LiveReadinessService().buildSnapshot();
    const entries = new Map(readiness.entries.map((entry) => [entry.normalizedSourceName, entry]));

    expect(entries.get('feishu')?.status).toBe('partial-live');
    expect(entries.get('googlechat')?.status).toBe('partial-live');
    expect(entries.get('matrix')?.status).toBe('partial-live');
    expect(entries.get('webhooks')?.status).toBe('partial-live');
    expect(entries.get('wecom')?.status).toBe('partial-live');
    expect(entries.get('weixin')?.status).toBe('partial-live');
    expect(entries.get('wechat')?.status).toBe('partial-live');
    expect(entries.get('yuanbao')?.status).toBe('partial-live');
    expect(entries.get('sms')?.status).toBe('partial-live');
    expect(entries.get('home-assistant')?.status).toBe('partial-live');
    expect(entries.get('bluebubbles')?.status).toBe('partial-live');
    expect(entries.get('imessage')?.status).toBe('partial-live');
  });

  it('sends through webhook and bot HTTP family adapters with redacted receipts', async () => {
    const calls: Array<{ url: string; body: string; authorization?: string }> = [];
    const fetchImpl = (async (url, init) => {
      calls.push({
        url: String(url),
        body: String(init?.body || ''),
        authorization: String((init?.headers as Record<string, string>)?.Authorization || ''),
      });
      return response({ id: 'accepted' }, { status: 200 });
    }) as typeof fetch;

    const webhookReceipt = await new WebhookChannelLiveClient({
      webhookUrl: 'https://hooks.example.test/googlechat',
      defaultRecipients: ['space-1'],
    }, { fetchImpl, now: () => new Date('2026-05-04T20:01:00.000Z') }).sendText({
      channelId: 'googlechat',
      message: 'hello webhook',
    });
    expect(webhookReceipt).toEqual(
      expect.objectContaining({
        channelId: 'googlechat',
        family: 'webhook',
        status: 'sent',
        liveIo: true,
        secretValuesSerialized: false,
      }),
    );

    const botReceipt = await new BotHttpChannelLiveClient({
      endpointUrl: 'https://api.example.test/line/send',
      bearerToken: 'token-value',
      defaultRecipients: ['line-user-1'],
    }, { fetchImpl }).sendText({
      channelId: 'line',
      message: 'hello bot',
    });
    expect(botReceipt.family).toBe('bot-http');
    expect(calls[1].authorization).toBe('Bearer token-value');
    expect(JSON.parse(calls[1].body)).toEqual(
      expect.objectContaining({
        channelId: 'line',
        recipients: ['line-user-1'],
        text: 'hello bot',
      }),
    );
  });

  it('sends through relay/local bridge and Apple bridge adapters', async () => {
    const endpointCalls: Array<{ url: string; body: string }> = [];
    const fetchImpl = (async (url, init) => {
      endpointCalls.push({
        url: String(url),
        body: String(init?.body || ''),
      });
      return response({ ok: true });
    }) as typeof fetch;

    const relayReceipt = await new LocalBridgeChannelLiveClient('relay-http', {
      endpointUrl: 'https://matrix.example.test/send',
      bridgeToken: 'bridge-token',
      defaultRecipients: ['!room:example.test'],
    }, { fetchImpl }).sendText({
      channelId: 'matrix',
      message: 'hello matrix',
    });
    expect(relayReceipt.family).toBe('relay-http');
    expect(JSON.parse(endpointCalls[0].body)).toEqual(
      expect.objectContaining({
        channelId: 'matrix',
        recipients: ['!room:example.test'],
      }),
    );

    const scriptCalls: Array<{ file: string; args: string[] }> = [];
    const appleReceipt = await new LocalBridgeChannelLiveClient('apple-bridge', {
      scriptPath: 'imessage-bridge.ps1',
      defaultRecipients: ['chat-guid'],
    }, {
      execFileImpl: async (file, args) => {
        scriptCalls.push({ file, args });
        return { stdout: 'ok', stderr: '' };
      },
    }).sendText({
      channelId: 'imessage',
      message: 'hello apple bridge',
    });
    expect(appleReceipt.family).toBe('apple-bridge');
    expect(scriptCalls[0]).toEqual({
      file: 'imessage-bridge.ps1',
      args: ['--channel', 'imessage', '--recipients', 'chat-guid', '--message', 'hello apple bridge'],
    });
  });

  it('runs configured doctors and blocks staging-live when config is missing', async () => {
    const service = new ChannelLongTailActivationService({
      env: {},
      now: () => new Date('2026-05-04T20:03:00.000Z'),
    });

    const doctor = service.runConfiguredDoctor({ channelId: 'googlechat' });
    expect(doctor).toEqual(
      expect.objectContaining({
        channelId: 'googlechat',
        status: 'missing-config',
        configured: false,
        allowlistConfigured: false,
        liveIoPerformed: false,
        secretValuesSerialized: false,
      }),
    );
    expect(doctor.missingRequiredEnv).toContain('GOOGLECHAT_WEBHOOK_URL');

    const blocked = await service.runStagingLiveSmoke({
      channelId: 'googlechat',
      confirmLiveIo: false,
      message: 'should not send',
    });
    expect(blocked).toEqual(
      expect.objectContaining({
        channelId: 'googlechat',
        status: 'blocked',
        confirmed: false,
        sendReceipt: null,
        liveIoPerformed: false,
      }),
    );
  });

  it('runs staging-live smoke through the selected long-tail family adapter', async () => {
    const calls: Array<{ url: string; body: string }> = [];
    const fetchImpl = (async (url, init) => {
      calls.push({
        url: String(url),
        body: String(init?.body || ''),
      });
      return response({ id: 'approval-gate-live-receipt' });
    }) as typeof fetch;

    const webhookService = new ChannelLongTailActivationService({
      env: {
        GOOGLECHAT_WEBHOOK_URL: 'https://hooks.example.test/googlechat',
        GOOGLECHAT_ALLOWED_RECIPIENTS: 'space-1',
      },
      fetchImpl,
      now: () => new Date('2026-05-04T20:04:00.000Z'),
    });
    const webhook = await webhookService.runStagingLiveSmoke({
      channelId: 'googlechat',
      confirmLiveIo: true,
      message: 'phase 3 webhook smoke',
    });
    expect(webhook).toEqual(
      expect.objectContaining({
        status: 'sent',
        liveIoPerformed: true,
        secretValuesSerialized: false,
      }),
    );
    expect(webhook.sendReceipt).toEqual(
      expect.objectContaining({
        family: 'webhook',
        status: 'sent',
        recipientsCount: 1,
      }),
    );
    expect(JSON.parse(calls[0].body)).toEqual(
      expect.objectContaining({
        channelId: 'googlechat',
        recipients: ['space-1'],
        text: 'phase 3 webhook smoke',
      }),
    );

    const botService = new ChannelLongTailActivationService({
      env: {
        LINE_API_BASE_URL: 'https://api.example.test/line/send',
        LINE_CHANNEL_ACCESS_TOKEN: 'line-token',
        LINE_TARGET_IDS: 'line-user-1',
      },
      fetchImpl,
    });
    const bot = await botService.runStagingLiveSmoke({
      channelId: 'line',
      confirmLiveIo: true,
      message: 'phase 3 bot smoke',
    });
    expect(bot.status).toBe('sent');
    expect(bot.sendReceipt?.family).toBe('bot-http');
  });

  it('runs staging-live smoke through local bridge scripts with allowlisted recipients', async () => {
    const scriptCalls: Array<{ file: string; args: string[] }> = [];
    const service = new ChannelLongTailActivationService({
      env: {
        IMESSAGE_BRIDGE_SCRIPT: 'imessage-bridge.ps1',
        IMESSAGE_ALLOWED_RECIPIENTS: 'chat-guid',
      },
      execFileImpl: async (file, args) => {
        scriptCalls.push({ file, args });
        return { stdout: 'ok', stderr: '' };
      },
    });

    const receipt = await service.runStagingLiveSmoke({
      channelId: 'imessage',
      confirmLiveIo: true,
      message: 'phase 3 apple bridge smoke',
    });

    expect(receipt.status).toBe('sent');
    expect(receipt.sendReceipt).toEqual(
      expect.objectContaining({
        family: 'apple-bridge',
        status: 'sent',
        recipientsCount: 1,
        secretValuesSerialized: false,
      }),
    );
    expect(scriptCalls[0]).toEqual({
      file: 'imessage-bridge.ps1',
      args: ['--channel', 'imessage', '--recipients', 'chat-guid', '--message', 'phase 3 apple bridge smoke'],
    });
  });
});
