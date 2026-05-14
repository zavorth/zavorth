import { SurfaceIdentityService } from '../../src/services/SurfaceIdentityService';

describe('SurfaceIdentityService', () => {
  it('persists rich surface links and resolves the principal id', () => {
    let persisted = '';
    const service = new SurfaceIdentityService({
      now: () => new Date('2026-04-01T12:00:00.000Z'),
      existsSync: () => Boolean(persisted),
      readFileSync: () => persisted,
      writeFileSync: (_path, content) => {
        persisted = String(content);
      },
      mkdirSync: () => undefined as any,
      allowedTelegramUserIds: ['telegram-admin'],
    });

    service.linkIdentity({
      source: 'web',
      sourceUserId: 'session-123',
      runtimeUserId: 'telegram-admin',
      sessionId: 'session-123',
      chatId: 'web:session-123',
      linkedBy: 'web-session',
      verificationMethod: 'dashboard-auth',
    });

    expect(service.resolveRuntimeUserId({
      source: 'web',
      sourceUserId: 'session-123',
      fallbackRuntimeUserId: 'fallback',
    })).toBe('telegram-admin');
    expect(service.listPrincipalUserIds('telegram-admin')).toEqual(['telegram-admin', 'session-123']);
    expect(service.listLinkedSurfaces('telegram-admin')).toEqual([
      {
        source: 'web',
        sourceUserId: 'session-123',
        linkedAt: '2026-04-01T12:00:00.000Z',
      },
    ]);
  });
});
