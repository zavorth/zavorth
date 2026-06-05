import { buildZavorthControlZavorthControlViewModel } from '../../../src/ai-gateway/app/(zavorthControl)/control/zavorth-control/adapters/zavorthControlZavorthControlAdapter.js';

describe('ZavorthControlZavorthControlAdapter', () => {
  it('maps current control state into ZavorthControl contracts without using demo metrics', () => {
    const viewModel = buildZavorthControlZavorthControlViewModel({
      state: {
        operator: { label: 'Grey' },
      },
      runtime: {
        status: 'ready',
        provider: 'Google',
        model: 'gemini-live',
      },
      wsStatus: 'connected',
      productModeLabel: 'chat',
      effectiveSessionId: 'session-1',
      sessionEntries: [
        {
          sessionId: 'session-1',
          title: 'CLI polish',
          channel: 'web',
          messageCount: 3,
          updatedAt: '2026-04-26T12:00:00.000Z',
        },
      ],
      transcriptEntries: [
        {
          id: 'msg-1',
          role: 'user',
          text: 'analise o repositorio',
          createdAt: '2026-04-26T12:00:00.000Z',
          events: [
            {
              id: 'evt-1',
              kind: 'thinking',
              title: 'Plano montado',
              status: 'running',
            },
          ],
        },
      ],
      taskEntries: [
        {
          id: 'task-1',
          title: 'Analisar repositorio',
          status: 'running',
          summary: 'Scan em andamento.',
          runId: 'run-1',
          updatedAt: '2026-04-26T12:00:30.000Z',
        },
      ],
      toolRuns: [
        {
          id: 'tool-1',
          name: 'workspace_scan',
          status: 'done',
          summary: 'Workspace lido.',
        },
      ],
      artifacts: [
        {
          id: 'artifact-1',
          title: 'Relatorio de inventario',
          kind: 'report',
          status: 'ready',
          createdAt: '2026-04-26T12:01:00.000Z',
        },
      ],
      memoryRecallSources: [
        {
          id: 'memory-1',
          title: 'Decisao de produto',
          layer: 'semantic',
          summary: 'ZavorthControl fake vira referencia visual oficial.',
          confidence: 0.91,
        },
      ],
      subagentAutoInvocation: {
        contractVersion: '2026-05-10.subagent-auto-invocation',
        generatedAt: '2026-04-26T12:00:20.000Z',
        status: 'auto-selected',
        selectedBy: 'implicit-complexity',
        action: 'invoke_live_subagents',
        mode: 'oneshot',
        channel: 'web',
        confidence: 0.88,
        live: true,
        roles: [
          { roleId: 'auditor', label: 'Auditor', whySelected: 'auditoria profunda' },
        ],
        triggers: ['deep-audit'],
        riskSignals: [],
        publicRationale: 'Complexidade alta com leitura segura.',
        nextSafeAction: 'Acompanhar workers e receipts.',
        safety: {
          noRawChainOfThought: true,
          noSecretValuesSerialized: true,
          readOnlyOnly: true,
          approvalsRequiredForMutation: true,
        },
      },
      budget: {
        status: 'ok',
        currency: 'USD',
        estimatedCost: 0.02,
        tokensUsed: 300,
        tokenBudget: 1200,
      },
      replay: {
        id: 'replay-1',
        runId: 'run-1',
        status: 'available',
        eventCount: 2,
        artifactCount: 1,
      },
      healthChecks: [
        {
          id: 'health-1',
          label: 'Gateway',
          status: 'ready',
        },
      ],
      releaseStatus: {
        status: 'preview_ready',
        channel: 'preview',
        version: 'local',
        rollbackAvailable: true,
      },
      integrations: [
        {
          id: 'telegram',
          label: 'Telegram',
          category: 'channel',
          status: 'connected',
        },
      ],
      identity: {
        agentName: 'Zavorth',
        userName: 'Grey',
        language: 'en-US',
        tone: 'direto',
        initiative: 'balanced',
        firstRunStatus: 'complete',
      },
      logs: [
        {
          id: 'log-1',
          level: 'info',
          source: 'runtime',
          message: 'ZavorthControl hidratado.',
          createdAt: '2026-04-26T12:02:00.000Z',
        },
      ],
      developerWorkspace: {
        processes: [
          {
            id: 'app',
            status: 'idle',
          },
        ],
      },
      nexusWorkbench: {
        ok: true,
        generatedAt: '2026-04-26T12:03:00.000Z',
        operatorExperience: {
          statusLabel: 'Pronto',
          tone: 'ok',
          primaryMessage: 'Nexus esta pronto para operar.',
          nextStep: 'Continue usando.',
          cards: [
            {
              id: 'runtime',
              label: 'Runtime',
              value: 'Principal',
              tone: 'ok',
              detail: 'Nexus esta ligado ao Agent Gateway.',
            },
          ],
        },
        runtime: {
          primary: 'ZavorthAgentGateway',
          agentGatewayAvailable: true,
          echoFallbackAvailable: true,
        },
        execution: {
          recentCount: 1,
          recent: [
            {
              id: 'exec-1',
              timestamp: '2026-04-26T12:02:00.000Z',
              prompt: 'status',
              status: 'completed',
              durationMs: 42,
              tools: ['status'],
              finalResponse: 'Tudo pronto.',
            },
          ],
        },
        approvals: {
          pendingCount: 0,
          pending: [],
        },
        capabilities: {
          totalTools: 9,
          categories: { system: 4, web: 2 },
          lifecycle: [{ id: 'voice', status: 'ready' }],
          maturity: [{ id: 'echo', status: 'stable' }],
          provisionedEdges: [
            {
              id: 'browser-mcp',
              label: 'Browser MCP',
              status: 'official-but-provisioned',
              publicStatus: 'precisa configurar',
              runtimeTruth: 'Browser sidecar precisa de doctor.',
              ownerLayer: 'tooling',
              commands: ['npm run mcp:browser:doctor'],
              limitations: ['Scripts arbitrarios exigem sidecar isolado.'],
              nextStep: 'Rodar doctor.',
              readiness: {
                itemId: 'mcp:browser-sidecar',
                label: 'Browser Sidecar',
                kind: 'mcp',
                status: 'needs_configuration',
                nextAction: 'ZAVORTH_BROWSER_SIDECAR_URL must exist. Value will not be read by the doctor.',
                blockers: ['ZAVORTH_BROWSER_SIDECAR_URL must exist. Value will not be read by the doctor.'],
                checks: [
                  {
                    id: 'env:ZAVORTH_BROWSER_SIDECAR_URL',
                    kind: 'env-key',
                    status: 'missing',
                    summary: 'ZAVORTH_BROWSER_SIDECAR_URL must exist. Value will not be read by the doctor.',
                  },
                ],
              },
            },
          ],
          readiness: {
            state: 'ready',
            capabilityId: null,
            status: 'stable',
            nextStep: null,
          },
        },
        echoExperience: {
          status: 'ready',
          provider: {
            online: true,
            providerName: 'ollama',
            model: 'gemma2:2b',
            latencyMs: 31,
          },
          fallback: {
            recentExecutions: 3,
          },
          voice: {
            totalRequests: 2,
          },
          watchMode: {
            nextAction: 'Sem pendencias.',
          },
        },
        actions: [
          {
            id: 'safe-status-check',
            kind: 'safe_execution',
            method: 'POST',
            route: '/api/v2/nexus/execute',
            risk: 'read_only',
            prompt: 'Mostre um status operacional resumido.',
          },
        ],
        receipts: ['nexus-workbench-uses-canonical-gateway'],
      },
    });

    expect(viewModel.contractVersion).toBe('zavorthControl-runtime-contract/v1');
    expect(viewModel.generatedAt).toEqual(expect.any(String));
    expect(viewModel.runtime).toEqual(expect.objectContaining({
      status: 'ready',
      operatorLabel: 'Grey',
      currentProviderLabel: 'Google',
      currentModelLabel: 'gemini-live',
      activeSessionId: 'session-1',
    }));
    expect(viewModel.sessions).toEqual([
      expect.objectContaining({
        id: 'session-1',
        title: 'CLI polish',
        status: 'active',
        messageCount: 3,
      }),
    ]);
    expect(viewModel.messages).toEqual([
      expect.objectContaining({
        id: 'msg-1',
        role: 'user',
        text: 'analise o repositorio',
        events: [
          expect.objectContaining({
            id: 'evt-1',
            kind: 'thinking',
            status: 'running',
          }),
        ],
      }),
    ]);
    expect(viewModel.tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'task-1',
        status: 'running',
        runId: 'run-1',
      }),
    ]));
    expect(viewModel.events).toEqual([
      expect.objectContaining({
        id: 'tool-1',
        kind: 'tool',
        status: 'done',
      }),
    ]);
    expect(viewModel.artifacts).toEqual([
      expect.objectContaining({
        id: 'artifact-1',
        kind: 'report',
        status: 'ready',
      }),
    ]);
    expect(viewModel.memorySignals).toEqual([
      expect.objectContaining({
        id: 'memory-1',
        layer: 'semantic',
      }),
    ]);
    expect(viewModel.subagentAutoInvocation).toEqual(expect.objectContaining({
      status: 'auto-selected',
      selectedBy: 'implicit-complexity',
      confidence: 0.88,
      roles: [expect.objectContaining({ roleId: 'auditor' })],
      publicRationale: 'Complexidade alta com leitura segura.',
      operational: expect.objectContaining({
        sessionId: 'session-1',
        selectedSessionId: 'session-1',
        runtimeStatus: 'auto-selected',
        workerResults: 1,
      }),
      actions: expect.arrayContaining([
        expect.objectContaining({ command: '/agents status' }),
        expect.objectContaining({ command: '/agents read session-1' }),
      ]),
      timeline: expect.arrayContaining([
        expect.objectContaining({ title: 'Decisao de subagentes' }),
      ]),
      receipts: expect.arrayContaining([
        expect.objectContaining({ kind: 'decision' }),
      ]),
      surface: expect.objectContaining({
        cliCommand: 'npm run zavorth:subagents -- status',
        channelCommand: '/agents status',
      }),
    }));
    expect(viewModel.budget).toEqual(expect.objectContaining({
      status: 'ok',
      tokensUsed: 300,
      tokenBudget: 1200,
    }));
    expect(viewModel.replay).toEqual(expect.objectContaining({
      id: 'replay-1',
      status: 'available',
      eventCount: 2,
      artifactCount: 1,
    }));
    expect(viewModel.health).toEqual(expect.objectContaining({
      status: 'ready',
      checks: [
        expect.objectContaining({
          id: 'health-1',
        }),
      ],
    }));
    expect(viewModel.releaseStatus).toEqual(expect.objectContaining({
      status: 'preview_ready',
      channel: 'preview',
      rollbackAvailable: true,
    }));
    expect(viewModel.integrations).toEqual([
      expect.objectContaining({
        id: 'telegram',
        status: 'connected',
      }),
    ]);
    expect(viewModel.identity).toEqual(expect.objectContaining({
      agentName: 'Zavorth',
      userName: 'Grey',
      firstRunStatus: 'complete',
    }));
    expect(viewModel.logs).toEqual([
      expect.objectContaining({
        id: 'log-1',
        level: 'info',
      }),
    ]);
    expect(viewModel.counts).toEqual(expect.objectContaining({
      tasks: 1,
      sessions: 1,
      artifacts: 1,
      integrations: 1,
      blockers: 0,
      logs: 1,
    }));
    expect(viewModel.sectors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'workspace',
        label: 'Workspace',
        title: 'Developer Workspace',
        badgeCount: 1,
        enabled: true,
      }),
      expect.objectContaining({
        id: 'gateway',
        label: 'Gateway',
        title: 'Gateway Console',
        enabled: true,
      }),
    ]));
    expect(viewModel.nexusWorkbench).toEqual(expect.objectContaining({
      status: 'ready',
      headline: 'Nexus pronto pelo runtime principal.',
      operatorExperience: expect.objectContaining({
        statusLabel: 'Pronto',
        tone: 'ok',
        primaryMessage: 'Nexus esta pronto para operar.',
        nextStep: 'Continue usando.',
        cards: [
          expect.objectContaining({
            id: 'runtime',
            label: 'Runtime',
            value: 'Principal',
          }),
        ],
      }),
      runtime: expect.objectContaining({
        primary: 'ZavorthAgentGateway',
        primaryLabel: 'Runtime principal',
        agentGatewayAvailable: true,
        echoFallbackAvailable: true,
      }),
      capabilities: expect.objectContaining({
        totalTools: 9,
        categories: { system: 4, web: 2 },
        lifecycleCount: 1,
        maturityCount: 1,
        provisionedEdges: [
          expect.objectContaining({
            id: 'browser-mcp',
            readiness: expect.objectContaining({
              itemId: 'mcp:browser-sidecar',
              status: 'needs_configuration',
            }),
          }),
        ],
      }),
      echoExperience: expect.objectContaining({
        online: true,
        providerName: 'ollama',
        model: 'gemma2:2b',
        recentExecutions: 3,
        voiceRequests: 2,
      }),
      actions: [
        expect.objectContaining({
          id: 'safe-status-check',
          kind: 'safe_execution',
          route: '/api/v2/nexus/execute',
          prompt: 'Mostre um status operacional resumido.',
        }),
      ],
    }));
  });

  it('turns warnings and approvals into visible blockers and safe actions', () => {
    const viewModel = buildZavorthControlZavorthControlViewModel({
      runtime: {
        status: 'ready',
      },
      wsStatus: 'connected',
      runtimeWarnings: ['Provider principal indisponivel.'],
      approvals: [
        {
          id: 'approval-1',
          title: 'Permitir escrita em arquivo',
          reason: 'A tarefa precisa alterar um arquivo.',
        },
      ],
    });

    expect(viewModel.runtime.status).toBe('degraded');
    expect(viewModel.runtime.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'runtime-warning-0',
        severity: 'warning',
      }),
      expect.objectContaining({
        id: 'pending-approvals',
        actionId: 'approvals.open',
      }),
    ]));
    expect(viewModel.events).toEqual([
      expect.objectContaining({
        id: 'approval-1',
        kind: 'approval',
        status: 'pending',
      }),
    ]);
    expect(viewModel.approvals).toEqual([
      expect.objectContaining({
        id: 'approval-1',
        status: 'pending',
        risk: 'attention',
        command: 'approve approval-1',
      }),
    ]);
    expect(viewModel.actions[0]).toEqual(expect.objectContaining({
      id: 'approvals.open',
      group: 'approval',
    }));
  });

  it('uses the shared model picker when runtime labels are not projected directly', () => {
    const viewModel = buildZavorthControlZavorthControlViewModel({
      runtime: {
        status: 'ready',
        modelPicker: {
          schemaVersion: 1,
          selected: {
            schemaVersion: 1,
            source: 'current-config',
            providerName: 'openai',
            providerLabel: 'OpenAI',
            modelName: 'gpt-5.2',
            modelLabel: 'gpt-5.2',
            routeId: 'openai',
            familyId: 'openai',
            readiness: 'ready',
            ready: true,
            fallbackOrder: [],
            explanation: ['Configuracao atual seleciona openai/gpt-5.2.'],
          },
        },
      },
      wsStatus: 'connected',
    });

    expect(viewModel.runtime.currentProviderLabel).toBe('OpenAI');
    expect(viewModel.runtime.currentModelLabel).toBe('gpt-5.2');
    expect(viewModel.modelProfile).toEqual(expect.objectContaining({
      providerLabel: 'OpenAI',
      modelLabel: 'gpt-5.2',
    }));
  });

  it('projects real run budget, Model Picker route metadata and receipts into the run observatory', () => {
    const viewModel = buildZavorthControlZavorthControlViewModel({
      runtime: {
        status: 'ready',
      },
      wsStatus: 'connected',
      agentRun: {
        id: 'run-1',
        traceId: 'trace-1',
        requestId: 'request-1',
        sessionId: 'session-1',
        status: 'completed',
        title: 'Responder pergunta simples',
        updatedAt: '2026-04-26T12:03:00.000Z',
        modelProfile: {
          providerLabel: 'Gemini',
          modelLabel: 'gemini-2.5-flash',
          routingPolicy: 'direct',
          routeId: 'gemini',
          familyId: 'gemini',
          selectionSource: 'current-config',
          readiness: 'ready',
          ready: true,
          fallbackOrder: ['gemini', 'openai'],
          selectionExplanation: ['Configuracao atual seleciona gemini/gemini-2.5-flash.'],
        },
        metadata: {
          modelPickerSelection: {
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
            explanation: ['Configuracao atual seleciona gemini/gemini-2.5-flash.'],
          },
          runBudget: {
            source: 'RunBudgetPolicy',
            degraded: false,
            estimatedCostUnits: 2,
            maxEstimatedCostUnits: 8,
            inputChars: 128,
            requestedToolCount: 1,
            exposedToolCount: 3,
          },
          providerRouteBudgetCorrelation: {
            source: 'AgentRunService',
            providerName: 'gemini',
            modelName: 'gemini-2.5-flash',
            routingPolicy: 'direct',
            fallbackUsed: false,
            modelPicker: {
              source: 'current-config',
              providerName: 'gemini',
              providerLabel: 'Gemini',
              modelName: 'gemini-2.5-flash',
              modelLabel: 'gemini-2.5-flash',
              routeId: 'gemini',
              readiness: 'ready',
              ready: true,
              fallbackOrder: ['gemini', 'openai'],
              explanation: ['Configuracao atual seleciona gemini/gemini-2.5-flash.'],
              matchedEffectiveProvider: true,
            },
            budget: {
              source: 'RunBudgetPolicy',
              degraded: false,
              estimatedCostUnits: 2,
              maxEstimatedCostUnits: 8,
              inputChars: 128,
              requestedToolCount: 1,
              exposedToolCount: 3,
            },
          },
        },
      },
    });

    expect(viewModel.agentRun).toEqual(expect.objectContaining({
      id: 'run-1',
      traceId: 'trace-1',
      requestId: 'request-1',
      sessionId: 'session-1',
      status: 'completed',
      providerLabel: 'Gemini',
      modelLabel: 'gemini-2.5-flash',
    }));
    expect(viewModel.budget).toEqual(expect.objectContaining({
      status: 'ok',
      source: 'RunBudgetPolicy',
      estimatedCostUnits: 2,
      maxEstimatedCostUnits: 8,
      inputChars: 128,
      requestedToolCount: 1,
      exposedToolCount: 3,
    }));
    expect(viewModel.modelProfile).toEqual(expect.objectContaining({
      providerLabel: 'Gemini',
      modelLabel: 'gemini-2.5-flash',
      routeId: 'gemini',
      familyId: 'gemini',
      selectionSource: 'current-config',
      readiness: 'ready',
      ready: true,
      fallbackOrder: ['gemini', 'openai'],
      selectionExplanation: ['Configuracao atual seleciona gemini/gemini-2.5-flash.'],
    }));
    expect(viewModel.agentRun?.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'agent-run-model-picker',
        title: 'Model Picker aplicado',
        status: 'done',
      }),
      expect.objectContaining({
        id: 'agent-run-budget',
        title: 'Budget do run calculado',
        status: 'done',
      }),
      expect.objectContaining({
        id: 'agent-run-route-budget',
        title: 'Rota e budget correlacionados',
        status: 'done',
      }),
    ]));
    expect(viewModel.runObservatory.runs).toEqual([
      expect.objectContaining({
        id: 'run-1',
        traceId: 'trace-1',
        requestId: 'request-1',
        sessionId: 'session-1',
        status: 'completed',
      }),
    ]);
  });

  it('publishes a safe agent trace contract for thinking, skills, tools, approvals and receipts', () => {
    const viewModel = buildZavorthControlZavorthControlViewModel({
      wsStatus: 'connected',
      effectiveSessionId: 'session-trace',
      agentRun: {
        id: 'run-trace',
        traceId: 'trace-visible',
        sessionId: 'session-trace',
        status: 'waiting_approval',
        title: 'Editar README',
        summary: 'Preparando alteracao governada.',
        events: [
          {
            id: 'event-thinking',
            kind: 'thinking',
            title: 'Thought for 1s',
            detail: 'Analisando o pedido e selecionando ferramentas seguras.',
            status: 'done',
          },
        ],
      },
      traceEvents: [
        {
          id: 'trace-skill',
          kind: 'skill.selected',
          skillName: 'workspace-edit',
          title: 'Selected skill',
          summary: 'O pedido exige editar arquivo dentro do workspace.',
          status: 'done',
        },
        {
          id: 'trace-tool',
          kind: 'tool.awaiting_approval',
          toolName: 'apply_patch',
          title: 'Waiting for approval',
          summary: 'Patch preparado; nenhuma escrita foi feita antes da aprovacao.',
          target: 'README.md',
          risk: 'attention',
          status: 'pending',
        },
        {
          id: 'trace-receipt',
          kind: 'receipt.recorded',
          title: 'Recorded receipt',
          summary: 'Receipt de preview anexado ao run.',
          status: 'done',
        },
      ],
    });

    expect(viewModel.trace).toEqual(expect.objectContaining({
      contractVersion: 'zavorth-agent-trace/v1',
      runId: 'run-trace',
      traceId: 'trace-visible',
      sessionId: 'session-trace',
      policy: expect.objectContaining({
        rawChainOfThoughtExposed: false,
        summariesOnly: true,
        toolCallsRequirePolicy: true,
      }),
    }));
    expect(viewModel.trace?.summary).toEqual(expect.objectContaining({
      skillCount: 1,
      toolCount: 1,
      approvalCount: 1,
      receiptCount: 1,
      capabilityCount: 2,
      approvalRequiredCapabilityCount: 2,
      hasPendingApproval: true,
    }));
    expect(viewModel.trace?.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'trace-skill',
        kind: 'skill.selected',
        chipLabel: 'workspace-edit',
        capability: expect.objectContaining({
          label: 'workspace-edit',
          kind: 'skill',
          requiresApproval: true,
          previewRequired: true,
          sideEffect: 'write',
          scope: 'runtime',
        }),
      }),
      expect.objectContaining({
        id: 'trace-tool',
        kind: 'tool.awaiting_approval',
        chipLabel: 'apply_patch',
        target: 'README.md',
        capability: expect.objectContaining({
          label: 'apply_patch',
          kind: 'file',
          risk: 'attention',
          requiresApproval: true,
          previewRequired: true,
          sideEffect: 'write',
          scope: 'README.md',
        }),
      }),
      expect.objectContaining({ id: 'trace-receipt', kind: 'receipt.recorded' }),
    ]));
    expect(viewModel.agentRun?.trace?.policy.rawChainOfThoughtExposed).toBe(false);
  });

  it('falls back honestly when there is no real data', () => {
    const viewModel = buildZavorthControlZavorthControlViewModel({
      wsStatus: 'disconnected',
    });

    expect(viewModel.runtime.status).toBe('offline');
    expect(viewModel.runtime.currentModelLabel).toBe('modelo nao informado');
    expect(viewModel.runtime.currentProviderLabel).toBe('provider nao informado');
    expect(viewModel.sessions).toHaveLength(0);
    expect(viewModel.messages).toHaveLength(0);
    expect(viewModel.artifacts).toHaveLength(0);
    expect(viewModel.memorySignals).toHaveLength(0);
    expect(viewModel.tasks).toHaveLength(0);
    expect(viewModel.runObservatory.runs).toHaveLength(0);
    expect(viewModel.approvals).toHaveLength(0);
    expect(viewModel.budget.status).toBe('unknown');
    expect(viewModel.replay.status).toBe('none');
    expect(viewModel.health.status).toBe('offline');
    expect(viewModel.releaseStatus.status).toBe('unknown');
    expect(viewModel.integrations).toHaveLength(0);
    expect(viewModel.identity.agentName).toBe('Zavorth');
    expect(viewModel.logs).toHaveLength(0);
    expect(viewModel.emptyState.subtitle).toContain('bloqueios');
  });
});
