import { BotGateway } from '../../src/telegram/BotGateway';
import { config } from '../../src/config/index';

describe('BotGateway role-aware broadcast recipients', () => {
  const originalAllowed = [...config.allowedUserIds];
  const originalRoles = { ...config.telegramUserRoles };

  afterEach(() => {
    (config as any).allowedUserIds = [...originalAllowed];
    (config as any).telegramUserRoles = { ...originalRoles };
  });

  it('filters recipients using the configured role map', () => {
    (config as any).allowedUserIds = ['100', '200', '300'];
    (config as any).telegramUserRoles = {
      '100': ['admin'],
      '200': ['operator'],
      '300': ['viewer'],
    };

    const gateway = Object.create(BotGateway.prototype) as any;

    expect(gateway.resolveBroadcastRecipients(['operator'])).toEqual(['200']);
    expect(gateway.resolveBroadcastRecipients(['admin', 'viewer'])).toEqual(['100', '300']);
  });
});
