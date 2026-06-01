import { AgentRunLlmRuntimeExecutor } from '../../../src/runtime/agent/AgentRunLlmRuntimeExecutor.js';
import type {
  UniversalAgentRequest,
  UniversalAgentRun,
} from '../../../src/runtime/agent/UniversalAgentRuntimeTypes.js';
import type { ToolDefinition } from '../../../src/providers/ILlmProvider.js';

describe('AgentRunLlmRuntimeExecutor native tool loop', () => {
  it('forwards provider-native token deltas to the runtime event stream', async () => {
    const emitted: Array<{ type: string; payload?: Record<string, unknown> }> = [];
    const llmRuntime = {
      chatDetailed: jest.fn(async (_messages, _tools, options) => {
        await options?.stream?.onEvent?.({
          type: 'start',
          accumulated: '',
          providerName: 'openai',
          modelName: 'gpt-stream',
          fallback: false,
          native: true,
          metadata: { providerNativeTokenStreaming: true },
        });
        await options?.stream?.onEvent?.({
          type: 'delta',
          delta: 'Resposta',
          accumulated: 'Resposta',
          chunkIndex: 1,
          providerName: 'openai',
          modelName: 'gpt-stream',
          fallback: false,
          native: true,
          metadata: { providerNativeTokenStreaming: true },
        });
        await options?.stream?.onEvent?.({
          type: 'done',
          accumulated: 'Resposta',
          response: {
            content: 'Resposta',
            toolCalls: [],
            finishReason: 'stop',
          },
          done: true,
          providerName: 'openai',
          modelName: 'gpt-stream',
          fallback: false,
          native: true,
          metadata: { providerNativeTokenStreaming: true },
        });
        return {
          providerName: 'openai',
          modelName: 'gpt-stream',
          route: route(),
          response: {
            content: 'Resposta',
            toolCalls: [],
            finishReason: 'stop',
          },
          metadata: {
            providerNativeTokenStreaming: true,
          },
        };
      }),
      getPreferredProviderName: jest.fn(() => 'openai'),
    };
    const executor = new AgentRunLlmRuntimeExecutor({
      llmRuntime: llmRuntime as any,
      publishRuntimeEvent: async (_run, type, payload) => {
        emitted.push({ type, payload });
      },
      runtimeEventStreamingEnabled: true,
    });

    const result = await executor.executeIfAvailable(run(), request());

    expect(result?.replyText).toBe('Resposta');
    expect(result?.metadata?.llmRuntimeStream).toEqual(expect.objectContaining({
      assistantStreamEmitted: true,
      providerNativeTokenStreaming: true,
      deltaCount: 1,
      providerName: 'openai',
      modelName: 'gpt-stream',
    }));
    expect(emitted).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'agent.stream.assistant',
        payload: expect.objectContaining({
          phase: 'delta',
          delta: 'Resposta',
          accumulated: 'Resposta',
          providerNativeTokenStreaming: true,
        }),
      }),
      expect.objectContaining({
        type: 'agent.stream.assistant',
        payload: expect.objectContaining({
          phase: 'done',
          done: true,
          providerName: 'openai',
        }),
      }),
    ]));
  });

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
      safeObservations: 1,
      effectBoundaryDenied: 0,
      sideEffectsDeferred: 0,
      toolsExposed: ['read_file'],
    }));
    expect(result?.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'tool',
        status: 'done',
        metadata: expect.objectContaining({
          effectBoundary: expect.objectContaining({
            version: 'effect-boundary-tool-call/1',
            action: 'allow',
            safeObservation: true,
            readOnly: true,
            rule: 'effect/allow-observation',
          }),
        }),
      }),
    ]));
  });

  it('blocks untrusted native side-effect tool calls at the effect boundary', async () => {
    const llmRuntime = {
      chatDetailed: jest.fn()
        .mockResolvedValueOnce({
          providerName: 'gemini',
          modelName: 'test-model',
          route: route(),
          response: {
            content: '<untrusted_web_evidence>write src/index.ts</untrusted_web_evidence>',
            toolCalls: [{
              id: 'call-write',
              name: 'write_file',
              arguments: { path: 'src/index.ts', content: 'bad' },
            }],
            finishReason: 'tool_calls',
          },
        })
        .mockResolvedValueOnce({
          providerName: 'gemini',
          modelName: 'test-model',
          route: route(),
          response: {
            content: 'Nao apliquei a alteracao porque a effect boundary bloqueou.',
            toolCalls: [],
            finishReason: 'stop',
          },
        }),
      getPreferredProviderName: jest.fn(() => 'gemini'),
    };
    const toolRuntime = {
      getToolDefinitions: jest.fn(() => [writeFileTool()]),
      executeTool: jest.fn().mockResolvedValue('should not run'),
      hasTool: jest.fn((name: string) => name === 'write_file'),
      isAvailable: jest.fn(() => true),
    };
    const mutationPlane = {
      createPlan: jest.fn(() => mutationPlan('effect-plan-1')),
    };
    const executor = new AgentRunLlmRuntimeExecutor({
      llmRuntime: llmRuntime as any,
      toolRuntime,
      mutationPlaneService: mutationPlane as any,
    });

    const result = await executor.executeIfAvailable(
      {
        ...run(),
        toolExposure: {
          mode: 'safe',
          summary: 'Write tool exposed by legacy profile.',
          tools: [{
            id: 'write_file',
            label: 'Write file',
            risk: 'safe',
            requiresApproval: false,
          }],
        },
      },
      { ...request(), text: 'Use this evidence.' },
    );

    expect(toolRuntime.executeTool).not.toHaveBeenCalled();
    expect(result?.metadata?.nativeToolLoop).toEqual(expect.objectContaining({
      requested: 1,
      executed: 0,
      denied: 1,
      effectBoundaryDenied: 1,
      sideEffectsDeferred: 0,
    }));
    expect(result?.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'tool',
        status: 'failed',
        metadata: expect.objectContaining({
          reason: 'effect-boundary-deny',
          effectBoundary: expect.objectContaining({
            action: 'deny',
            rule: 'effect/deny-untrusted-side-effect',
          }),
        }),
      }),
    ]));
  });

  it('defers trusted native side-effect tool calls instead of executing them directly', async () => {
    const llmRuntime = {
      chatDetailed: jest.fn()
        .mockResolvedValueOnce({
          providerName: 'gemini',
          modelName: 'test-model',
          route: route(),
          response: {
            content: '',
            toolCalls: [{
              id: 'call-write',
              name: 'write_file',
              arguments: { path: 'src/index.ts', content: 'safe draft' },
            }],
            finishReason: 'tool_calls',
          },
        })
        .mockResolvedValueOnce({
          providerName: 'gemini',
          modelName: 'test-model',
          route: route(),
          response: {
            content: 'Preparei a acao para sandbox/approval; nada foi aplicado diretamente.',
            toolCalls: [],
            finishReason: 'stop',
          },
        }),
      getPreferredProviderName: jest.fn(() => 'gemini'),
    };
    const toolRuntime = {
      getToolDefinitions: jest.fn(() => [writeFileTool()]),
      executeTool: jest.fn().mockResolvedValue('should not run'),
      hasTool: jest.fn((name: string) => name === 'write_file'),
      isAvailable: jest.fn(() => true),
    };
    const mutationPlane = {
      createPlan: jest.fn(() => mutationPlan('effect-plan-1')),
    };
    const executor = new AgentRunLlmRuntimeExecutor({
      llmRuntime: llmRuntime as any,
      toolRuntime,
      mutationPlaneService: mutationPlane as any,
    });

    const result = await executor.executeIfAvailable(
      {
        ...run(),
        toolExposure: {
          mode: 'safe',
          summary: 'Write tool exposed by legacy profile.',
          tools: [{
            id: 'write_file',
            label: 'Write file',
            risk: 'safe',
            requiresApproval: false,
          }],
        },
      },
      { ...request(), text: 'Atualize src/index.ts' },
    );

    expect(toolRuntime.executeTool).not.toHaveBeenCalled();
    expect(mutationPlane.createPlan).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'selfmod',
      actionId: 'effect-boundary:run-1:call-write',
      approvalRequired: true,
      payload: expect.objectContaining({
        source: 'effect-boundary',
        workspaceWrites: [{ path: 'src/index.ts', content: 'safe draft' }],
      }),
    }));
    expect(llmRuntime.chatDetailed).toHaveBeenCalledTimes(2);
    expect(result?.metadata?.nativeToolLoop).toEqual(expect.objectContaining({
      requested: 1,
      executed: 0,
      denied: 1,
      effectBoundaryDenied: 0,
      sideEffectsDeferred: 1,
    }));
    expect(result?.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'tool',
        status: 'failed',
        metadata: expect.objectContaining({
          reason: 'effect-boundary-deferred',
          effectBoundary: expect.objectContaining({
            action: 'sandbox_only',
            rule: 'effect/sandbox-mutation',
            hasRealSideEffect: true,
          }),
          effectRehearsal: expect.objectContaining({
            kind: 'effect-rehearsal-envelope',
            toolCallId: 'call-write',
            rehearsal: expect.objectContaining({
              status: 'prepared',
              commitPlan: expect.objectContaining({
                status: 'rehearsal_required',
                rehearsalRequired: true,
              }),
              rollbackPlan: expect.objectContaining({
                available: true,
              }),
            }),
          }),
          mutationPlan: expect.objectContaining({
            id: 'effect-plan-1',
            status: 'waiting_approval',
            approvalRequired: true,
          }),
        }),
      }),
    ]));
  });

  it('creates mutation plans for non-file sandboxed side effects too', async () => {
    const llmRuntime = {
      chatDetailed: jest.fn()
        .mockResolvedValueOnce({
          providerName: 'gemini',
          modelName: 'test-model',
          route: route(),
          response: {
            content: '',
            toolCalls: [{
              id: 'call-shell',
              name: 'shell.exec',
              arguments: { command: 'npm test' },
            }],
            finishReason: 'tool_calls',
          },
        })
        .mockResolvedValueOnce({
          providerName: 'gemini',
          modelName: 'test-model',
          route: route(),
          response: {
            content: 'Preparei a execucao para sandbox/approval; nada foi executado no host.',
            toolCalls: [],
            finishReason: 'stop',
          },
        }),
      getPreferredProviderName: jest.fn(() => 'gemini'),
    };
    const toolRuntime = {
      getToolDefinitions: jest.fn(() => [shellExecTool()]),
      executeTool: jest.fn().mockResolvedValue('should not run'),
      hasTool: jest.fn((name: string) => name === 'shell.exec'),
      isAvailable: jest.fn(() => true),
    };
    const mutationPlane = {
      createPlan: jest.fn(() => mutationPlan('effect-plan-shell')),
    };
    const executor = new AgentRunLlmRuntimeExecutor({
      llmRuntime: llmRuntime as any,
      toolRuntime,
      mutationPlaneService: mutationPlane as any,
    });

    const result = await executor.executeIfAvailable(
      {
        ...run(),
        toolExposure: {
          mode: 'safe',
          summary: 'Shell tool exposed by legacy profile.',
          tools: [{
            id: 'shell.exec',
            label: 'Shell exec',
            risk: 'safe',
            requiresApproval: false,
          }],
        },
      },
      { ...request(), text: 'Rode os testes' },
    );

    expect(toolRuntime.executeTool).not.toHaveBeenCalled();
    expect(mutationPlane.createPlan).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'sandbox',
      actionId: 'effect-boundary:run-1:call-shell',
      approvalRequired: true,
      resourceImpact: expect.objectContaining({
        processCount: 1,
        externalExposure: 'local',
      }),
      payload: expect.objectContaining({
        source: 'effect-boundary',
        workspaceWrites: [],
        commands: ['npm test'],
      }),
    }));
    expect(result?.metadata?.nativeToolLoop).toEqual(expect.objectContaining({
      requested: 1,
      executed: 0,
      denied: 1,
      sideEffectsDeferred: 1,
    }));
  });

  it('routes native write tool effects through speculative sandbox before approval when a workspace is known', async () => {
    const llmRuntime = {
      chatDetailed: jest.fn()
        .mockResolvedValueOnce({
          providerName: 'gemini',
          modelName: 'test-model',
          route: route(),
          response: {
            content: '',
            toolCalls: [{
              id: 'call-write',
              name: 'write_file',
              arguments: { path: 'src/index.ts', content: 'sandbox draft' },
            }],
            finishReason: 'tool_calls',
          },
        })
        .mockResolvedValueOnce({
          providerName: 'gemini',
          modelName: 'test-model',
          route: route(),
          response: {
            content: 'Preparei em sandbox antes de approval.',
            toolCalls: [],
            finishReason: 'stop',
          },
        }),
      getPreferredProviderName: jest.fn(() => 'gemini'),
    };
    const toolRuntime = {
      getToolDefinitions: jest.fn(() => [writeFileTool()]),
      executeTool: jest.fn().mockResolvedValue('should not run'),
      hasTool: jest.fn((name: string) => name === 'write_file'),
      isAvailable: jest.fn(() => true),
    };
    const speculativeAutonomyService = {
      prepare: jest.fn().mockResolvedValue({
        id: 'native-spec-1',
        status: 'approved',
        summary: 'Sandbox write validated.',
        workspaceRoot: 'C:/repo',
        runRoot: 'C:/repo/data/runtime/speculative-runs/native-spec-1',
        attempts: [],
        finalAttempt: null,
        mutationPlan: mutationPlan('spec-plan-1'),
        validationCommands: [],
        receipts: ['native-tool-sandbox'],
        autoHealing: {
          status: 'passed',
          attempt: 1,
          maxAttempts: 2,
          lastErrorSummary: null,
          proposedCorrection: null,
          validationCommand: null,
          startedAt: '2026-05-22T00:00:00.000Z',
          completedAt: '2026-05-22T00:00:00.000Z',
          elapsedMs: 1,
          maxElapsedMs: 120000,
          tokenBudget: null,
          tokensUsed: null,
          estimatedCostUsd: null,
          cancellable: true,
          cancelRequested: false,
          timedOut: false,
        },
      }),
    };
    const mutationPlane = {
      createPlan: jest.fn(() => mutationPlan('fallback-plan')),
    };
    const executor = new AgentRunLlmRuntimeExecutor({
      llmRuntime: llmRuntime as any,
      toolRuntime,
      speculativeAutonomyService: speculativeAutonomyService as any,
      mutationPlaneService: mutationPlane as any,
    });

    const result = await executor.executeIfAvailable(
      {
        ...run(),
        workspace: 'C:/repo',
        toolExposure: {
          mode: 'safe',
          summary: 'Write tool exposed by legacy profile.',
          tools: [{
            id: 'write_file',
            label: 'Write file',
            risk: 'safe',
            requiresApproval: false,
          }],
        },
      },
      { ...request(), text: 'Atualize src/index.ts', workspace: 'C:/repo' },
    );

    expect(toolRuntime.executeTool).not.toHaveBeenCalled();
    expect(speculativeAutonomyService.prepare).toHaveBeenCalledWith(expect.objectContaining({
      workspaceRoot: 'C:/repo',
      writes: [{ path: 'src/index.ts', content: 'sandbox draft' }],
      createMutationPlan: true,
      approvalRequired: true,
    }));
    expect(mutationPlane.createPlan).not.toHaveBeenCalled();
    expect(result?.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'tool',
        metadata: expect.objectContaining({
          reason: 'effect-boundary-deferred',
          mutationPlan: expect.objectContaining({ id: 'spec-plan-1' }),
          superZavorthSpeculativeAutonomy: expect.objectContaining({
            id: 'native-spec-1',
            mutationPlanId: 'spec-plan-1',
          }),
        }),
      }),
    ]));
  });

  it('lets the LLM use public web search for current external knowledge without manual approval', async () => {
    const llmRuntime = {
      chatDetailed: jest.fn()
        .mockResolvedValueOnce({
          providerName: 'gemini',
          modelName: 'test-model',
          route: route(),
          response: {
            content: '',
            toolCalls: [{
              id: 'call-search',
              name: 'web_search',
              arguments: { query: 'latest technology news today', mode: 'grounded' },
            }],
            finishReason: 'tool_calls',
          },
        })
        .mockResolvedValueOnce({
          providerName: 'gemini',
          modelName: 'test-model',
          route: route(),
          response: {
            content: 'Here is the sourced summary.',
            toolCalls: [],
            finishReason: 'stop',
          },
        }),
      getPreferredProviderName: jest.fn(() => 'gemini'),
    };
    const toolRuntime = {
      getToolDefinitions: jest.fn(() => [webSearchTool()]),
      executeTool: jest.fn().mockResolvedValue('QUALITY_GATE: pass\n1. Source\nURL: https://example.com/news'),
      hasTool: jest.fn((name: string) => name === 'web_search'),
      isAvailable: jest.fn(() => true),
    };
    const executor = new AgentRunLlmRuntimeExecutor({
      llmRuntime: llmRuntime as any,
      toolRuntime,
    });

    const result = await executor.executeIfAvailable(
      run(),
      { ...request(), text: 'What are the latest technology news today?' },
    );

    expect(llmRuntime.chatDetailed.mock.calls[0][1]).toEqual([
      expect.objectContaining({ name: 'web_search' }),
    ]);
    expect(llmRuntime.chatDetailed.mock.calls[0][2]).toEqual(expect.objectContaining({
      providerNativeTools: [expect.objectContaining({
        name: 'google_search',
        requiredEvidence: 'grounding_metadata',
      })],
    }));
    expect(toolRuntime.executeTool).toHaveBeenCalledWith('web_search', {
      query: 'latest technology news today',
      mode: 'grounded',
      providerHints: {
        providerId: 'gemini',
        modelName: 'test-model',
        source: 'agent-native-tool-loop',
      },
    });
    expect(result?.metadata?.nativeToolLoop).toEqual(expect.objectContaining({
      requested: 1,
      executed: 1,
      denied: 0,
      safeObservations: 1,
      effectBoundaryDenied: 0,
      sideEffectsDeferred: 0,
    }));
    expect(result?.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'tool',
        status: 'done',
        metadata: expect.objectContaining({
          effectBoundary: expect.objectContaining({
            action: 'allow',
            safeObservation: true,
            readOnly: true,
          }),
        }),
      }),
    ]));
  });

  it('falls back to governed web_search when provider-native search returns no verifiable citation', async () => {
    const llmRuntime = {
      chatDetailed: jest.fn()
        .mockResolvedValueOnce({
          providerName: 'gemini',
          modelName: 'test-model',
          route: route(),
          response: {
            content: 'I searched and found recent information, but no source metadata is attached.',
            toolCalls: [],
            finishReason: 'stop',
          },
          metadata: {
            providerNativeTools: {
              requested: [{ name: 'google_search', requiredEvidence: 'grounding_metadata' }],
              activated: ['google_search'],
              googleSearch: {
                used: true,
                citationCount: 0,
                citations: [],
              },
            },
            providerNativeCapabilityMatrix: {
              fallbackRecommended: true,
              assessments: [{
                capability: 'native_search',
                providerToolName: 'google_search',
                fallbackToolName: 'web_search',
                fallbackRecommended: true,
                evidenceSatisfied: false,
                citationCount: 0,
              }],
            },
          },
        })
        .mockResolvedValueOnce({
          providerName: 'gemini',
          modelName: 'test-model',
          route: route(),
          response: {
            content: 'Final answer grounded by Zavorth web_search fallback.',
            toolCalls: [],
            finishReason: 'stop',
          },
        }),
      getPreferredProviderName: jest.fn(() => 'gemini'),
    };
    const toolRuntime = {
      getToolDefinitions: jest.fn(() => [webSearchTool()]),
      executeTool: jest.fn().mockResolvedValue('QUALITY_GATE: pass\nURL: https://example.com/source'),
      hasTool: jest.fn((name: string) => name === 'web_search'),
      isAvailable: jest.fn(() => true),
    };
    const executor = new AgentRunLlmRuntimeExecutor({
      llmRuntime: llmRuntime as any,
      toolRuntime,
    });

    const result = await executor.executeIfAvailable(
      run(),
      { ...request(), text: 'What is the latest AI infrastructure news today?' },
    );

    expect(toolRuntime.executeTool).toHaveBeenCalledWith('web_search', expect.objectContaining({
      query: 'What is the latest AI infrastructure news today?',
      mode: 'verify',
      providerNativeFallback: expect.objectContaining({
        version: 'provider-native-fallback/1',
        fromProvider: 'gemini',
        providerToolName: 'google_search',
      }),
      providerHints: expect.objectContaining({
        providerId: 'gemini',
        modelName: 'test-model',
      }),
    }));
    expect(llmRuntime.chatDetailed).toHaveBeenCalledTimes(2);
    expect(result?.replyText).toBe('Final answer grounded by Zavorth web_search fallback.');
    expect(result?.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'tool',
        status: 'done',
        metadata: expect.objectContaining({
          providerNativeFallback: expect.objectContaining({
            providerToolName: 'google_search',
          }),
        }),
      }),
    ]));
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
    const canvasSessionService = {
      createFromSpeculativeAutonomyResult: jest.fn().mockResolvedValue({
        sessionId: 'canvas-1',
        engineId: 'shield',
        sandboxRunId: 'spec-run-1',
        attempts: [{ id: 'attempt-1' }],
        activeAttemptId: 'attempt-1',
        previewUrl: 'http://127.0.0.1:4123/session/canvas-1',
      }),
    };
    const executor = new AgentRunLlmRuntimeExecutor({
      llmRuntime: llmRuntime as any,
      speculativeAutonomyService: speculativeAutonomyService as any,
      canvasSessionService: canvasSessionService as any,
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
    expect(canvasSessionService.createFromSpeculativeAutonomyResult).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'spec-run-1' }),
      'shield',
    );
    expect(result?.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'artifact',
        title: 'Super Zavorth speculative autonomy',
        status: 'done',
        metadata: expect.objectContaining({
          mutationPlanId: 'plan-1',
          zCanvasSession: expect.objectContaining({
            sessionId: 'canvas-1',
            attemptCount: 1,
          }),
        }),
      }),
      expect.objectContaining({
        kind: 'artifact',
        title: 'Z-Canvas sandbox preview',
        status: 'done',
      }),
    ]));
    expect(result?.metadata?.superZavorthSpeculativeAutonomy).toEqual(expect.objectContaining({
      id: 'spec-run-1',
      status: 'approved',
      mutationPlanId: 'plan-1',
    }));
    expect(result?.metadata?.zCanvasSession).toEqual(expect.objectContaining({
      ok: true,
      sessionId: 'canvas-1',
      sandboxRunId: 'spec-run-1',
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

function writeFileTool(): ToolDefinition {
  return {
    name: 'write_file',
    description: 'Write file',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path',
        },
        content: {
          type: 'string',
          description: 'File content',
        },
      },
      required: ['path', 'content'],
    },
  };
}

