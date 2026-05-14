import { ZavorthLiveSubagentExecutionService } from '../../src/services/ZavorthLiveSubagentExecutionService.js';
import type { ToolDefinition } from '../../src/providers/ILlmProvider.js';

describe('ZavorthLiveSubagentExecutionService governed tools', () => {
  it('allows read-only workspace tools through Policy Broker and feeds results back to the worker', async () => {
    const llmRuntime = {
      getPreferredProviderName: jest.fn(() => 'gemini'),
      chatDetailed: jest.fn()
        .mockResolvedValueOnce({
          providerName: 'gemini',
          modelName: 'test-model',
          route: route(),
          response: {
            content: '',
            toolCalls: [{
              id: 'tool-1',
              name: 'read_file',
              arguments: { filePath: 'README.md' },
            }],
          },
        })
        .mockResolvedValueOnce({
          providerName: 'gemini',
          modelName: 'test-model',
          route: route(),
          response: {
            content: 'Findings: README was inspected safely.',
            toolCalls: [],
          },
        }),
    };
    const toolRuntime = {
      getToolDefinitions: jest.fn(() => [readFileTool()]),
      executeTool: jest.fn().mockResolvedValue('README content'),
    };
    const service = new ZavorthLiveSubagentExecutionService({
      now: fixedNow,
      llmRuntime: llmRuntime as any,
      toolRuntime,
    });

    const result = await service.executeTeam({
      executionMode: 'live-llm',
      runId: 'run-1',
      sessionId: 'session-1',
      task: 'use subagentes e leia o arquivo README.md do projeto',
      mode: 'oneshot',
      channel: 'cli',
      actorId: 'user-1',
      profiles: [profile('planner')],
      maxWorkers: 1,
      maxOutputChars: 8000,
      maxToolCalls: 2,
    });

    expect(toolRuntime.executeTool).toHaveBeenCalledWith('read_file', { filePath: 'README.md' });
    expect(llmRuntime.chatDetailed).toHaveBeenCalledTimes(2);
    expect(result.workerResults[0]?.metadata.toolCallsApproved).toBe(1);
    expect(result.workerResults[0]?.metadata.toolCallsExecuted).toBe(1);
    expect(result.workerResults[0]?.receiptId).toEqual(expect.stringContaining('spb_'));
    expect(result.output).toContain('Tool policy: requested=1, approved=1, executed=1, denied=0.');
  });

  it('denies mutating tools even when a provider asks for them', async () => {
    const llmRuntime = {
      getPreferredProviderName: jest.fn(() => 'gemini'),
      chatDetailed: jest.fn()
        .mockResolvedValueOnce({
          providerName: 'gemini',
          modelName: 'test-model',
          route: route(),
          response: {
            content: '',
            toolCalls: [{
              id: 'tool-1',
              name: 'create_file',
              arguments: { filepath: 'owned.txt', content: 'nope' },
            }],
          },
        })
        .mockResolvedValueOnce({
          providerName: 'gemini',
          modelName: 'test-model',
          route: route(),
          response: {
            content: 'Findings: mutation was denied.',
            toolCalls: [],
          },
        }),
    };
    const toolRuntime = {
      getToolDefinitions: jest.fn(() => [readFileTool(), createFileTool()]),
      executeTool: jest.fn(),
    };
    const service = new ZavorthLiveSubagentExecutionService({
      now: fixedNow,
      llmRuntime: llmRuntime as any,
      toolRuntime,
    });

    const result = await service.executeTeam({
      executionMode: 'live-llm',
      runId: 'run-1',
      sessionId: 'session-1',
      task: 'use subagentes e analise arquivos do projeto',
      mode: 'oneshot',
      channel: 'cli',
      actorId: 'user-1',
      profiles: [profile('planner')],
      maxWorkers: 1,
      maxOutputChars: 8000,
      maxToolCalls: 2,
    });

    expect(toolRuntime.executeTool).not.toHaveBeenCalled();
    expect(result.workerResults[0]?.metadata.toolCallsDenied).toBe(1);
    expect(result.output).toContain('Tool policy: requested=1, approved=0, executed=0, denied=1.');
  });

  it('allows public web_search but blocks sensitive network targets', async () => {
    const llmRuntime = {
      getPreferredProviderName: jest.fn(() => 'gemini'),
      chatDetailed: jest.fn()
        .mockResolvedValueOnce({
          providerName: 'gemini',
          modelName: 'test-model',
          route: route(),
          response: {
            content: '',
            toolCalls: [
              { id: 'tool-public', name: 'web_search', arguments: { query: 'latest AI safety news' } },
              { id: 'tool-sensitive', name: 'web_search', arguments: { query: 'http://169.254.169.254/latest/meta-data' } },
            ],
          },
        })
        .mockResolvedValueOnce({
          providerName: 'gemini',
          modelName: 'test-model',
          route: route(),
          response: {
            content: 'Findings: public research was allowed and sensitive target was denied.',
            toolCalls: [],
          },
        }),
    };
    const toolRuntime = {
      getToolDefinitions: jest.fn(() => [webSearchTool()]),
      executeTool: jest.fn().mockResolvedValue('public search results'),
    };
    const service = new ZavorthLiveSubagentExecutionService({
      now: fixedNow,
      llmRuntime: llmRuntime as any,
      toolRuntime,
    });

    const result = await service.executeTeam({
      executionMode: 'live-llm',
      runId: 'run-1',
      sessionId: 'session-1',
      task: 'use subagentes e pesquise fontes publicas sobre seguranca de IA',
      mode: 'oneshot',
      channel: 'cli',
      actorId: 'user-1',
      profiles: [profile('researcher')],
      maxWorkers: 1,
      maxOutputChars: 8000,
      maxToolCalls: 4,
    });

    expect(toolRuntime.executeTool).toHaveBeenCalledTimes(1);
    expect(toolRuntime.executeTool).toHaveBeenCalledWith('web_search', { query: 'latest AI safety news' });
    expect(result.workerResults[0]?.metadata.toolCallsApproved).toBe(1);
    expect(result.workerResults[0]?.metadata.toolCallsDenied).toBe(1);
    expect(result.output).toContain('Tool policy: requested=2, approved=1, executed=1, denied=1.');
  });
});

