import { ZavorthConnectorExperienceService } from '../../src/services/ZavorthConnectorExperienceService';
import { ZavorthProductDemoService } from '../../src/services/ZavorthProductDemoService';

describe('ZavorthConnectorExperienceService', () => {
  it('renders connector doctor with GitHub, Telegram and Discord setup paths', async () => {
    const service = new ZavorthConnectorExperienceService({
      productDemo: new ZavorthProductDemoService({ env: {} }),
      providerDoctor: null,
    });

    const result = await service.runDoctor();
    const text = service.renderDoctor(result);

    expect(result.status).toBe('needs_setup');
    expect(result.connectors.map((connector) => connector.id)).toEqual([
      'github',
      'github-pr-comment',
      'telegram',
      'discord',
    ]);
    expect(text).toContain('zavorth connectors setup telegram --apply');
    expect(text).toContain('zavorth connectors setup discord --apply');
    expect(text).toContain('gh auth login');
  });

  it('builds a Telegram setup preview without accepting raw secrets', () => {
    const service = new ZavorthConnectorExperienceService({
      productDemo: new ZavorthProductDemoService({ env: {} }),
      providerDoctor: null,
    });

    const result = service.buildSetup({ channelId: 'telegram' });

    expect(result.status).toBe('preview');
    expect(result.assistant?.selected?.channelId).toBe('telegram');
    expect(result.safety).toEqual({
      rawSecretsAccepted: false,
      writesRequireApply: true,
      externalMutationBeforeApproval: false,
    });
    expect(service.renderSetup(result)).toContain('zavorth connectors doctor telegram');
  });

  it('passes guided allowlist entries to Telegram and Discord apply flows', async () => {
    const applyInputs: any[] = [];
    const fakeAssistant = {
      buildSession: jest.fn((input) => ({
        generatedAt: '2026-05-16T00:00:00.000Z',
        status: 'needs_config',
        selected: {
          channelId: input.channelId,
          label: input.channelId === 'discord' ? 'Discord' : 'Telegram',
          setupMode: input.mode || 'native',
          missingEnvKeys: [],
          operatorNextStep: 'Run doctor.',
        },
        options: [],
        envFilePath: '.env',
        localBaseUrl: 'http://127.0.0.1:3000',
        publicBaseUrl: null,
        naturalReply: 'ok',
        nextQuestions: [],
        nextActions: [],
        report: { generatedAt: 'now', envFilePath: '.env', localBaseUrl: '', publicBaseUrl: null, channels: [] },
        channels: null,
      })),
      apply: jest.fn(async (input) => {
        applyInputs.push(input);
        return {
          generatedAt: '2026-05-16T00:00:00.000Z',
          applyReport: {
            generatedAt: '2026-05-16T00:00:00.000Z',
            channelId: input.channelId,
            mode: input.mode || 'native',
            env: {
              filePath: '.env',
              writtenKeys: input.extraEntries.map((entry: { key: string }) => entry.key),
              preservedKeys: [],
              created: false,
            },
            directoriesCreated: [],
            report: { generatedAt: 'now', envFilePath: '.env', localBaseUrl: '', publicBaseUrl: null, channels: [] },
            nextSteps: ['Run doctor.'],
          },
          assistant: fakeAssistant.buildSession(input),
        };
      }),
    };
    const service = new ZavorthConnectorExperienceService({
      productDemo: new ZavorthProductDemoService({ env: {} }),
      assistant: fakeAssistant,
      providerDoctor: null,
    });

    await service.applySetup({ channelId: 'telegram', allowedUserIds: ['42'] });
    await service.applySetup({
      channelId: 'discord',
      allowedGuildIds: ['guild-1'],
      allowedChannelIds: ['channel-1'],
      ownerUserIds: ['owner-1'],
      allowDms: false,
    });

    expect(applyInputs[0].extraEntries).toEqual(expect.arrayContaining([
      { key: 'TELEGRAM_ALLOWED_USER_IDS', value: '42' },
      { key: 'ZAVORTH_CHANNEL_POLICY_TELEGRAM_ALLOWED', value: 'user:42' },
    ]));
    expect(applyInputs[1].extraEntries).toEqual(expect.arrayContaining([
      { key: 'DISCORD_ALLOWED_GUILD_IDS', value: 'guild-1' },
      { key: 'DISCORD_ALLOWED_CHANNEL_IDS', value: 'channel-1' },
      { key: 'DISCORD_OWNER_USER_IDS', value: 'owner-1' },
      { key: 'DISCORD_ALLOW_DMS', value: 'false' },
      {
        key: 'ZAVORTH_CHANNEL_POLICY_DISCORD_ALLOWED',
        value: 'guild:guild-1,channel:channel-1,user:owner-1',
      },
    ]));
  });
});
