import {
  AgentRunService,
  ColdContextResolver,
  McpSnapshotAssembler,
  RunBudgetPolicy,
  SkillSnapshotAssembler,
} from '../../../src/runtime/agent/index.js';
import type {
  UniversalAgentExecutor,
  UniversalAgentLlmRuntime,
  UniversalAgentToolRuntime,
} from '../../../src/runtime/agent/index.js';
import { ZavorthNativeAutonomySpineService } from '../../../src/services/ZavorthNativeAutonomySpineService.js';

import type { SkillManifest } from '../../../src/context-engine/SkillScanner.js';
import type { McpRuntimeSnapshot } from '../../../src/mcp/McpRuntimeService.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => {
    index += 1;
    return `${prefix}-${index}`;
  };
}

function createModelPickerContract(overrides: Record<string, any> = {}) {
  const generatedAt = '2026-05-02T12:00:00.000Z';
  return {
    schemaVersion: 1,
    generatedAt,
    families: { schemaVersion: 1, generatedAt, families: [] },
    routes: { schemaVersion: 1, generatedAt, routes: [] },
    profiles: [],
    selected: {
      schemaVersion: 1,
      source: 'current-config',
      providerName: 'gemini',
      providerLabel: 'Gemini',
      modelName: 'gemini-2.5-flash',
      modelLabel: 'gemini-2.5-flash',
      routeId: 'gemini',
      familyId: 'gemini',
      readiness: 'ready',
      ready: true,
      fallbackOrder: ['gemini', 'openai'],
      limitations: [],
      explanation: ['Configuracao atual seleciona gemini/gemini-2.5-flash.'],
      ...overrides,
    },
  };
}

function createSkillManifest(overrides: Partial<SkillManifest> = {}): SkillManifest {
  return {
    id: 'workspace-reporter',
    directory: 'C:/repo/Zavorth/skill-library/workspace-reporter',
    toolsMarkdown: '# Workspace reporter\nReports workspace state.',
    toolDefinitions: [
      {
        name: 'workspace_report',
      },
    ],
    entryPoint: 'C:/repo/Zavorth/skill-library/workspace-reporter/index.ts',
    metadata: {
      category: 'workspace',
    },
    ...overrides,
  };
}

function createMcpRuntimeSnapshot(overrides: Partial<McpRuntimeSnapshot> = {}): McpRuntimeSnapshot {
  return {
    generatedAt: '2026-04-27T12:00:00.000Z',
    manifestPath: 'C:/repo/Zavorth/config/mcp-servers.json',
    summary: {
      total: 2,
      enabled: 2,
      connected: 1,
      failed: 1,
      disabled: 0,
      stopped: 0,
      toolCount: 2,
    },
    capabilities: ['core', 'experimental'],
    entries: [
      {
        id: 'zavorth-core',
        capability: 'core',
        enabled: true,
        status: 'connected',
        toolCount: 1,
        toolNames: ['runtime_status'],
        command: 'node',
        args: ['core.js'],
        lastAttemptedAt: null,
        lastConnectedAt: '2026-04-27T12:00:00.000Z',
        lastError: null,
      },
      {
        id: 'imported-draft',
        capability: 'experimental',
        enabled: true,
        status: 'failed',
        toolCount: 1,
        toolNames: ['unsafe_remote_tool'],
        command: 'node',
        args: ['draft.js'],
        lastAttemptedAt: '2026-04-27T11:59:00.000Z',
        lastConnectedAt: null,
        lastError: 'review required',
      },
    ],
    ...overrides,
  };
}