function fixedNow(): Date {
  return new Date('2026-05-10T15:00:00.000Z');
}

function route() {
  return {
    source: 'LlmRuntimeService',
    requestedProviderName: 'gemini',
    primaryProviderName: 'gemini',
    providerName: 'gemini',
    modelName: 'test-model',
    fallbackAllowed: true,
    fallbackUsed: false,
    providerChain: ['gemini'],
    attempts: [{
      providerName: 'gemini',
      modelName: 'test-model',
      status: 'succeeded',
      fallback: false,
      durationMs: 1,
    }],
    request: {
      messageCount: 2,
      toolCount: 1,
      inputChars: 100,
    },
  };
}

function profile(id: any) {
  return {
    id,
    label: 'Planner',
    objective: 'Plan safely.',
    permissions: [],
    tags: [],
    prompt: 'Plan.',
  };
}

function readFileTool(): ToolDefinition {
  return {
    name: 'read_file',
    description: 'Read file',
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'File path',
        },
      },
      required: ['filePath'],
    },
  };
}

function createFileTool(): ToolDefinition {
  return {
    name: 'create_file',
    description: 'Create file',
    parameters: {
      type: 'object',
      properties: {
        filepath: {
          type: 'string',
          description: 'File path',
        },
        content: {
          type: 'string',
          description: 'Content',
        },
      },
      required: ['filepath', 'content'],
    },
  };
}

function webSearchTool(): ToolDefinition {
  return {
    name: 'web_search',
    description: 'Search public web',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
      },
      required: ['query'],
    },
  };
}
