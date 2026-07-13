import { SharedSurfaceWatchModeCommandPack } from '../../src/domain/surface/presentation/shared-surface/SharedSurfaceWatchModeCommandPack';

function buildCtx(rawText = '/watchmode') {
  return {
    platform: 'telegram',
    userId: 'telegram-user',
    chatId: 'telegram:chat-1',
    isGroup: false,
    rawText,
    reply: jest.fn(async () => undefined),
    editMessage: jest.fn(async () => undefined),
  };
}

function buildPack(overrides: Record<string, any> = {}): SharedSurfaceWatchModeCommandPack {
  return new SharedSurfaceWatchModeCommandPack({
    watchModeControlPlaneService: {
      renderReport: jest.fn(() => 'Watch mode: Watch Mode supervisionado\nPostura: healthy.'),
    } as any,
    watchModePolicyFileService: {
      setStrictApprovalDefault: jest.fn(),
      allowApp: jest.fn(),
      allowSite: jest.fn(),
    } as any,
    permissionService: {
      findApprovedRequest: jest.fn(async () => null),
      createRequest: jest.fn(async () => ({
        permission_id: 'perm-watch-1',
        status: 'pending',
        scope: 'once',
      })),
      getRequest: jest.fn(async () => null),
    } as any,
    ...overrides,
  });
}

describe('SharedSurfaceWatchModeCommandPack', () => {
  it('renders the Watch Mode control plane', async () => {
    const renderReport = jest.fn(() => 'Watch Mode supervisionado');
    const pack = buildPack({
      watchModeControlPlaneService: { renderReport } as any,
    });
    const ctx = buildCtx('/watchmode status');

    const handled = await pack.maybeHandle(ctx as any, '/watchmode', 'status');

    expect(handled).toBe(true);
    expect(renderReport).toHaveBeenCalledTimes(1);
    expect(ctx.reply).toHaveBeenCalledWith('Watch Mode supervisionado');
  });

  it('applies strict approval on directly because it reduces risk', async () => {
    const setStrictApprovalDefault = jest.fn();
    const renderReport = jest.fn(() => 'Watch Mode strict policy on');
    const pack = buildPack({
      watchModeControlPlaneService: { renderReport } as any,
      watchModePolicyFileService: {
        setStrictApprovalDefault,
        allowApp: jest.fn(),
        allowSite: jest.fn(),
      } as any,
    });
    const ctx = buildCtx('/watchmode strict on');

    const handled = await pack.maybeHandle(ctx as any, '/watchmode', 'strict on');

    expect(handled).toBe(true);
    expect(setStrictApprovalDefault).toHaveBeenCalledWith(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Policy do Watch Mode atualizada.'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Watch Mode strict policy on'));
  });

  it('creates a mutation preview for strict approval off', async () => {
    const setStrictApprovalDefault = jest.fn();
    const permissionService = {
      findApprovedRequest: jest.fn(async () => null),
      createRequest: jest.fn(async () => ({
        permission_id: 'perm-watch-preview',
        status: 'pending',
        scope: 'once',
      })),
      getRequest: jest.fn(async () => null),
    };
    const pack = buildPack({
      watchModePolicyFileService: {
        setStrictApprovalDefault,
        allowApp: jest.fn(),
        allowSite: jest.fn(),
      } as any,
      permissionService: permissionService as any,
    });
    const ctx = buildCtx('/watchmode strict off');

    const handled = await pack.maybeHandle(ctx as any, '/watchmode', 'strict off');

    expect(handled).toBe(true);
    expect(setStrictApprovalDefault).not.toHaveBeenCalled();
    expect(permissionService.createRequest).toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Watch Mode em preview'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('/watchmode apply'));
  });

  it('rejects empty allow-app arguments with usage guidance', async () => {
    const pack = buildPack();
    const ctx = buildCtx('/watchmode allow-app');

    const handled = await pack.maybeHandle(ctx as any, '/watchmode', 'allow-app');

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('/watchmode <janela>'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('allow-app'));
  });

  it('treats free text window name as allow-app primary action', async () => {
    const permissionService = {
      findApprovedRequest: jest.fn(async () => null),
      createRequest: jest.fn(async () => ({
        permission_id: 'perm-watch-app',
        status: 'pending',
        scope: 'once',
      })),
      getRequest: jest.fn(async () => null),
    };
    const pack = buildPack({ permissionService: permissionService as any });
    const ctx = buildCtx('/watchmode Chrome');

    const handled = await pack.maybeHandle(ctx as any, '/watchmode', 'allow-app Chrome');

    expect(handled).toBe(true);
    expect(permissionService.createRequest).toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Watch Mode em preview'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('allow-app Chrome'));
  });

  it('ignores unrelated commands', async () => {
    const pack = buildPack();
    const ctx = buildCtx('/hub');

    const handled = await pack.maybeHandle(ctx as any, '/hub', '');

    expect(handled).toBe(false);
    expect(ctx.reply).not.toHaveBeenCalled();
  });
});
