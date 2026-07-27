import type { Task } from '../../../src/contracts/TaskContract';
import { TelegramConversationDecisionService } from '../../../src/gateways/channels/telegram/controllers/TelegramConversationDecisionService';

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    task_id: 'task-1',
    created_at: '2026-07-16T00:00:00.000Z',
    updated_at: '2026-07-16T00:00:00.000Z',
    source: 'telegram',
    chat_id: 'chat-1',
    user_id: 'user-1',
    raw_message: '',
    normalized_message: '',
    command_type: '/task',
    intent: 'unknown',
    target: null,
    workspace: null,
    risk_level: 0,
    status: 'parsed',
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

describe('TelegramConversationDecisionService', () => {
  const service = new TelegramConversationDecisionService();

  it('activates execution from structured autonomy payload when workspace signal exists', async () => {
    const result = await service.decideAutonomousExecution(
      createTask({ workspace: 'C:/workspace' }),
      'please help with this workspace task',
      '{"mode":"autonomous","task":"apply approved workspace changes"}',
    );

    expect(result).toEqual(expect.objectContaining({
      mode: 'autonomous',
      reason: 'automation_requires_control',
      taskKind: 'automation',
      taskSubtype: 'app_control',
    }));
  });

  it('returns direct_by_default without structured autonomy signal or workspace signal', async () => {
    const result = await service.decideAutonomousExecution(
      createTask(),
      'please update the system',
      'please update the system',
    );

    expect(result).toEqual(expect.objectContaining({
      mode: 'direct',
      reason: 'direct_by_default',
    }));
  });

  it('does not infer continuation from natural-language keywords', () => {
    expect(service.isContinuationIntent('continue')).toBe(false);
    expect(service.isContinuationIntent('resume')).toBe(false);
  });
});
