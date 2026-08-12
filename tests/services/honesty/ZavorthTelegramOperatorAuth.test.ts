import {
  canTelegramActorWriteLearning,
  isTelegramHostMutationCommand,
  isZavorthTelegramOperator,
} from '../../../src/services/ZavorthTelegramOperatorAuth.js';

jest.mock('../../../src/config/index.js', () => ({
  config: {
    allowedUserIds: ['111', '222'],
  },
}));

describe('ZavorthTelegramOperatorAuth', () => {
  it('accepts only allowlisted operator ids', () => {
    expect(isZavorthTelegramOperator('111')).toBe(true);
    expect(isZavorthTelegramOperator(222)).toBe(true);
    expect(isZavorthTelegramOperator('999')).toBe(false);
    expect(isZavorthTelegramOperator('')).toBe(false);
  });

  it('allows durable learning write only for operators when allowlist is set', () => {
    expect(canTelegramActorWriteLearning('111')).toBe(true);
    expect(canTelegramActorWriteLearning('999')).toBe(false);
    expect(canTelegramActorWriteLearning('')).toBe(false);
  });

  it('detects host mutation phrases for setup and learning', () => {
    expect(isTelegramHostMutationCommand('pular setup')).toBe(true);
    expect(isTelegramHostMutationCommand('refazer setup')).toBe(true);
    expect(isTelegramHostMutationCommand('desfazer aprendizado pref-1')).toBe(true);
    expect(isTelegramHostMutationCommand('oi tudo bem')).toBe(false);
    expect(isTelegramHostMutationCommand('o que voce sabe fazer?')).toBe(false);
  });
});
