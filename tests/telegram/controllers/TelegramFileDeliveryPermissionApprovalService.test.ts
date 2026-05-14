import { TelegramFileDeliveryPermissionApprovalService } from '../../../src/telegram/controllers/TelegramFileDeliveryPermissionApprovalService';

describe('TelegramFileDeliveryPermissionApprovalService', () => {
  function createService(overrides: Record<string, any> = {}) {
    return new TelegramFileDeliveryPermissionApprovalService({
      replyWithPermissionDecision: jest.fn(async (ctx) => {
        await ctx.reply('Acesso local do Zavorth liberado.');
      }),
      ...overrides,
    });
  }

  it('reports a delivery error without aborting the permission flow', async () => {
    const resumeFileDeliveryPermission = jest
      .fn()
      .mockRejectedValue(new Error('bridge offline'));
    const service = createService({
      resumeFileDeliveryPermission,
    });
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    const handled = await service.finalizeApproval(
      ctx,
      {
        permission_id: 'perm-file-1',
        executor: 'file_delivery',
        kind: 'workspace_access',
      } as any,
    );

    expect(handled).toBe(true);
    expect(resumeFileDeliveryPermission).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        permission_id: 'perm-file-1',
      }),
    );
    expect(ctx.reply).toHaveBeenNthCalledWith(1, 'Acesso local do Zavorth liberado.');
    expect(ctx.reply).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('nao consegui concluir o envio agora'),
    );
    expect(ctx.reply).toHaveBeenNthCalledWith(2, expect.stringContaining('bridge offline'));
  });

  it('falls back to inspection and reports inspection errors when delivery does not resume', async () => {
    const resumeFileDeliveryPermission = jest.fn().mockResolvedValue(false);
    const resumeFileInspectionPermission = jest
      .fn()
      .mockRejectedValue(new Error('inspection timeout'));
    const service = createService({
      resumeFileDeliveryPermission,
      resumeFileInspectionPermission,
    });
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    const handled = await service.finalizeApproval(
      ctx,
      {
        permission_id: 'perm-file-2',
        executor: 'file_delivery',
        kind: 'workspace_access',
      } as any,
    );

    expect(handled).toBe(true);
    expect(resumeFileDeliveryPermission).toHaveBeenCalled();
    expect(resumeFileInspectionPermission).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        permission_id: 'perm-file-2',
      }),
    );
    expect(ctx.reply).toHaveBeenNthCalledWith(1, 'Acesso local do Zavorth liberado.');
    expect(ctx.reply).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('nao consegui concluir a inspecao agora'),
    );
    expect(ctx.reply).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('inspection timeout'),
    );
  });
});
