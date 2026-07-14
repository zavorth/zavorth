import { TelegramConversationAutonomousService } from '../../../src/telegram/controllers/TelegramConversationAutonomousService';
import { TelegramConversationContextService } from '../../../src/telegram/controllers/TelegramConversationContextService';
import { TelegramConversationDecisionService } from '../../../src/telegram/controllers/TelegramConversationDecisionService';
import { TelegramConversationDirectReplyService } from '../../../src/telegram/controllers/TelegramConversationDirectReplyService';
import { TelegramConversationStateService } from '../../../src/telegram/controllers/TelegramConversationStateService';
import type { Task } from '../../../src/contracts/TaskContract';

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    task_id: 'task-telegram-autonomous',
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

describe('TelegramConversationAutonomousService', () => {
  it('routes autonomous Telegram work through ZavorthAgentGateway instead of GraphRuntimeService', async () => {
    const task = createTask({
      metadata: {
        responseDecision: {
          requestedTools: ['write_file', 'shell.exec'],
        },
      },
    });
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const agentGateway = {
      handle: jest.fn(async (input: any) => ({
        ok: true,
        run: {
          id: 'agent-run-telegram',
          traceId: 'trace-telegram',
          requestId: input.requestId,
          sessionId: input.sessionId,
          userId: input.userId,
          channel: 'telegram',
          title: input.text,
          input: input.text,
          workspace: input.workspace,
          status: 'waiting_approval',
          createdAt: '2026-05-02T00:00:00.000Z',
          updatedAt: '2026-05-02T00:00:00.000Z',
          summary: 'Preciso da sua aprovacao para continuar com seguranca.',
          events: [],
          toolExposure: {
            mode: 'restricted',
            summary: '2 ferramentas expostas com policy restricted.',
            tools: [
              { id: 'write_file', risk: 'danger', requiresApproval: true },
              { id: 'shell.exec', risk: 'danger', requiresApproval: true },
            ],
          },
          replyPorts: [],
          modelProfile: {},
          approvals: [
            {
              id: 'approval-telegram',
              status: 'pending',
              risk: 'danger',
            },
          ],
          artifacts: [],
          memorySignals: [],
          metadata: {},
        },
        replies: [
          {
            text: 'Preciso da sua aprovacao para continuar com seguranca.',
          },
        ],
      })),
    };
    const decisionService = new TelegramConversationDecisionService();
    const contextService = new TelegramConversationContextService({
      isContinuationIntent: (messageText) => decisionService.isContinuationIntent(messageText),
    });
    const stateService = new TelegramConversationStateService({
      buildWorkspaceStrategySnapshot: () => ({ taskKind: 'code' }),
    });
    const directReplyService = new TelegramConversationDirectReplyService({
      stateService,
    });
    const recordAssistantMessage = jest.fn();
    const service = new TelegramConversationAutonomousService({
      agentGateway,
      contextService,
      decisionService,
      directReplyService,
      recordAssistantMessage,
      stateService,
    } as any);

    await service.handleAutonomousSuggestion({
      ctx,
      task,
      messageText: task.raw_message,
      contextualMessage: task.raw_message,
      actionPayload: task.raw_message,
      userId: '42',
      chatId: '4242',
      convAgent: { chat: jest.fn() },
    });

    expect(agentGateway.handle).toHaveBeenCalledWith(expect.objectContaining({
      channel: 'telegram',
      text: task.raw_message,
      workspace: task.workspace,
      requestedTools: expect.arrayContaining(['write_file', 'shell.exec']),
      metadata: expect.objectContaining({
        graphRuntimeServiceCalled: false,
        responseDecision: expect.objectContaining({
          responsePath: 'agent-runtime',
        }),
      }),
    }));
    expect(task.metadata.agent_gateway_last_run).toEqual(expect.objectContaining({
      status: 'waiting_approval',
      entrypoint: 'ZavorthAgentGateway.handle',
      agentRunServiceUsed: true,
      graphRuntimeServiceCalled: false,
    }));
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringMatching(
        /Trabalho autonomo ativado no runtime governado\.|Autonomous work activated in the governed runtime\./,
      ),
      expect.anything(),
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      'Preciso da sua aprovacao para continuar com seguranca.',
      expect.anything(),
    );
  });
});
