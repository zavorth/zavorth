import { TelegramCodexRemotePermissionApprovalService } from '../../../src/telegram/controllers/TelegramCodexRemotePermissionApprovalService';

describe('TelegramCodexRemotePermissionApprovalService', () => {
  it('executes approved Codex Remote permissions and replies with the result', async () => {
    const execute = jest.fn(async () => ({
      action: {
        note: 'Sessao codex-1 iniciada. Pedido perm-1 aprovado e executado.',
      },
      permission: {
        permission_id: 'perm-1',
        status: 'approved',
      },
      session: {
        record: {
          sessionId: 'codex-1',
          title: 'Demo',
          handoffCommand: '/open-session session-web-1',
        },
        operatorSummary: 'Sessao em execucao.',
      },
    }));
    const service = new TelegramCodexRemotePermissionApprovalService({
      codexRemoteActionService: { execute } as any,
    });
    const ctx = {
      reply: jest.fn(async () => undefined),
    };

    const handled = await service.finalizeApproval(
      ctx as any,
      {
        permission_id: 'perm-1',
        executor: 'codex_remote',
      } as any,
      'telegram-user',
    );

    expect(handled).toBe(true);
    expect(execute).toHaveBeenCalledWith({
      actionId: 'approve-permission',
      permissionId: 'perm-1',
      runtimeUserId: 'telegram-user',
      skipApproval: true,
    });
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Sessao codex-1 iniciada');
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('/open-session session-web-1');
  });

  it('ignores non-Codex Remote permissions', async () => {
    const execute = jest.fn();
    const service = new TelegramCodexRemotePermissionApprovalService({
      codexRemoteActionService: { execute } as any,
    });

    const handled = await service.finalizeApproval(
      { reply: jest.fn(async () => undefined) } as any,
      {
        permission_id: 'perm-1',
        executor: 'external_executor',
      } as any,
      'telegram-user',
    );

    expect(handled).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });
});
