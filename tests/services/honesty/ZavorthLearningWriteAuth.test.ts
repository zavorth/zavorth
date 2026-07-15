import {
  canActorWriteLearning,
  canDiscordActorWriteLearning,
  canSignalActorWriteLearning,
  canSlackActorWriteLearning,
  canWhatsAppActorWriteLearning,
  isLearningWriteAllowed,
  isLoopbackRemoteAddress,
  resolveLearningLoopApiUserId,
} from '../../../src/services/ZavorthLearningWriteAuth.js';
import { config } from '../../../src/config/index.js';

jest.mock('../../../src/config/index.js', () => ({
  config: {
    allowedUserIds: ['111', '222'],
    whatsappAllowedChatIds: ['5511999990000', 'group-1'],
    discordOwnerUserIds: ['owner-1'],
    discordOperatorUserIds: ['op-1'],
    slackAllowedChannelIds: ['C-allowed'],
    signalAllowedRecipients: ['+15550001'],
  },
}));

describe('ZavorthLearningWriteAuth', () => {
  it('gates telegram write by operator allowlist', () => {
    expect(canActorWriteLearning({ surface: 'telegram', userId: '111' })).toBe(true);
    expect(canActorWriteLearning({ surface: 'telegram', userId: '999' })).toBe(false);
  });

  it('gates whatsapp write by chat allowlist', () => {
    expect(canWhatsAppActorWriteLearning('5511999990000', '5511999990000')).toBe(true);
    expect(canWhatsAppActorWriteLearning('other', 'group-1')).toBe(true);
    expect(canWhatsAppActorWriteLearning('other', 'not-allowed')).toBe(false);
    expect(
      canActorWriteLearning({
        surface: 'whatsapp',
        userId: 'other',
        chatId: 'not-allowed',
      }),
    ).toBe(false);
    expect(
      canActorWriteLearning({
        surface: 'whatsapp',
        userId: 'x',
        chatId: 'group-1',
      }),
    ).toBe(true);
  });

  it('gates discord write by owner/operator allowlist', () => {
    expect(canDiscordActorWriteLearning('owner-1')).toBe(true);
    expect(canDiscordActorWriteLearning('op-1')).toBe(true);
    expect(canDiscordActorWriteLearning('random-user')).toBe(false);
    expect(canActorWriteLearning({ surface: 'discord', userId: 'owner-1' })).toBe(true);
    expect(canActorWriteLearning({ surface: 'discord', userId: 'random-user' })).toBe(false);

    const originalOwners = (config as any).discordOwnerUserIds;
    const originalOperators = (config as any).discordOperatorUserIds;
    try {
      (config as any).discordOwnerUserIds = [];
      (config as any).discordOperatorUserIds = [];
      expect(canDiscordActorWriteLearning('owner-1')).toBe(false);
      expect(canActorWriteLearning({ surface: 'discord', userId: 'owner-1' })).toBe(false);
    } finally {
      (config as any).discordOwnerUserIds = originalOwners;
      (config as any).discordOperatorUserIds = originalOperators;
    }
  });

  it('gates slack write by channel allowlist', () => {
    expect(canSlackActorWriteLearning('u1', 'C-allowed')).toBe(true);
    expect(canSlackActorWriteLearning('C-allowed', 'other-channel')).toBe(true);
    expect(canSlackActorWriteLearning('u1', 'C-denied')).toBe(false);
    expect(
      canActorWriteLearning({
        surface: 'slack',
        userId: 'u1',
        chatId: 'C-allowed',
      }),
    ).toBe(true);
    expect(
      canActorWriteLearning({
        surface: 'slack',
        userId: 'u1',
        chatId: 'C-denied',
      }),
    ).toBe(false);

    const original = (config as any).slackAllowedChannelIds;
    try {
      (config as any).slackAllowedChannelIds = [];
      expect(canSlackActorWriteLearning('u1', 'C-allowed')).toBe(false);
      expect(
        canActorWriteLearning({
          surface: 'slack',
          userId: 'u1',
          chatId: 'C-allowed',
        }),
      ).toBe(false);
    } finally {
      (config as any).slackAllowedChannelIds = original;
    }
  });

  it('gates signal write by recipient allowlist', () => {
    expect(canSignalActorWriteLearning('+15550001', 'chat-x')).toBe(true);
    expect(canSignalActorWriteLearning('other', '+15550001')).toBe(true);
    expect(canSignalActorWriteLearning('other', 'not-allowed')).toBe(false);
    expect(
      canActorWriteLearning({
        surface: 'signal',
        userId: 'other',
        chatId: '+15550001',
      }),
    ).toBe(true);
    expect(
      canActorWriteLearning({
        surface: 'signal',
        userId: 'other',
        chatId: 'not-allowed',
      }),
    ).toBe(false);

    const original = (config as any).signalAllowedRecipients;
    try {
      (config as any).signalAllowedRecipients = [];
      expect(canSignalActorWriteLearning('+15550001', '+15550001')).toBe(false);
      expect(
        canActorWriteLearning({
          surface: 'signal',
          userId: '+15550001',
          chatId: '+15550001',
        }),
      ).toBe(false);
    } finally {
      (config as any).signalAllowedRecipients = original;
    }
  });

  it('respects explicit allowLearningWrite override', () => {
    expect(
      canActorWriteLearning({
        surface: 'telegram',
        userId: '999',
        allowLearningWrite: true,
      }),
    ).toBe(true);
    expect(
      canActorWriteLearning({
        surface: 'cli',
        userId: 'any',
        allowLearningWrite: false,
      }),
    ).toBe(false);
  });

  it('allows local/single-tenant surfaces when userId is present', () => {
    expect(canActorWriteLearning({ surface: 'cli', userId: 'local-user' })).toBe(true);
    expect(canActorWriteLearning({ surface: 'desktop', userId: 'desktop' })).toBe(true);
    expect(canActorWriteLearning({ surface: 'web', userId: '' })).toBe(false);
  });

  it('denies public multi-tenant surfaces without allowlist match or explicit allowLearningWrite', () => {
    expect(canActorWriteLearning({ surface: 'discord', userId: 'user-1' })).toBe(false);
    expect(canActorWriteLearning({ surface: 'slack', userId: 'user-1' })).toBe(false);
    expect(canActorWriteLearning({ surface: 'signal', userId: 'user-1' })).toBe(false);
    expect(canActorWriteLearning({ surface: 'matrix', userId: 'user-1' })).toBe(false);
    expect(
      canActorWriteLearning({
        surface: 'discord',
        userId: 'user-1',
        allowLearningWrite: true,
      }),
    ).toBe(true);
    expect(isLearningWriteAllowed({ surface: 'discord', userId: 'user-1' })).toBe(false);
  });

  it('resolveLearningLoopApiUserId prefers session over requested userId', () => {
    expect(
      resolveLearningLoopApiUserId({
        requestedUserId: 'attacker',
        authUserId: 'session-user',
      }),
    ).toEqual({ ok: true, userId: 'session-user' });

    expect(
      resolveLearningLoopApiUserId({
        requestedUserId: 'control',
        authUserId: 'session-user',
        allowLocalUiWithoutAuth: false,
      }),
    ).toEqual({ ok: true, userId: 'session-user' });
  });

  it('resolveLearningLoopApiUserId allows local UI only when allowLocalUiWithoutAuth is true', () => {
    expect(
      resolveLearningLoopApiUserId({
        requestedUserId: 'control',
        authUserId: '',
        allowLocalUiWithoutAuth: true,
      }),
    ).toEqual({ ok: true, userId: 'control' });

    expect(
      resolveLearningLoopApiUserId({
        requestedUserId: 'desktop',
        authUserId: '',
        allowLocalUiWithoutAuth: true,
      }),
    ).toEqual({ ok: true, userId: 'desktop' });

    expect(
      resolveLearningLoopApiUserId({
        requestedUserId: 'local-user',
        authUserId: '',
        allowLocalUiWithoutAuth: true,
      }),
    ).toEqual({ ok: true, userId: 'local-user' });

    expect(
      resolveLearningLoopApiUserId({
        requestedUserId: '',
        authUserId: '',
        allowLocalUiWithoutAuth: true,
      }),
    ).toEqual({ ok: true, userId: 'control' });
  });

  it('resolveLearningLoopApiUserId forbids non-local userId on loopback without auth', () => {
    expect(
      resolveLearningLoopApiUserId({
        requestedUserId: 'alice',
        authUserId: '',
        allowLocalUiWithoutAuth: true,
      }),
    ).toEqual({ ok: false, error: 'forbidden_user_id' });
  });

  it('resolveLearningLoopApiUserId requires auth when local UI shortcut is off (fail closed)', () => {
    expect(
      resolveLearningLoopApiUserId({
        requestedUserId: 'control',
        authUserId: '',
      }),
    ).toEqual({ ok: false, error: 'auth_required' });

    expect(
      resolveLearningLoopApiUserId({
        requestedUserId: 'control',
        authUserId: '',
        allowLocalUiWithoutAuth: false,
      }),
    ).toEqual({ ok: false, error: 'auth_required' });

    expect(
      resolveLearningLoopApiUserId({
        requestedUserId: 'desktop',
        authUserId: '',
        allowLocalUiWithoutAuth: false,
      }),
    ).toEqual({ ok: false, error: 'auth_required' });

    expect(
      resolveLearningLoopApiUserId({
        requestedUserId: '',
        authUserId: '',
        allowLocalUiWithoutAuth: false,
      }),
    ).toEqual({ ok: false, error: 'auth_required' });
  });

  it('resolveLearningLoopApiUserId forbids arbitrary unauth userId when shortcut is off', () => {
    expect(
      resolveLearningLoopApiUserId({
        requestedUserId: 'alice',
        authUserId: '',
        allowLocalUiWithoutAuth: false,
      }),
    ).toEqual({ ok: false, error: 'forbidden_user_id' });
  });

  it('resolveLearningLoopApiUserId allows session user when shortcut is off', () => {
    expect(
      resolveLearningLoopApiUserId({
        requestedUserId: 'control',
        authUserId: 'session-user',
        allowLocalUiWithoutAuth: false,
      }),
    ).toEqual({ ok: true, userId: 'session-user' });
  });

  it('isLoopbackRemoteAddress matches classic loopback peers', () => {
    expect(isLoopbackRemoteAddress('127.0.0.1')).toBe(true);
    expect(isLoopbackRemoteAddress('::1')).toBe(true);
    expect(isLoopbackRemoteAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isLoopbackRemoteAddress('localhost')).toBe(true);
    expect(isLoopbackRemoteAddress('LOCALHOST')).toBe(true);
    expect(isLoopbackRemoteAddress('192.168.1.10')).toBe(false);
    expect(isLoopbackRemoteAddress('10.0.0.5')).toBe(false);
    expect(isLoopbackRemoteAddress('')).toBe(false);
    expect(isLoopbackRemoteAddress(null)).toBe(false);
    expect(isLoopbackRemoteAddress(undefined)).toBe(false);
  });
});
