import { ContextManager } from '../../src/orchestrator/ContextManager';

describe('ContextManager', () => {
  it('attaches the latest task using only TaskManager public methods', async () => {
    const saveTask = jest.fn();
    const getLatestTaskForUser = jest.fn().mockReturnValue({
      task_id: 'previous-task',
      target: 'src/index.ts',
      workspace: 'C:/workspace/zavorth',
    });
    const taskManager = { saveTask, getLatestTaskForUser } as any;
    const manager = new ContextManager(taskManager);
    const currentTask = {
      task_id: 'current-task',
      user_id: 'user-1',
      normalized_message: 'continue a anterior e finalize',
      metadata: {},
      target: null,
      workspace: null,
      parent_task_id: null,
    } as any;

    await manager.attachRecentContext(currentTask);

    expect(getLatestTaskForUser).toHaveBeenCalledWith('user-1', 'current-task');
    expect(currentTask.parent_task_id).toBe('previous-task');
    expect(currentTask.target).toBe('src/index.ts');
    expect(currentTask.workspace).toBe('C:/workspace/zavorth');
    expect(currentTask.metadata.inherited_from).toBe('previous-task');
    expect(saveTask).toHaveBeenCalledWith(currentTask);
  });

  it('does nothing when there is no previous task for the user', async () => {
    const saveTask = jest.fn();
    const getLatestTaskForUser = jest.fn().mockReturnValue(undefined);
    const manager = new ContextManager({ saveTask, getLatestTaskForUser } as any);
    const currentTask = {
      task_id: 'current-task',
      user_id: 'user-1',
      normalized_message: 'me ajude com isso',
      metadata: {},
      target: null,
      workspace: null,
      parent_task_id: null,
    } as any;

    await manager.attachRecentContext(currentTask);

    expect(saveTask).not.toHaveBeenCalled();
    expect(currentTask.parent_task_id).toBeNull();
  });

  it('inherits target and workspace for short follow-up prompts like cade', async () => {
    const saveTask = jest.fn();
    const getLatestTaskForUser = jest.fn().mockReturnValue({
      task_id: 'previous-task',
      target: 'src/index.ts',
      workspace: 'C:/workspace/zavorth',
    });
    const manager = new ContextManager({ saveTask, getLatestTaskForUser } as any);
    const currentTask = {
      task_id: 'current-task',
      user_id: 'user-1',
      normalized_message: 'cade-',
      metadata: {},
      target: null,
      workspace: null,
      parent_task_id: null,
    } as any;

    await manager.attachRecentContext(currentTask);

    expect(currentTask.parent_task_id).toBe('previous-task');
    expect(currentTask.target).toBe('src/index.ts');
    expect(currentTask.workspace).toBe('C:/workspace/zavorth');
    expect(currentTask.metadata.inherited_from).toBe('previous-task');
    expect(saveTask).toHaveBeenCalledWith(currentTask);
  });
});
