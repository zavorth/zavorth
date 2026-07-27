import { TelegramCallbackController } from '../../src/telegram/controllers/TelegramCallbackController';

describe('TelegramCallbackController Echo callbacks', () => {
  it('routes echo callbacks to the Echo approval handler', async () => {
    const handleEchoApprovalCallback = jest.fn();
    const controller = new TelegramCallbackController({
      handleHubCallback: jest.fn(),
      handlePermissionCallback: jest.fn(),
      handleEchoApprovalCallback,
      handleStatusAction: jest.fn(),
      handleHelpAction: jest.fn(),
      handleAuditAction: jest.fn(),
      handleModeAction: jest.fn(),
      handleModelsAction: jest.fn(),
    });
    const ctx = {
      answerCallbackQuery: jest.fn(),
    } as any;

    await controller.handleCallback(ctx, 'echo:approve:approval-echo-1');

    expect(handleEchoApprovalCallback).toHaveBeenCalledWith(ctx, 'echo:approve:approval-echo-1');
    expect(ctx.answerCallbackQuery).not.toHaveBeenCalledWith({ text: 'Comando not reconhecido.' });
  });
});
