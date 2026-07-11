import {
  REACH_CHANNEL_SPINE_CONTRACT_VERSION,
  ReachChannelSpineService,
} from '../../src/services/ReachChannelSpineService.js';
import { REACH_CHANNEL_SPINE_CONTRACT_VERSION as CONTRACT_VERSION } from '../../src/contracts/channel/ReachChannelSpineContract.js';

describe('ReachChannelSpineService', () => {
  it('documents the stable ring and keeps long-tail outside the spine', () => {
    const snapshot = new ReachChannelSpineService({
      now: () => new Date('2026-07-10T12:00:00.000Z'),
      env: {},
    }).buildSnapshot({
      userId: 'operator',
      sessionId: 'session-spine',
    });

    expect(snapshot.contractVersion).toBe(REACH_CHANNEL_SPINE_CONTRACT_VERSION);
    expect(snapshot.contractVersion).toBe(CONTRACT_VERSION);
    expect(snapshot.source).toBe('ReachChannelSpineService');
    expect(snapshot.stableRing.ids).toEqual(['web', 'cli', 'telegram', 'discord', 'slack']);
    expect(snapshot.stableRing.preferredThird).toBe('slack');
    expect(snapshot.longTailPolicy).toEqual(expect.objectContaining({
      activationService: 'ChannelLongTailActivationService',
      separateFromSpine: true,
      telegramParityRequired: false,
    }));
    expect(snapshot.summary.longTailChannelsExcluded).toBe(true);
    expect(snapshot.policy).toEqual(expect.objectContaining({
      catalogIsNotLive: true,
      longTailActivationSeparate: true,
      noTelegramParityOnLongTail: true,
      approvalRequiredForChannelSwitch: true,
      noLiveNetworkRequiredForSpineSmoke: true,
      secretValuesSerialized: false,
    }));
    expect(snapshot.members.map((member) => member.id)).toEqual([
      'web',
      'cli',
      'telegram',
      'discord',
      'slack',
    ]);
  });

  it('builds approval-required continuity handoffs for web↔telegram and telegram↔discord', () => {
    const service = new ReachChannelSpineService({
      now: () => new Date('2026-07-10T12:00:00.000Z'),
      env: {
        TELEGRAM_BOT_TOKEN: 'tg-token',
        TELEGRAM_ALLOWED_USER_IDS: '1',
        DISCORD_BOT_TOKEN: 'discord-token',
        DISCORD_ALLOWED_GUILD_IDS: 'guild-1',
        SLACK_BOT_TOKEN: 'xoxb-token',
        SLACK_ALLOWED_CHANNEL_IDS: 'C1',
      },
    });

    const snapshot = service.buildSnapshot({
      userId: 'grey',
      sessionId: 'session-cross',
    });

    expect(snapshot.continuity.approvalRequiredForChannelSwitch).toBe(true);
    expect(snapshot.continuity.handoffs.length).toBeGreaterThanOrEqual(2);
    expect(snapshot.continuity.handoffs.every((handoff) => handoff.requiresApproval === true)).toBe(true);
    expect(snapshot.continuity.handoffs.every((handoff) => handoff.status === 'needs-approval')).toBe(true);
    expect(snapshot.continuity.bridgedPairs).toEqual(expect.arrayContaining([
      { from: 'web', to: 'telegram' },
      { from: 'telegram', to: 'discord' },
    ]));

    const handoffPreview = service.buildHandoffPreview({
      fromChannel: 'telegram',
      toChannel: 'discord',
      userId: 'grey',
      sessionId: 'session-cross',
    });

    expect(handoffPreview.policy.approvalRequiredForChannelSwitch).toBe(true);
    expect(handoffPreview.policy.noCrossChannelMessageSent).toBe(true);
    expect(handoffPreview.session.continuityKey).toBe('grey:session-cross');
    expect(handoffPreview.handoffs.some((handoff) => handoff.requiresApproval)).toBe(true);
  });

  it('marks local surfaces live-ready and chat members install/doctor/mock capable', () => {
    const snapshot = new ReachChannelSpineService({
      now: () => new Date('2026-07-10T12:00:00.000Z'),
      env: {},
    }).buildSnapshot({ includeContinuityPreview: false });

    const byId = new Map(snapshot.members.map((member) => [member.id, member]));
    expect(byId.get('web')?.liveReady).toBe(true);
    expect(byId.get('cli')?.liveReady).toBe(true);
    expect(byId.get('discord')?.capabilities).toEqual(expect.objectContaining({
      inbound: true,
      outbound: true,
      allowlist: true,
      doctor: true,
      installScaffold: true,
      outboxFallback: true,
      mockIo: true,
      continuity: true,
    }));
    expect(byId.get('slack')?.capabilities).toEqual(expect.objectContaining({
      inbound: true,
      outbound: true,
      allowlist: true,
      doctor: true,
      installScaffold: true,
      outboxFallback: true,
      mockIo: true,
    }));
    expect(byId.get('discord')?.installCommand).toContain('channels:install');
    expect(byId.get('slack')?.doctorCommand).toContain('test:channels:smoke');
  });
});
