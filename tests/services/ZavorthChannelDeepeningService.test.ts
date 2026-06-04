import { ZavorthChannelDeepeningService } from '../../src/services/ZavorthChannelDeepeningService.js';

describe('ZavorthChannelDeepeningService', () => {
  it('builds an all-channel readiness map with setup, doctor, pairing, proof and outbox coverage', () => {
    const service = new ZavorthChannelDeepeningService({
      now: () => new Date('2026-05-24T12:00:00.000Z'),
      env: {},
    });

    const snapshot = service.buildSnapshot();
    const ids = snapshot.items.map((item) => item.id);

    expect(snapshot.contractVersion).toBe('2026-05-24.channel-live-readiness');
    expect(snapshot.status).toBe('attention');
    expect(snapshot.summary.total).toBeGreaterThanOrEqual(34);
    expect(snapshot.summary.liveProofCommands).toBe(snapshot.summary.total);
    expect(snapshot.summary.pairingCapable).toBeGreaterThanOrEqual(28);
    expect(snapshot.summary.outboxCapable).toBeGreaterThanOrEqual(28);
    expect(snapshot.summary.allChannelsHaveSetupDoctorPairingProof).toBe(true);
    expect(snapshot.summary.allExternalChannelsHavePolicyAndReceipts).toBe(true);
    expect(snapshot.summary.nonLiveSendersUseOutboxOrBlock).toBe(true);
    expect(snapshot.summary.rawSecretsSerialized).toBe(false);
    expect(snapshot.summary.externalIoPerformed).toBe(false);
    expect(snapshot.summary.workspaceMutationPerformed).toBe(false);
    expect(snapshot.guarantees.catalogIsNotLiveProof).toBe(true);
    expect(snapshot.guarantees.liveProofRequiresCredentialsAndAllowlist).toBe(true);
    expect(ids).toEqual(expect.arrayContaining([
      'telegram',
      'discord',
      'slack',
      'whatsapp',
      'whatsapp-cloud',
      'whatsapp-baileys',
      'signal',
      'imessage',
      'bluebubbles',
      'email',
      'msteams',
      'matrix',
      'mattermost',
      'nextcloud-talk',
      'feishu',
      'lark',
      'googlechat',
      'irc',
      'line',
      'zalo',
      'zalouser',
      'wecom',
      'weixin',
      'qqbot',
      'twitch',
      'nostr',
      'synology-chat',
      'tlon',
      'clickclack',
      'webhooks',
      'yuanbao',
      'sms',
      'home-assistant',
    ]));

    const telegram = snapshot.items.find((item) => item.id === 'telegram');
    expect(telegram?.commands.setup).toBe('zavorth channels telegram setup');
    expect(telegram?.commands.doctor).toBe('zavorth channels telegram doctor');
    expect(telegram?.commands.pairing).toBe('zavorth channels telegram pair');
    expect(telegram?.commands.liveProof).toBe('zavorth channels telegram proof --live');
    expect(telegram?.commands.safeOutbox).toBe('zavorth channels telegram outbox');
    expect(telegram?.safeDefaultRoute).toBe(false);
    expect(telegram?.defaultBlockReason).toContain('Missing required configuration');
  });

  it('marks a channel live only after config, allowlist and proof receipt signal exist', () => {
    const service = new ZavorthChannelDeepeningService({
      now: () => new Date('2026-05-24T12:00:00.000Z'),
      env: {
        TELEGRAM_BOT_TOKEN: 'redacted-token',
        TELEGRAM_ALLOWED_USER_IDS: '123',
        ZAVORTH_CHANNEL_LIVE_PROOF_TELEGRAM: 'receipt://telegram-proof',
      },
    });

    const snapshot = service.buildSnapshot();
    const telegram = snapshot.items.find((item) => item.id === 'telegram');

    expect(telegram?.status).toBe('live_ready');
    expect(telegram?.safeDefaultRoute).toBe(true);
    expect(telegram?.configuration.rawSecretsSerialized).toBe(false);
    expect(snapshot.summary.liveReady).toBeGreaterThanOrEqual(1);
  });
});
