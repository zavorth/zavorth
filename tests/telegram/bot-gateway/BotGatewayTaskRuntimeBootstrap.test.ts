import {
  buildTaskNaturalConversationIngress,
} from '../../../src/telegram/bot-gateway/BotGatewayTaskRuntimeBootstrap';
import type { Task } from '../../../src/contracts/TaskContract';

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    task_id: 'task-12345678',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source: 'telegram',
    chat_id: '42',
    user_id: '42',
    raw_message: '/task me ajude',
    normalized_message: '/task me ajude',
    command_type: '/task',
    intent: 'unknown',
    target: null,
    workspace: null,
    risk_level: 0,
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

describe('BotGatewayTaskRuntimeBootstrap', () => {
  it('routes task natural conversation through the LegacyUnifiedGatewayAdapter fallback and persists the result summary', async () => {
    const task = createTask();
    const taskManager = {
      saveTask: jest.fn(),
    } as any;
    const gateway = {
      logRepo: {
        log: jest.fn(),
      },
      legacyUnifiedGateway: {
        handleEvent: jest.fn().mockResolvedValue({
          responseText: 'Response through the unified ingress.',
        }),
      },
    };
    const ingress = buildTaskNaturalConversationIngress(gateway, taskManager);
    const ctx = {
      chat: { id: 42, type: 'private' },
      from: { id: 99 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await ingress(ctx, task, 'me ajude com esse projeto');

    expect(gateway.legacyUnifiedGateway.handleEvent).toHaveBeenCalledWith(expect.objectContaining({
      surface: 'telegram',
      chatId: '42',
      userId: '99',
      text: 'me ajude com esse projeto',
      metadata: expect.objectContaining({
        phase: 'legacy-unified-task-route-v1',
        taskId: 'task-12345678',
        source: 'telegram',
      }),
    }));
    expect(task.result_summary).toBe('Response through the unified ingress.');
    expect(taskManager.saveTask).toHaveBeenCalledWith(task);
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('delivers LegacyUnifiedGatewayAdapter task replies through the Echo output stage when available', async () => {
    const task = createTask();
    const taskManager = {
      saveTask: jest.fn(),
    } as any;
    const echoOutputStage = {
      deliver: jest.fn().mockResolvedValue({ delivered: 'voice' }),
    };
    const gateway = {
      logRepo: {
        log: jest.fn(),
      },
      echoOutputStage,
      legacyUnifiedGateway: {
        handleEvent: jest.fn(async (event: any) => {
          await event.reply('Voice response through the unified ingress.');
          return {
            responseText: 'Voice response through the unified ingress.',
          };
        }),
      },
    };
    const ingress = buildTaskNaturalConversationIngress(gateway, taskManager);
    const ctx = {
      chat: { id: 42, type: 'private' },
      from: { id: 99 },
      api: {
        sendChatAction: jest.fn().mockResolvedValue(undefined),
      },
      reply: jest.fn().mockResolvedValue(undefined),
      replyWithVoice: jest.fn().mockResolvedValue(undefined),
    } as any;

    await ingress(ctx, task, 'can you respond with audio-');

    expect(echoOutputStage.deliver).toHaveBeenCalledWith(expect.objectContaining({
      surface: 'telegram',
      text: 'Voice response through the unified ingress.',
      rawInput: 'can you respond with audio-',
      taskId: 'task-12345678',
      requestedBy: '99',
      sessionId: '42',
      sink: expect.objectContaining({
        sendText: expect.any(Function),
        sendChatAction: expect.any(Function),
        sendVoice: expect.any(Function),
      }),
    }));
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('returns a safe user-facing error instead of falling back to the legacy conversation controller when LegacyUnifiedGatewayAdapter is unavailable', async () => {
    const task = createTask();
    const taskManager = {
      saveTask: jest.fn(),
    } as any;
    const gateway = {
      logRepo: {
        log: jest.fn(),
      },
      legacyUnifiedGateway: null,
    };
    const ingress = buildTaskNaturalConversationIngress(gateway, taskManager);
    const ctx = {
      chat: { id: 42, type: 'private' },
      from: { id: 99 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await ingress(ctx, task, 'me ajude com esse projeto');

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toMatch(
      /conversa unificada|unified conversation|LegacyUnifiedGatewayAdapter/i,
    );
    expect(gateway.logRepo.log).toHaveBeenCalledWith(
      'error',
      'BotGateway',
      expect.stringMatching(/LegacyUnifiedGatewayAdapter unavailable/),
      expect.anything(),
    );
    expect(taskManager.saveTask).not.toHaveBeenCalled();
  });
});
