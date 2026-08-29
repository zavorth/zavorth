import { describe, it, expect, jest } from '@jest/globals';
import { ToolExecutor } from '../../src/execution/ToolExecutor.js';

describe('ToolExecutor - Scoped Procedural Guidance & Fail-Open', () => {
  it('executes tool normally and logs guidance when proceduralBridgeService returns active rules', async () => {
    const executeMock = jest.fn(async () => 'file content here');
    const registry = {
      getTool: jest.fn(() => ({
        name: 'read_file',
        execute: executeMock,
      })),
    } as any;

    const logMock = jest.fn();
    const telemetryRecordMock = jest.fn(async () => {});
    const telemetryRuntime = {
      record: telemetryRecordMock,
    } as any;

    const mockBridge = {
      getScopedGuidanceForTool: jest.fn(async () => [
        'Always check if file exists before reading',
      ]),
    };

    const executor = new ToolExecutor(
      registry,
      { log: logMock } as any,
      telemetryRuntime,
      {
        proceduralBridgeService: mockBridge,
      },
    );

    const result = await executor.executeTool('read_file', { path: 'test.txt' });
    expect(result).toBe('file content here');
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(mockBridge.getScopedGuidanceForTool).toHaveBeenCalledWith('read_file');
    expect(logMock).toHaveBeenCalledWith(
      'info',
      'ToolExecutor',
      expect.stringContaining('Applied 1 scoped procedural rule(s) for read_file'),
    );
  });

  it('fails open and executes tool when proceduralBridgeService throws an unhandled error', async () => {
    const executeMock = jest.fn(async () => 'command output');
    const registry = {
      getTool: jest.fn(() => ({
        name: 'read_file',
        execute: executeMock,
      })),
    } as any;

    const logMock = jest.fn();
    const mockFailingBridge = {
      getScopedGuidanceForTool: jest.fn(async () => {
        throw new Error('Database connection timeout in procedural vault');
      }),
    };

    const executor = new ToolExecutor(
      registry,
      { log: logMock } as any,
      null,
      {
        proceduralBridgeService: mockFailingBridge,
      },
    );

    // Execution MUST succeed without rethrowing the bridge error (fail-open)
    const result = await executor.executeTool('read_file', { path: 'file.txt' });
    expect(result).toBe('command output');
    expect(executeMock).toHaveBeenCalledTimes(1);
  });

  it('executes tool without errors when proceduralBridgeService is not provided', async () => {
    const executeMock = jest.fn(async () => 'success');
    const registry = {
      getTool: jest.fn(() => ({
        name: 'read_file',
        execute: executeMock,
      })),
    } as any;

    const executor = new ToolExecutor(
      registry,
      { log: jest.fn() } as any,
      null,
      {},
    );

    const result = await executor.executeTool('read_file', { path: 'file.txt' });
    expect(result).toBe('success');
    expect(executeMock).toHaveBeenCalledTimes(1);
  });
});
