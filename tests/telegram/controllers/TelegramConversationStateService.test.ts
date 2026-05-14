import { TelegramConversationStateService } from '../../../src/telegram/controllers/TelegramConversationStateService.js';

describe('TelegramConversationStateService', () => {
  it('finalizes direct conversational replies as completed tasks', () => {
    const advanceState = jest.fn((task: any, nextStatus: string) => {
      task.status = nextStatus;
    });
    const saveTask = jest.fn();
    const service = new TelegramConversationStateService({
      taskManager: {
        advanceState,
        saveTask,
      } as any,
      buildWorkspaceStrategySnapshot: () => ({}),
    });

    const task = {
      task_id: 'task-1',
      status: 'parsed',
      approval_status: 'not_required',
      raw_message: '/task me responda',
      result_summary: null,
      error_summary: null,
      metadata: {
        workspace_route_outcome: {
          final_status: 'parsed',
          source_surface: 'telegram',
        },
      },
    } as any;

    service.recordDirectResponseOutcome(
      task,
      'unknown' as any,
      'unknown' as any,
      [],
      { providerName: 'gemini', modelName: 'test-model' },
      null,
      'Resposta final',
      false,
    );

    expect(advanceState).toHaveBeenNthCalledWith(
      1,
      task,
      'running',
      expect.objectContaining({
        reason: 'direct_response_completed',
      }),
    );
    expect(advanceState).toHaveBeenNthCalledWith(
      2,
      task,
      'completed',
      expect.objectContaining({
        reason: 'direct_response_completed',
      }),
    );
    expect(task.status).toBe('completed');
    expect(task.result_summary).toBe('Resposta final');
    expect(task.metadata.workspace_route_outcome.final_status).toBe('completed');
    expect(saveTask).toHaveBeenCalled();
  });
});
