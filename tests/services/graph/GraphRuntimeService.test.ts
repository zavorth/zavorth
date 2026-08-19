import { config } from '../../../src/config/index.js';
import { GraphRuntimeService } from '../../../src/services/graph/GraphRuntimeService';

describe('GraphRuntimeService', () => {
  it('completes a simple autonomous task when the critic approves on the first pass', async () => {
    const telemetryRuntime = {
      record: jest.fn().mockResolvedValue(undefined),
    } as any;
    const llmRuntime = {
      getPreferredProviderName: jest.fn().mockReturnValue('AIGateway'),
      isProviderAvailable: jest.fn().mockReturnValue(true),
      chat: jest
        .fn()
.mockResolvedValueOnce({
          content: 'Comparison ready.',
          toolCalls: [],
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          content: 'APROVADO',
          toolCalls: [],
          finishReason: 'stop',
        }),
    } as any;

    const runtime = new GraphRuntimeService({
      llmRuntime,
      telemetryRuntime,
      maxIterations: 2,
      maxToolRounds: 1,
    });

    const result = await runtime.runAutonomousTask('review the code');

    expect(result.ok).toBe(true);
    expect(result.status).toBe('approved');
    expect(result.finalReply).toBe('Plano concluido.');
    expect(result.iterations).toBe(1);
    expect(result.traceId).toBeTruthy();
    expect(result.tokenBudget.used).toBeGreaterThanOrEqual(0);
    expect(telemetryRuntime.record).toHaveBeenCalledTimes(2);
  });

  it('executes registered tools before asking the critic to review the final answer', async () => {
    const llmRuntime = {
      getPreferredProviderName: jest.fn().mockReturnValue('AIGateway'),
      isProviderAvailable: jest.fn().mockReturnValue(true),
      chat: jest
        .fn()
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tool-1',
              name: 'read_file',
              arguments: { path: 'README.md' },
            },
          ],
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'Arquivo analisado com sucesso.',
          toolCalls: [],
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          content: 'APROVADO',
          toolCalls: [],
          finishReason: 'stop',
        }),
    } as any;
    const toolRuntime = {
      getToolDefinitions: jest.fn().mockReturnValue([
        {
          name: 'read_file',
          description: 'Reads a local file.',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'File path.',
              },
            },
            required: ['path'],
          },
        },
      ]),
      executeTool: jest.fn().mockResolvedValue('file content'),
    } as any;

    const runtime = new GraphRuntimeService({
      llmRuntime,
      toolRuntime,
      maxIterations: 2,
      maxToolRounds: 2,
    });

    const result = await runtime.runAutonomousTask('analyze the README');
    const toolArgs = (toolRuntime.executeTool as jest.Mock).mock.calls[0][1];

    expect(toolRuntime.executeTool).toHaveBeenCalledWith(
      'read_file',
      expect.objectContaining({
        path: 'README.md',
        metadata: expect.objectContaining({
          traceId: expect.any(String),
        }),
      }),
    );
    expect(toolArgs.metadata.traceId).toBe(result.traceId);
    expect(result.ok).toBe(true);
    expect(result.finalReply).toBe('File analyzed successfully.');
  });

  it('stops after the configured max iterations when the critic keeps rejecting the work', async () => {
    const llmRuntime = {
      getPreferredProviderName: jest.fn().mockReturnValue('AIGateway'),
      isProviderAvailable: jest.fn().mockReturnValue(true),
      chat: jest
        .fn()
        .mockResolvedValueOnce({
          content: 'First attempt.',
          toolCalls: [],
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          content: 'Fix the conclusion.',
          toolCalls: [],
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          content: 'Second attempt.',
          toolCalls: [],
          finishReason: 'stop',
        })
.mockResolvedValueOnce({
          content: 'APPROVED',
          toolCalls: [],
          finishReason: 'stop',
        }),
    } as any;

    const runtime = new GraphRuntimeService({
      llmRuntime,
      maxIterations: 2,
      maxToolRounds: 1,
    });

    const result = await runtime.runAutonomousTask('melhorar a resposta');

    expect(result.ok).toBe(false);
    expect(result.status).toBe('max_iterations');
    expect(result.iterations).toBe(2);
    expect(result.criticFeedback).toBe('Still not good.');
    expect(result.finalReply).toBe('Second attempt.');
  });

  it('builds strategy hints from workspace profile and operational memory before invoking the graph', async () => {
    const llmRuntime = {
      getPreferredProviderName: jest.fn().mockReturnValue('AIGateway'),
      isProviderAvailable: jest.fn().mockReturnValue(true),
      chat: jest
        .fn()
        .mockResolvedValueOnce({
          content: 'Plan adjusted to workspace.',
          toolCalls: [],
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          content: 'APROVADO',
          toolCalls: [],
          finishReason: 'stop',
        }),
    } as any;

    const runtime = new GraphRuntimeService({
      llmRuntime,
      maxIterations: 2,
      maxToolRounds: 1,
    });

    const initialMessages = [
      {
        role: 'system',
        content: 'Additional context for autonomous task.\n\nCURRENT WORKSPACE:\n- C:/repo',
      },
    ] as any;

    const result = await runtime.runAutonomousTask('review the project', {
      initialMessages,
      metadata: {
        workspace: 'C:/repo',
        workspaceProfile: {
          scripts: {
            test: 'npm test',
            build: 'npm run build',
          },
          important_paths: ['C:/repo/src', 'C:/repo/tests'],
          instruction_file: 'C:/repo/ZAVORTH.md',
          instruction_summary: 'Prioritize small changes and objective validation before completing.',
          instruction_notes: [
            'Run npm test before completing structural changes.',
            'Prefer acting on src/ and tests/ before operational scripts.',
          ],
          workspace_hooks: [
            { event: 'before-complete', command: 'npm test' },
            { event: 'before-publish', command: 'npm run security:preflight' },
          ],
          workspace_commands: [
            { name: 'review', template: '/workflow review ${args}' },
            { name: 'smoke', template: '/run npm run test:smoke' },
          ],
        },
        workspaceOperationalMemory: {
          successful_executors: [{ executor: 'codex', count: 3 }],
          repeated_failures: [{ executor: 'external_executor', summary: 'gateway timeout while listing files' }],
          task_kind_recommendations: [
            {
              kind: 'code',
              preferred_executor: 'codex',
              success_count: 4,
              repeated_failure_executor: 'external_executor',
              repeated_failure_summary: 'gateway timeout while listing files',
            },
          ],
          task_subtype_recommendations: [
            {
              kind: 'code',
              subtype: 'review',
              preferred_executor: 'external_executor',
              success_count: 3,
              repeated_failure_executor: 'codex',
              repeated_failure_summary: 'shallow response in code review',
            },
          ],
          approved_paths: [{ path: 'C:/repo/src' }, { path: 'C:/repo/tests' }],
        },
      },
    });

    expect(result.ok).toBe(true);
    expect(llmRuntime.chat).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('Estimated current task type: code'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Estimated current task subtype: review'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('For review subtype, prioritize external_executor'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('avoid repeating codex'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('CURRENT WORKSPACE'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('ZAVORTH.md summary'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Run npm test before completing structural changes'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Workspace operational hooks declared'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Workspace reusable commands'),
        }),
      ]),
      undefined,
      expect.objectContaining({
        providerName: 'AIGateway',
        modelName: config.AIGatewayModel,
      }),
    );
  });

  it('adds comparison-specific quality guidance for research tasks', async () => {
    const llmRuntime = {
      getPreferredProviderName: jest.fn().mockReturnValue('AIGateway'),
      isProviderAvailable: jest.fn((name: string) => ['openrouter', 'AIGateway', 'gemini', 'openai'].includes(name)),
      chat: jest
        .fn()
        .mockResolvedValueOnce({
          content: 'Comparacao pronta.',
          toolCalls: [],
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          content: 'APROVADO',
          toolCalls: [],
          finishReason: 'stop',
        }),
    } as any;

    const runtime = new GraphRuntimeService({
      llmRuntime,
      maxIterations: 2,
      maxToolRounds: 1,
    });

await runtime.runAutonomousTask('compare GPT and Claude for code review', {
      metadata: {
        taskKind: 'research',
        taskSubtype: 'comparison',
      },
    });

    expect(llmRuntime.chat).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('Estimated current task type: research'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Estimated current task subtype: comparison'),
        }),
        expect.objectContaining({
          content: expect.stringContaining(`Modelo preferencial desta tarefa: ${config.openRouterModel}`),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Depth profile: deep; tool intensity: evidence_heavy'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Structure the deliverable as a clear comparison'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('tradeoffs, risks and final recommendation'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('use sufficient tools to gather verifiable evidence'),
        }),
      ]),
      undefined,
      expect.objectContaining({
        providerName: 'openrouter',
        modelName: config.openRouterModel,
        allowFallback: true,
      }),
    );
  });

  it('adds summarization-specific quality guidance for research synthesis tasks', async () => {
    const llmRuntime = {
      getPreferredProviderName: jest.fn().mockReturnValue('AIGateway'),
      isProviderAvailable: jest.fn((name: string) => ['gemini', 'AIGateway', 'openrouter', 'openai'].includes(name)),
      chat: jest
        .fn()
        .mockResolvedValueOnce({
          content: 'Synthesis ready.',
          toolCalls: [],
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          content: 'APROVADO',
          toolCalls: [],
          finishReason: 'stop',
        }),
    } as any;

    const runtime = new GraphRuntimeService({
      llmRuntime,
      maxIterations: 2,
      maxToolRounds: 1,
    });

    await runtime.runAutonomousTask('summarize the main AI news of the week', {
      metadata: {
        taskKind: 'research',
        taskSubtype: 'summarization',
      },
    });

    expect(llmRuntime.chat).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('Estimated current task subtype: summarization'),
        }),
        expect.objectContaining({
          content: expect.stringContaining(`Modelo preferencial desta tarefa: ${config.aiStudioModel}`),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Depth profile: concise; tool intensity: minimal'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Deliver a short and hierarchical synthesis'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('executive summary'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Avoid extra tool rounds'),
        }),
      ]),
      undefined,
      expect.objectContaining({
        providerName: 'gemini',
        modelName: config.aiStudioModel,
        allowFallback: true,
      }),
    );
  });

  it('prefers learned provider and model from workspace memory when the workspace has enough successful history', async () => {
    const llmRuntime = {
      getPreferredProviderName: jest.fn().mockReturnValue('AIGateway'),
      isProviderAvailable: jest.fn((name: string) => ['deepseek', 'openrouter', 'AIGateway', 'gemini', 'openai'].includes(name)),
      chat: jest
        .fn()
        .mockResolvedValueOnce({
          content: 'Comparison ready with learned provider.',
          toolCalls: [],
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          content: 'APROVADO',
          toolCalls: [],
          finishReason: 'stop',
        }),
    } as any;

    const runtime = new GraphRuntimeService({
      llmRuntime,
      maxIterations: 2,
      maxToolRounds: 1,
    });

    await runtime.runAutonomousTask('compare providers for code review', {
      metadata: {
        taskKind: 'research',
        taskSubtype: 'comparison',
        workspaceOperationalMemory: {
          task_subtype_llm_recommendations: [
            {
              kind: 'research',
              subtype: 'comparison',
              preferred_provider: 'deepseek',
              preferred_model: 'deepseek-chat',
              success_count: 3,
              confidence: 'high',
            },
          ],
        },
      },
    });

    expect(llmRuntime.chat).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('Preferred provider for this task: deepseek'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Preferred model for this task: deepseek-chat'),
        }),
      ]),
      undefined,
      expect.objectContaining({
        providerName: 'deepseek',
        modelName: 'deepseek-chat',
      }),
    );
  });

  it('expands tool rounds automatically for deep comparison tasks', async () => {
    const llmRuntime = {
      getPreferredProviderName: jest.fn().mockReturnValue('AIGateway'),
      isProviderAvailable: jest.fn((name: string) => ['openrouter', 'AIGateway', 'gemini', 'openai'].includes(name)),
      chat: jest
        .fn()
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            { id: 'tool-1', name: 'search_web', arguments: { q: 'model A' } },
          ],
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            { id: 'tool-2', name: 'search_web', arguments: { q: 'model B' } },
          ],
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'Deep comparison ready.',
          toolCalls: [],
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          content: 'APROVADO',
          toolCalls: [],
          finishReason: 'stop',
        }),
    } as any;
    const toolRuntime = {
      getToolDefinitions: jest.fn().mockReturnValue([
        {
          name: 'search_web',
          description: 'Web search.',
          parameters: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] },
        },
      ]),
      executeTool: jest.fn().mockResolvedValue('result'),
    } as any;

    const runtime = new GraphRuntimeService({
      llmRuntime,
      toolRuntime,
      maxIterations: 1,
      maxToolRounds: 1,
    });

    const result = await runtime.runAutonomousTask('compare GPT and Claude for code review', {
      metadata: {
        taskKind: 'research',
        taskSubtype: 'comparison',
      },
    });

    expect(toolRuntime.executeTool).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
    expect(result.finalReply).toBe('Deep comparison ready.');
    expect(llmRuntime.chat).toHaveBeenCalledWith(
      expect.any(Array),
      expect.anything(),
      expect.objectContaining({
        providerName: 'openrouter',
        modelName: config.openRouterModel,
        allowFallback: true,
      }),
    );
  });

  it('expands iteration depth automatically for deep comparison tasks', async () => {
    const llmRuntime = {
      getPreferredProviderName: jest.fn().mockReturnValue('AIGateway'),
      isProviderAvailable: jest.fn((name: string) => ['openrouter', 'AIGateway', 'gemini', 'openai'].includes(name)),
      chat: jest
        .fn()
        .mockResolvedValueOnce({
          content: 'First comparison still superficial.',
          toolCalls: [],
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          content: 'Deepen tradeoffs and refine final recommendation.',
          toolCalls: [],
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          content: 'Refined comparison with final recommendation.',
          toolCalls: [],
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          content: 'APROVADO',
          toolCalls: [],
          finishReason: 'stop',
        }),
    } as any;

    const runtime = new GraphRuntimeService({
      llmRuntime,
      maxIterations: 1,
      maxToolRounds: 1,
    });

    const result = await runtime.runAutonomousTask('compare GPT and Claude for code review', {
      metadata: {
        taskKind: 'research',
        taskSubtype: 'comparison',
      },
    });

    expect(result.ok).toBe(true);
    expect(result.iterations).toBe(2);
    expect(result.finalReply).toBe('Refined comparison with final recommendation.');
  });

  it('curates research tools for comparison tasks and hides mutating tools', async () => {
    const llmRuntime = {
      getPreferredProviderName: jest.fn().mockReturnValue('AIGateway'),
      isProviderAvailable: jest.fn((name: string) => ['openrouter', 'AIGateway', 'gemini', 'openai'].includes(name)),
      chat: jest
        .fn()
        .mockResolvedValueOnce({
          content: 'Comparacao pronta.',
          toolCalls: [],
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          content: 'APROVADO',
          toolCalls: [],
          finishReason: 'stop',
        }),
    } as any;
    const toolRuntime = {
      getToolDefinitions: jest.fn().mockReturnValue([
        { name: 'web_search', description: '', parameters: { type: 'object', properties: {} } },
        { name: 'query_external_ai', description: '', parameters: { type: 'object', properties: {} } },
        { name: 'read_file', description: '', parameters: { type: 'object', properties: {} } },
        { name: 'list_directory', description: '', parameters: { type: 'object', properties: {} } },
        { name: 'create_file', description: '', parameters: { type: 'object', properties: {} } },
        { name: 'remote_shell', description: '', parameters: { type: 'object', properties: {} } },
      ]),
      executeTool: jest.fn(),
    } as any;

    const runtime = new GraphRuntimeService({
      llmRuntime,
      toolRuntime,
      maxIterations: 2,
      maxToolRounds: 1,
    });

    await runtime.runAutonomousTask('compare providers for code review', {
      metadata: {
        taskKind: 'research',
        taskSubtype: 'comparison',
      },
    });

    const advertisedTools = llmRuntime.chat.mock.calls[0][1];
    const advertisedNames = advertisedTools.map((tool: any) => tool.name);

    expect(advertisedNames).toEqual(
      expect.arrayContaining(['web_search', 'query_external_ai', 'read_file', 'list_directory']),
    );
    expect(advertisedNames).not.toContain('create_file');
    expect(advertisedNames).not.toContain('remote_shell');
  });

  it('blocks mutating or shell tools during readonly review tasks even if the model hallucinates them', async () => {
    const llmRuntime = {
      getPreferredProviderName: jest.fn().mockReturnValue('AIGateway'),
      isProviderAvailable: jest.fn((name: string) => ['AIGateway', 'openai', 'openrouter', 'gemini'].includes(name)),
      chat: jest
        .fn()
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: 'tool-1',
              name: 'create_file',
              arguments: { filepath: 'output/test.md', content: 'should not write' },
            },
          ],
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'Review completed with one main finding.',
          toolCalls: [],
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          content: 'APROVADO',
          toolCalls: [],
          finishReason: 'stop',
        }),
    } as any;
    const toolRuntime = {
      getToolDefinitions: jest.fn().mockReturnValue([
        { name: 'read_file', description: '', parameters: { type: 'object', properties: {} } },
        { name: 'create_file', description: '', parameters: { type: 'object', properties: {} } },
      ]),
      executeTool: jest.fn().mockResolvedValue('file created'),
    } as any;

    const runtime = new GraphRuntimeService({
      llmRuntime,
      toolRuntime,
      maxIterations: 2,
      maxToolRounds: 2,
    });

    const result = await runtime.runAutonomousTask('review the payment module', {
      metadata: {
        taskKind: 'code',
        taskSubtype: 'review',
      },
    });

    expect(toolRuntime.executeTool).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.finalReply).toBe('Review completed with one main finding.');
  });

  it('prioritizes control tools for automation tasks', async () => {
    const llmRuntime = {
      getPreferredProviderName: jest.fn().mockReturnValue('AIGateway'),
      isProviderAvailable: jest.fn((name: string) => ['AIGateway', 'gemini', 'openai'].includes(name)),
      chat: jest
        .fn()
        .mockResolvedValueOnce({
          content: 'Automation planned.',
          toolCalls: [],
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          content: 'APROVADO',
          toolCalls: [],
          finishReason: 'stop',
        }),
    } as any;
    const toolRuntime = {
      getToolDefinitions: jest.fn().mockReturnValue([
        { name: 'web_search', description: '', parameters: { type: 'object', properties: {} } },
        { name: 'remote_shell', description: '', parameters: { type: 'object', properties: {} } },
        { name: 'run_sandbox_code', description: '', parameters: { type: 'object', properties: {} } },
        { name: 'create_file', description: '', parameters: { type: 'object', properties: {} } },
        { name: 'read_file', description: '', parameters: { type: 'object', properties: {} } },
      ]),
      executeTool: jest.fn(),
    } as any;

    const runtime = new GraphRuntimeService({
      llmRuntime,
      toolRuntime,
      maxIterations: 2,
      maxToolRounds: 1,
    });

    await runtime.runAutonomousTask('automate navigation to fill a form', {
      metadata: {
        taskKind: 'automation',
        taskSubtype: 'form_fill',
      },
    });

    const advertisedTools = llmRuntime.chat.mock.calls[0][1];
    const advertisedNames = advertisedTools.map((tool: any) => tool.name);

    expect(advertisedNames.slice(0, 3)).toEqual(
      expect.arrayContaining(['remote_shell', 'run_sandbox_code', 'read_file']),
    );
    expect(advertisedNames).toContain('create_file');
  });

  it('enforces findings-first delivery and strict review verification for code review tasks', async () => {
    const llmRuntime = {
      getPreferredProviderName: jest.fn().mockReturnValue('AIGateway'),
      isProviderAvailable: jest.fn((name: string) => ['AIGateway', 'openai', 'openrouter', 'gemini'].includes(name)),
      chat: jest
        .fn()
        .mockResolvedValueOnce({
          content: 'Found a regression bug in the login flow.',
          toolCalls: [],
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          content: 'APROVADO',
          toolCalls: [],
          finishReason: 'stop',
        }),
    } as any;

    const runtime = new GraphRuntimeService({
      llmRuntime,
      maxIterations: 2,
      maxToolRounds: 1,
    });

    await runtime.runAutonomousTask('review the authentication module', {
      metadata: {
        taskKind: 'code',
        taskSubtype: 'review',
      },
    });

    expect(llmRuntime.chat).toHaveBeenNthCalledWith(
      1,
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('Expected delivery format: findings_first.'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Final verification rigor: strict.'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Start with the most important findings'),
        }),
      ]),
      undefined,
      expect.objectContaining({
        providerName: 'AIGateway',
        modelName: config.AIGatewayModel,
      }),
    );

    const criticSystemPrompt = llmRuntime.chat.mock.calls[1][0][0].content;
    expect(criticSystemPrompt).toContain('Only approve when the response covers risks, impact and expected validations');
    expect(criticSystemPrompt).toContain('reject responses that hide the main findings');
  });

  it('enforces checkpointed delivery and stepwise verification for automation tasks', async () => {
    const llmRuntime = {
      getPreferredProviderName: jest.fn().mockReturnValue('AIGateway'),
      isProviderAvailable: jest.fn((name: string) => ['AIGateway', 'gemini', 'openai'].includes(name)),
      chat: jest
        .fn()
        .mockResolvedValueOnce({
          content: 'Checkpoint 1 completed. Checkpoint 2 completed.',
          toolCalls: [],
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          content: 'APROVADO',
          toolCalls: [],
          finishReason: 'stop',
        }),
    } as any;

    const runtime = new GraphRuntimeService({
      llmRuntime,
      maxIterations: 2,
      maxToolRounds: 1,
    });

    await runtime.runAutonomousTask('automate navigation to the registration form', {
      metadata: {
        taskKind: 'automation',
        taskSubtype: 'navigation',
      },
    });

    expect(llmRuntime.chat).toHaveBeenNthCalledWith(
      1,
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('Expected delivery format: checkpointed.'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Final verification rigor: stepwise.'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Organize the output by checkpoints'),
        }),
      ]),
      undefined,
      expect.objectContaining({
        providerName: 'AIGateway',
        modelName: config.AIGatewayModel,
      }),
    );

    const criticSystemPrompt = llmRuntime.chat.mock.calls[1][0][0].content;
    expect(criticSystemPrompt).toContain('Only approve when checkpoints are coherent');
    expect(criticSystemPrompt).toContain('reject responses that jump from execution to conclusion');
  });

  it('records a traceable decision with provider and skill routing hints', async () => {
    const llmRuntime = {
      getPreferredProviderName: jest.fn().mockReturnValue('gemini'),
      isProviderAvailable: jest.fn().mockReturnValue(true),
      chat: jest
        .fn()
        .mockResolvedValueOnce({
          content: 'Review completed.',
          toolCalls: [],
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          content: 'APROVADO',
          toolCalls: [],
          finishReason: 'stop',
        }),
    } as any;

    const runtime = new GraphRuntimeService({
      llmRuntime,
      maxIterations: 2,
      maxToolRounds: 1,
      executionIntentClassifierService: {
        classify: () => ({
          taskKind: 'code',
          taskSubtype: 'review',
          responseStyle: 'findings_first',
          executionMode: 'graph',
          executionRoute: 'graph.code',
          confidence: 'high',
          rationale: ['Explicit classification for code review.'],
        }),
      },
      providerStrategyService: {
        resolve: () => ({
          providerName: 'AIGateway',
          modelName: 'AIGateway-coder',
          allowFallback: true,
          fallbackOrder: ['openai'],
          profileId: 'coding',
          profileLabel: 'Coding',
          selectionSource: 'profile',
          configuredProviderName: 'gemini',
          learnedProviderName: null,
          rationale: ['Coding profile favors AIGateway for review.'],
        }),
      },
      skillRoutingService: {
        recommend: () => ({
          primarySkill: {
            id: 'skill:codenavi',
            name: 'codenavi',
            description: 'Navigate and review large codebases safely.',
          },
          supportingSkills: [
            {
              id: 'skill:security-threat-model',
              name: 'security-threat-model',
              description: 'Threat model a codebase with repo evidence.',
            },
          ],
          matchedBundleTags: ['coding', 'security'],
          rationale: ['Skill principal sugerida: @codenavi.'],
        }),
      },
    });

    const result = await runtime.runAutonomousTask('review the authentication module');

    expect(result.decisionTrace).toEqual(
      expect.objectContaining({
        executionRoute: 'graph.code',
        taskKind: 'code',
        taskSubtype: 'review',
        provider: expect.objectContaining({
          providerName: 'AIGateway',
          modelName: 'AIGateway-coder',
          profileId: 'coding',
        }),
        skills: expect.objectContaining({
          primarySkillName: 'codenavi',
          supportingSkillNames: ['security-threat-model'],
        }),
      }),
    );
    expect(llmRuntime.chat).toHaveBeenNthCalledWith(
      1,
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('Operational route for this execution: graph.code'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Suggested skill to drive the task: @codenavi'),
        }),
      ]),
      undefined,
      expect.objectContaining({
        providerName: 'AIGateway',
        modelName: 'AIGateway-coder',
      }),
    );
  });
});
