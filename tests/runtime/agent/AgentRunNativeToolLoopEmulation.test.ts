import { AgentRunLlmRequestBuilder } from '../../../src/runtime/agent/AgentRunLlmRequestBuilder.js';
import { AgentRunNativeToolLoopService } from '../../../src/runtime/agent/AgentRunNativeToolLoopService.js';
import type { ToolDefinition } from '../../../src/providers/ILlmProvider.js';
import type {
  UniversalAgentRequest,
  UniversalAgentRun,
} from '../../../src/runtime/agent/UniversalAgentRuntimeTypes.js';

describe('AgentRunNativeToolLoopService emulated tool calling track', () => {
  it('extracts and executes emulated tool calls written as inline JSON in the model content', async () => {
    const llmRuntime = {
      chatDetailed: jest.fn(async () => runtimeResult('Final answer.', [], 'stop')),
    };
    const executeTool = jest.fn(async () => 'file content: hello world');
    const service = buildService({
      llmRuntime,
      toolRuntime: {
        getToolDefinitions: () => [tool('read_file'), tool('get_datetime')],
        hasTool: (name: string) => name === 'read_file' || name === 'get_datetime',
        isAvailable: () => true,
        executeTool,
      },
    });

    const result = await service.run({
      messages: [{ role: 'user', content: 'read a.txt' }],
      initialResult: runtimeResult(
        'Reading now. {"tool": "read_file", "arguments": {"path": "a.txt"}}',
        [],
        'stop',
      ),
      tools: [tool('read_file'), tool('get_datetime')],
      options: {},
      run: run(),
      request: request('read a.txt'),
    });

    expect(executeTool).toHaveBeenCalledTimes(1);
    expect(executeTool).toHaveBeenLastCalledWith('read_file', expect.objectContaining({
      path: 'a.txt',
    }));
    expect(result.stats.emulatedExtracted).toBe(1);
    expect(result.stats.emulatedExecuted).toBe(1);
    expect(result.stats.executed).toBe(1);
  });

  it('extracts and executes DeepSeek-style <function> blocks from the model content', async () => {
    const llmRuntime = {
      chatDetailed: jest.fn(async () => runtimeResult('Done.', [], 'stop')),
    };
    const executeTool = jest.fn(async () => 'ok');
    const service = buildService({
      llmRuntime,
      toolRuntime: {
        getToolDefinitions: () => [tool('get_datetime')],
        hasTool: (name: string) => name === 'get_datetime',
        isAvailable: () => true,
        executeTool,
      },
    });

    const result = await service.run({
      messages: [{ role: 'user', content: 'what time' }],
      initialResult: runtimeResult(
        'Checking. <function>get_datetime</function>({"timezone": "local"})',
        [],
        'stop',
      ),
      tools: [tool('get_datetime')],
      options: {},
      run: run(),
      request: request('what time'),
    });

    expect(executeTool).toHaveBeenCalledTimes(1);
    expect(executeTool).toHaveBeenLastCalledWith('get_datetime', expect.objectContaining({
      timezone: 'local',
    }));
    expect(result.stats.emulatedExtracted).toBe(1);
    expect(result.stats.emulatedExecuted).toBe(1);
  });

  it('keeps the clean conversational text when pushing the assistant message', async () => {
    const llmRuntime = {
      chatDetailed: jest.fn(async () => runtimeResult('Finished.', [], 'stop')),
    };
    const executeTool = jest.fn(async () => 'ok');
    const service = buildService({
      llmRuntime,
      toolRuntime: {
        getToolDefinitions: () => [tool('get_datetime')],
        hasTool: (name: string) => name === 'get_datetime',
        isAvailable: () => true,
        executeTool,
      },
    });

    await service.run({
      messages: [{ role: 'user', content: 'what time' }],
      initialResult: runtimeResult(
        'Let me check. {"tool": "get_datetime", "arguments": {}}',
        [],
        'stop',
      ),
      tools: [tool('get_datetime')],
      options: {},
      run: run(),
      request: request('what time'),
    });

    const assistantMessage = llmRuntime.chatDetailed.mock.calls[0][0]
      .find((message: { role: string }) => message.role === 'assistant');
    expect(assistantMessage.content).not.toContain('"tool"');
    expect(assistantMessage.content).toContain('Let me check.');
    expect(assistantMessage.toolCalls).toHaveLength(1);
    expect(assistantMessage.toolCalls[0].name).toBe('get_datetime');
  });

  it('does not break the loop when the content has no emulated invocation', async () => {
    const llmRuntime = {
      chatDetailed: jest.fn(),
    };
    const executeTool = jest.fn();
    const service = buildService({
      llmRuntime,
      toolRuntime: {
        getToolDefinitions: () => [tool('read_file')],
        hasTool: (name: string) => name === 'read_file',
        isAvailable: () => true,
        executeTool,
      },
    });

    const result = await service.run({
      messages: [{ role: 'user', content: 'hello' }],
      initialResult: runtimeResult('Just a plain answer, no tools needed.', [], 'stop'),
      tools: [tool('read_file')],
      options: {},
      run: run(),
      request: request('hello'),
    });

    expect(executeTool).not.toHaveBeenCalled();
    expect(result.stats.emulatedExtracted).toBe(0);
    expect(result.stats.emulatedExecuted).toBe(0);
  });
});

function buildService(runtime: {
  llmRuntime: unknown;
  toolRuntime: unknown;
}): AgentRunNativeToolLoopService {
  return new AgentRunNativeToolLoopService({
    llmRuntime: runtime.llmRuntime as never,
    toolRuntime: runtime.toolRuntime as never,
    requestBuilder: new AgentRunLlmRequestBuilder({
      hallucinationInstruction: () => '',
    }),
    mutationPlaneService: null,
    speculativeAutonomyService: null,
    canvasSessionService: null,
    terminalBackendsService: null,
  });
}

function tool(name: string, description = name): ToolDefinition {
  return {
    name,
    description,
    parameters: {
      type: 'object',
      properties: {},
    },
  };
}

function runtimeResult(content: string, toolCalls: unknown[], finishReason: string): unknown {
  return {
    providerName: 'test-provider',
    modelName: 'test-model',
    route: { providerName: 'test-provider', fallbackUsed: false },
    response: {
      content,
      toolCalls,
      finishReason,
    },
  };
}

function request(text: string): UniversalAgentRequest {
  return {
    userId: 'user-1',
    channel: 'cli',
    text,
    requestedTools: [],
  };
}

function run(overrides: Partial<UniversalAgentRun> = {}): UniversalAgentRun {
  return {
    id: 'run-emulated-track-test',
    traceId: 'trace-1',
    requestId: 'request-1',
    sessionId: 'session-1',
    userId: 'user-1',
    channel: 'cli',
    title: 'Emulated tool track',
    input: 'Emulated tool track',
    status: 'running',
    createdAt: '2026-05-31T00:00:00.000Z',
    updatedAt: '2026-05-31T00:00:00.000Z',
    summary: '',
    events: [],
    toolExposure: {
      mode: 'safe',
      summary: 'Tools exposed.',
      tools: [],
    },
    replyPorts: [],
    modelProfile: {
      providerLabel: 'test',
      modelLabel: 'test',
      routingPolicy: 'direct',
    },
    approvals: [],
    artifacts: [],
    memorySignals: [],
    metadata: {},
    ...overrides,
  };
}
