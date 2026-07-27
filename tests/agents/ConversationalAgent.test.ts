import { ConversationalAgent } from '../../src/agents/ConversationalAgent';
import { config } from '../../src/config/index';
import { STRUCTURED_AGENT_RUN_ACTION_TYPE } from '../../src/contracts/runtime/StructuredAgentRunContract';

describe('ConversationalAgent', () => {
  const originalProvider = (config as any).llmProvider;

  beforeEach(() => {
    (config as any).llmProvider = 'gemini';
  });

  afterEach(() => {
    (config as any).llmProvider = originalProvider;
  });

  it('builds a lean user-facing system instruction without dumping slash command catalogs', () => {
    const agent = new ConversationalAgent();
    const instruction = agent.buildSystemInstruction();

    expect(instruction).toMatch(/You are \*\*Zavorth\*\*/i);
    expect(instruction).toMatch(/Use tools when facts need verification/i);
    expect(instruction).toMatch(/web_search/i);
    expect(instruction).toMatch(/Slash\/UI commands exist/i);
    expect(instruction).toMatch(/DISCIPLINA ANTI-ALUCINACAO|ANTI-HALLUCINATION|there isllucination|Never invent/i);
    // Lean prompt: no full slash catalog dump every turn
    expect(instruction).not.toMatch(/KNOWN COMMANDS \(INTERNAL REFERENCE\)/i);
    expect(instruction).not.toMatch(/\/selfmod/i);
    expect(instruction).not.toMatch(/responda na primeira linthere is exatamente|respond on the first line exactly/i);
  });

  it('exposes brain tools with full schema and other tools as compact lazy stubs', async () => {
    const llmRuntime = {
      isProviderAvailable: jest.fn(() => true),
      chatDetailed: jest.fn().mockResolvedValue({
        providerName: 'gemini',
        response: { content: 'ok' },
      }),
    } as any;
    const toolRuntime = {
      getToolDefinitions: jest.fn().mockReturnValue([
        {
          name: 'web_search',
          description: 'Search the web for current information and sources.',
          parameters: {
            type: 'object',
            properties: { query: { type: 'string', description: 'Query' } },
            required: ['query'],
          },
        },
        {
          name: 'remote_shell',
          description: 'Run a shell command on a remote host with full control options.',
          parameters: {
            type: 'object',
            properties: {
              command: { type: 'string', description: 'Shell command' },
              cwd: { type: 'string', description: 'Working directory' },
            },
            required: ['command'],
          },
        },
      ]),
      executeTool: jest.fn(),
    };
    const agent = new ConversationalAgent({ llmRuntime, toolRuntime } as any);
    await agent.chat('hello there', undefined, { mode: 'direct' });

    const tools = llmRuntime.chatDetailed.mock.calls[0][1] as any[];
    const web = tools.find((t) => t.name === 'web_search');
    const shell = tools.find((t) => t.name === 'remote_shell');
    expect(web?.parameters?.properties?.query).toBeDefined();
    expect(shell?.metadata?.lazyCompact).toBe(true);
    expect(Object.keys(shell?.parameters?.properties || {})).toHaveLength(0);
    const system = String(llmRuntime.chatDetailed.mock.calls[0][0].find((m: any) => m.role === 'system')?.content || '');
    expect(system).toMatch(/lazy/i);
    expect(system).toMatch(/remote_shell/);
  });

  it('does not convert reply text markers into actions', async () => {
    const llmRuntime = {
      isProviderAvailable: jest.fn(() => true),
      chatDetailed: jest.fn().mockResolvedValue({
        providerName: 'gemini',
        response: {
          content: 'change the system',
        },
      }),
    } as any;
    const agent = new ConversationalAgent(llmRuntime);

    const defaultResponse = await agent.chat('change the system');

    expect(defaultResponse.action).toBeUndefined();
    expect(defaultResponse.text).toBe('change the system');
    expect(defaultResponse.escalation).toEqual(expect.objectContaining({
      shouldEscalate: false,
      source: 'none',
      reason: 'none',
    }));
  });

  it('mitigates unsupported current factual answers before returning them', async () => {
    const llmRuntime = {
      isProviderAvailable: jest.fn(() => true),
      chatDetailed: jest.fn().mockResolvedValue({
        providerName: 'gemini',
        response: {
          content: 'The current CEO of Example Corp is Ana Silva.',
        },
      }),
    } as any;
    const agent = new ConversationalAgent(llmRuntime);

    const response = await agent.chat('who is the current CEO of Example Corp-', undefined, {
      mode: 'direct',
    });

    expect(response.text).toContain('Reliability note');
    expect(response.text).toContain('I need to verify before treating it as fact');
    expect(response.text).toContain('The current CEO of Example Corp is Ana Silva.');
  });

  it('can request structured autonomous escalation without using the legacy marker', async () => {
    const llmRuntime = {
      isProviderAvailable: jest.fn(() => true),
      chatDetailed: jest.fn().mockResolvedValue({
        providerName: 'gemini',
        response: {
          content: 'I will route this execution through the structured runtime.',
        },
      }),
    } as any;
    const agent = new ConversationalAgent(llmRuntime);

    const response = await agent.chat('run focused validation', undefined, {
      executionEscalation: {
        target: 'graph_runtime',
        taskGoal: 'run focused validation',
      },
    });

    expect(response.text).toBe('Starting the autonomous runtime to change the system...');
    expect(response.action).toEqual(expect.objectContaining({
      type: STRUCTURED_AGENT_RUN_ACTION_TYPE,
      payload: 'run focused validation',
      metadata: expect.objectContaining({
        canonicalEscalation: true,
      }),
    }));
    expect(response.escalation).toEqual(expect.objectContaining({
      shouldEscalate: true,
      target: 'graph_runtime',
      source: 'structured',
      reason: 'graph-runtime-required',
      taskGoal: 'run focused validation',
    }));
  });

  it('uses task profile to choose a stronger provider/model for research comparison', async () => {
    const llmRuntime = {
      isProviderAvailable: jest.fn((name: string) => ['openrouter', 'aigateway', 'gemini', 'openai'].includes(name)),
      chatDetailed: jest.fn().mockResolvedValue({
        providerName: 'openrouter',
        response: { content: 'Comparison ready.' },
      }),
    } as any;
    const agent = new ConversationalAgent(llmRuntime);

    await agent.chat('compare providers for code review', undefined, {
      taskKind: 'research',
      taskSubtype: 'comparison',
    });

    expect(llmRuntime.chatDetailed).toHaveBeenCalledWith(
      expect.any(Array),
      undefined,
      expect.objectContaining({
        // Workspace strategy stays on the user-configured provider; task kind only picks model.
        providerName: 'gemini',
        modelName: expect.any(String),
        allowFallback: false,
        fallbackOrder: [],
      }),);
  });

  it('uses task profile to choose summarization model and keeps direct style hints in direct mode', async () => {
    const llmRuntime = {
      isProviderAvailable: jest.fn((name: string) => ['gemini', 'aigateway', 'openrouter'].includes(name)),
      chatDetailed: jest.fn().mockResolvedValue({
        providerName: 'gemini',
        response: { content: 'Summary ready.' },
      }),
    } as any;
    const agent = new ConversationalAgent(llmRuntime);

    await agent.chat("summarize this week's news", undefined, {
      mode: 'direct',
      taskKind: 'research',
      taskSubtype: 'summarization',
      styleHints: ['Open with a short executive summary.'],
    });

    expect(llmRuntime.chatDetailed).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'system',
          content: expect.stringMatching(
            /PREFERRED FORMAT|FORMATO PREFERENCIAL|Open with a short executive summary/i,
          ),
        }),
      ]),
      undefined,
      expect.objectContaining({
        providerName: 'gemini',
        modelName: config.graphResearchSummaryModel || config.aiStudioModel || config.geminiModel,
        allowFallback: false,
      }),
    );
  });

  it('does not pre-run web_search for free-text news; exposes the tool for the model', async () => {
    const llmRuntime = {
      isProviderAvailable: jest.fn((name: string) => ['gemini', 'aigateway', 'openrouter'].includes(name)),
      chatDetailed: jest.fn().mockResolvedValue({
        providerName: 'gemini',
        response: { content: 'Summary with current news.' },
      }),
    } as any;
    const toolRuntime = {
      getToolDefinitions: jest.fn().mockReturnValue([
        {
          name: 'web_search',
          description: 'Web search',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      ]),
      executeTool: jest.fn().mockResolvedValue('Search results for recent news.'),
    };
    const agent = new ConversationalAgent({ llmRuntime, toolRuntime } as any);

    await agent.chat('summarize news from the last 24 hours', undefined, {
      mode: 'direct',
      taskKind: 'research',
      taskSubtype: 'summarization',
    });

    expect(toolRuntime.executeTool).not.toHaveBeenCalled();
    expect(llmRuntime.chatDetailed).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: 'user', content: 'summarize news from the last 24 hours' }),
      ]),
      expect.arrayContaining([
        expect.objectContaining({ name: 'web_search' }),
      ]),
      expect.any(Object),
    );
    const systemMessages = llmRuntime.chatDetailed.mock.calls[0][0]
      .filter((entry: any) => entry.role === 'system')
      .map((entry: any) => String(entry.content || ''))
      .join('\n');
    expect(systemMessages).not.toContain('Automatic web search context');
  });

  it('runs web_search only when the model issues a tool call', async () => {
    const llmRuntime = {
      isProviderAvailable: jest.fn((name: string) => ['gemini', 'aigateway', 'openrouter'].includes(name)),
      chatDetailed: jest.fn()
        .mockResolvedValueOnce({
          providerName: 'gemini',
          response: {
            content: '',
            toolCalls: [{ id: 'cached-search', name: 'web_search', arguments: { query: 'repeat' } }],
          },
        })
        .mockResolvedValueOnce({
          providerName: 'gemini',
          response: { content: 'Summary based on the sources found.' },
        }),
    } as any;
    const toolRuntime = {
      getToolDefinitions: jest.fn().mockReturnValue([
        {
          name: 'web_search',
          description: 'Web search',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      ]),
      executeTool: jest.fn().mockResolvedValue('QUALITY_GATE: fresh_news_results_ok\nRecent sources.'),
    };
    const agent = new ConversationalAgent({ llmRuntime, toolRuntime } as any);

    await agent.chat('tell me the latest weekly news on global politics', undefined, {
      mode: 'direct',
    });

    expect(toolRuntime.executeTool).toHaveBeenCalledTimes(1);
    expect(toolRuntime.executeTool).toHaveBeenCalledWith('web_search', expect.objectContaining({
      query: 'repeat',
    }));
    expect(llmRuntime.chatDetailed).toHaveBeenCalledTimes(2);
    expect(llmRuntime.chatDetailed.mock.calls[1][0]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        role: 'tool',
        content: expect.stringContaining('QUALITY_GATE: fresh_news_results_ok'),
      }),
    ]));
  });

  it('strips internal voice metadata before the LLM sees free text', async () => {
    const llmRuntime = {
      isProviderAvailable: jest.fn((name: string) => ['gemini', 'aigateway', 'openrouter'].includes(name)),
      chatDetailed: jest.fn().mockResolvedValue({
        providerName: 'gemini',
        response: { content: 'Yes, I can reply with audio when Echo is active.' },
      }),
    } as any;
    const toolRuntime = {
      getToolDefinitions: jest.fn().mockReturnValue([
        {
          name: 'web_search',
          description: 'Web search',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      ]),
      executeTool: jest.fn().mockResolvedValue('Should not search.'),
    };
    const agent = new ConversationalAgent({ llmRuntime, toolRuntime } as any);

    await agent.chat(
      '[Automatically transcribed audio]  STT provider: gemini. Use this transcript as an auditory draft, not as confirmation of the user name or identity. Can you send me an audio reply?',
      undefined,
      { mode: 'direct' },
    );

    expect(toolRuntime.executeTool).not.toHaveBeenCalled();
    expect(llmRuntime.chatDetailed.mock.calls[0][0]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        role: 'user',
        content: 'Can you send me an audio reply?',
      }),
    ]));
  });

  it('does not auto-search follow-ups; model owns tool use with context messages', async () => {
    const llmRuntime = {
      isProviderAvailable: jest.fn((name: string) => ['gemini', 'aigateway', 'openrouter'].includes(name)),
      chatDetailed: jest.fn().mockResolvedValue({
        providerName: 'gemini',
        response: { content: 'Verified news details.' },
      }),
    } as any;
    const toolRuntime = {
      getToolDefinitions: jest.fn().mockReturnValue([
        {
          name: 'web_search',
          description: 'Web search',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      ]),
      executeTool: jest.fn().mockResolvedValue('Detailed result with sources.'),
    };
    const contextEngine = {
      prepareAsync: jest.fn().mockResolvedValue({
        messages: [
          { role: 'system', content: 'system via context engine' },
          { role: 'user', content: 'me diga as latest AI news worldwide' },
          {
            role: 'assistant',
            content: '1. OpenAI releases new ChatGPT research tools - https://example.com/openai',
          },
          { role: 'user', content: 'explain more about that news item you mentioned' },
        ],
        tools: [{ name: 'web_search', description: 'Web search', parameters: { type: 'object', properties: {}, required: [] } }],
        useFastModel: false,
        firewallStats: 'stats',
        intentCategory: 'full_toolset',
      }),
    };
    const agent = new ConversationalAgent({ llmRuntime, toolRuntime, contextEngine } as any);

    await agent.chat('explain more about that news item you mentioned', undefined, {
      mode: 'direct',
      requireContextEngine: true,
      userId: 'user-1',
      chatId: 'chat-1',
      surface: 'telegram',
    });

    expect(toolRuntime.executeTool).not.toHaveBeenCalled();
    expect(llmRuntime.chatDetailed).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: 'explain more about that news item you mentioned',
        }),
      ]),
      expect.arrayContaining([
        expect.objectContaining({ name: 'web_search' }),
      ]),
      expect.any(Object),
    );
  });

  it.each([
    'what is the best notebook cost benefit in 2026-',
    'write a report with sources about remote work impacts',
    'who is the current Chief Justice of the US Supreme Court-',
    'what are the latest medical discoveries worldwide-',
    'find court cases about moral damages for flight delays',
    'find scientific articles about CRISPR and send the links',
    'teach me a simple pancake recipe',
  ])('does not keyword-auto-search free text: %s', async (message) => {
    const llmRuntime = {
      isProviderAvailable: jest.fn((name: string) => ['gemini', 'aigateway', 'openrouter'].includes(name)),
      chatDetailed: jest.fn().mockResolvedValue({
        providerName: 'gemini',
        response: { content: 'Direct model answer without pre-search.' },
      }),
    } as any;
    const toolRuntime = {
      getToolDefinitions: jest.fn().mockReturnValue([
        {
          name: 'web_search',
          description: 'Web search',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      ]),
      executeTool: jest.fn(),
    };
    const agent = new ConversationalAgent({ llmRuntime, toolRuntime } as any);

    await agent.chat(message, undefined, { mode: 'direct' });

    expect(toolRuntime.executeTool).not.toHaveBeenCalled();
    expect(llmRuntime.chatDetailed.mock.calls[0][1]).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'web_search' })]),
    );
  });

  it('refuses natural-surface LLM calls when ContextEngine.prepareAsync is required but unavailable', async () => {
    const llmRuntime = {
      isProviderAvailable: jest.fn((name: string) => ['gemini', 'aigateway', 'openrouter'].includes(name)),
      chatDetailed: jest.fn(),
    } as any;
    const toolRuntime = {
      getToolDefinitions: jest.fn().mockReturnValue([
        {
          name: 'web_search',
          description: 'Web search',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      ]),
      executeTool: jest.fn(),
    };
    const agent = new ConversationalAgent({ llmRuntime, toolRuntime } as any);

    await expect(agent.chat('summarize current news', undefined, {
      mode: 'direct',
      requireContextEngine: true,
      userId: 'user-1',
      chatId: 'chat-1',
      surface: 'telegram',
    })).rejects.toThrow('ContextEngine.prepareAsync');

    expect(toolRuntime.executeTool).not.toHaveBeenCalled();
    expect(llmRuntime.chatDetailed).not.toHaveBeenCalled();
  });

  it('uses ContextEngine.prepareAsync before required natural-surface LLM calls', async () => {
    const llmRuntime = {
      isProviderAvailable: jest.fn((name: string) => ['gemini', 'aigateway', 'openrouter'].includes(name)),
      chatDetailed: jest.fn().mockResolvedValue({
        providerName: 'gemini',
        response: { content: 'Response prepared by context.' },
      }),
    } as any;
    const toolDefinitions = [
      {
        name: 'get_datetime',
        description: 'Date and time',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    ];
    const contextDecision = {
      messages: [
        { role: 'system', content: 'system via context engine' },
        { role: 'user', content: 'hello via web' },
      ],
      tools: toolDefinitions,
      useFastModel: false,
      firewallStats: 'Context firewall stats',
      intentCategory: 'general',
    };
    const contextEngine = {
      prepareAsync: jest.fn().mockResolvedValue(contextDecision),
    };
    const agent = new ConversationalAgent({
      llmRuntime,
      toolRuntime: {
        getToolDefinitions: jest.fn().mockReturnValue(toolDefinitions),
        executeTool: jest.fn(),
      },
      contextEngine,
    } as any);

    await agent.chat('hello via web', undefined, {
      mode: 'direct',
      requireContextEngine: true,
      userId: 'user-web',
      chatId: 'web:session-1',
      surface: 'web',
      workspaceContext: 'workspace extra',
    });

    expect(contextEngine.prepareAsync).toHaveBeenCalledWith(
      'hello via web',
      'user-web',
      'web:session-1',
      'web',
      toolDefinitions,
      expect.stringMatching(/You are \*\*Zavorth\*\*/i),
      'workspace extra',
      undefined,
    );
    // Lazy tool catalog is injected into the system message before chatDetailed.
    expect(llmRuntime.chatDetailed).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'system',
          content: expect.stringMatching(/TOOLS \(lazy\)|get_datetime/i),
        }),
        expect.objectContaining({ role: 'user', content: 'hello via web' }),
      ]),
      expect.arrayContaining([
        expect.objectContaining({ name: 'get_datetime' }),
      ]),
      expect.objectContaining({
        providerName: 'gemini',
        allowFallback: false,
        fallbackOrder: [],
      }),
    );
  });

  it('uses ContextEngine toolHintProfile as policy input before falling back to legacy tools', async () => {
    const llmRuntime = {
      isProviderAvailable: jest.fn((name: string) => ['gemini', 'aigateway', 'openrouter'].includes(name)),
      chatDetailed: jest.fn().mockResolvedValue({
        providerName: 'gemini',
        response: { content: 'README checked.' },
      }),
    } as any;
    const readFileTool = {
      name: 'read_file',
      description: 'Read file',
      parameters: { type: 'object', properties: {}, required: [] },
    };
    const listDirectoryTool = {
      name: 'list_directory',
      description: 'List directory',
      parameters: { type: 'object', properties: {}, required: [] },
    };
    const webSearchTool = {
      name: 'web_search',
      description: 'Web search',
      parameters: { type: 'object', properties: {}, required: [] },
    };
    const contextEngine = {
      prepareAsync: jest.fn().mockResolvedValue({
        messages: [
          { role: 'system', content: 'system via context engine' },
          { role: 'user', content: 'check the main project README' },
        ],
        tools: [webSearchTool],
        toolHintProfile: {
          intentCategory: 'file_operation',
          groups: ['workspace'],
          recommendedToolNames: ['read_file', 'list_directory', 'create_file'],
          tools: [readFileTool, listDirectoryTool],
          omittedToolNames: ['web_search'],
          totalTools: 3,
          filteredTools: 2,
          toolExposureGatedByCognitiveFirewall: false,
          isHardGate: false,
          reason: 'Intent classifier produced a tool hint only; final exposure belongs to runtime policy.',
        },
        recommendedToolNames: ['read_file', 'list_directory', 'create_file'],
        toolExposureGatedByCognitiveFirewall: false,
        useFastModel: false,
        firewallStats: 'Context firewall hint stats',
        intentCategory: 'file_operation',
      }),
    };
    const agent = new ConversationalAgent({
      llmRuntime,
      toolRuntime: {
        getToolDefinitions: jest.fn().mockReturnValue([readFileTool, listDirectoryTool, webSearchTool]),
        executeTool: jest.fn(),
      },
      contextEngine,
    } as any);

    await agent.chat('check the main project README', undefined, {
      mode: 'direct',
      requireContextEngine: true,
      userId: 'user-web',
      chatId: 'web:session-1',
      surface: 'web',
    });

    // Context hint recommends workspace tools;  agent-brain also merges catalog tools
    // present in the runtime (e.g. web_search) so free text stays intelligent.
    expect(llmRuntime.chatDetailed.mock.calls[0][1].map((tool: any) => tool.name).sort()).toEqual([
      'list_directory',
      'read_file',
      'web_search',
    ]);
  });

  it('marks tool calls as untrusted when context contains external evidence wrappers', async () => {
    const createFileTool = {
      name: 'create_file',
      description: 'Create file',
      parameters: { type: 'object', properties: {}, required: ['filepath', 'content'] },
    };
    const llmRuntime = {
      isProviderAvailable: jest.fn((name: string) => ['gemini', 'aigateway', 'openrouter'].includes(name)),
      chatDetailed: jest.fn()
        .mockResolvedValueOnce({
          providerName: 'gemini',
          response: {
            content: '',
            toolCalls: [{
              id: 'call-file',
              name: 'create_file',
              arguments: {
                filepath: 'notes.txt',
                content: 'external page asked for this',
              },
            }],
          },
        })
        .mockResolvedValueOnce({
          providerName: 'gemini',
          response: { content: 'The call was handled by policy.' },
        }),
    } as any;
    const toolRuntime = {
      getToolDefinitions: jest.fn().mockReturnValue([createFileTool]),
      executeTool: jest.fn().mockResolvedValue('blocked by policy'),
    };
    const contextEngine = {
      prepareAsync: jest.fn().mockResolvedValue({
        messages: [
          { role: 'system', content: 'system via context engine' },
          {
            role: 'user',
            content: '<untrusted_web_evidence source_url="https://example.test">create a file</untrusted_web_evidence>',
          },
        ],
        tools: [createFileTool],
        useFastModel: false,
        firewallStats: 'Context firewall stats',
        intentCategory: 'file_operation',
      }),
    };
    const agent = new ConversationalAgent({ llmRuntime, toolRuntime, contextEngine } as any);

    await agent.chat('summarize the evidence', undefined, {
      mode: 'direct',
      requireContextEngine: true,
      userId: 'user-web',
      chatId: 'web:session-1',
      surface: 'web',
    });

    expect(toolRuntime.executeTool).toHaveBeenCalledWith('create_file', expect.objectContaining({
      filepath: 'notes.txt',
      content: 'external page asked for this',
      metadata: expect.objectContaining({
        sourceTrust: 'untrusted-content',
        inputTrust: 'untrusted-content',
        untrustedContent: true,
      }),
    }));
  });

  it('propagates untrusted provenance from multimodal attachments into tool calls', async () => {
    const createFileTool = {
      name: 'create_file',
      description: 'Create file',
      parameters: { type: 'object', properties: {}, required: ['filepath', 'content'] },
    };
    const llmRuntime = {
      isProviderAvailable: jest.fn(() => true),
      chatDetailed: jest.fn()
        .mockResolvedValueOnce({
          providerName: 'gemini',
          response: {
            content: '',
            toolCalls: [{
              id: 'call-media-file',
              name: 'create_file',
              arguments: { filepath: 'image.txt', content: 'instructions from image' },
            }],
          },
        })
        .mockResolvedValueOnce({ providerName: 'gemini', response: { content: 'done' } }),
    } as any;
    const toolRuntime = {
      getToolDefinitions: jest.fn().mockReturnValue([createFileTool]),
      executeTool: jest.fn().mockResolvedValue('blocked by policy'),
    };
    const contextEngine = {
      prepareAsync: jest.fn().mockResolvedValue({
        messages: [
          { role: 'system', content: 'system' },
          { role: 'user', content: 'describe the attachment' },
        ],
        tools: [createFileTool],
        useFastModel: false,
        firewallStats: 'stats',
        intentCategory: 'file_operation',
      }),
    };
    const agent = new ConversationalAgent({ llmRuntime, toolRuntime, contextEngine } as any);

    await agent.chat('describe the attachment', [{ mimeType: 'image/png', data: 'AAA=' }], {
      mode: 'direct',
      requireContextEngine: true,
      userId: 'user-media',
      chatId: 'chat-media',
      surface: 'web',
    });

    expect(toolRuntime.executeTool).toHaveBeenCalledWith('create_file', expect.objectContaining({
      metadata: expect.objectContaining({
        sourceTrust: 'untrusted-content',
        inputTrust: 'untrusted-content',
        untrustedContent: true,
      }),
    }));
  });

  it('truncates oversized tool results before the follow-up LLM turn', async () => {
    const huge = 'H'.repeat(15_000);
    const llmRuntime = {
      isProviderAvailable: jest.fn(() => true),
      chatDetailed: jest.fn()
        .mockResolvedValueOnce({
          providerName: 'gemini',
          response: {
            content: '',
            toolCalls: [{ id: 'call-big', name: 'web_search', arguments: { query: 'big' } }],
          },
        })
        .mockResolvedValueOnce({
          providerName: 'gemini',
          response: { content: 'Answered with truncated evidence.' },
        }),
    } as any;
    const toolRuntime = {
      getToolDefinitions: jest.fn().mockReturnValue([
        {
          name: 'web_search',
          description: 'Web search',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      ]),
      executeTool: jest.fn().mockResolvedValue(huge),
    };
    const agent = new ConversationalAgent({ llmRuntime, toolRuntime } as any);
    const response = await agent.chat('search something large', undefined, { mode: 'direct' });

    const toolMsg = llmRuntime.chatDetailed.mock.calls[1][0].find((m: any) => m.role === 'tool');
    expect(String(toolMsg.content)).toContain('truncated tool output');
    expect(String(toolMsg.content).length).toBeLessThan(huge.length);
    expect(response.toolTelemetry?.truncatedToolResults).toBe(1);
    expect(response.text).toBe('Answered with truncated evidence.');
  });

  it('reuses cached read-only tool results on identical args', async () => {
    const llmRuntime = {
      isProviderAvailable: jest.fn(() => true),
      chatDetailed: jest.fn()
        .mockResolvedValueOnce({
          providerName: 'gemini',
          response: {
            content: '',
            toolCalls: [
              { id: 'c1', name: 'web_search', arguments: { query: 'same' } },
              { id: 'c2', name: 'web_search', arguments: { query: 'same' } },
            ],
          },
        })
        .mockResolvedValueOnce({
          providerName: 'gemini',
          response: { content: 'Done.' },
        }),
    } as any;
    const toolRuntime = {
      getToolDefinitions: jest.fn().mockReturnValue([
        {
          name: 'web_search',
          description: 'Web search',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      ]),
      executeTool: jest.fn().mockResolvedValue('QUALITY_GATE: ok\nCached body'),
    };
    const agent = new ConversationalAgent({ llmRuntime, toolRuntime } as any);
    const response = await agent.chat('search twice same query', undefined, { mode: 'direct' });

    expect(toolRuntime.executeTool).toHaveBeenCalledTimes(1);
    expect(response.toolTelemetry?.toolCacheHits).toBe(1);
    const toolMsgs = llmRuntime.chatDetailed.mock.calls[1][0].filter((m: any) => m.role === 'tool');
    expect(toolMsgs.some((m: any) => String(m.content).includes('cache hit'))).toBe(true);
  });

  it('compacts older tool history after multiple tool rounds', async () => {
    const llmRuntime = {
      isProviderAvailable: jest.fn(() => true),
      chatDetailed: jest.fn()
        .mockResolvedValueOnce({
          providerName: 'gemini',
          response: {
            content: '',
            toolCalls: [
              { id: 'a1', name: 'web_search', arguments: { query: 'a1' } },
              { id: 'a2', name: 'web_search', arguments: { query: 'a2' } },
            ],
          },
        })
        .mockResolvedValueOnce({
          providerName: 'gemini',
          response: {
            content: '',
            toolCalls: [
              { id: 'b1', name: 'web_search', arguments: { query: 'b1' } },
              { id: 'b2', name: 'web_search', arguments: { query: 'b2' } },
            ],
          },
        })
        .mockResolvedValueOnce({
          providerName: 'gemini',
          response: {
            content: '',
            toolCalls: [
              { id: 'c1', name: 'web_search', arguments: { query: 'c1' } },
              { id: 'c2', name: 'web_search', arguments: { query: 'c2' } },
            ],
          },
        })
        .mockResolvedValueOnce({
          providerName: 'gemini',
          response: { content: 'Finished multi-round.' },
        }),
    } as any;
    const toolRuntime = {
      getToolDefinitions: jest.fn().mockReturnValue([
        {
          name: 'web_search',
          description: 'Web search',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      ]),
      executeTool: jest.fn().mockImplementation(async (_name: string, args: any) => `RESULT:${args.query}`),
    };
    const agent = new ConversationalAgent({ llmRuntime, toolRuntime } as any);
    const response = await agent.chat('multi round research', undefined, { mode: 'direct' });

    expect(llmRuntime.chatDetailed).toHaveBeenCalledTimes(4);
    // After 3 tool rounds we should have compacted older tool messages at least once.
    expect(response.toolTelemetry?.historyCompactions).toBeGreaterThanOrEqual(1);
    const lastMessages = llmRuntime.chatDetailed.mock.calls[3][0];
    const compacted = lastMessages.filter(
      (m: any) => m.role === 'tool' && String(m.content).includes('[compacted tool history]'),
    );
    expect(compacted.length).toBeGreaterThanOrEqual(1);
    expect(response.text).toBe('Finished multi-round.');
  });

  it('executes conversational tool calls and follows up with tool results', async () => {
    const llmRuntime = {
      isProviderAvailable: jest.fn((name: string) => ['gemini', 'aigateway', 'openrouter'].includes(name)),
      chatDetailed: jest.fn()
        .mockResolvedValueOnce({
          providerName: 'gemini',
          response: {
            content: '',
            toolCalls: [{ id: 'call-1', name: 'web_search', arguments: { query: 'latest news' } }],
          },
        })
        .mockResolvedValueOnce({
          providerName: 'gemini',
          response: { content: 'Summary based on the search.' },
        }),
    } as any;
    const toolRuntime = {
      getToolDefinitions: jest.fn().mockReturnValue([
        {
          name: 'web_search',
          description: 'Web search',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      ]),
      executeTool: jest.fn().mockResolvedValue('Fresh web results.'),
    };
    const agent = new ConversationalAgent({ llmRuntime, toolRuntime } as any);

    // Model tool call path: free text does not pre-run search.
    const response = await agent.chat('research the latest AI news worldwide with sources');

    expect(toolRuntime.executeTool).toHaveBeenCalledWith(
      'web_search',
      expect.objectContaining({ query: 'latest news' }),
    );
    expect(llmRuntime.chatDetailed).toHaveBeenCalledTimes(2);
    expect(llmRuntime.chatDetailed.mock.calls[1][0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'tool',
          toolCallId: 'call-1',
          content: expect.stringContaining('<untrusted_tool_output'),
        }),
      ]),);
    expect(llmRuntime.chatDetailed.mock.calls[1][0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('Fresh web results.'),
        }),
      ]),);
    expect(response.text).toBe('Summary based on the search.');
  });

  it('exposes intent-relevant tools to voice/text conversations and can chain multiple tool rounds', async () => {
    const llmRuntime = {
      isProviderAvailable: jest.fn((name: string) => ['gemini', 'aigateway', 'openrouter'].includes(name)),
      chatDetailed: jest.fn()
        .mockResolvedValueOnce({
          providerName: 'gemini',
          response: {
            content: '',
            toolCalls: [{ id: 'call-search', name: 'web_search', arguments: { query: 'market trends' } }],
          },
        })
        .mockResolvedValueOnce({
          providerName: 'gemini',
          response: {
            content: '',
            toolCalls: [{
              id: 'call-file',
              name: 'create_file',
              arguments: {
                filepath: 'reports/market.md',
                content: '# Report\n\nChart: ...',
              },
            }],
          },
        })
        .mockResolvedValueOnce({
          providerName: 'gemini',
          response: { content: 'Full report created at output/reports/market.md.' },
        }),
    } as any;
    const toolDefinitions = [
      {
        name: 'web_search',
        description: 'Web search',
        parameters: { type: 'object', properties: {}, required: [] },
      },
      {
        name: 'create_file',
        description: 'Create file',
        parameters: { type: 'object', properties: {}, required: ['filepath', 'content'] },
      },
      {
        name: 'remote_shell',
        description: 'Run shell',
        parameters: { type: 'object', properties: {}, required: ['command'] },
      },
    ];
    const toolRuntime = {
      getToolDefinitions: jest.fn().mockReturnValue(toolDefinitions),
      executeTool: jest.fn()
        .mockResolvedValueOnce('Trends found.')
        .mockResolvedValueOnce('File created.'),
    };
    const agent = new ConversationalAgent({ llmRuntime, toolRuntime } as any);

    // Full catalog is exposed (including remote_shell); model chooses which tools to call.
    const response = await agent.chat('research market trends and create a report file with sources', undefined, {
      mode: 'direct',
    });

    expect(llmRuntime.chatDetailed.mock.calls[0][1]).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'web_search' }),
      expect.objectContaining({ name: 'create_file' }),
      expect.objectContaining({ name: 'remote_shell' }),
    ]));
    expect(toolRuntime.executeTool).toHaveBeenNthCalledWith(1, 'web_search', expect.objectContaining({
      query: 'market trends',
    }));
    expect(toolRuntime.executeTool).toHaveBeenNthCalledWith(2, 'create_file', expect.objectContaining({
      filepath: 'reports/market.md',
      content: '# Report\n\nChart: ...',
    }));
    expect(llmRuntime.chatDetailed).toHaveBeenCalledTimes(3);
    expect(response.text).toBe('Full report created at output/reports/market.md.');
  });

  it('complex free-text stays on the LLM tool path (no keyword auto-subagent steal)', async () => {
    const llmRuntime = {
      isProviderAvailable: jest.fn(() => true),
      chatDetailed: jest.fn().mockResolvedValue({
        providerName: 'gemini',
        response: {
          content: 'I will use tools (e.g. zavorth_delegate / agent_manager) when a multi-agent team is needed.',
        },
      }),
    } as any;
    const agent = new ConversationalAgent({ llmRuntime } as any);

    const response = await agent.chat(
      'do a deep audit of all of Zavorth, find failures and validate the findings',
      undefined,
      { mode: 'direct' },);

    expect(llmRuntime.chatDetailed).toHaveBeenCalled();
    expect(response.text).toMatch(/tools|zavorth_delegate|agent_manager|multi-agent/i);
  });

  it('explicit subagent free-text also reaches the LLM with brain tools available', async () => {
    const llmRuntime = {
      isProviderAvailable: jest.fn(() => true),
      chatDetailed: jest.fn().mockResolvedValue({
        providerName: 'gemini',
        response: {
          content: 'Use zavorth_delegate or agent_manager for multi-agent work; mutations need approval.',
        },
      }),
    } as any;
    const toolRuntime = {
      getToolDefinitions: jest.fn().mockReturnValue([
        { name: 'zavorth_delegate', description: 'Delegate to subagents', parameters: { type: 'object', properties: {}, required: [] } },
        { name: 'agent_manager', description: 'Manage agents', parameters: { type: 'object', properties: {}, required: [] } },
        { name: 'web_search', description: 'Web search', parameters: { type: 'object', properties: {}, required: [] } },
      ]),
      executeTool: jest.fn(),
    };
    const agent = new ConversationalAgent({ llmRuntime, toolRuntime } as any);

    const response = await agent.chat(
      'use subagents to edit the files and apply a patch to the project',
      undefined,
      { mode: 'direct' },);

    expect(llmRuntime.chatDetailed).toHaveBeenCalled();
    const exposed = llmRuntime.chatDetailed.mock.calls[0][1]?.map((tool: any) => tool.name) || [];
    expect(exposed).toEqual(expect.arrayContaining(['zavorth_delegate', 'agent_manager']));
    expect(response.text).toMatch(/zavorth_delegate|agent_manager|approval/i);
  });
});
