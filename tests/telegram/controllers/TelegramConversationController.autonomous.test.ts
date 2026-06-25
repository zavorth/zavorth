import { TelegramConversationController } from '../../../src/telegram/controllers/TelegramConversationController';
import type { Task } from '../../../src/contracts/TaskContract';

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    task_id: 'task-controller-autonomous',
    created_at: '2026-05-02T00:00:00.000Z',
    updated_at: '2026-05-02T00:00:00.000Z',
    source: 'telegram',
    chat_id: '4242',
    user_id: '42',
    raw_message: 'corrija o arquivo package.json e rode npm test',
    normalized_message: 'corrija o arquivo package.json e rode npm test',
    command_type: '/task',
    intent: 'conversation',
    target: null,
    workspace: 'C:\\workspace\\app',
    risk_level: 1,
    status: 'pending',
    requires_planning: false,
    requires_approval: false,
    approval_status: 'not_required',
    planner_used: null,
    executor_used: null,
    fallback_used: false,
    parent_task_id: null,
    actions_planned: [],
    actions_executed: [],
    target_files: [],
    artifacts: [],
    stdout_summary: null,
    stderr_summary: null,
    diff_summary: null,
    result_summary: null,
    error_summary: null,
    rollback_available: false,
    metadata: {},
    ...overrides,
  };
}

describe('TelegramConversationController autonomous gateway routing', () => {
  it('keeps an explicit GraphRuntimeService backend behind AgentRunService approval', async () => {
    const task = createTask();
    const ctx = {
      chat: { id: 4242 },
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined),
      api: {
        sendChatAction: jest.fn().mockResolvedValue(undefined),
      },
    } as any;
    const graphRuntime = {
      runAutonomousTask: jest.fn().mockResolvedValue({
        ok: true,
        status: 'completed',
        finalReply: 'Graph executou depois da aprovacao.',
      }),
    };
    const sessionTarget = {
      runtimeUserId: '42',
      platform: 'telegram',
      chatId: '4242',
      sessionId: 'telegram:4242',
      sourceUserId: '42',
    };
    const controller = new TelegramConversationController(
      { dispatchToIDE: jest.fn() } as any,
      undefined,
      graphRuntime as any,
      {
        sessionLedgerService: {
          appendMessage: jest.fn(),
        } as any,
        sessionReadModelService: {
          resolveTarget: jest.fn(() => sessionTarget),
          buildSnapshot: jest.fn().mockResolvedValue(null),
        } as any,
      },
    );

    await controller.handleConversational(ctx, task, task.raw_message);

    expect(graphRuntime.runAutonomousTask).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Trabalho autonomo ativado no runtime governado.'),
      expect.anything(),
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('approval'),
      expect.anything(),
    );
    expect(task.metadata.agent_gateway_last_run).toEqual(expect.objectContaining({
      status: 'waiting_approval',
      entrypoint: 'ZavorthAgentGateway.handle',
      agentRunServiceUsed: true,
      graphRuntimeServiceCalled: false,
    }));
  });
});
