import { TelegramCallbackController } from '../../../src/telegram/controllers/TelegramCallbackController';

describe('TelegramCallbackController', () => {
  function createCtx(overrides: Record<string, unknown> = {}) {
    return {
      answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
      deleteMessage: jest.fn().mockResolvedValue(undefined),
      msg: { message_id: 10 },
      ...overrides,
    } as unknown as import('grammy').Context;
  }

  it('routes menu actions through the injected handlers', async () => {
    const handleStatusAction = jest.fn().mockResolvedValue(undefined);
    const controller = new TelegramCallbackController({
      handleHubCallback: jest.fn(),
      handlePermissionCallback: jest.fn(),
      handleExperienceActionCardCallback: jest.fn(),
      handleStatusAction,
      handleHelpAction: jest.fn(),
      handleAuditAction: jest.fn(),
      handleModeAction: jest.fn(),
      handleModelsAction: jest.fn(),
    });
    const ctx = createCtx();

    await controller.handleCallback(ctx, 'menu_status');

    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
    expect(handleStatusAction).toHaveBeenCalledWith(ctx);
  });

  it('delegates hub and permission callbacks without duplicating the ack', async () => {
    const handleHubCallback = jest.fn().mockResolvedValue(undefined);
    const handlePermissionCallback = jest.fn().mockResolvedValue(undefined);
    const controller = new TelegramCallbackController({
      handleHubCallback,
      handlePermissionCallback,
      handleExperienceActionCardCallback: jest.fn(),
      handleStatusAction: jest.fn(),
      handleHelpAction: jest.fn(),
      handleAuditAction: jest.fn(),
      handleModeAction: jest.fn(),
      handleModelsAction: jest.fn(),
    });
    const ctx = createCtx();

    await controller.handleCallback(ctx, 'hub:page:overview');
    await controller.handleCallback(ctx, 'perm:approve:abc123');

    expect(handleHubCallback).toHaveBeenCalledWith(ctx, 'hub:page:overview');
    expect(handlePermissionCallback).toHaveBeenCalledWith(ctx, 'perm:approve:abc123');
  });
});
