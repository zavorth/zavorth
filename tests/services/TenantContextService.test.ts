import { TenantContextService } from '../../src/services/TenantContextService';

describe('TenantContextService', () => {
  it('resolves Discord guild traffic into a tenant-scoped context', () => {
    const service = new TenantContextService({
      ownerUserIds: ['owner-1'],
      allowedChannelIds: ['channel-9'],
    });

    const context = service.resolveForDispatch({
      platform: 'discord',
      chatId: 'discord:guild:guild-1:channel:channel-9',
      sourceUserId: 'discord-user-1',
      runtimeUserId: 'discord-user-1',
      publicServerMode: true,
    });

    expect(context).toEqual(
      expect.objectContaining({
        tenantId: 'discord:guild:guild-1',
        boundary: 'shared',
        policyProfile: 'discord-public-guild',
        guildId: 'guild-1',
        channelId: 'channel-9',
      }),
    );
  });

  it('keeps owner DMs as an internal operator context', () => {
    const service = new TenantContextService({
      ownerUserIds: ['owner-1'],
    });

    const context = service.resolveForDispatch({
      platform: 'discord',
      chatId: 'discord:dm:channel-1',
      sourceUserId: 'owner-1',
      runtimeUserId: 'owner-1',
    });

    expect(context).toEqual(
      expect.objectContaining({
        tenantId: 'discord:dm:owner-1',
        boundary: 'personal',
        policyProfile: 'discord-dm',
      }),
    );
  });

  it('marks public Discord guilds as pending onboarding when owner or channel policy is missing', () => {
    const service = new TenantContextService({
      ownerUserIds: ['owner-1'],
      allowedGuildIds: ['guild-1'],
      allowedChannelIds: [],
    });

    const context = service.resolveForDispatch({
      platform: 'discord',
      chatId: 'discord:guild:guild-1:channel:channel-9',
      sourceUserId: 'discord-user-1',
      runtimeUserId: 'discord-user-1',
      publicServerMode: true,
    });

    expect(context).toEqual(
      expect.objectContaining({
        tenantId: 'discord:guild:guild-1',
        onboardingStatus: 'pending_onboarding',
        publicServerMode: true,
      }),
    );
  });

  it('builds task metadata and permission matches from tenant-aware task metadata', () => {
    const metadata = TenantContextService.buildTaskMetadataFromContext({
      tenantId: 'discord:guild:guild-1',
      platform: 'discord',
      tenantType: 'discord_guild',
      boundary: 'shared',
      policyProfile: 'discord-public-guild',
      ownerUserIds: ['owner-1'],
      allowedGuildIds: ['guild-1'],
      allowedChannelIds: ['channel-9'],
      guildId: 'guild-1',
      channelId: 'channel-9',
      threadId: null,
      sessionId: null,
      sourceUserId: 'discord-user-1',
      runtimeUserId: 'discord-user-1',
      scopeId: 'channel-9',
    });

    expect(TenantContextService.extractTenantId(metadata)).toBe('discord:guild:guild-1');
    expect(
      TenantContextService.buildPermissionMetadataMatchFromTask({
        metadata,
      } as any),
    ).toEqual({
      tenant_id: 'discord:guild:guild-1',
      tenant_policy_profile: 'discord-public-guild',
    });
    expect(
      TenantContextService.buildPermissionMetadataFromTask({
        metadata,
      } as any),
    ).toEqual(
      expect.objectContaining({
        tenant_id: 'discord:guild:guild-1',
        tenant_type: 'discord_guild',
        guild_id: 'guild-1',
        channel_id: 'channel-9',
      }),
    );
  });
});
