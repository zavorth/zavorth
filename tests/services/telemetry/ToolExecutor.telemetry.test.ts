import { ToolExecutor } from '../../../src/execution/ToolExecutor';

describe('ToolExecutor telemetry', () => {
  it('records tool lifecycle events with the incoming trace id', async () => {
    const telemetryRuntime = {
      record: jest.fn().mockResolvedValue(undefined),
    } as any;
    const registry = {
      getTool: jest.fn().mockReturnValue({
        execute: jest.fn().mockResolvedValue('content'),
      }),
    } as any;
    const executor = new ToolExecutor(registry, { log: jest.fn() } as any, telemetryRuntime);

    const result = await executor.executeTool('read_file', {
      path: 'README.md',
      metadata: { traceId: 'trace-tool-123' },
    });

    expect(result).toBe('content');
    expect(telemetryRuntime.record).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: 'trace-tool-123',
        source: 'tool-executor',
        eventType: 'tool.started',
        status: 'running',
      }),
    );
    expect(telemetryRuntime.record).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: 'trace-tool-123',
        source: 'tool-executor',
        eventType: 'tool.completed',
        status: 'success',
      }),
    );
  });

  it('records a failure event when the requested tool does not exist', async () => {
    const telemetryRuntime = {
      record: jest.fn().mockResolvedValue(undefined),
    } as any;
    const registry = {
      getTool: jest.fn().mockReturnValue(undefined),
    } as any;
    const executor = new ToolExecutor(registry, { log: jest.fn() } as any, telemetryRuntime);

    await expect(executor.executeTool('missing_tool', { taskId: 'task-1' })).rejects.toThrow(
      'Ferramenta "missing_tool" not encontrada no registro.',
    );

    expect(telemetryRuntime.record).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: 'task:task-1',
        source: 'tool-executor',
        eventType: 'tool.failed',
        status: 'tool_missing',
      }),
    );
  });
});
