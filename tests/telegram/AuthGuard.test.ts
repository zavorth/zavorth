import { config } from '../../src/config/index';
import { AuthGuard } from '../../src/telegram/AuthGuard';

describe('AuthGuard', () => {
  const originalAllowedUserIds = [...config.allowedUserIds];
  const originalRoles = { ...config.telegramUserRoles };

  afterEach(() => {
    config.allowedUserIds = [...originalAllowedUserIds];
    config.telegramUserRoles = { ...originalRoles };
  });

  it('blocks hidden remote mode commands for vice-owners', async () => {
    config.allowedUserIds = ['42'];
    config.telegramUserRoles = { '42': ['vice-owner'] };

    const middleware = AuthGuard.middleware();
    const ctx = {
      chat: { id: 1, type: 'private' },
      from: { id: 42 },
      message: { text: '/remote@ZavorthBot on', message_id: 99 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const next = jest.fn();

    await middleware(ctx, next);

    expect(ctx.reply).toHaveBeenCalledWith(
    expect.stringContaining('Restricted Access'),
    expect.objectContaining({ parse_mode: 'Markdown' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('lets group service messages through for non-authorized users', async () => {
    config.allowedUserIds = [];

    const middleware = AuthGuard.middleware();
    const ctx = {
      chat: { id: 1, type: 'group' },
      from: { id: 42 },
      message: {
        message_id: 12,
        new_chat_members: [
          { id: 7, is_bot: false, first_name: 'Nova' },
        ],
      },
      reply: jest.fn().mockResolvedValue(undefined),
      api: {
        getChatMember: jest.fn(),
      },
    } as any;
    const next = jest.fn();

    await middleware(ctx, next);

    expect(next).toHaveBeenCalled();
    expect(ctx.api.getChatMember).not.toHaveBeenCalled();
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('lets normal group media pass through for moderation and stats', async () => {
    config.allowedUserIds = [];

    const middleware = AuthGuard.middleware();
    const ctx = {
      chat: { id: 1, type: 'group' },
      from: { id: 42 },
      message: {
        message_id: 13,
        photo: [{ file_id: 'photo-1' }],
      },
      reply: jest.fn().mockResolvedValue(undefined),
      api: {
        getChatMember: jest.fn(),
      },
    } as any;
    const next = jest.fn();

    await middleware(ctx, next);

    expect(next).toHaveBeenCalled();
    expect(ctx.api.getChatMember).not.toHaveBeenCalled();
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('allows normalized group admin commands for Telegram admins', async () => {
    config.allowedUserIds = [];

    const middleware = AuthGuard.middleware();
    const getChatMember = jest.fn().mockResolvedValue({ status: 'administrator' });
    const ctx = {
      chat: { id: 1, type: 'supergroup' },
      from: { id: 42 },
      message: { text: '/ban@ZavorthBot 123456', message_id: 88 },
      reply: jest.fn().mockResolvedValue(undefined),
      api: { getChatMember },
    } as any;
    const next = jest.fn();

    await middleware(ctx, next);

    expect(getChatMember).toHaveBeenCalledWith(1, 42);
    expect(next).toHaveBeenCalled();
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('keeps blocking normalized non-admin commands in groups', async () => {
    config.allowedUserIds = [];

    const middleware = AuthGuard.middleware();
    const getChatMember = jest.fn().mockResolvedValue({ status: 'member' });
    const ctx = {
      chat: { id: 1, type: 'group' },
      from: { id: 42 },
      message: { text: '/external@ZavorthBot revise o código', message_id: 77 },
      reply: jest.fn().mockResolvedValue(undefined),
      api: { getChatMember },
    } as any;
    const next = jest.fn();

    await middleware(ctx, next);

    expect(getChatMember).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ reply_to_message_id: 77 }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks natural-language ZavorthBridge control shortcuts for vice-owners', async () => {
    config.allowedUserIds = ['42'];
    config.telegramUserRoles = { '42': ['vice-owner'] };

    const middleware = AuthGuard.middleware();
    const ctx = {
      chat: { id: 1, type: 'private' },
      from: { id: 42 },
      message: { text: 'abrir zavorthBridge', message_id: 100 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const next = jest.fn();

    await middleware(ctx, next);

    expect(ctx.reply).toHaveBeenCalledWith(
    expect.stringContaining('Restricted Access'),
    expect.objectContaining({ parse_mode: 'Markdown' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks /selfmod for vice-owners', async () => {
    config.allowedUserIds = ['42'];
    config.telegramUserRoles = { '42': ['vice-owner'] };

    const middleware = AuthGuard.middleware();
    const ctx = {
      chat: { id: 1, type: 'private' },
      from: { id: 42 },
      message: { text: '/selfmod src/telegram/AuthGuard.ts -- endurecer o guard', message_id: 101 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const next = jest.fn();

    await middleware(ctx, next);

    expect(ctx.reply).toHaveBeenCalledWith(
    expect.stringContaining('Restricted Access'),
    expect.objectContaining({ parse_mode: 'Markdown' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks /autorepair for vice-owners', async () => {
    config.allowedUserIds = ['42'];
    config.telegramUserRoles = { '42': ['vice-owner'] };

    const middleware = AuthGuard.middleware();
    const ctx = {
      chat: { id: 1, type: 'private' },
      from: { id: 42 },
      message: { text: '/autorepair force', message_id: 103 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const next = jest.fn();

    await middleware(ctx, next);

    expect(ctx.reply).toHaveBeenCalledWith(
    expect.stringContaining('Restricted Access'),
    expect.objectContaining({ parse_mode: 'Markdown' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks /automations for vice-owners', async () => {
    config.allowedUserIds = ['42'];
    config.telegramUserRoles = { '42': ['vice-owner'] };

    const middleware = AuthGuard.middleware();
    const ctx = {
      chat: { id: 1, type: 'private' },
      from: { id: 42 },
      message: { text: '/automations maintenance on', message_id: 104 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const next = jest.fn();

    await middleware(ctx, next);

    expect(ctx.reply).toHaveBeenCalledWith(
    expect.stringContaining('Restricted Access'),
    expect.objectContaining({ parse_mode: 'Markdown' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('forces execution commands into read-only mode when the host is not authorized', async () => {
    config.allowedUserIds = ['42'];
    config.telegramUserRoles = { '42': ['admin'] };

    const hostIdentityService = {
      getStatus: jest.fn().mockReturnValue({
        authorized: false,
        firstRun: false,
        currentFingerprint: 'current-host',
        storedFingerprint: 'stored-host',
      }),
    } as any;
    const middleware = AuthGuard.middleware(hostIdentityService);
    const ctx = {
      chat: { id: 1, type: 'private' },
      from: { id: 42 },
      message: { text: '/run npm test', message_id: 102 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const next = jest.fn();

    await middleware(ctx, next);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('read-only mode'),
      expect.objectContaining({ parse_mode: 'Markdown' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('allows /access and /bootstrap while the host is in read-only mode', async () => {
    config.allowedUserIds = ['42'];
    config.telegramUserRoles = { '42': ['admin'] };

    const hostIdentityService = {
      getStatus: jest.fn().mockReturnValue({
        authorized: false,
        firstRun: false,
        currentFingerprint: 'current-host',
        storedFingerprint: 'stored-host',
      }),
    } as any;
    const middleware = AuthGuard.middleware(hostIdentityService);
    const next = jest.fn();

    const accessCtx = {
      chat: { id: 1, type: 'private' },
      from: { id: 42 },
      message: { text: '/access remote', message_id: 104 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await middleware(accessCtx, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(accessCtx.reply).not.toHaveBeenCalled();

    const bootstrapCtx = {
      chat: { id: 1, type: 'private' },
      from: { id: 42 },
      message: { text: '/bootstrap', message_id: 105 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await middleware(bootstrapCtx, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(bootstrapCtx.reply).not.toHaveBeenCalled();
  });
});
