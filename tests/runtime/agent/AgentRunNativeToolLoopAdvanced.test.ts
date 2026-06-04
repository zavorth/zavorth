import { AgentRunLlmRequestBuilder } from '../../../src/runtime/agent/AgentRunLlmRequestBuilder.js';
import { AgentRunNativeToolLoopService } from '../../../src/runtime/agent/AgentRunNativeToolLoopService.js';
import type { ToolDefinition } from '../../../src/providers/ILlmProvider.js';
import type {
  UniversalAgentRequest,
  UniversalAgentRun,
} from '../../../src/runtime/agent/UniversalAgentRuntimeTypes.js';

describe('AgentRunNativeToolLoopService advanced harness', () => {
  it('repairs provider tool-call shape and retries transient safe observation failures', async () => {
    const llmRuntime = {
      chatDetailed: jest.fn(async () => runtimeResult('Final with repaired tool evidence.', [], 'stop')),
    };
    const executeTool = jest.fn()
      .mockRejectedValueOnce(new Error('timeout while reading file'))
      .mockResolvedValueOnce('README content after retry');
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
      messages: [{ role: 'user', content: 'read README' }],
      initialResult: runtimeResult('', [{
        id: 'call-1',
        name: 'read file',
        arguments: '{"filePath":"README.md"}' as unknown as Record<string, unknown>,
      }], 'tool_calls'),
      tools: [tool('read_file')],
      options: {},
      run: run(),
      request: request('read README'),
    });

    expect(executeTool).toHaveBeenCalledTimes(2);
    expect(executeTool).toHaveBeenLastCalledWith('read_file', { filePath: 'README.md' });
    expect(result.stats).toEqual(expect.objectContaining({
      requested: 1,
      executed: 1,
      repairedToolCalls: 1,
      retriedToolCalls: 1,
      successfulRetries: 1,
    }));
  });

  it('uses the compact tool catalog to materialize a hidden safe tool for the next round', async () => {
    const tools = [
      ...Array.from({ length: 14 }, (_, index) => tool(`catalog_item_${index}`, `Catalog filler ${index}`)),
      tool('memory.read', 'Read long-term memory.'),
    ];
    const llmRuntime = {
      chatDetailed: jest.fn()
        .mockResolvedValueOnce(runtimeResult('', [{
          id: 'call-memory',
          name: 'memory.read',
          arguments: { query: 'long-term memory' },
        }], 'tool_calls'))
        .mockResolvedValueOnce(runtimeResult('Final answer from memory.', [], 'stop')),
    };
    const executeTool = jest.fn(async (name: string) => `${name} result`);
    const toolRuntime = {
      getToolDefinitions: () => tools,
      hasTool: (name: string) => tools.some((entry) => entry.name === name),
      isAvailable: () => true,
      executeTool,
    };
    const service = buildService({ llmRuntime, toolRuntime });
    const activeRun = run({
      toolExposure: {
        mode: 'safe',
        summary: 'test',
        tools: tools.map((entry) => ({
          id: entry.name,
          label: entry.name,
          risk: 'safe' as const,
          requiresApproval: false,
        })),
      },
    });
    const activeRequest = request('inspect the project');
    const exposedTools = service.resolveNativeTools(activeRun, activeRequest);

    expect(exposedTools.map((entry) => entry.name)).toContain('zavorth_tool_catalog');
    expect(exposedTools.map((entry) => entry.name)).not.toContain('memory.read');

    const result = await service.run({
      messages: [{ role: 'user', content: activeRequest.text }],
      initialResult: runtimeResult('', [{
        id: 'call-catalog',
        name: 'zavorth_tool_catalog',
        arguments: { operation: 'search', query: 'long-term memory', limit: 1 },
      }], 'tool_calls'),
      tools: exposedTools,
      options: {},
      run: activeRun,
      request: activeRequest,
    });

    expect(executeTool).toHaveBeenCalledWith('memory.read', expect.objectContaining({ query: 'long-term memory' }));
    expect(result.stats).toEqual(expect.objectContaining({
      catalogSearches: 1,
      catalogMaterializedTools: 1,
      executed: 1,
    }));
  });

  it('recovers once from provider stop reasons that indicate truncation', async () => {
    const llmRuntime = {
      chatDetailed: jest.fn(async () => runtimeResult('Recovered continuation.', [], 'stop')),
    };
    const service = buildService({
      llmRuntime,
      toolRuntime: {
        getToolDefinitions: () => [tool('read_file')],
        hasTool: (name: string) => name === 'read_file',
        isAvailable: () => true,
        executeTool: jest.fn(async () => 'unused'),
      },
    });

    const result = await service.run({
      messages: [{ role: 'user', content: 'continue if truncated' }],
      initialResult: runtimeResult('Partial', [], 'length'),
      tools: [tool('read_file')],
      options: {},
      run: run(),
      request: request('continue if truncated'),
    });

    expect(llmRuntime.chatDetailed).toHaveBeenCalledTimes(1);
    expect(result.result.response.content).toBe('Recovered continuation.');
    expect(result.stats.stopReasonRecoveries).toBe(1);
  });
});

function buildService(runtime: {
  llmRuntime: any;
  toolRuntime: any;
}): AgentRunNativeToolLoopService {
  return new AgentRunNativeToolLoopService({
    llmRuntime: runtime.llmRuntime,
    toolRuntime: runtime.toolRuntime,
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

function runtimeResult(content: string, toolCalls: any[], finishReason: string): any {
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
    id: 'run-native-tool-loop-advanced',
    traceId: 'trace-1',
    requestId: 'request-1',
    sessionId: 'session-1',
    userId: 'user-1',
    channel: 'cli',
    title: 'Native tool loop advanced',
    input: 'Native tool loop advanced',
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