describe('AgentRunService', () => {
  it('runs a simple text request through the configured executor', async () => {
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(({ run }) => ({
      status: 'completed',
      summary: `Run ${run.id} processed.`,
      replyText: 'Simple response ready.',
    }));
    const service = new AgentRunService({
      now: () => new Date('2026-04-27T12:00:00.000Z'),
      idFactory: createIdFactory(),
      executor,
      defaultProviderLabel: 'OpenAI',
      defaultModelLabel: 'gpt-4o',
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-simple',
      text: 'responda oi',
      requestedTools: [],
      metadata: {
        capabilityNegotiationApproved: true,
      },
    });

    expect(executor).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(result.run).toEqual(expect.objectContaining({
      status: 'completed',
      sessionId: 'session-simple',
      summary: 'Run agent-run-2 processed.',
      modelProfile: expect.objectContaining({
        providerLabel: 'OpenAI',
        modelLabel: 'gpt-4o',
      }),
    }));
    expect(result.run.metadata.runBudget).toEqual(expect.objectContaining({
      source: 'RunBudgetPolicy',
      degraded: false,
      toolExposureGatedByRunBudget: false,
    }));
    expect(result.run.metadata.policyKernel).toEqual(expect.objectContaining({
      source: 'AgentRunPolicyKernel',
      stage: 6,
      lastStage: 'pre-execution',
      receipts: expect.arrayContaining([
        expect.objectContaining({
          stage: 'trust',
          decision: 'allowed',
        }),
        expect.objectContaining({
          stage: 'budget',
          decision: 'allowed',
        }),
        expect.objectContaining({
          stage: 'pre-execution',
          decision: 'allowed',
        }),
      ]),
    }));
    expect(result.run.metadata.executorBoundary).toEqual(expect.objectContaining({
      source: 'AgentRunExecutorBoundary',
      stage: 8,
      selected: 'custom-executor',
    }));
    expect(result.run.metadata.naturalFirstRoute).toEqual(expect.objectContaining({
      source: 'NaturalFirstRunClassifier',
      contractVersion: 'natural-first-classifier/3',
      mode: 'natural-first-agent-runtime',
      shouldEnterGateway: true,
      route: 'llm-reply',
      intent: expect.objectContaining({
        primary: 'free-text-question',
      }),
      cost: expect.objectContaining({
        tier: expect.any(String),
      }),
      context: expect.objectContaining({
        channel: 'web',
        user: expect.objectContaining({
          present: true,
          id: 'grey',
        }),
        session: expect.objectContaining({
          present: true,
          id: 'session-simple',
        }),
      }),
    }));
    expect(result.run.metadata.naturalFirstEntrypoint).toEqual(expect.objectContaining({
      version: 'natural-first-agent-runtime/1',
      inputKind: 'free-text',
      entrypoint: 'zavorth-agent-gateway',
      gatewayRequired: true,
    }));
    expect(result.run.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'planning',
        title: 'Natural-first contract applied',
        metadata: expect.objectContaining({
          entrypoint: 'zavorth-agent-gateway',
        }),
      }),
      expect.objectContaining({
        kind: 'planning',
        title: 'Natural-first routing',
        metadata: expect.objectContaining({
          route: 'llm-reply',
        }),
      }),
    ]));
    expect(result.run.metadata.corePipeline).toEqual(expect.objectContaining({
      source: 'AgentRunCorePipeline',
      stage: 12,
      lastStage: 'finalized',
      receipts: expect.arrayContaining([
        expect.objectContaining({ stage: 'created' }),
        expect.objectContaining({ stage: 'prepared' }),
        expect.objectContaining({ stage: 'finalized' }),
      ]),
    }));
    expect(result.run.metadata.coreDietBaseline).toEqual(expect.objectContaining({
      source: 'AgentRunService',
      stage: 0,
      profile: 'default',
      metadataBytes: expect.any(Number),
      metadataKeyCount: expect.any(Number),
      snapshotBuilds: expect.any(Number),
      attachedSnapshots: expect.any(Number),
      skippedSnapshots: expect.any(Number),
      cacheHits: expect.any(Number),
      overBudget: expect.any(Array),
      stages: expect.arrayContaining([
        expect.objectContaining({ name: 'core-pipeline-create-run' }),
        expect.objectContaining({ name: 'core-pipeline-policy-trust' }),
        expect.objectContaining({ name: 'core-pipeline-policy-budget' }),
        expect.objectContaining({ name: 'policy-kernel-pre-execution' }),
        expect.objectContaining({ name: 'core-pipeline-frontloaded-evidence' }),
      ]),
      snapshotEvents: expect.arrayContaining([
        expect.objectContaining({ key: 'providerMeshConsolidation' }),
      ]),
    }));
    expect(result.run.metadata.coreDietObservability).toEqual(expect.objectContaining({
      source: 'AgentRunService',
      stage: 10,
      profile: 'default',
      status: expect.stringMatching(/within-budget|over-budget/),
      violations: expect.any(Array),
      budgets: expect.objectContaining({
        metadataBytes: expect.any(Number),
        stageCount: expect.any(Number),
        maxStageMs: expect.any(Number),
        scheduledWorkerJobs: expect.any(Number),
      }),
      metrics: expect.objectContaining({
        metadataBytes: expect.any(Number),
        snapshotBuilds: expect.any(Number),
        stageCount: expect.any(Number),
        maxStageMs: expect.any(Number),
        scheduledWorkerJobs: expect.any(Number),
      }),
    }));
    expect(result.run.metadata.evidenceRefs).toEqual(expect.objectContaining({
      source: 'AgentRunEvidenceStore',
      stage: 4,
      refs: expect.arrayContaining([
        expect.objectContaining({
          key: 'providerMeshConsolidation',
          runId: result.run.id,
          material: expect.any(Boolean),
        }),
      ]),
    }));
    expect(result.run.metadata.metadataDiet).toEqual(expect.objectContaining({
      source: 'AgentRunService',
      stage: 5,
      operationalKeys: expect.arrayContaining(['runBudget', 'providerArena', 'evidenceRefs', 'coreDietObservability']),
      auditKeys: expect.arrayContaining(['providerMeshConsolidation']),
      debugKeys: expect.arrayContaining(['coreDietBaseline']),
      lazyRefCount: expect.any(Number),
      nonMaterialRefCount: expect.any(Number),
    }));
    const providerMeshSnapshot = service.readEvidenceSnapshot(result.run, 'providerMeshConsolidation');
    expect(providerMeshSnapshot).toEqual(expect.objectContaining({
      source: 'ProviderMeshConsolidationService',
    }));
    const providerMeshRef = (result.run.metadata.evidenceRefs as any).refs.find(
      (ref: any) => ref.key === 'providerMeshConsolidation',
    );
    expect(service.readEvidenceSnapshot(result.run, providerMeshRef.id)).toEqual(providerMeshSnapshot);
    expect(result.run.metadata.lifecycleDefense).toEqual(expect.objectContaining({
      preExecutor: expect.objectContaining({
        source: 'AgentRunRiskHooks',
        stage: 'pre-executor',
        blocked: false,
        risk: 'safe',
      }),
      postExecutor: expect.objectContaining({
        source: 'AgentRunRiskHooks',
        stage: 'post-executor',
        blocked: false,
        risk: 'safe',
      }),
    }));
    expect(result.run.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: 'Defense hook pre-executor',
        status: 'done',
      }),
      expect.objectContaining({
        title: 'Defense hook post-executor',
        status: 'done',
      }),
    ]));
    expect(result.replies[0]).toEqual(expect.objectContaining({
      text: 'Simple response ready.',
    }));
  });

  it('routes light chat through the governed runtime instead of a canned lightweight reply', async () => {
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
      status: 'completed',
      summary: 'Executor received light chat.',
      replyText: 'executor-called',
    }));
    const service = new AgentRunService({
      now: () => new Date('2026-05-11T12:00:00.000Z'),
      idFactory: createIdFactory(),
      executor,
      defaultProviderLabel: 'OpenAI',
      defaultModelLabel: 'gpt-4o',
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-light-chat',
      text: 'oi',
      requestedTools: [],
    });

    expect(executor).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(result.run.status).toBe('completed');
    expect(result.run.summary).toBe('Executor received light chat.');
    expect(result.replies[0]).toEqual(expect.objectContaining({
      text: 'executor-called',
    }));
    expect(result.run.metadata.naturalFirstLightReply).toBeUndefined();
    expect(result.run.metadata.executorBoundary).toEqual(expect.any(Object));
    expect(result.run.events).toEqual(expect.not.arrayContaining([
      expect.objectContaining({
      title: 'Governed lightweight reply',
      }),
    ]));
  });

  it('publishes runtime lifecycle events without changing executor behavior', async () => {
    const emitted: Array<{ type: string; payload?: Record<string, unknown> }> = [];
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(({ run }) => ({
      status: 'completed',
      summary: `Run ${run.id} processed.`,
      replyText: 'Response with events ready.',
    }));
    const service = new AgentRunService({
      now: () => new Date('2026-04-27T12:00:00.000Z'),
      idFactory: createIdFactory(),
      executor,
      runtimeEventBus: {
        emit: async (type, payload) => {
          emitted.push({ type, payload });
        },
        snapshot: () => ({
          emittedEvents: emitted.length,
        }),
      },
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-events',
      text: 'responda oi',
      requestedTools: [],
      metadata: {
        capabilityNegotiationApproved: true,
      },
    });

    expect(executor).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(emitted.map((event) => event.type)).toEqual([
      'agent.run.created',
      'agent.policy.evaluated',
      'agent.execution.started',
      'agent.stream.lifecycle',
      'agent.stream.assistant',
      'agent.stream.assistant',
      'agent.stream.assistant',
      'agent.stream.lifecycle',
      'agent.skill.evolution.candidate',
      'agent.adapter.proof.required',
      'agent.execution.completed',
      'agent.run.completed',
    ]);
    expect(emitted[0].payload).toEqual(expect.objectContaining({
      runId: result.run.id,
      sessionId: 'session-events',
      channel: 'web',
    }));
    expect(emitted).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'agent.stream.assistant',
        payload: expect.objectContaining({
          phase: 'delta',
          accumulated: 'Response with events ready.',
          done: false,
          rawChainOfThoughtExposed: false,
        }),
      }),
      expect.objectContaining({
        type: 'agent.stream.assistant',
        payload: expect.objectContaining({
          phase: 'done',
          done: true,
          accumulated: 'Response with events ready.',
        }),
      }),
    ]));
    expect(result.run.metadata.runtimeEventBus).toEqual(expect.objectContaining({
      source: 'AgentRunService',
      stage: 2,
      configured: true,
      events: expect.arrayContaining([
        expect.objectContaining({
          type: 'agent.run.completed',
          delivery: 'delivered',
        }),
      ]),
    }));
  });

  it('can attach the native autonomy spine after a successful turn without leaking raw secrets', async () => {
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(({ run }) => ({
      status: 'completed',
      summary: `Run ${run.id} completed.`,
      replyText: 'I will use 3 bullets for short summaries.',
    }));
    const service = new AgentRunService({
      now: () => new Date('2026-06-05T12:00:00.000Z'),
      idFactory: createIdFactory(),
      executor,
      nativeAutonomySpine: new ZavorthNativeAutonomySpineService({
        now: () => new Date('2026-06-05T12:00:00.000Z'),
      }),
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-native-spine',
      text: 'Sempre use 3 bullets nos resumos. token=secret-token sk-test-123',
      requestedTools: [],
      metadata: {
        capabilityNegotiationApproved: true,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.run.metadata.nativeAutonomySpine).toEqual(expect.objectContaining({
      version: 'native-autonomy-spine/v1',
      status: 'ready',
      summary: expect.objectContaining({
        organicLearningReady: true,
        skillForgeReady: true,
      }),
    }));
    expect(JSON.stringify(result.run.metadata.nativeAutonomySpine)).not.toContain('secret-token');
    expect(JSON.stringify(result.run.metadata.nativeAutonomySpine)).not.toContain('sk-test-123');
  });

  it('fans runtime lifecycle events out to subscribed buses', async () => {
    const primary: Array<{ type: string; payload?: Record<string, unknown> }> = [];
    const subscriber: Array<{ type: string; payload?: Record<string, unknown> }> = [];
    const service = new AgentRunService({
      now: () => new Date('2026-04-27T12:00:00.000Z'),
      idFactory: createIdFactory(),
      executor: jest.fn(({ run }) => ({
        status: 'completed',
        summary: `Run ${run.id} processed.`,
        replyText: 'Response sent to multiple surfaces.',
      })),
      runtimeEventBus: {
        emit: async (type, payload) => {
          primary.push({ type, payload });
        },
      },
    });
    service.addRuntimeEventBus({
      emit: async (type, payload) => {
        subscriber.push({ type, payload });
      },
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'telegram',
      sessionId: 'telegram-session',
      text: 'acompanhe o progresso',
      requestedTools: [],
      metadata: {
        capabilityNegotiationApproved: true,
        chatId: '4242',
      },
    });

    expect(primary.map((event) => event.type)).toEqual(subscriber.map((event) => event.type));
    expect(subscriber[0].payload).toEqual(expect.objectContaining({
      runId: result.run.id,
      channel: 'telegram',
      sessionId: 'telegram-session',
      surfaceChatId: '4242',
    }));
    expect(result.run.metadata.runtimeEventBus).toEqual(expect.objectContaining({
      configured: true,
      subscriberCount: 2,
    }));
  });

  it('uses the provider runtime when no explicit executor is configured', async () => {
    const llmRuntime: UniversalAgentLlmRuntime = {
      chatDetailed: jest.fn(async () => ({
        providerName: 'openai',
        modelName: 'gpt-4o',
        response: {
          content: 'Resposta natural via provider runtime.',
          toolCalls: [],
          finishReason: 'stop',
        },
        route: {
          source: 'LlmRuntimeService',
          requestedProviderName: 'openai',
          primaryProviderName: 'openai',
          providerName: 'openai',
          modelName: 'gpt-4o',
          fallbackAllowed: true,
          fallbackUsed: false,
          providerChain: ['openai'],
          attempts: [
            {
              providerName: 'openai',
              modelName: 'gpt-4o',
              status: 'succeeded',
              fallback: false,
            },
          ],
          request: {
            messageCount: 2,
            toolCount: 0,
            inputChars: 128,
          },
        },
      })),
    };
    const service = new AgentRunService({
      now: () => new Date('2026-05-02T12:00:00.000Z'),
      idFactory: createIdFactory(),
      llmRuntime,
      defaultProviderLabel: 'OpenAI',
      defaultModelLabel: 'gpt-4o',
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-provider-runtime',
      text: 'responda oi pelo runtime real',
      requestedTools: [],
      metadata: {
        capabilityNegotiationApproved: true,
      },
    });

    expect(llmRuntime.chatDetailed).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('You are Zavorth'),
        }),
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('Reply in the same language the user used'),
        }),
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('Natural First route: llm-reply'),
        }),
        expect.objectContaining({
          role: 'user',
          content: 'responda oi pelo runtime real',
        }),
      ]),
      [],
      expect.objectContaining({
        allowFallback: true,
        stream: expect.objectContaining({
          mode: 'auto',
          onEvent: expect.any(Function),
        }),
        toolPolicy: expect.objectContaining({
          approvalGranted: false,
          approvedToolIds: [],
          exposedTools: [],
          requestedTools: [],
        }),
      }),
    );
    expect(result.run.status).toBe('completed');
    expect(result.run.summary).toBe('Answer generated by the governed model loop.');
    expect(result.replies[0].text).toBe('Resposta natural via provider runtime.');
    expect(result.run.modelProfile).toEqual(expect.objectContaining({
      providerLabel: 'openai',
      modelLabel: 'gpt-4o',
      routingPolicy: 'direct',
    }));
    expect(result.run.metadata.governedExecutor).toEqual(expect.objectContaining({
      id: 'zavorth-llm-runtime',
    }));
    expect(result.run.metadata.naturalFirstLlmRuntime).toEqual(expect.objectContaining({
      contractVersion: 'natural-first-llm-runtime/5',
      stage: 5,
      route: 'llm-reply',
      providerConfigured: true,
      providerUsed: true,
      fallbackUsed: false,
      generatedBy: 'llm-runtime',
      providerName: 'openai',
      modelName: 'gpt-4o',
      safety: expect.objectContaining({
        noToolExecution: true,
        noApprovalBypass: true,
        noExternalProviderCall: false,
      }),
    }));
  });

  it('exposes governed safe tool runtime tools to provider execution', async () => {
    const llmRuntime: UniversalAgentLlmRuntime = {
      chatDetailed: jest.fn(async () => ({
        providerName: 'openai',
        modelName: 'gpt-4o',
        response: {
          content: 'Agora sao 12:00.',
          toolCalls: [],
          finishReason: 'stop',
        },
        route: {
          source: 'LlmRuntimeService',
          requestedProviderName: 'openai',
          primaryProviderName: 'openai',
          providerName: 'openai',
          modelName: 'gpt-4o',
          fallbackAllowed: true,
          fallbackUsed: false,
          providerChain: ['openai'],
          attempts: [
            {
              providerName: 'openai',
              modelName: 'gpt-4o',
              status: 'succeeded',
              fallback: false,
            },
          ],
          request: {
            messageCount: 2,
            toolCount: 3,
            inputChars: 128,
          },
        },
      })),
    };
    const toolRuntime: UniversalAgentToolRuntime = {
      getToolDefinitions: jest.fn(() => [
        { name: 'get_datetime', description: 'Returns current date and time.' },
        { name: 'workspace.read', description: 'Reads workspace files.' },
        { name: 'zavorth_action', description: 'Runs governed Zavorth actions.' },
        { name: 'remote_shell', description: 'Runs shell commands.' },
      ]),
      hasTool: jest.fn(() => true),
      isAvailable: jest.fn(() => true),
      executeTool: jest.fn(async () => '{}'),
    };
    const service = new AgentRunService({
      now: () => new Date('2026-05-02T12:00:00.000Z'),
      idFactory: createIdFactory(),
      llmRuntime,
      toolRuntime,
      defaultProviderLabel: 'OpenAI',
      defaultModelLabel: 'gpt-4o',
    });

    await service.run({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-provider-tools',
      text: 'que horas sao agora?',
      requestedTools: [],
      metadata: {
        capabilityNegotiationApproved: true,
      },
    });

    const [,, options] = (llmRuntime.chatDetailed as jest.Mock).mock.calls[0];
    const tools = (llmRuntime.chatDetailed as jest.Mock).mock.calls[0][1];
    const toolNames = tools.map((tool: { name: string }) => tool.name);
    expect(toolNames).toEqual(expect.arrayContaining([
      'get_datetime',
      'workspace.read',
      'zavorth_action',
    ]));
    expect(toolNames).not.toContain('remote_shell');
    expect(options).toEqual(expect.objectContaining({
      toolPolicy: expect.objectContaining({
        exposedTools: expect.arrayContaining([
          expect.objectContaining({ id: 'get_datetime' }),
        ]),
      }),
    }));
  });

  it('answers open-ended free text with an honest natural fallback when no provider is configured', async () => {
    const service = new AgentRunService({
      now: () => new Date('2026-05-11T13:00:00.000Z'),
      idFactory: createIdFactory(),
      defaultProviderLabel: 'provider not configured',
      defaultModelLabel: 'model not configured',
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-no-provider',
      text: 'qual a melhor forma de pensar sobre esse produto?',
      requestedTools: [],
    });

    expect(result.ok).toBe(true);
    expect(result.run.status).toBe('completed');
    expect(result.run.summary).toBe('A model is not configured yet, so Zavorth answered with setup guidance only.');
    expect(result.replies[0].text).toContain('no model is configured yet');
    expect(result.replies[0].text).toContain('Next:');
    expect(result.run.metadata.naturalFirstRoute).toEqual(expect.objectContaining({
      route: 'llm-reply',
    }));
    expect(result.run.metadata.naturalFirstLlmRuntime).toEqual(expect.objectContaining({
      contractVersion: 'natural-first-llm-runtime/5',
      stage: 5,
      route: 'llm-reply',
      providerConfigured: false,
      providerUsed: false,
      fallbackUsed: true,
      generatedBy: 'honest-local-fallback',
      safety: expect.objectContaining({
        noToolExecution: true,
        noApprovalBypass: true,
        noExternalProviderCall: true,
      }),
    }));
    expect(result.run.metadata.executorResolution).toEqual(expect.objectContaining({
      status: 'missing-llm-provider',
      gracefulFallback: true,
    }));
    expect(result.run.metadata.executorBoundary).toEqual(expect.objectContaining({
      selected: 'missing',
    }));
    expect(result.run.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: 'Model setup needed',
        status: 'done',
      }),
    ]));
  });

  it('uses the shared Model Picker selection for provider execution and route explainability', async () => {
    const llmRuntime: UniversalAgentLlmRuntime = {
      chatDetailed: jest.fn(async () => ({
        providerName: 'gemini',
        modelName: 'gemini-2.5-flash',
        response: {
          content: 'Response through shared selection.',
          toolCalls: [],
          finishReason: 'stop',
        },
        route: {
          source: 'LlmRuntimeService',
          requestedProviderName: 'gemini',
          primaryProviderName: 'gemini',
          providerName: 'gemini',
          modelName: 'gemini-2.5-flash',
          fallbackAllowed: true,
          fallbackUsed: false,
          providerChain: ['gemini', 'openai'],
          attempts: [
            {
              providerName: 'gemini',
              modelName: 'gemini-2.5-flash',
              status: 'succeeded',
              fallback: false,
            },
          ],
          request: {
            messageCount: 2,
            toolCount: 0,
            inputChars: 128,
          },
        },
      })),
    };
    const service = new AgentRunService({
      now: () => new Date('2026-05-02T12:00:00.000Z'),
      idFactory: createIdFactory(),
      llmRuntime,
      modelPickerContractService: {
        buildContract: jest.fn(() => createModelPickerContract() as any),
      },
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-model-picker-runtime',
      text: 'responda pelo picker compartilhado',
      requestedTools: [],
      metadata: {
        capabilityNegotiationApproved: true,
      },
    });

    expect(llmRuntime.chatDetailed).toHaveBeenCalledWith(
      expect.any(Array),
      [],
      expect.objectContaining({
        providerName: 'gemini',
        modelName: 'gemini-2.5-flash',
        fallbackOrder: ['gemini', 'openai'],
        allowFallback: true,
        stream: expect.objectContaining({
          mode: 'auto',
          onEvent: expect.any(Function),
        }),
        toolPolicy: expect.objectContaining({
          approvalGranted: false,
          approvedToolIds: [],
          exposedTools: [],
          requestedTools: [],
        }),
      }),
    );
    expect(result.run.modelProfile).toEqual(expect.objectContaining({
      providerLabel: 'gemini',
      modelLabel: 'gemini-2.5-flash',
      routingPolicy: 'direct',
      routeId: 'gemini',
      familyId: 'gemini',
      selectionSource: 'current-config',
      readiness: 'ready',
      ready: true,
      fallbackOrder: ['gemini', 'openai'],
    }));
    expect(result.run.metadata.modelPickerSelection).toEqual(expect.objectContaining({
      providerName: 'gemini',
      modelName: 'gemini-2.5-flash',
      routeId: 'gemini',
      readiness: 'ready',
    }));
    expect(result.run.metadata.providerRouteBudgetCorrelation).toEqual(expect.objectContaining({
      providerName: 'gemini',
      modelName: 'gemini-2.5-flash',
      modelPicker: expect.objectContaining({
        providerName: 'gemini',
        modelName: 'gemini-2.5-flash',
        matchedEffectiveProvider: true,
        fallbackOrder: ['gemini', 'openai'],
      }),
    }));
    expect(result.run.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: 'Model Picker aplicado',
        metadata: expect.objectContaining({
          selected: expect.objectContaining({
            providerName: 'gemini',
          }),
        }),
      }),
    ]));
  });

  it('assembles canonical hot/warm/cold context before policy and provider execution', async () => {
    const llmRuntime: UniversalAgentLlmRuntime = {
      chatDetailed: jest.fn(async () => ({
        providerName: 'openai',
        modelName: 'gpt-4o',
        response: {
          content: 'Resposta com contexto canonico.',
          toolCalls: [],
          finishReason: 'stop',
        },
        route: {
          source: 'LlmRuntimeService',
          requestedProviderName: 'openai',
          primaryProviderName: 'openai',
          providerName: 'openai',
          modelName: 'gpt-4o',
          fallbackAllowed: true,
          fallbackUsed: false,
          providerChain: ['openai'],
          attempts: [
            {
              providerName: 'openai',
              modelName: 'gpt-4o',
              status: 'succeeded',
              fallback: false,
            },
          ],
          request: {
            messageCount: 2,
            toolCount: 0,
            inputChars: 256,
          },
        },
      })),
    };
    const coldContext = new ColdContextResolver().resolve({
      sessionId: 'web:z4-context',
      channel: 'web',
      skill: new SkillSnapshotAssembler().assemble({
        manifests: [
          createSkillManifest({
            id: 'imported-skill-draft',
            toolDefinitions: [{ name: 'unsafe_imported_tool' }],
            metadata: {
              trustState: 'quarantined',
            },
          }),
        ],
      }).cold,
      mcp: new McpSnapshotAssembler().assemble({
        snapshot: createMcpRuntimeSnapshot(),
      }).cold,
    });
    const service = new AgentRunService({
      now: () => new Date('2026-05-02T12:15:00.000Z'),
      idFactory: createIdFactory(),
      llmRuntime,
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-z4-context',
      text: 'use memory, skills and MCP to answer',
      workspace: 'C:/repo/Zavorth',
      requestedTools: ['unsafe_imported_tool', 'read_file'],
      metadata: {
        continuityPrompt: 'Continuity: user requested the previous audit.',
        workspacePrompt: 'Zavorth workspace loaded in read-only mode.',
        memoryPrompt: 'Memory: prefer short answers.',
        skillPrompt: 'Skill: workspace-reporter available only if trusted.',
        mcpSnapshot: {
          servers: [{ id: 'mnemos', status: 'available' }],
        },
        coldContext: coldContext.cold.metadata,
        capabilityNegotiationApproved: true,
        toolRehearsal: {
          status: 'approved',
          approved: true,
        },
      },
    });

    const systemMessage = (llmRuntime.chatDetailed as jest.Mock).mock.calls[0][0][0].content;
    expect(systemMessage).toContain('Canonical run context');
    expect(systemMessage).toContain('Zavorth workspace loaded in read-only mode.');
    expect(systemMessage).toContain('Memory: prefer short answers.');
    expect(systemMessage).toContain('Skill: workspace-reporter available only if trusted.');
    expect(systemMessage).toContain('MCP snapshot available');
    expect(result.run.metadata.canonicalContextSummary).toEqual(expect.objectContaining({
      source: 'AgentRunService',
      depth: 'cold',
      layers: ['hot', 'warm', 'cold'],
      hasWorkspacePrompt: true,
      hasMemoryPrompt: true,
      hasSkillPrompt: true,
      hasMcpSnapshot: true,
      toolExposureGatedByContextProfile: false,
    }));
    expect((result.run.metadata.canonicalContext as any).profile).toEqual(expect.objectContaining({
      depth: 'cold',
      gatesToolExposure: false,
    }));
    expect(result.run.toolExposure.tools.map((tool) => tool.id)).toEqual(expect.arrayContaining(['read_file']));
    expect(result.run.toolExposure.blockedTools).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'unsafe_imported_tool',
        reason: 'blocked-by-imported-capability-trust',
      }),
    ]));
  });

  it('correlates LLM route receipts with run budget and effective model profile', async () => {
    const routeReceipt = {
      source: 'LlmRuntimeService',
      requestedProviderName: 'openrouter',
      primaryProviderName: 'openrouter',
      providerName: 'openai',
      modelName: 'gpt-4.1-mini',
      fallbackAllowed: true,
      fallbackUsed: true,
      providerChain: ['openrouter', 'openai'],
      attempts: [
        {
          providerName: 'openrouter',
          modelName: 'openrouter/default',
          status: 'skipped_unavailable',
          fallback: false,
        },
        {
          providerName: 'openai',
          modelName: 'gpt-4.1-mini',
          status: 'succeeded',
          fallback: true,
        },
      ],
      request: {
        messageCount: 2,
        toolCount: 1,
        inputChars: 128,
      },
    };
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
      status: 'completed',
      summary: 'LLM respondeu via fallback.',
      replyText: 'Resposta com rota observavel.',
      metadata: {
        llmRuntimeRoute: routeReceipt,
      },
    }));
    const service = new AgentRunService({
      now: () => new Date('2026-04-27T12:06:00.000Z'),
      idFactory: createIdFactory(),
      executor,
      defaultProviderLabel: 'OpenRouter',
      defaultModelLabel: 'openrouter/default',
      runBudgetPolicy: new RunBudgetPolicy({
        maxEstimatedCostUnits: 5,
      }),
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-route-budget',
      text: 'responda com fallback',
      requestedTools: ['read_file'],
      metadata: {
        estimatedCostUnits: 2,
      },
    });

    expect(result.run.modelProfile).toEqual(expect.objectContaining({
      providerLabel: 'openai',
      modelLabel: 'gpt-4.1-mini',
      routingPolicy: 'fallback',
      fallbackModelLabel: 'gpt-4.1-mini',
    }));
    expect(result.run.metadata.llmRuntimeRoute).toEqual(routeReceipt);
    expect(result.run.metadata.executorBoundary).toEqual(expect.objectContaining({
      source: 'AgentRunExecutorBoundary',
      stage: 8,
      selected: 'custom-executor',
    }));
    expect(result.run.metadata.providerRouteBudgetCorrelation).toEqual(expect.objectContaining({
      source: 'AgentRunService',
      routeSource: 'LlmRuntimeService',
      providerName: 'openai',
      modelName: 'gpt-4.1-mini',
      primaryProviderName: 'openrouter',
      routingPolicy: 'fallback',
      fallbackUsed: true,
      providerAttemptCount: 2,
      unavailableProviderCount: 1,
      budget: expect.objectContaining({
        source: 'RunBudgetPolicy',
        degraded: false,
        estimatedCostUnits: 2,
        maxEstimatedCostUnits: 5,
      }),
    }));
    expect(result.run.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'status',
        title: 'Rota LLM correlacionada',
        metadata: expect.objectContaining({
          providerName: 'openai',
          fallbackUsed: true,
        }),
      }),
    ]));
  });

  it('uses toolHintProfile as ToolExposurePolicy input without turning it into a gate', async () => {
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(({ run }) => ({
      status: 'completed',
      summary: `Tools expostas: ${run.toolExposure.tools.map((tool) => tool.id).join(', ')}`,
      replyText: 'Hints reconciliados.',
    }));
    const service = new AgentRunService({
      now: () => new Date('2026-04-27T12:05:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-tool-hint',
      text: 'confere o README',
      requestedTools: [],
      metadata: {
        toolHintProfile: {
          intentCategory: 'file_operation',
          groups: ['workspace'],
          recommendedToolNames: ['read_file', 'list_directory'],
          toolExposureGatedByCognitiveFirewall: false,
          isHardGate: false,
          reason: 'workspace-reference',
        },
        capabilityNegotiationApproved: true,
      },
    });

    expect(executor).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(result.run.toolExposure).toEqual(expect.objectContaining({
      mode: 'safe',
      summary: '2 tools exposed with safe policy.',
    }));
    expect(result.run.toolExposure.tools).toEqual([
      expect.objectContaining({
        id: 'read_file',
        risk: 'safe',
        requiresApproval: false,
      }),
      expect.objectContaining({
        id: 'list_directory',
        risk: 'safe',
        requiresApproval: false,
      }),
    ]);
    expect(result.run.metadata.toolExposureHint).toEqual(expect.objectContaining({
      source: 'toolHintProfile',
      intentCategory: 'file_operation',
      groups: ['workspace'],
      recommendedToolNames: ['read_file', 'list_directory'],
      toolExposureGatedByCognitiveFirewall: false,
      isHardGate: false,
      usedAsPolicyInput: true,
      reason: expect.stringContaining('workspace-reference'),
    }));
    expect(result.replies[0]).toEqual(expect.objectContaining({
      text: 'Hints reconciliados.',
    }));
  });

  it('governs Echo Hands through tool exposure policy before any executor can run it', async () => {
    const executor = jest.fn();
    const service = new AgentRunService({
      now: () => new Date('2026-04-27T12:12:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-echo-hands',
      text: 'abra o navegador com Echo',
      requestedTools: ['echo_hands'],
      metadata: {
        capabilityNegotiationApproved: true,
      },
    });

    expect(executor).not.toHaveBeenCalled();
    expect(result.run.status).toBe('waiting_approval');
    expect(result.run.toolExposure).toEqual(expect.objectContaining({
      mode: 'restricted',
      summary: '1 tool exposed with restricted policy.',
    }));
    expect(result.run.toolExposure.tools).toEqual([
      expect.objectContaining({
        id: 'echo_hands',
        group: 'local_control',
        risk: 'danger',
        requiresApproval: true,
        policyTags: expect.arrayContaining([
          'capability:echo',
          'group:local_control',
          'approval-required',
        ]),
      }),
    ]);
    expect(result.run.approvals).toEqual([
      expect.objectContaining({
        title: 'Aprovar tool rehearsal',
        risk: 'danger',
        status: 'pending',
      }),
    ]);
    expect(result.run.metadata.toolRehearsal).toEqual(expect.objectContaining({
      status: 'waiting-approval',
      approvalCreated: true,
      summary: expect.objectContaining({
        callCount: 1,
        approvalRequired: true,
      }),
    }));
    expect(result.run.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: 'Tool Rehearsal',
        status: 'pending',
        metadata: expect.objectContaining({
          source: 'ToolRehearsalService',
          noToolExecuted: true,
        }),
      }),
    ]));
    expect(result.replies[0]).toEqual(expect.objectContaining({
      text: expect.stringContaining('Tool Rehearsal - Tool Rehearsal'),
    }));
  });

  it('executes approved Echo Hands through the existing tool runtime when available', async () => {
    const toolRuntime = {
      isAvailable: jest.fn(() => true),
      hasTool: jest.fn((toolName: string) => toolName === 'echo_hands'),
      executeTool: jest.fn().mockResolvedValue(JSON.stringify({
        ok: true,
        action: 'browser_search',
        message: 'Busca enviada para youtube.',
        approvalRequired: false,
      })),
    };
    const service = new AgentRunService({
      now: () => new Date('2026-04-27T12:14:00.000Z'),
      idFactory: createIdFactory(),
      toolRuntime,
    });
    const request = {
      userId: 'grey',
      channel: 'web' as const,
      sessionId: 'session-echo-hands-approved',
      text: 'busque com Echo',
      requestedTools: ['echo_hands'],
      metadata: {
        capabilityNegotiationApproved: true,
        toolRehearsal: {
          status: 'approved',
          approved: true,
        },
        echoHandsArgs: {
          action: 'browser_search',
          args: {
            engine: 'youtube',
            query: 'Zavorth runtime',
          },
          risk: 'low',
        },
      },
    };

    const pending = await service.run(request);
    const result = await service.resumeApprovedRun(pending.run, request);

    expect(toolRuntime.executeTool).toHaveBeenCalledWith('echo_hands', expect.objectContaining({
      action: 'browser_search',
      args: {
        engine: 'youtube',
        query: 'Zavorth runtime',
      },
      trusted: true,
      metadata: expect.objectContaining({
        runId: pending.run.id,
        sessionId: 'session-echo-hands-approved',
        governedBy: 'ToolExposurePolicy',
      }),
    }));
    expect(result.run.status).toBe('completed');
    expect(result.run.summary).toBe('Echo Hands executado via tool runtime governado.');
    expect(result.run.metadata.echoHands).toEqual(expect.objectContaining({
      source: 'AgentRunService',
      executed: true,
      toolRuntimeAvailable: true,
      governedBy: 'ToolExposurePolicy',
    }));
    expect(result.run.metadata.executorBoundary).toEqual(expect.objectContaining({
      source: 'AgentRunExecutorBoundary',
      stage: 8,
      selected: 'tool-runtime',
    }));
    expect(result.run.metadata.lifecycleDefense).toEqual(expect.objectContaining({
      resume: expect.objectContaining({
        source: 'AgentRunRiskHooks',
        stage: 'resume',
        risk: 'danger',
        blocked: false,
        approvalRequiredToolIds: ['echo_hands'],
      }),
      postExecutor: expect.objectContaining({
        source: 'AgentRunRiskHooks',
        stage: 'post-executor',
        risk: 'danger',
        blocked: false,
        approvalRequiredToolIds: ['echo_hands'],
      }),
    }));
    expect(result.run.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'status',
        title: 'Defense hook resume',
        status: 'done',
      }),
      expect.objectContaining({
        kind: 'tool',
        title: 'echo_hands',
        status: 'done',
        metadata: expect.objectContaining({
          source: 'ToolRuntimeService',
        }),
      }),
    ]));
  });

  it('records a defense hook when execution is interrupted by an executor failure', async () => {
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => {
      throw new Error('executor caiu');
    });
    const service = new AgentRunService({
      now: () => new Date('2026-04-27T12:15:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-interrupted',
      text: 'responda com erro controlado',
      requestedTools: [],
      metadata: {
        capabilityNegotiationApproved: true,
        toolRehearsal: {
          status: 'approved',
          approved: true,
        },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.run.status).toBe('failed');
    expect(result.run.metadata.lifecycleDefense).toEqual(expect.objectContaining({
      preExecutor: expect.objectContaining({
        source: 'AgentRunRiskHooks',
        stage: 'pre-executor',
        blocked: false,
      }),
      interrupted: expect.objectContaining({
        source: 'AgentRunRiskHooks',
        stage: 'interrupted',
        blocked: false,
        risk: 'safe',
      }),
    }));
    expect(result.run.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'error',
        title: 'Falha estruturada do executor',
        status: 'failed',
      }),
      expect.objectContaining({
        kind: 'status',
        title: 'Defense hook interrupted',
        status: 'done',
      }),
    ]));
  });

  it('degrades honestly when approved Echo Hands is not available in the tool runtime', async () => {
    const service = new AgentRunService({
      now: () => new Date('2026-04-27T12:16:00.000Z'),
      idFactory: createIdFactory(),
      toolRuntime: {
        isAvailable: jest.fn(() => true),
        hasTool: jest.fn(() => false),
        executeTool: jest.fn(),
      },
    });
    const request = {
      userId: 'grey',
      channel: 'web' as const,
      sessionId: 'session-echo-hands-unavailable',
      text: 'use Echo',
      requestedTools: ['echo_hands'],
      metadata: {
        echoHandsArgs: {
          action: 'open_app',
          args: { app: 'notepad' },
        },
      },
    };

    const pending = await service.run(request);
    const result = await service.resumeApprovedRun(pending.run, request);

    expect(result.run.status).toBe('completed');
    expect(result.run.summary).toBe('Echo Hands unavailable in the tool runtime for this execution.');
    expect(result.run.metadata.echoHands).toEqual(expect.objectContaining({
      executed: false,
      reason: 'echo-hands-unavailable',
      governedBy: 'ToolExposurePolicy',
    }));
    expect(result.run.metadata.executorBoundary).toEqual(expect.objectContaining({
      source: 'AgentRunExecutorBoundary',
      stage: 8,
      selected: 'tool-runtime',
    }));
    expect(result.run.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'tool',
        title: 'echo_hands',
        status: 'failed',
      }),
    ]));
  });

  it('promotes cold context trust reports into observable run metadata', async () => {
    const coldContext = new ColdContextResolver().resolve({
      sessionId: 'web:cold-trust',
      channel: 'web',
      hot: {
        continuityPrompt: 'Recent continuity.',
      },
      warm: {
        workspacePrompt: 'Workspace loaded.',
      },
      skill: new SkillSnapshotAssembler().assemble({
        manifests: [
          createSkillManifest({
            id: 'official-builder',
            toolDefinitions: [{ name: 'official_build' }],
            metadata: {
              origin: 'official',
            },
          }),
          createSkillManifest({
            id: 'imported-skill-draft',
            toolDefinitions: [{ name: 'unsafe_imported_tool' }],
            metadata: {
              trustState: 'quarantined',
            },
          }),
        ],
      }).cold,
      mcp: new McpSnapshotAssembler().assemble({
        snapshot: createMcpRuntimeSnapshot(),
      }).cold,
    });
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(({ run }) => ({
      status: 'completed',
      summary: `Quarentena observavel: ${(run.metadata.importedCapabilityTrust as any).total.quarantined}.`,
      replyText: 'Trust metadata pronta.',
    }));
    const service = new AgentRunService({
      now: () => new Date('2026-04-27T12:30:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cold-trust',
      text: 'use o snapshot frio',
      requestedTools: [],
      metadata: {
        coldContext: coldContext.cold.metadata,
        capabilityNegotiationApproved: true,
        toolRehearsal: {
          status: 'approved',
          approved: true,
        },
      },
    });

    expect(executor).toHaveBeenCalledTimes(1);
    expect(executor.mock.calls[0][0].run.metadata.importedCapabilityTrust).toEqual(expect.objectContaining({
      source: 'ColdContextResolver',
      hasQuarantined: true,
      blockedTools: expect.arrayContaining(['unsafe_imported_tool', 'unsafe_remote_tool']),
      toolExposureGatedByImportedCapabilityTrust: true,
    }));
    expect(result.run.metadata.importedCapabilityTrust).toEqual(expect.objectContaining({
      skill: {
        trusted: 1,
        safe: 0,
        quarantined: 1,
      },
      mcp: {
        trusted: 1,
        safe: 0,
        quarantined: 1,
      },
      total: {
        trusted: 2,
        safe: 0,
        quarantined: 2,
      },
      blockedTools: expect.arrayContaining(['unsafe_imported_tool', 'unsafe_remote_tool']),
    }));
    expect((result.run.metadata.importedCapabilityTrust as any).riskReports).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'skill',
        id: 'imported-skill-draft',
        trustState: 'quarantined',
      }),
      expect.objectContaining({
        kind: 'mcp',
        id: 'imported-draft',
        trustState: 'quarantined',
      }),
    ]));
    expect(result.run.summary).toBe('Quarentena observavel: 2.');
  });

  it('uses imported capability trust as ToolExposurePolicy input to block quarantined tools', async () => {
    const coldContext = new ColdContextResolver().resolve({
      sessionId: 'web:cold-trust-policy',
      channel: 'web',
      skill: new SkillSnapshotAssembler().assemble({
        manifests: [
          createSkillManifest({
            id: 'imported-skill-draft',
            toolDefinitions: [{ name: 'unsafe_imported_tool' }],
            metadata: {
              trustState: 'quarantined',
            },
          }),
        ],
      }).cold,
      mcp: new McpSnapshotAssembler().assemble({
        snapshot: createMcpRuntimeSnapshot(),
      }).cold,
    });
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(({ run }) => ({
      status: 'completed',
      summary: `Tools permitidas: ${run.toolExposure.tools.map((tool) => tool.id).join(', ')}.`,
      replyText: 'Tools filtradas pela policy.',
    }));
    const service = new AgentRunService({
      now: () => new Date('2026-04-27T12:35:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cold-trust-policy',
      text: 'use apenas tools seguras',
      requestedTools: ['read_file', 'unsafe_imported_tool', 'unsafe_remote_tool'],
      metadata: {
        allowedTools: ['list_directory', 'unsafe_imported_tool'],
        coldContext: coldContext.cold.metadata,
        capabilityNegotiationApproved: true,
        toolRehearsal: {
          status: 'approved',
          approved: true,
        },
      },
    });

    expect(executor).toHaveBeenCalledTimes(1);
    expect(executor.mock.calls[0][0].run.toolExposure.tools.map((tool) => tool.id)).toEqual([
      'read_file',
      'list_directory',
    ]);
    expect(result.run.toolExposure).toEqual(expect.objectContaining({
      mode: 'safe',
      summary: '2 tools exposed with safe policy. 2 tools blocked by quarantine.',
      toolExposureGatedByImportedCapabilityTrust: true,
    }));
    expect(result.run.toolExposure.blockedTools).toEqual([
      expect.objectContaining({
        id: 'unsafe_imported_tool',
        reason: 'blocked-by-imported-capability-trust',
      }),
      expect.objectContaining({
        id: 'unsafe_remote_tool',
        reason: 'blocked-by-imported-capability-trust',
      }),
    ]);
    expect(result.run.metadata.importedCapabilityTrust).toEqual(expect.objectContaining({
      blockedTools: expect.arrayContaining(['unsafe_imported_tool', 'unsafe_remote_tool']),
      toolExposureGatedByImportedCapabilityTrust: true,
    }));
    expect(result.run.summary).toBe('Tools permitidas: read_file, list_directory.');
  });

  it('degrades oversized runs with an honest reply before calling the executor', async () => {
    const executor = jest.fn();
    const service = new AgentRunService({
      now: () => new Date('2026-04-27T12:10:00.000Z'),
      idFactory: createIdFactory(),
      executor,
      runBudgetPolicy: new RunBudgetPolicy({
        maxInputChars: 16,
      }),
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-budget',
      text: 'this request is larger than the minimum cutoff',
      requestedTools: ['read_file'],
    });

    expect(executor).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.run.status).toBe('completed');
    expect(result.run.summary).toBe('Run degraded by minimum budget before the executor: input-too-large.');
    expect(result.run.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'status',
        title: 'Minimum budget applied',
        status: 'done',
        metadata: expect.objectContaining({
          reason: 'input-too-large',
          degraded: true,
          toolExposureGatedByRunBudget: false,
        }),
      }),
    ]));
    expect(result.run.metadata.runBudget).toEqual(expect.objectContaining({
      source: 'RunBudgetPolicy',
      reason: 'input-too-large',
      maxInputChars: 16,
      degraded: true,
    }));
    expect(result.replies[0]).toEqual(expect.objectContaining({
      text: 'Run degraded by minimum budget before the executor: input-too-large.',
    }));
  });

  it('converts executor exceptions into structured failure semantics', async () => {
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => {
      const error = Object.assign(new Error('provider timeout'), {
        code: 'ETIMEDOUT',
      });
      throw error;
    });
    const service = new AgentRunService({
      now: () => new Date('2026-04-27T12:20:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-failure',
      text: 'responda usando provider remoto',
      requestedTools: [],
      metadata: {
        capabilityNegotiationApproved: true,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.run.status).toBe('failed');
    expect(result.run.summary).toBe('provider timeout');
    expect(result.run.metadata.failureSemantics).toEqual(expect.objectContaining({
      source: 'executor',
      code: 'ETIMEDOUT',
      message: 'provider timeout',
      retryable: true,
      severity: 'warning',
    }));
    expect(result.run.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'error',
        title: 'Falha estruturada do executor',
        status: 'failed',
        metadata: expect.objectContaining({
          failureSemantics: expect.objectContaining({
            retryable: true,
          }),
        }),
      }),
    ]));
    expect(result.replies[0]).toEqual(expect.objectContaining({
      text: 'Falha estruturada no executor: provider timeout. Pode ser tentado novamente.',
    }));
  });
});
