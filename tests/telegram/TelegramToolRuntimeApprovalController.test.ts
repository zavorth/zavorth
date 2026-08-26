import { TelegramEchoApprovalController } from '../../src/telegram/controllers/TelegramToolRuntimeApprovalController';

function createPermission(id = 'approval-echo-1234567890') {
  return {
    id,
    action: 'os_screenshot',
    resource: '{"mode":"fullscreen"}',
    reason: 'Validar approval Echo no Telegram real.',
    status: 'pending',
    requestedAt: '2026-04-18T12:00:00.000Z',
    approvalId: id,
    correlation: {
      traceId: 'trace-telegram-echo',
      runId: 'run-telegram-echo',
      sessionId: 'agent-session',
      approvalId: id,
      artifactId: null,
    },
    runContext: {
      traceId: 'trace-telegram-echo',
      runId: 'run-telegram-echo',
      sessionId: 'agent-session',
      surface: 'agent',
      requestedBy: 'zavorth-agent',
      profile: 'OS',
    },
    metadata: {},
  };
}

function createContext() {
  return {
    chat: { id: 4242, type: 'private' },
    from: { id: 777 },
    message: { message_thread_id: 9 },
    reply: jest.fn(),
    answerCallbackQuery: jest.fn(),
    editMessageText: jest.fn(),
  } as any;
}

function createController(permission = createPermission()) {
  const resolvePermission = jest.fn(async (id: string, approved: boolean) => ({
    ok: true,
    id,
    status: approved ? 'approved' : 'denied',
  }));
  const readPendingPermissions = jest.fn(async () => [permission]);
  const getSurfaceContext = jest.fn(() => ({
    channel: 'telegram',
    chatId: '4242',
    threadId: '9',
    userId: '777',
    sessionId: 'telegram-4242-thread-9',
    surface: 'telegram',
    requestedBy: 'telegram:777',
  }));
  const factory = jest.fn(() => ({
    getSurfaceContext,
    readPendingPermissions,
    resolvePermission,
  }));

  return {
    controller: new TelegramEchoApprovalController({ clientFactory: factory }),
    factory,
    getSurfaceContext,
    readPendingPermissions,
    resolvePermission,
  };
}

describe('TelegramEchoApprovalController', () => {
  it('lists Echo approvals with inline approval controls', async () => {
    const ctx = createContext();
    const { controller, factory } = createController();

    await controller.handleEchoCommand(ctx, 'list');

    expect(factory).toHaveBeenCalledWith(expect.objectContaining({
      chatId: '4242',
      threadId: '9',
      userId: '777',
      requestedBy: 'telegram:777',
    }));
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Pending Echo approvals (1)');
      expect(ctx.reply.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ reply_markup: expect.any(Object) }));
    expect(ctx.reply.mock.calls[0][0]).toContain('run-telegram-echo');
  });

  it('resolves a Echo approval from an inline callback', async () => {
    const ctx = createContext();
    const { controller, resolvePermission } = createController();

    await controller.handleEchoCallback(ctx, 'echo:approve:approval-echo-1');

    expect(resolvePermission).toHaveBeenCalledWith('approval-echo-1234567890', true);
    const answerText = String(ctx.answerCallbackQuery.mock.calls[0]?.[0]?.text ?? '');
    expect(answerText).toMatch(/Approval Echo aprovado\.?|Echo approval approved\.?/i);
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      expect.stringMatching(/Approval Echo aprovado\.?|Echo approval approved\.?/i),
    );
  });

  it('resolves a Echo approval from a text command', async () => {
    const ctx = createContext();
    const { controller, resolvePermission } = createController();

    await controller.handleEchoCommand(ctx, 'reject approval-echo-1');

    expect(resolvePermission).toHaveBeenCalledWith('approval-echo-1234567890', false);
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Echo approval denied');
  });
});
