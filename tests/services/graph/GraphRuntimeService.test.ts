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
          content: 'Plano concluido.',
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

    const result = await runtime.runAutonomousTask('revisar o codigo');

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
          description: 'Le um arquivo local.',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Caminho do arquivo.',
              },
            },
            required: ['path'],
          },
        },
      ]),
      executeTool: jest.fn().mockResolvedValue('conteudo do arquivo'),
    } as any;

    const runtime = new GraphRuntimeService({
      llmRuntime,
      toolRuntime,
      maxIterations: 2,
      maxToolRounds: 2,
    });

    const result = await runtime.runAutonomousTask('analisar o README');
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
    expect(result.finalReply).toBe('Arquivo analisado com sucesso.');
  });

  it('stops after the configured max iterations when the critic keeps rejecting the work', async () => {
    const llmRuntime = {
      getPreferredProviderName: jest.fn().mockReturnValue('AIGateway'),
      isProviderAvailable: jest.fn().mockReturnValue(true),
      chat: jest
        .fn()
        .mockResolvedValueOnce({
          content: 'Primeira tentativa.',
          toolCalls: [],
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          content: 'Corrija a conclusao.',
          toolCalls: [],
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          content: 'Segunda tentativa.',
          toolCalls: [],
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          content: 'Ainda nao esta boa.',
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
    expect(result.criticFeedback).toBe('Ainda nao esta boa.');
    expect(result.finalReply).toBe('Segunda tentativa.');
  });

  it('builds strategy hints from workspace profile and operational memory before invoking the graph', async () => {
    const llmRuntime = {
      getPreferredProviderName: jest.fn().mockReturnValue('AIGateway'),
      isProviderAvailable: jest.fn().mockReturnValue(true),
      chat: jest
        .fn()
        .mockResolvedValueOnce({
          content: 'Plano ajustado ao workspace.',
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
        content: 'Contexto adicional para a tarefa autonoma.\n\nWORKSPACE ATUAL:\n- C:/repo',
      },
    ] as any;

    const result = await runtime.runAutonomousTask('revisar o projeto', {
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
          instruction_summary: 'Priorize mudancas pequenas e validacao objetiva antes de concluir.',
          instruction_notes: [
            'Rode npm test antes de concluir mudancas estruturais.',
            'Prefira atuar em src/ e tests/ antes de scripts operacionais.',
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
              repeated_failure_summary: 'resposta superficial no code review',
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
          content: expect.stringContaining('Tipo estimado da tarefa atual: code'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Subtipo estimado da tarefa atual: review'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Para o subtipo review, priorize external_executor'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('evite repetir codex'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('WORKSPACE ATUAL'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Resumo do ZAVORTH.md'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Rode npm test antes de concluir mudancas estruturais'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Hooks operacionais declarados no workspace'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Comandos reutilizaveis do workspace'),
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

    await runtime.runAutonomousTask('compare GPT e Claude para code review', {
      metadata: {
        taskKind: 'research',
        taskSubtype: 'comparison',
      },
    });

    expect(llmRuntime.chat).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('Tipo estimado da tarefa atual: research'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Subtipo estimado da tarefa atual: comparison'),
        }),
        expect.objectContaining({
          content: expect.stringContaining(`Modelo preferencial desta tarefa: ${config.openRouterModel}`),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Perfil de profundidade: deep; intensidade de ferramentas: evidence_heavy'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Estruture a entrega como comparacao clara'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('tradeoffs, riscos e recomendacao final'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('use ferramentas suficientes para reunir evidencia verificavel'),
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
          content: 'Sintese pronta.',
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

    await runtime.runAutonomousTask('resuma as principais noticias de IA da semana', {
      metadata: {
        taskKind: 'research',
        taskSubtype: 'summarization',
      },
    });

    expect(llmRuntime.chat).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('Subtipo estimado da tarefa atual: summarization'),
        }),
        expect.objectContaining({
          content: expect.stringContaining(`Modelo preferencial desta tarefa: ${config.aiStudioModel}`),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Perfil de profundidade: concise; intensidade de ferramentas: minimal'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Entregue uma sintese curta e hierarquizada'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('resumo executivo'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Evite rodadas extras de ferramenta'),
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
          content: 'Comparacao pronta com provider aprendido.',
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

    await runtime.runAutonomousTask('compare provedores para code review', {
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
          content: expect.stringContaining('Provider preferencial desta tarefa: deepseek'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Modelo preferencial desta tarefa: deepseek-chat'),
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
            { id: 'tool-1', name: 'search_web', arguments: { q: 'modelo A' } },
          ],
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            { id: 'tool-2', name: 'search_web', arguments: { q: 'modelo B' } },
          ],
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'Comparacao aprofundada pronta.',
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
          description: 'Pesquisa na web.',
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

    const result = await runtime.runAutonomousTask('compare GPT e Claude para code review', {
      metadata: {
        taskKind: 'research',
        taskSubtype: 'comparison',
      },
    });

    expect(toolRuntime.executeTool).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
    expect(result.finalReply).toBe('Comparacao aprofundada pronta.');
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
          content: 'Primeira comparacao ainda superficial.',
          toolCalls: [],
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          content: 'Aprofunde os tradeoffs e refine a recomendacao final.',
          toolCalls: [],
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          content: 'Comparacao refinada com recomendacao final.',
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

    const result = await runtime.runAutonomousTask('compare GPT e Claude para code review', {
      metadata: {
        taskKind: 'research',
        taskSubtype: 'comparison',
      },
    });

    expect(result.ok).toBe(true);
    expect(result.iterations).toBe(2);
    expect(result.finalReply).toBe('Comparacao refinada com recomendacao final.');
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

    await runtime.runAutonomousTask('compare provedores para code review', {
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
              arguments: { filepath: 'output/teste.md', content: 'nao deveria escrever' },
            },
          ],
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'Review finalizado com um achado principal.',
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
      executeTool: jest.fn().mockResolvedValue('arquivo criado'),
    } as any;

    const runtime = new GraphRuntimeService({
      llmRuntime,
      toolRuntime,
      maxIterations: 2,
      maxToolRounds: 2,
    });

    const result = await runtime.runAutonomousTask('faca review do modulo de pagamento', {
      metadata: {
        taskKind: 'code',
        taskSubtype: 'review',
      },
    });

    expect(toolRuntime.executeTool).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.finalReply).toBe('Review finalizado com um achado principal.');
  });

  it('prioritizes control tools for automation tasks', async () => {
    const llmRuntime = {
      getPreferredProviderName: jest.fn().mockReturnValue('AIGateway'),
      isProviderAvailable: jest.fn((name: string) => ['AIGateway', 'gemini', 'openai'].includes(name)),
      chat: jest
        .fn()
        .mockResolvedValueOnce({
          content: 'Automacao planejada.',
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

    await runtime.runAutonomousTask('automatize a navegacao para preencher um formulario', {
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
          content: 'Achei um bug de regressao no fluxo de login.',
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

    await runtime.runAutonomousTask('faca review do modulo de autenticacao', {
      metadata: {
        taskKind: 'code',
        taskSubtype: 'review',
      },
    });

    expect(llmRuntime.chat).toHaveBeenNthCalledWith(
      1,
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('Formato de entrega esperado: findings_first.'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Rigor de verificacao final: strict.'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Comece pelos achados mais importantes'),
        }),
      ]),
      undefined,
      expect.objectContaining({
        providerName: 'AIGateway',
        modelName: config.AIGatewayModel,
      }),
    );

    const criticSystemPrompt = llmRuntime.chat.mock.calls[1][0][0].content;
    expect(criticSystemPrompt).toContain('So aprove quando a resposta cobrir riscos, impacto e verificacoes esperadas');
    expect(criticSystemPrompt).toContain('rejeite respostas que escondam os principais achados');
  });

  it('enforces checkpointed delivery and stepwise verification for automation tasks', async () => {
    const llmRuntime = {
      getPreferredProviderName: jest.fn().mockReturnValue('AIGateway'),
      isProviderAvailable: jest.fn((name: string) => ['AIGateway', 'gemini', 'openai'].includes(name)),
      chat: jest
        .fn()
        .mockResolvedValueOnce({
          content: 'Checkpoint 1 concluido. Checkpoint 2 concluido.',
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

    await runtime.runAutonomousTask('automatize a navegacao ate o formulario de cadastro', {
      metadata: {
        taskKind: 'automation',
        taskSubtype: 'navigation',
      },
    });

    expect(llmRuntime.chat).toHaveBeenNthCalledWith(
      1,
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('Formato de entrega esperado: checkpointed.'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Rigor de verificacao final: stepwise.'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Organize a saida por checkpoints'),
        }),
      ]),
      undefined,
      expect.objectContaining({
        providerName: 'AIGateway',
        modelName: config.AIGatewayModel,
      }),
    );

    const criticSystemPrompt = llmRuntime.chat.mock.calls[1][0][0].content;
    expect(criticSystemPrompt).toContain('So aprove quando os checkpoints estiverem coerentes');
    expect(criticSystemPrompt).toContain('rejeite respostas que pulam de execucao para conclusao');
  });

  it('records a traceable decision with provider and skill routing hints', async () => {
    const llmRuntime = {
      getPreferredProviderName: jest.fn().mockReturnValue('gemini'),
      isProviderAvailable: jest.fn().mockReturnValue(true),
      chat: jest
        .fn()
        .mockResolvedValueOnce({
          content: 'Review finalizado.',
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
          rationale: ['Classificacao explicita para review de codigo.'],
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
          rationale: ['Perfil Coding favorece AIGateway para review.'],
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

    const result = await runtime.runAutonomousTask('faca review do modulo de autenticacao');

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
          content: expect.stringContaining('Rota operacional desta execucao: graph.code'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Skill sugerida para conduzir a tarefa: @codenavi'),
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
