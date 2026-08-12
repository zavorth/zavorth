import { WebAppRuntimeCanonicalStateService } from '../../src/domain/surface/presentation/web-app/WebAppRuntimeCanonicalStateService.js';
import type { WebAppRuntimeRouteDeps } from '../../src/domain/surface/presentation/web-app/WebAppRuntimeRouteService.js';

describe('WebAppRuntimeCanonicalStateService', () => {
  it('builds the canonical session bundle from gateway session tools without changing external shape', async () => {
    const service = new WebAppRuntimeCanonicalStateService();
    const deps: WebAppRuntimeRouteDeps = {
      runtime: {
        webUserId: 'telegram-admin',
      } as any,
      realtime: {
        getChatId: jest.fn(() => 'web:session-web-2'),
      } as any,
      runtimeGateway: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-16T12:00:00.000Z',
          summary: { sessionTargets: 2 },
        })),
      } as any,
      runtimeGatewaySessionTools: {
        buildDescriptors: jest.fn(() => [{ id: 'history.read' }]),
        listSessions: jest.fn(async () => [{ sessionId: 'session-web-2' }]),
        listSessionsSummary: jest.fn(() => ({ total: 1 })),
        readHistoryFast: jest.fn(() => ({
          sessionId: 'session-web-2',
          chatId: 'web:session-web-2',
          tasks: [{ task_id: 'task-1' }],
        })),
      } as any,
    } as any;

    const bundle = await service.buildCanonicalSessionBundle('session-web-2', deps, {
      includeSessionsList: true,
      historyMode: 'fast',
      includeGateway: true,
    });

    expect(bundle.gateway).toEqual(expect.objectContaining({
      summary: expect.objectContaining({
        sessionTargets: 2,
      }),
    }));
    expect(bundle.gatewaySessionTools).toEqual(expect.objectContaining({
      tools: [{ id: 'history.read' }],
      sessions: [{ sessionId: 'session-web-2' }],
      sessionsSummary: { total: 1 },
    }));
    expect(bundle.session).toEqual(expect.objectContaining({
      sessionId: 'session-web-2',
      chatId: 'web:session-web-2',
    }));
  });

  it('hydrates the canonical state payload with approvals, artifacts, resources, companions and selfmod planes', async () => {
    const service = new WebAppRuntimeCanonicalStateService();
    const payload = await service.buildCanonicalStatePayload(
      'session-web-1',
      {
        runtime: {
          webUserId: 'telegram-admin',
          permissionController: {
            resolvePermissionReference: jest.fn(),
          },
          taskManager: {
            getRecentTasksByChat: jest.fn(() => []),
          },
        } as any,
        realtime: {
          getChatId: jest.fn(() => 'web:session-web-1'),
          getResolvedSnapshot: jest.fn(async () => ({
            sessionId: 'session-web-1',
            chatId: 'web:session-web-1',
            permissions: [{ permission_id: 'perm-1', status: 'pending' }],
            toolRuns: [
              {
                runId: 'run-1',
                filesTouched: ['C:/repo/src/app.ts'],
                artifacts: [{ id: 'artifact-1', path: 'C:/repo/src/app.ts' }],
                diff: {
                  summary: 'Patch aplicado.',
                  patches: [{ path: 'C:/repo/src/app.ts', diff: '@@\n+ok\n', summary: null }],
                },
              },
            ],
          })),
          getSnapshot: jest.fn(() => null),
        } as any,
        agentGateway: {
          buildSnapshot: jest.fn((input: any) => ({
            generatedAt: '2026-04-26T16:30:00.000Z',
            source: {
              kind: 'universal-agent-runtime',
              label: 'Zavorth Agent Gateway',
            },
            activeRun: input.activeSessionId === 'session-web-1'
              ? {
                  id: 'agent-run-web-1',
                  sessionId: 'session-web-1',
                  status: 'running',
                  title: 'compare o que mudou',
                }
              : null,
            runs: [],
          })),
        } as any,
        runtimeGateway: null,
        runtimeSessionTools: null,
        sessionTools: null,
        runtimeGatewaySessionTools: null,
        auth: {} as any,
        accessReadiness: {} as any,
        accessManifest: {} as any,
        installJourney: {} as any,
        officialRemoteAccess: {} as any,
        remoteAccess: {} as any,
        surfaceConsistency: {} as any,
        consoleAssets: {} as any,
        buildMemoryPlaneSnapshot: jest.fn(async () => null),
        buildLayeredMemoryStatus: jest.fn(async () => null),
        buildLearningPlaneStatus: jest.fn(async () => null),
        buildLearningPlaneSnapshot: jest.fn(async () => null),
        buildLearningPlaneMetrics: jest.fn(async () => null),
        executeLearningAction: jest.fn(),
        searchLayeredMemory: jest.fn(async () => null),
        readLayeredMemoryProcedures: jest.fn(async () => null),
        readLayeredMemoryMetrics: jest.fn(async () => null),
        buildOpsQuality: jest.fn(async () => null),
        buildSessionPlaneSnapshot: jest.fn(async () => null),
        buildSessionPlaneStatusSummary: jest.fn(async () => null),
        processChatSend: jest.fn(),
        resolveSessionId: jest.fn(() => 'session-web-1'),
        resolveSessionIdFromPermission: jest.fn(),
        resolveSessionIdFromTask: jest.fn(),
        createWebContext: jest.fn(),
        openEventStream: jest.fn(),
        writeJson: jest.fn(),
        readJsonBody: jest.fn(),
        getComposerCatalog: jest.fn(),
        getGatewaySessionTools: jest.fn(),
        capabilityLifecycle: {
          buildSnapshot: jest.fn(() => ({
            profile: 'core',
            capabilities: [{ id: 'watch-mode', state: 'dormant' }],
            commands: {},
            summary: {
              total: 1,
              builtinCapabilities: 1,
              registeredCommands: 0,
              active: 0,
              dormant: 1,
              requiringApproval: 1,
            },
          })),
        } as any,
        selfModification: {
          createPreview: jest.fn(),
          createGoalPreview: jest.fn(),
          applyPreview: jest.fn(),
          rollbackChangeSet: jest.fn(),
        } as any,
        mutationPlane: {
          listPlans: jest.fn(() => [{
            id: 'plan-selfmod-1',
            domain: 'selfmod',
            actionId: 'apply',
            status: 'waiting_approval',
            title: 'Apply selfmod',
            summary: 'Aplicar preview',
            updatedAt: '2026-04-13T10:00:00.000Z',
            approval: { permissionId: 'perm-2', status: 'pending' },
            payload: { previewId: 'preview-1', sessionId: 'session-web-1' },
          }]),
        } as any,
        desktopResources: {
          inspectLive: jest.fn(async () => ({
            generatedAt: '2026-04-14T19:00:00.000Z',
            host: {
              totalVisibleMemoryMb: 8192,
              usedPhysicalMemoryMb: 4096,
              pressure: 'moderate',
            },
            signals: {},
            totals: {},
            groups: [{ id: 'zavorth', label: 'Zavorth', metrics: { workingSetMb: 180 }, pressure: 'moderate' }],
            topConsumers: [{ id: 'codex', label: 'Codex', metrics: { workingSetMb: 512 }, owner: 'companion' }],
            recommendedActions: [{
              actionId: 'inspect',
              label: 'Inspecionar companions',
              description: 'Revise quem esta pesando memoria agora.',
              safety: 'safe',
              requiresApproval: false,
              controlId: 'codex-companion',
            }],
            warnings: ['Host em pressao moderada.'],
            recommendations: ['Revise companions ativos antes de subir mais packs.'],
          })),
        } as any,
        companions: {
          buildSnapshot: jest.fn(async () => ({
            generatedAt: '2026-04-14T19:00:00.000Z',
            companions: [{
              id: 'docker-desktop',
              label: 'Docker Desktop',
              status: 'idle',
              pressure: 'moderate',
              workingSetMb: 220,
              processCount: 2,
              summary: 'Docker Desktop ocioso.',
              details: [],
              activeWindowTitles: [],
              runningContainerCount: 0,
              runningDistros: [],
              actions: [{
                actionId: 'stop-idle',
                label: 'Desligar idle',
                description: 'Desliga Docker Desktop quando nao ha container rodando.',
                safety: 'safe',
                requiresApproval: false,
                available: true,
                reason: 'Nao ha containers.',
                command: null,
              }],
            }],
            warnings: ['Docker Desktop segue carregado mesmo sem containers.'],
            recommendations: ['Desligue Docker Desktop se nao houver stack ativa.'],
          })),
        } as any,
      } as any,
      {
        historyMode: 'none',
        sessionPlaneMode: 'none',
        snapshotMode: 'resolved',
        includeGateway: false,
      },
    );

    expect(payload.approvalPlane).toEqual(expect.objectContaining({
      sessionId: 'session-web-1',
      pending: expect.any(Array),
    }));
    expect(payload.agentRuntime).toEqual(expect.objectContaining({
      source: expect.objectContaining({
        kind: 'universal-agent-runtime',
      }),
      activeRun: expect.objectContaining({
        id: 'agent-run-web-1',
        sessionId: 'session-web-1',
      }),
    }));
    expect((payload.agentRuntime as any)?.activeRun?.id).toBe('agent-run-web-1');
    expect(payload.capabilityPlane).toEqual(expect.objectContaining({
      sessionId: 'session-web-1',
      capabilities: expect.arrayContaining([
        expect.objectContaining({ id: 'watch-mode' }),
      ]),
    }));
    expect(payload.artifactPlane).toEqual(expect.objectContaining({
      sessionId: 'session-web-1',
      artifacts: expect.arrayContaining([
        expect.objectContaining({ id: 'artifact-1' }),
      ]),
    }));
    expect(payload.selfmodPlane).toEqual(expect.objectContaining({
      sessionId: 'session-web-1',
      recentPlans: expect.arrayContaining([
        expect.objectContaining({ id: 'plan-selfmod-1' }),
      ]),
    }));
    expect(payload.resourcePlane).toEqual(expect.objectContaining({
      status: 'moderate',
      topConsumers: expect.arrayContaining([
        expect.objectContaining({ label: 'Codex' }),
      ]),
    }));
    expect(payload.companionPlane).toEqual(expect.objectContaining({
      companions: expect.arrayContaining([
        expect.objectContaining({ id: 'docker-desktop' }),
      ]),
    }));
    expect(payload.uiSurfaceHints).toEqual(expect.objectContaining({
      primarySurface: 'control',
      recommendedExternalChannel: 'telegram',
      visibleSurfaces: expect.arrayContaining(['control', 'telegram']),
    }));
    expect(payload.runtimeWarnings).toEqual(expect.arrayContaining([
      'Host em pressao moderada.',
      expect.stringContaining('selfmod plan'),
    ]));
    expect(payload.actionRecommendations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        plane: 'resources',
        label: 'Inspecionar companions',
      }),
      expect.objectContaining({
        plane: 'companions',
        controlId: 'docker-desktop',
      }),
    ]));
  });

  it('passes direct Run Observatory queries to the agent gateway without forcing the active session', async () => {
    const service = new WebAppRuntimeCanonicalStateService();
    const buildSnapshot = jest.fn((input: Record<string, any>) => ({
      generatedAt: '2026-04-26T16:30:00.000Z',
      source: {
        kind: 'universal-agent-runtime',
        label: 'Zavorth Agent Gateway',
      },
      activeRun: input.activeTraceId
        ? {
            id: 'agent-run-trace-7',
            traceId: input.activeTraceId,
            sessionId: 'session-other',
            status: input.runStatus,
          }
        : null,
      runs: [],
      runObservatory: {
        generatedAt: '2026-04-26T16:30:00.000Z',
        query: {
          traceId: input.activeTraceId || null,
          sessionId: input.activeSessionId || null,
          status: input.runStatus || null,
          limit: input.runLimit || null,
        },
        totalRuns: 1,
        matchedRuns: 1,
        indexes: {
          runIds: ['agent-run-trace-7'],
          traceIds: ['trace-7'],
          sessionIds: ['session-other'],
          statuses: [{ status: 'failed', count: 1 }],
        },
        runs: [],
      },
    }));

    const payload = await service.buildCanonicalStatePayload(
      'session-web-1',
      {
        runtime: {
          webUserId: 'telegram-admin',
        } as any,
        realtime: {
          getChatId: jest.fn(() => 'web:session-web-1'),
          getSnapshot: jest.fn(() => ({
            sessionId: 'session-web-1',
            chatId: 'web:session-web-1',
          })),
        } as any,
        agentGateway: {
          buildSnapshot,
        } as any,
        runtimeGateway: null,
        runtimeGatewaySessionTools: null,
        buildMemoryPlaneSnapshot: jest.fn(async () => null),
      } as any,
      {
        historyMode: 'none',
        sessionPlaneMode: 'none',
        snapshotMode: 'cached',
        includeGateway: false,
        includeMemoryRecall: false,
        includeApprovalPlane: false,
        includeCapabilityPlane: false,
        includeArtifactPlane: false,
        includeSelfmodPlane: false,
        includeResourcePlane: false,
        includeCompanionPlane: false,
        includeModeEscalation: false,
        agentRunQuery: {
          activeTraceId: 'trace-7',
          runStatus: 'failed',
          runLimit: 5,
        },
      },
    );

    expect(buildSnapshot).toHaveBeenCalledWith({
      activeTraceId: 'trace-7',
      runStatus: 'failed',
      runLimit: 5,
      activeSessionId: null,
    });
    expect(payload.agentRuntime).toEqual(expect.objectContaining({
      activeRun: expect.objectContaining({
        id: 'agent-run-trace-7',
        traceId: 'trace-7',
      }),
      runObservatory: expect.objectContaining({
        query: expect.objectContaining({
          traceId: 'trace-7',
          sessionId: null,
          status: 'failed',
          limit: 5,
        }),
      }),
    }));
  });
});

