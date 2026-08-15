import { GatewayCallbackRouter } from '../../../src/telegram/bot-gateway/GatewayCallbackRouter';

describe('GatewayCallbackRouter', () => {
  function createRouter(overrides: Record<string, any> = {}) {
    const deps = {
      handleHubCallback: jest.fn().mockResolvedValue(undefined),
      handlePermissionCallback: jest.fn().mockResolvedValue(undefined),
      handleEchoApprovalCallback: jest.fn().mockResolvedValue(undefined),
      handleMnemosCallback: jest.fn().mockResolvedValue(undefined),
      handleStatusAction: jest.fn().mockResolvedValue(undefined),
      handleHelpAction: jest.fn().mockResolvedValue(undefined),
      handleAuditAction: jest.fn().mockResolvedValue(undefined),
      handleModeAction: jest.fn().mockResolvedValue(undefined),
      handleModelsAction: jest.fn().mockResolvedValue(undefined),
      handleSurfaceCommandCallback: jest.fn().mockResolvedValue(undefined),
      logError: jest.fn(),
      ...overrides,
    };

    return {
      deps,
      router: new GatewayCallbackRouter(deps),
    };
  }

  function createCtx(overrides: Record<string, any> = {}) {
    return {
      answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
      deleteMessage: jest.fn().mockResolvedValue(undefined),
      msg: { message_id: 10 },
      ...overrides,
    } as any;
  }

  it('routes inline permission callbacks without adding a duplicate ack', async () => {
    const { deps, router } = createRouter();
    const ctx = createCtx();

    await router.handleCallback(ctx, 'perm:approve:abc123');

    expect(deps.handlePermissionCallback).toHaveBeenCalledWith(ctx, 'perm:approve:abc123');
    expect(ctx.answerCallbackQuery).not.toHaveBeenCalled();
  });

  it('acknowledges menu callbacks before invoking the menu action', async () => {
    const { deps, router } = createRouter();
    const ctx = createCtx();

    await router.handleCallback(ctx, 'menu_models');

    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith();
    expect(deps.handleModelsAction).toHaveBeenCalledWith(ctx);
  });

  it('keeps delete callbacks idempotent for stale messages', async () => {
    const { router } = createRouter();
    const ctx = createCtx({
      deleteMessage: jest.fn().mockRejectedValue(new Error('message gone')),
    });

    await router.handleCallback(ctx, 'action:delete');

    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith();
  });

  it('routes safe command-like surface callbacks through the shared command callback handler', async () => {
    const { deps, router } = createRouter();
    const ctx = createCtx();

    await router.handleCallback(ctx, '/channels status whatsapp');

    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith();
    expect(deps.handleSurfaceCommandCallback).toHaveBeenCalledWith(ctx, '/channels status whatsapp');
  });

  it('rejects forged mutating shared-surface callbacks', async () => {
    const { deps, router } = createRouter();
    const ctx = createCtx();

    await router.handleCallback(ctx, '/channels logout whatsapp');

    expect(deps.handleSurfaceCommandCallback).not.toHaveBeenCalled();
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({ text: 'Command not recognized.' });
  });

  it('reports callback errors through the injected logger and user ack', async () => {
    const { deps, router } = createRouter({
      handleStatusAction: jest.fn().mockRejectedValue(new Error('boom')),
    });
    const ctx = createCtx();

    await router.handleCallback(ctx, 'menu_status');

    expect(deps.logError).toHaveBeenCalledWith('boom');
    expect(ctx.answerCallbackQuery).toHaveBeenLastCalledWith({ text: 'Error processing.' });
  });
});
