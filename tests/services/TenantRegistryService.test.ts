import { TenantRegistryService } from '../../src/services/TenantRegistryService';

describe('TenantRegistryService', () => {
  it('upserts tenant records and keeps onboarding details', () => {
    let persisted = '';
    const service = new TenantRegistryService({
      now: () => new Date('2026-04-02T10:00:00.000Z'),
      existsSync: () => Boolean(persisted),
      readFileSync: () => persisted,
      writeFileSync: (_path, content) => {
        persisted = String(content);
      },
      mkdirSync: () => undefined as any,
    });

    service.upsert({
      tenantId: 'discord:guild:guild-1',
      tenantType: 'discord_guild',
      boundary: 'shared',
      isolationMode: 'tenant',
      onboardingStatus: 'pending_onboarding',
      platform: 'discord',
      policyProfile: 'discord-public-guild',
      publicServerMode: true,
      scopeId: 'channel-9',
      ownerUserIds: ['owner-1'],
      allowedGuildIds: ['guild-1'],
      allowedChannelIds: [],
      guildId: 'guild-1',
      channelId: 'channel-9',
      threadId: null,
      sessionId: null,
      sourceUserId: 'discord-user-1',
      runtimeUserId: 'discord-user-1',
      chatId: 'discord:guild:guild-1:channel:channel-9',
      metadata: {},
    });

    const record = service.getTenant('discord:guild:guild-1');
    const summary = service.summarize();

    expect(record).toEqual(
      expect.objectContaining({
        tenantId: 'discord:guild:guild-1',
        boundary: 'shared',
        onboardingStatus: 'pending_onboarding',
        policyProfile: 'discord-public-guild',
        channelId: 'channel-9',
        publicServerMode: true,
      }),
    );
    expect(summary).toEqual(
      expect.objectContaining({
        totalCount: 1,
        sharedCount: 1,
        pendingOnboardingCount: 1,
        publicServerCount: 1,
        byPlatform: {
          discord: 1,
        },
      }),
    );
  });
});
