import {
  canActorWriteLearning,
  canWhatsAppActorWriteLearning,
} from '../../../src/services/ZavorthLearningWriteAuth.js';

jest.mock('../../../src/config/index.js', () => ({
  config: {
    allowedUserIds: ['111', '222'],
    whatsappAllowedChatIds: ['5511999990000', 'group-1'],
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
    expect(canActorWriteLearning({
      surface: 'whatsapp',
      userId: 'other',
      chatId: 'not-allowed',
    })).toBe(false);
    expect(canActorWriteLearning({
      surface: 'whatsapp',
      userId: 'x',
      chatId: 'group-1',
    })).toBe(true);
  });

  it('respects explicit allowLearningWrite override', () => {
    expect(canActorWriteLearning({
      surface: 'telegram',
      userId: '999',
      allowLearningWrite: true,
    })).toBe(true);
    expect(canActorWriteLearning({
      surface: 'cli',
      userId: 'any',
      allowLearningWrite: false,
    })).toBe(false);
  });

  it('allows other surfaces when userId is present', () => {
    expect(canActorWriteLearning({ surface: 'cli', userId: 'local-user' })).toBe(true);
    expect(canActorWriteLearning({ surface: 'web', userId: '' })).toBe(false);
  });
});
