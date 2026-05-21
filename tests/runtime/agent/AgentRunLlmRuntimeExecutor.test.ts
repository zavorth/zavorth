import { AgentRunLlmRuntimeExecutor } from '../../../src/runtime/agent/AgentRunLlmRuntimeExecutor.js';
import type {
  UniversalAgentRequest,
  UniversalAgentRun,
} from '../../../src/runtime/agent/UniversalAgentRuntimeTypes.js';
import type { ToolDefinition } from '../../../src/providers/ILlmProvider.js';

describe('AgentRunLlmRuntimeExecutor native tool loop', () => {
  it('exposes governed read tools to the main LLM and feeds observations back before final answer', async () => {
    const llmRuntime = {
      chatDetailed: jest.fn()
        .mockResolvedValueOnce({
          providerName: 'gemini',
          modelName: 'test-model',
          route: route(),
          response: {
            content: '',
            toolCalls: [{
              id: 'call-read',
              name: 'read_file',
              arguments: { filePath: 'README.md' },
            }],
            finishReason: 'tool_calls',
          },
        })
        .mockResolvedValueOnce({
          providerName: 'gemini',
          modelName: 'test-model',
          route: route(),
          response: {
            content: 'Final answer from README.',
            toolCalls: [],
            finishReason: 'stop',
          },
        }),
      getPreferredProviderName: jest.fn(() => 'gemini'),
    };
    const toolRuntime = {
      getToolDefinitions: jest.fn(() => [readFileTool()]),
      executeTool: jest.fn().mockResolvedValue('README content'),
      hasTool: jest.fn((name: string) => name === 'read_file'),
      isAvailable: jest.fn(() => true),
    };
    const executor = new AgentRunLlmRuntimeExecutor({
      llmRuntime: llmRuntime as any,
      toolRuntime,
    });

    const result = await executor.executeIfAvailable(run(), request());

    expect(llmRuntime.chatDetailed).toHaveBeenCalledTimes(2);
    expect(llmRuntime.chatDetailed.mock.calls[0][1]).toEqual([
      expect.objectContaining({ name: 'read_file' }),
    ]);
    expect(toolRuntime.executeTool).toHaveBeenCalledWith('read_file', { filePath: 'README.md' });
    expect(llmRuntime.chatDetailed.mock.calls[1][0]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        role: 'tool',
        toolCallId: 'call-read',
        toolName: 'read_file',
        content: expect.stringContaining('<untrusted_tool_output'),
      }),
    ]));
    expect(result?.replyText).toBe('Final answer from README.');
    expect(result?.metadata?.nativeToolLoop).toEqual(expect.objectContaining({
      requested: 1,
      executed: 1,
      toolsExposed: ['read_file'],
    }));
    expect(result?.events?.some((event) => event.kind === 'tool' && event.status === 'done')).toBe(true);
  });

  it('routes structured workspace drafts through Super Zavorth speculative autonomy before returning', async () => {
    const llmRuntime = {
      chatDetailed: jest.fn().mockResolvedValueOnce({
        providerName: 'gemini',
        modelName: 'test-model',
        route: route(),
        response: {
          content: [
            'Preparei a alteracao.',
            '```zavorth-workspace-writes',
            JSON.stringify({ writes: [{ path: 'src/a.ts', content: 'export const a = 1;\n' }] }),
            '```',
          ].join('\n'),
          toolCalls: [],
          finishReason: 'stop',
        },
      }),
      getPreferredProviderName: jest.fn(() => 'gemini'),
    };
    const speculativeAutonomyService = {
      prepare: jest.fn().mockResolvedValue({
        id: 'spec-run-1',
        status: 'approved',
        summary: 'Sandbox aprovado, diff final gerado e plano plan-1 criado para aprovacao.',
        workspaceRoot: 'C:/repo',
        runRoot: 'C:/repo/data/runtime/speculative-runs/spec-run-1',
        attempts: [],
        finalAttempt: null,
        mutationPlan: { id: 'plan-1' },
        validationCommands: ['npm run runtime:check -- --pretty false'],
        receipts: ['super-zavorth-speculative-sandbox'],
      }),
    };
    const executor = new AgentRunLlmRuntimeExecutor({
      llmRuntime: llmRuntime as any,
      speculativeAutonomyService: speculativeAutonomyService as any,
    });

    const result = await executor.executeIfAvailable(
      { ...run(), workspace: 'C:/repo' },
      { ...request(), workspace: 'C:/repo' },
    );

    expect(speculativeAutonomyService.prepare).toHaveBeenCalledWith(expect.objectContaining({
      workspaceRoot: 'C:/repo',
      writes: [{ path: 'src/a.ts', content: 'export const a = 1;\n' }],
      patches: [],
      createMutationPlan: true,
      approvalRequired: true,
    }));
    expect(result?.replyText).toContain('Super Zavorth: ensaio especulativo aprovado em sandbox');
    expect(result?.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'artifact',
        title: 'Super Zavorth speculative autonomy',
        status: 'done',
        metadata: expect.objectContaining({ mutationPlanId: 'plan-1' }),
      }),
    ]));
    expect(result?.metadata?.superZavorthSpeculativeAutonomy).toEqual(expect.objectContaining({
      id: 'spec-run-1',
      status: 'approved',
      mutationPlanId: 'plan-1',
    }));
  });
});

function request(): UniversalAgentRequest {
  return {
    userId: 'user-1',
    channel: 'cli',
    text: 'Analise o README.',
    requestedTools: [],
  };
}

function run(): UniversalAgentRun {
  return {
    id: 'run-1',
    traceId: 'trace-1',
    requestId: 'request-1',
    sessionId: 'session-1',
    userId: 'user-1',
    channel: 'cli',
    title: 'Analise o README.',
    input: 'Analise o README.',
    status: 'running',
    createdAt: '2026-05-21T00:00:00.000Z',
    updatedAt: '2026-05-21T00:00:00.000Z',
    summary: '',
    events: [],
    toolExposure: {
      mode: 'safe',
      summary: 'Read tools exposed.',
      tools: [],
    },
    replyPorts: [],
    modelProfile: {
      providerLabel: 'gemini',
      modelLabel: 'test-model',
      routingPolicy: 'direct',
    },
    approvals: [],
    artifacts: [],
    memorySignals: [],
    metadata: {},
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
    attempts: [],
    request: {
      messageCount: 2,
      toolCount: 1,
      inputChars: 100,
    },
  };
}
