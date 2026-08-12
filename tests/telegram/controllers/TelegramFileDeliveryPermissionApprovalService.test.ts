import { TelegramFileDeliveryPermissionApprovalService } from '../../../src/telegram/controllers/TelegramFileDeliveryPermissionApprovalService';

describe('TelegramFileDeliveryPermissionApprovalService', () => {
  function createService(overrides: Record<string, any> = {}) {
    return new TelegramFileDeliveryPermissionApprovalService({
      replyWithPermissionDecision: jest.fn(async (ctx) => {
        await ctx.reply('Permission approved');
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
    expect(ctx.reply).toHaveBeenNthCalledWith(1, 'Permission approved');
    expect(String(ctx.reply.mock.calls[1]?.[0] ?? '')).toMatch(/could not complete|bridge offline|nao consegui/i);
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
    expect(ctx.reply).toHaveBeenNthCalledWith(1, 'Permission approved');
    expect(ctx.reply).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('could not complete'),
    );
    expect(ctx.reply).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('inspection timeout'),
    );
  });
});
