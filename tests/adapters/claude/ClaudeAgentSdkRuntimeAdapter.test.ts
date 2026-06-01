import { ClaudeAgentSdkRuntimeAdapter } from '../../../src/adapters/claude/ClaudeAgentSdkRuntimeAdapter.js';
import { AgentRunLlmRuntimeExecutor } from '../../../src/runtime/agent/AgentRunLlmRuntimeExecutor.js';
import { AgentRunService } from '../../../src/runtime/agent/AgentRunService.js';
import type {
  UniversalAgentRequest,
  UniversalAgentRun,
} from '../../../src/runtime/agent/UniversalAgentRuntimeTypes.js';

async function* sdkMessages(...messages: Array<Record<string, unknown>>): AsyncIterable<Record<string, unknown>> {
  for (const message of messages) {
    yield message;
  }
}

describe('ClaudeAgentSdkRuntimeAdapter', () => {
  it('stays unavailable until explicitly enabled', () => {
    const adapter = new ClaudeAgentSdkRuntimeAdapter({
      apiKey: 'test-key',
      cwd: 'C:/TESTES DEV/zavorth-core/Zavorth',
    });

    expect(adapter.isAvailable()).toBe(false);
  });

  it('runs through injected Claude Agent SDK query with plan-mode tools disabled', async () => {
    const calls: Array<Record<string, unknown>> = [];
    const adapter = new ClaudeAgentSdkRuntimeAdapter({
      enabled: true,
      apiKey: 'test-key',
      model: 'claude-test-model',
      cwd: 'C:/TESTES DEV/zavorth-core/Zavorth',
      allowedWorkspaceRoots: ['C:/TESTES DEV/zavorth-core'],
      query: (params) => {
        calls.push(params as unknown as Record<string, unknown>);
        return sdkMessages({
          type: 'result',
          subtype: 'success',
          result: 'Resposta Claude governada.',
          stop_reason: 'end_turn',
          session_id: 'claude-session-1',
        });
      },
    });

    const result = await adapter.chatDetailed([
      { role: 'system', content: 'Responda como Zavorth.' },
      { role: 'user', content: 'Ola' },
    ]);

    expect(result.providerName).toBe('claude-agent-sdk');
    expect(result.modelName).toBe('claude-test-model');
    expect(result.response.content).toBe('Resposta Claude governada.');
    expect(result.route.fallbackAllowed).toBe(false);
    expect(calls).toHaveLength(1);
    expect(calls[0].options).toEqual(expect.objectContaining({
      model: 'claude-test-model',
      permissionMode: 'plan',
      persistSession: false,
      settingSources: [],
      tools: [],
      allowedTools: [],
    }));
  });

  it('emits provider-native stream events from Claude Agent SDK query messages', async () => {
    const events: any[] = [];
    const adapter = new ClaudeAgentSdkRuntimeAdapter({
      enabled: true,
      apiKey: 'test-key',
      model: 'claude-stream-model',
      cwd: 'C:/TESTES DEV/zavorth-core/Zavorth',
      query: () => sdkMessages(
        {
          type: 'assistant',
          message: {
            content: [{ type: 'text', text: 'Parcial' }],
            stop_reason: null,
          },
          session_id: 'claude-stream-session',
        },
        {
          type: 'result',
          subtype: 'success',
          result: 'Parcial final',
          stop_reason: 'end_turn',
          session_id: 'claude-stream-session',
        },
      ),
    });

    const result = await adapter.chatDetailed([
      { role: 'user', content: 'stream' },
    ], [], {
      stream: {
        onEvent: (event) => {
          events.push(event);
        },
      },
    });

    expect(result.response.content).toBe('Parcial final');
    expect(result.metadata).toEqual(expect.objectContaining({
      providerNativeTokenStreaming: true,
      providerNativeStreamSource: 'claude-agent-sdk-query',
    }));
    expect(events).toEqual([
      expect.objectContaining({
        type: 'start',
        providerName: 'claude-agent-sdk',
        modelName: 'claude-stream-model',
        native: true,
      }),
      expect.objectContaining({
        type: 'delta',
        delta: 'Parcial',
        accumulated: 'Parcial',
        providerName: 'claude-agent-sdk',
      }),
      expect.objectContaining({
        type: 'delta',
        delta: ' final',
        accumulated: 'Parcial final',
      }),
      expect.objectContaining({
        type: 'done',
        done: true,
        accumulated: 'Parcial final',
      }),
    ]);
  });

  it('does not inherit unrelated host provider secrets into the Claude SDK env', async () => {
    const previousOpenAi = process.env.OPENAI_API_KEY;
    const previousGemini = process.env.GEMINI_API_KEY;
    const previousTelegram = process.env.TELEGRAM_BOT_TOKEN;
    process.env.OPENAI_API_KEY = 'host-openai-secret';
    process.env.GEMINI_API_KEY = 'host-gemini-secret';
    process.env.TELEGRAM_BOT_TOKEN = 'host-telegram-secret';
    let capturedOptions: Record<string, unknown> | null = null;

    try {
      const adapter = new ClaudeAgentSdkRuntimeAdapter({
        enabled: true,
        apiKey: 'explicit-anthropic-secret',
        cwd: 'C:/TESTES DEV/zavorth-core/Zavorth',
        env: {
          ZAVORTH_SAFE_FLAG: '1',
        },
        query: (params) => {
          capturedOptions = params.options as unknown as Record<string, unknown>;
          return sdkMessages({
            type: 'result',
            subtype: 'success',
            result: 'ok',
          });
        },
      });

      await adapter.chatDetailed([{ role: 'user', content: 'teste' }]);

      const env = capturedOptions?.env as Record<string, string>;
      expect(env).toEqual(expect.objectContaining({
        ANTHROPIC_API_KEY: 'explicit-anthropic-secret',
        CLAUDE_AGENT_SDK_CLIENT_APP: 'zavorth/claude-agent-sdk-runtime',
        ZAVORTH_SAFE_FLAG: '1',
      }));
      expect(env.OPENAI_API_KEY).toBeUndefined();
      expect(env.GEMINI_API_KEY).toBeUndefined();
      expect(env.TELEGRAM_BOT_TOKEN).toBeUndefined();
    } finally {
      if (previousOpenAi === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousOpenAi;
      if (previousGemini === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = previousGemini;
      if (previousTelegram === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
      else process.env.TELEGRAM_BOT_TOKEN = previousTelegram;
    }
  });

  it('blocks cwd outside configured workspace roots before calling the SDK', async () => {
    const query = jest.fn();
    const adapter = new ClaudeAgentSdkRuntimeAdapter({
      enabled: true,
      apiKey: 'test-key',
      cwd: 'D:/outside',
      allowedWorkspaceRoots: ['C:/TESTES DEV/zavorth-core'],
      query,
    });

    await expect(adapter.chatDetailed([
      { role: 'user', content: 'teste' },
    ])).rejects.toThrow(/outside allowed workspace roots/);
    expect(query).not.toHaveBeenCalled();
  });

  it('keeps configured write and shell tools in plan mode until Zavorth approval exists', async () => {
    const calls: Array<Record<string, unknown>> = [];
    const adapter = new ClaudeAgentSdkRuntimeAdapter({
      enabled: true,
      apiKey: 'test-key',
      cwd: 'C:/TESTES DEV/zavorth-core/Zavorth',
      toolPolicyMode: 'configured',
      allowedTools: ['Write', 'Bash'],
      requireApprovalForConfiguredTools: true,
      query: (params) => {
        calls.push(params as unknown as Record<string, unknown>);
        return sdkMessages({
          type: 'result',
          subtype: 'success',
          result: 'Plano sem tools live.',
          stop_reason: 'end_turn',
        });
      },
    });

    const result = await adapter.chatDetailed([
      { role: 'user', content: 'Crie um arquivo.' },
    ], [], {
      toolPolicy: {
        requestedTools: ['Write', 'Bash'],
        approvedToolIds: [],
        approvalGranted: false,
        exposedTools: [
          { id: 'Write', risk: 'danger', requiresApproval: true },
          { id: 'Bash', risk: 'danger', requiresApproval: true },
        ],
      },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].options).toEqual(expect.objectContaining({
      permissionMode: 'plan',
      tools: [],
      allowedTools: [],
    }));
    expect(result.metadata?.claudeAgentSdk).toEqual(expect.objectContaining({
      toolPolicyMode: 'configured',
      permissionMode: 'plan',
      allowedTools: [],
      requireApprovalForConfiguredTools: true,
    }));
  });

  it('allows only configured Claude tools that match approved Zavorth tool ids', async () => {
    let capturedOptions: Record<string, unknown> | null = null;
    const adapter = new ClaudeAgentSdkRuntimeAdapter({
      enabled: true,
      apiKey: 'test-key',
      cwd: 'C:/TESTES DEV/zavorth-core/Zavorth',
      toolPolicyMode: 'configured',
      allowedTools: ['Write', 'Bash'],
      requireApprovalForConfiguredTools: true,
      query: (params) => {
        capturedOptions = params.options as unknown as Record<string, unknown>;
        return sdkMessages({
          type: 'result',
          subtype: 'success',
          result: 'Write aprovado, Bash nao.',
          stop_reason: 'end_turn',
        });
      },
    });

    const result = await adapter.chatDetailed([
      { role: 'user', content: 'Atualize um arquivo.' },
    ], [], {
      toolPolicy: {
        requestedTools: ['Write', 'Bash'],
        approvedToolIds: ['write_file'],
        approvalGranted: true,
        exposedTools: [
          { id: 'Write', risk: 'danger', requiresApproval: true },
          { id: 'Bash', risk: 'danger', requiresApproval: true },
        ],
      },
    });

    expect(capturedOptions).toEqual(expect.objectContaining({
      permissionMode: 'dontAsk',
      tools: ['Write'],
      allowedTools: ['Write'],
    }));

    const canUseTool = capturedOptions?.canUseTool as (
      toolName: string,
      input: Record<string, unknown>,
      options: { signal: AbortSignal; toolUseID: string },
    ) => Promise<Record<string, unknown>>;
    await expect(canUseTool('Write', { file_path: 'README.md' }, {
      signal: new AbortController().signal,
      toolUseID: 'toolu-write',
    })).resolves.toEqual(expect.objectContaining({
      behavior: 'allow',
      toolUseID: 'toolu-write',
    }));
    await expect(canUseTool('Bash', { command: 'npm test' }, {
      signal: new AbortController().signal,
      toolUseID: 'toolu-bash',
    })).resolves.toEqual(expect.objectContaining({
      behavior: 'deny',
      toolUseID: 'toolu-bash',
    }));

    const metadata = result.metadata?.claudeAgentSdk as Record<string, unknown>;
    expect(metadata.permissionDecisions).toEqual([
      expect.objectContaining({
        toolName: 'Write',
        allowed: true,
        reason: 'allowed-by-zavorth-policy',
        approvalGranted: true,
      }),
      expect.objectContaining({
        toolName: 'Bash',
        allowed: false,
        reason: 'blocked-by-zavorth-policy',
        approvalGranted: true,
      }),
    ]);
  });

  it('plugs into AgentRunService as an optional governed LLM runtime', async () => {
    const adapter = new ClaudeAgentSdkRuntimeAdapter({
      enabled: true,
      apiKey: 'test-key',
      cwd: 'C:/TESTES DEV/zavorth-core/Zavorth',
      query: () => sdkMessages({
        type: 'result',
        subtype: 'success',
        result: 'Run respondido pelo Claude Agent SDK.',
        stop_reason: 'end_turn',
        session_id: 'claude-session-2',
      }),
    });
    const service = new AgentRunService({
      now: () => new Date('2026-05-05T05:30:00.000Z'),
      idFactory: (prefix) => `${prefix}-test`,
      llmRuntime: adapter,
    });

    const result = await service.run({
      userId: 'user-1',
      channel: 'cli',
      text: 'Explique a integracao Claude.',
      requestedTools: [],
      metadata: {
        providerName: 'claude-agent-sdk',
        modelName: 'claude-test-model',
      },
    });

    expect(result.ok).toBe(true);
    expect(result.replies[0].text).toContain('Run respondido pelo Claude Agent SDK.');
    expect(result.run.metadata.llmRuntimeRoute).toEqual(expect.objectContaining({
      providerName: 'claude-agent-sdk',
      modelName: 'claude-test-model',
    }));
    expect(result.run.events.some((event) => event.title === 'Model response generated')).toBe(true);
  });

  it('passes approved AgentRun tool exposure into Claude Agent SDK live tool policy', async () => {
    let capturedOptions: Record<string, unknown> | null = null;
    const adapter = new ClaudeAgentSdkRuntimeAdapter({
      enabled: true,
      apiKey: 'test-key',
      cwd: 'C:/TESTES DEV/zavorth-core/Zavorth',
      toolPolicyMode: 'configured',
      allowedTools: ['Write', 'Bash'],
      requireApprovalForConfiguredTools: true,
      query: (params) => {
        capturedOptions = params.options as unknown as Record<string, unknown>;
        return sdkMessages({
          type: 'result',
          subtype: 'success',
          result: 'Run retomado com Write aprovado.',
          stop_reason: 'end_turn',
          session_id: 'claude-session-approved-tools',
        });
      },
    });
    const request: UniversalAgentRequest = {
      userId: 'user-1',
      channel: 'cli',
      text: 'Atualize um arquivo usando Claude.',
      requestedTools: ['Write'],
      metadata: {
        providerName: 'claude-agent-sdk',
        modelName: 'claude-test-model',
      },
    };
    const run: UniversalAgentRun = {
      id: 'agent-run-approved-tools',
      traceId: 'trace-approved-tools',
      requestId: 'request-approved-tools',
      sessionId: 'cli:request-approved-tools',
      userId: 'user-1',
      channel: 'cli',
      title: 'Atualize um arquivo usando Claude.',
      input: request.text,
      status: 'running',
      createdAt: '2026-05-05T05:30:00.000Z',
      updatedAt: '2026-05-05T05:31:00.000Z',
      summary: 'Aprovacao recebida.',
      events: [
        {
          id: 'agent-event-approved-write',
          runId: 'agent-run-approved-tools',
          kind: 'approval',
          title: 'Aprovar Write',
          detail: 'Write pode alterar arquivos e exige aprovacao.',
          status: 'done',
          createdAt: '2026-05-05T05:31:00.000Z',
          metadata: {
            approvalId: 'approval-write',
            toolId: 'Write',
          },
        },
      ],
      toolExposure: {
        mode: 'restricted',
        summary: 'Write e Bash expostos com aprovacao.',
        tools: [
          {
            id: 'Write',
            label: 'Write',
            risk: 'danger',
            requiresApproval: true,
          },
          {
            id: 'Bash',
            label: 'Bash',
            risk: 'danger',
            requiresApproval: true,
          },
        ],
      },
      replyPorts: [],
      modelProfile: {
        providerLabel: 'claude-agent-sdk',
        modelLabel: 'claude-test-model',
        routingPolicy: 'direct',
      },
      approvals: [
        {
          id: 'approval-write',
          runId: 'agent-run-approved-tools',
          title: 'Aprovar Write',
          reason: 'Write pode alterar arquivos e exige aprovacao.',
          risk: 'danger',
          status: 'approved',
          createdAt: '2026-05-05T05:30:00.000Z',
        },
      ],
      artifacts: [],
      memorySignals: [],
      metadata: {},
    };
    const executor = new AgentRunLlmRuntimeExecutor({
      llmRuntime: adapter,
    });

    const result = await executor.executeIfAvailable(run, request);

    expect(result?.replyText).toContain('Run retomado com Write aprovado.');
    expect(capturedOptions).toEqual(expect.objectContaining({
      permissionMode: 'dontAsk',
      tools: ['Write'],
      allowedTools: ['Write'],
    }));
    expect(result?.metadata?.llmRuntimeMetadata).toEqual(expect.objectContaining({
      claudeAgentSdk: expect.objectContaining({
        allowedTools: ['Write'],
        permissionMode: 'dontAsk',
      }),
    }));
  });
});
