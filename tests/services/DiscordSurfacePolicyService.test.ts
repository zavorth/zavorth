import { DiscordSurfacePolicyService } from '../../src/services/DiscordSurfacePolicyService';

describe('DiscordSurfacePolicyService', () => {
  it('allows threads under an allowlisted parent channel', () => {
    const service = new DiscordSurfacePolicyService({
      allowedChannelIds: ['channel-parent'],
      commandExposure: 'minimal',
    });

    expect(service.isChannelAllowed('thread-1', 'channel-parent')).toBe(true);
    expect(service.isChannelAllowed('channel-other', 'channel-parent')).toBe(true);
    expect(service.isChannelAllowed('channel-other', 'channel-x')).toBe(false);
  });

  it('blocks mass mentions and too many links in guild channels', () => {
    const service = new DiscordSurfacePolicyService({
      allowedChannelIds: ['channel-1'],
      blockMassMentions: true,
      maxLinksPerMessage: 2,
      commandExposure: 'minimal',
    });

    expect(
      service.validateInboundMessage({
        channelId: 'channel-1',
        rawText: 'oi @everyone',
        isDirectMessage: false,
      }),
    ).toEqual({
      valid: false,
      reason: 'Mensagens com @everyone ou @here estao bloqueadas neste servidor do Discord.',
    });

    expect(
      service.validateInboundMessage({
        channelId: 'channel-1',
        rawText: 'https://a.test https://b.test https://c.test',
        isDirectMessage: false,
      }),
    ).toEqual({
      valid: false,
      reason: 'This message has too many links for this Discord channel. Current limit: 2.',
    });
  });

  it('does not apply guild channel guardrails to direct messages', () => {
    const service = new DiscordSurfacePolicyService({
      allowedChannelIds: ['channel-1'],
      blockMassMentions: true,
      maxLinksPerMessage: 1,
      commandExposure: 'minimal',
    });

    expect(
      service.validateInboundMessage({
        channelId: 'dm-1',
        rawText: '@everyone https://a.test https://b.test',
        isDirectMessage: true,
      }),
    ).toEqual({ valid: true });
  });

  it('requires channel allowlists before accepting guild traffic in public-server mode', () => {
    const service = new DiscordSurfacePolicyService({
      publicServerMode: true,
      commandExposure: 'minimal',
    });

    expect(service.shouldRegisterSlashCommands()).toBe(false);
    expect(
      service.validateInboundMessage({
        channelId: 'channel-1',
        rawText: 'oi',
        isDirectMessage: false,
      }),
    ).toEqual({
      valid: false,
      reason: 'Discord is in public server mode and requires DISCORD_ALLOWED_CHANNEL_IDS before accepting traffic.',
    });
  });

  it('keeps public slash commands minimal even when operator exposure is requested', () => {
    const service = new DiscordSurfacePolicyService({
      publicServerMode: true,
      allowedChannelIds: ['channel-1'],
      commandExposure: 'operator',
    });

    expect(service.buildSlashCommandNames()).toEqual(['task', 'plan', 'auto', 'help', 'commands']);
  });

  it('treats operator-only shared commands as operational and exposes them only in operator contexts', () => {
    const service = new DiscordSurfacePolicyService({
      publicServerMode: false,
      commandExposure: 'operator',
    });

    expect(service.isOperationalCommand('/workflow')).toBe(true);
    expect(service.isOperationalCommand('/channels')).toBe(true);
    expect(service.isOperationalCommand('/gateway')).toBe(true);
    expect(service.buildSlashCommandNames()).toContain('workflow');
  });

  it('allows operational commands only for owners in direct messages during public-server mode', () => {
    const service = new DiscordSurfacePolicyService({
      publicServerMode: true,
      ownerUserIds: ['owner-1'],
      operatorUserIds: ['operator-1'],
      commandExposure: 'operator',
    });

    expect(service.canUseOperationalCommand('owner-1', { isDirectMessage: true })).toBe(true);
    expect(service.canUseOperationalCommand('owner-1', { isDirectMessage: false })).toBe(false);
    expect(service.canUseOperationalCommand('operator-1', { isDirectMessage: true })).toBe(false);
  });

  it('blocks attachments and oversized messages for non-owners in public-server mode', () => {
    const service = new DiscordSurfacePolicyService({
      publicServerMode: true,
      allowedChannelIds: ['channel-1'],
      ownerUserIds: ['owner-1'],
      maxMessageChars: 10,
      allowAttachmentsInPublicServerMode: false,
      commandExposure: 'minimal',
    });

    expect(
      service.validateInboundMessage({
        userId: 'discord-user',
        channelId: 'channel-1',
        rawText: 'message too large to pass',
        isDirectMessage: false,
        attachmentsCount: 0,
      }),
    ).toEqual({
      valid: false,
      reason: 'This message exceeds the safe limit for this Discord channel. Current limit: 10 characters.',
    });

    expect(
      service.validateInboundMessage({
        userId: 'discord-user',
        channelId: 'channel-1',
        rawText: 'oi',
        isDirectMessage: false,
        attachmentsCount: 1,
      }),
    ).toEqual({
      valid: false,
      reason: 'Attachments are blocked by pattern on this runtime public Discord.',
    });

    expect(
      service.validateInboundMessage({
        userId: 'owner-1',
        channelId: 'channel-1',
        rawText: 'message too large to pass',
        isDirectMessage: true,
        attachmentsCount: 1,
      }),
    ).toEqual({ valid: true });
  });

  it('rate limits repeated traffic for non-owners but bypasses owners', () => {
    let currentTime = 1_000;
    const service = new DiscordSurfacePolicyService({
      publicServerMode: true,
      allowedChannelIds: ['channel-1'],
      ownerUserIds: ['owner-1'],
      rateLimitWindowMs: 60_000,
      rateLimitMaxRequests: 2,
      commandExposure: 'minimal',
      now: () => currentTime,
    });

    expect(
      service.validateInboundMessage({
        userId: 'discord-user',
        channelId: 'channel-1',
        rawText: 'oi 1',
        isDirectMessage: false,
      }),
    ).toEqual({ valid: true });
    expect(
      service.validateInboundMessage({
        userId: 'discord-user',
        channelId: 'channel-1',
        rawText: 'oi 2',
        isDirectMessage: false,
      }),
    ).toEqual({ valid: true });
    expect(
      service.validateInboundMessage({
        userId: 'discord-user',
        channelId: 'channel-1',
        rawText: 'oi 3',
        isDirectMessage: false,
      }),
    ).toEqual({
      valid: false,
      reason: 'you atingiu o limite temporary deste channel do Discord. Aguarde um pouco antes de tentar de novo.',
    });

    currentTime += 1_000;

    expect(
      service.validateInboundMessage({
        userId: 'owner-1',
        channelId: 'channel-1',
        rawText: 'owner',
        isDirectMessage: true,
      }),
    ).toEqual({ valid: true });
  });
});
