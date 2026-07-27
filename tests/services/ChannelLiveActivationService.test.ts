import { SignalLiveClient } from '../../src/adapters/channels/SignalLiveClient.js';
import { TeamsGraphBotClient } from '../../src/adapters/channels/TeamsGraphBotClient.js';
import { ChannelLiveActivationService } from '../../src/services/ChannelLiveActivationService.js';
import { LiveReadinessService } from '../../src/services/LiveReadinessService.js';

const response = (payload: Record<string, unknown>, init: { status-: number } = {}) =>
  new Response(JSON.stringify(payload), {
    status: init.status || 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });

describe('ChannelLiveActivationService Preview engine', () => {
  it('resolves teams/msteams aliases to the live activation channel id', () => {
    const service = new ChannelLiveActivationService();
    expect(service.resolveChannelId('teams')).toBe('msteams');
    expect(service.resolveChannelId('msteams')).toBe('msteams');
    expect(service.resolveChannelId('ms-teams')).toBe('msteams');
    expect(service.resolveChannelId('slack')).toBe('slack');
    expect(service.resolveChannelId('unknown-channel')).toBeNull();
  });

  it('closes Preview engine P0 channel activation gates without live IO', () => {
    const snapshot = new ChannelLiveActivationService({
      now: () => new Date('2026-05-04T19:00:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-04.live-checkpoint-2');
    expect(snapshot.phase).toBe('Preview engine - Channel Live Activation P0');
    expect(snapshot.status).toBe('closed');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        channels: 6,
        liveReady: 1,
        partialLive: 5,
        configuredOnly: 0,
        blocked: 0,
        signalAndTeamsOutboxOnly: false,
        configSchemas: 6,
        setupDoctors: 6,
        inboundMockTests: 6,
        outboundMockTests: 6,
        stagingLiveSmokeCommands: 6,
        redactedReceipts: 6,
        liveIoRequiredByStage2Check: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        noLiveIoDuringStage2Check: true,
        stagingLiveRequiresExplicitOperatorCommand: true,
        outboxAllowedOnlyAsFallback: true,
        signalUsesJsonRpcOrSignalCli: true,
        teamsUsesMicrosoftGraph: true,
        noSecretsSerialized: true,
      }),
    );
  });

  it('gives every P0 channel schema, doctor, mock gates, staging-live command and redacted receipt', () => {
    const snapshot = new ChannelLiveActivationService().buildSnapshot();
    const entries = new Map(snapshot.entries.map((entry) => [entry.channelId, entry]));

    for (const channelId of ['signal', 'msteams', 'slack', 'whatsapp', 'discord', 'telegram'] as const) {
      const entry = entries.get(channelId);
      expect(entry).toBeDefined();
      expect(entry?.configSchema.requiredEnv.length).toBeGreaterThan(0);
      expect(entry?.doctorCommand).toContain('--profile configured');
      expect(entry?.stagingLiveSmokeCommand).toContain('--confirm-live-io');
      expect(entry?.gates.map((gate) => gate.kind)).toEqual([
        'config-schema',
        'setup-doctor',
        'inbound-mock',
        'outbound-mock',
        'real-send-path',
        'inbound-validation',
        'fallback-policy',
        'staging-live-smoke',
        'redacted-receipt',
      ]);
      expect(entry?.receipt).toEqual(
        expect.objectContaining({
          liveIoPerformed: false,
          stagingLiveRequiresExplicitCommand: true,
          secretValuesSerialized: false,
        }),
      );
    }

    expect(entries.get('signal')).toEqual(
      expect.objectContaining({
        status: 'partial-live',
        adapterTarget: 'src/adapters/channels/SignalLiveClient.ts',
      }),
    );
    expect(entries.get('signal')?.configSchema.requiredEnv).toContain('SIGNAL_JSONRPC_URL or SIGNAL_CLI_PATH');
    expect(entries.get('msteams')).toEqual(
      expect.objectContaining({
        status: 'partial-live',
        adapterTarget: 'src/adapters/channels/TeamsGraphBotClient.ts',
      }),
    );
    expect(entries.get('msteams')?.configSchema.secretEnv).toContain('TEAMS_CLIENT_SECRET');
    expect(entries.get('telegram')?.status).toBe('live-ready');
  });

  it('moves Signal and Teams out of dry-run-only readiness', () => {
    const readiness = new LiveReadinessService().buildSnapshot();
    const entries = new Map(readiness.entries.map((entry) => [entry.normalizedSourceName, entry]));

    expect(entries.get('signal')).toEqual(
      expect.objectContaining({
        primitiveId: 'channel.message',
        status: 'partial-live',
      }),
    );
    expect(entries.get('msteams')).toEqual(
      expect.objectContaining({
        primitiveId: 'channel.message',
        status: 'partial-live',
      }),
    );
  });

  it('sends Signal messages through JSON-RPC or signal-cli with redacted receipts', async () => {
    const jsonRpcCalls: Array<{ url: string; body: string }> = [];
    const jsonRpcClient = new SignalLiveClient({
      now: () => new Date('2026-05-04T19:01:00.000Z'),
      settings: {
        jsonRpcUrl: 'http://127.0.0.1:7583/api/v1/rpc',
        accountNumber: '+15550000000',
        allowedRecipients: ['+15551111111'],
      },
      fetchImpl: (async (url, init) => {
        jsonRpcCalls.push({
          url: String(url),
          body: String(init?.body || ''),
        });
        return response({ jsonrpc: '2.0', result: { timestamp: 1 } });
      }) as typeof fetch,
    });

    const jsonRpcReceipt = await jsonRpcClient.sendText({ message: 'hello signal' });
    expect(jsonRpcReceipt).toEqual(
      expect.objectContaining({
        channelId: 'signal',
        transport: 'json-rpc',
        status: 'sent',
        recipientsCount: 1,
        liveIo: true,
        secretValuesSerialized: false,
      }),
    );
    expect(JSON.parse(jsonRpcCalls[0].body)).toEqual(
      expect.objectContaining({
        method: 'send',
        params: expect.objectContaining({
          account: '+15550000000',
          recipients: ['+15551111111'],
          message: 'hello signal',
        }),
      }),
    );

    const cliCalls: Array<{ file: string; args: string[] }> = [];
    const cliClient = new SignalLiveClient({
      settings: {
        cliPath: 'signal-cli',
        accountNumber: '+15550000000',
        allowedRecipients: ['+15551111111'],
      },
      execFileImpl: async (file, args) => {
        cliCalls.push({ file, args });
        return { stdout: 'ok', stderr: '' };
      },
    });
    const cliReceipt = await cliClient.sendText({ message: 'hello cli' });
    expect(cliReceipt.transport).toBe('signal-cli');
    expect(cliCalls[0]).toEqual({
      file: 'signal-cli',
      args: ['-u', '+15550000000', 'send', '-m', 'hello cli', '+15551111111'],
    });
    expect(cliClient.buildDaemonCommand()).toContain('daemon --json-rpc');
  });

  it('sends Microsoft Teams messages through Graph with redacted receipts', async () => {
    const calls: Array<{ url: string; method: string | undefined }> = [];
    const client = new TeamsGraphBotClient({
      now: () => new Date('2026-05-04T19:02:00.000Z'),
      settings: {
        tenantId: 'tenant-1',
        appId: 'app-1',
        appSecret: 'secret-value',
        allowedConversationIds: ['19:conversation-long-id@thread.v2'],
        graphBaseUrl: 'https://graph.example.test/v1.0',
      },
      fetchImpl: (async (url, init) => {
        calls.push({
          url: String(url),
          method: init?.method,
        });
        if (String(url).includes('login.microsoftonline.com')) {
          return response({ access_token: 'token-value', expires_in: 3600 });
        }
        return response({ id: 'graph-message-1' }, { status: 201 });
      }) as typeof fetch,
    });

    const receipt = await client.sendText({
      conversationId: '19:conversation-long-id@thread.v2',
      message: 'hello teams',
    });

    expect(receipt).toEqual(
      expect.objectContaining({
        channelId: 'msteams',
        transport: 'microsoft-graph',
        status: 'sent',
        providerConfigured: true,
        liveIo: true,
        secretValuesSerialized: false,
        responseId: 'graph-message-1',
      }),
    );
    expect(receipt.conversationIdRedacted).not.toBe('19:conversation-long-id@thread.v2');
    expect(calls.map((call) => call.method)).toEqual(['POST', 'POST']);
    expect(calls[1].url).toContain('/chats/19%3Aconversation-long-id%40thread.v2/messages');
  });
});