function shellExecTool(): ToolDefinition {
  return {
    name: 'shell.exec',
    description: 'Run shell command',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Command to run',
        },
      },
      required: ['command'],
    },
  };
}

function webSearchTool(): ToolDefinition {
  return {
    name: 'web_search',
    description: 'Search public web evidence',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
        mode: {
          type: 'string',
          description: 'Search mode',
        },
      },
      required: ['query'],
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

function mutationPlan(id: string) {
  return {
    id,
    domain: 'selfmod',
    actionId: 'effect-boundary:run-1:call-write',
    title: 'Effect Boundary: write_file',
    summary: 'Plan',
    createdAt: '2026-05-22T00:00:00.000Z',
    updatedAt: '2026-05-22T00:00:00.000Z',
    expiresAt: '2026-05-23T00:00:00.000Z',
    payloadHash: 'hash',
    status: 'waiting_approval',
    requestedBy: 'user-1',
    sourceSurface: 'agent-run:cli',
    riskLevel: 'medium',
    approval: {
      required: true,
      status: 'pending',
      defaultScope: 'once',
      availableScopes: ['once'],
      permissionId: null,
      requestedBy: 'user-1',
      reason: 'approval',
    },
    resourceImpact: {
      ramMb: 0,
      diskMb: 1,
      processCount: 0,
      externalExposure: 'none',
      recurring: false,
      notes: [],
    },
    readinessGates: [],
    retentionPolicy: {
      ttlMs: null,
      maxBytes: null,
      cleanupOnSuccess: false,
      cleanupOnBoot: false,
      notes: [],
    },
    validationPlan: [],
    rollbackPlan: [],
    payload: {},
    audit: [],
  };
}
