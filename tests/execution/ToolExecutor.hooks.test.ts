import { ToolExecutor } from '../../src/execution/ToolExecutor';

describe('ToolExecutor hooks', () => {
  it('blocks runtime execution when a before hook vetoes the tool run', async () => {
    const run = jest.fn(async ({ event }: any) => ({
      ok: event !== 'runtime.before_execute' ? true : false,
      event,
      workspace: process.cwd(),
      listenerCount: 0,
      workspaceHookCount: 1,
    }));
    const registry = {
      getTool: jest.fn(),
    } as any;
    const telemetryRuntime = {
      record: jest.fn().mockResolvedValue(undefined),
    } as any;
    const executor = new ToolExecutor(
      registry,
      { log: jest.fn() } as any,
      telemetryRuntime,
      {
        hookPipelineService: {
          run,
        } as any,
      },
    );

    await expect(executor.executeTool('read_file', { path: 'README.md' })).rejects.toThrow(
      'A hook blocked runtime execution for this tool.',
    );

    expect(registry.getTool).not.toHaveBeenCalled();
    expect(run).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        event: 'runtime.before_execute',
        context: expect.objectContaining({
          toolName: 'read_file',
        }),
      }),
    );
    expect(run).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        event: 'runtime.exec_failed',
        context: expect.objectContaining({
          toolName: 'read_file',
          reason: 'blocked_by_hook',
        }),
      }),
    );
  });

  it('runs after_execute after a successful tool execution', async () => {
    const run = jest.fn(async ({ event }: any) => ({
      ok: true,
      event,
      workspace: process.cwd(),
      listenerCount: 0,
      workspaceHookCount: 0,
    }));
    const registry = {
      getTool: jest.fn().mockReturnValue({
        execute: jest.fn().mockResolvedValue('content'),
      }),
    } as any;
    const executor = new ToolExecutor(
      registry,
      { log: jest.fn() } as any,
      { record: jest.fn().mockResolvedValue(undefined) } as any,
      {
        hookPipelineService: {
          run,
        } as any,
      },
    );

    const result = await executor.executeTool('read_file', { path: 'README.md' });

    expect(result).toBe('content');
    expect(run).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        event: 'runtime.before_execute',
      }),
    );
    expect(run).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        event: 'runtime.after_execute',
        context: expect.objectContaining({
          toolName: 'read_file',
          resultLength: 8,
        }),
      }),
    );
  });

  it('runs exec_failed when the tool execution throws or the tool is missing', async () => {
    const run = jest.fn(async ({ event }: any) => ({
      ok: true,
      event,
      workspace: process.cwd(),
      listenerCount: 0,
      workspaceHookCount: 0,
    }));
    const telemetryRuntime = {
      record: jest.fn().mockResolvedValue(undefined),
    } as any;

    const missingExecutor = new ToolExecutor(
      {
        getTool: jest.fn().mockReturnValue(undefined),
      } as any,
      { log: jest.fn() } as any,
      telemetryRuntime,
      {
        hookPipelineService: {
          run,
        } as any,
      },
    );
    await expect(missingExecutor.executeTool('missing_tool', { taskId: 'task-1' })).rejects.toThrow(
      'Ferramenta "missing_tool" not encontrada no registro.',
    );

    const failingExecutor = new ToolExecutor(
      {
        getTool: jest.fn().mockReturnValue({
          execute: jest.fn().mockRejectedValue(new Error('boom')),
        }),
      } as any,
      { log: jest.fn() } as any,
      telemetryRuntime,
      {
        hookPipelineService: {
          run,
        } as any,
      },
    );
    await expect(failingExecutor.executeTool('read_file', { path: 'README.md' })).rejects.toThrow('boom');

    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'runtime.exec_failed',
        context: expect.objectContaining({
          toolName: 'missing_tool',
          reason: 'tool_missing',
        }),
      }),
    );
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'runtime.exec_failed',
        context: expect.objectContaining({
          toolName: 'read_file',
          reason: 'tool_execution_failed',
          errorMessage: 'boom',
        }),
      }),
    );
  });
});
