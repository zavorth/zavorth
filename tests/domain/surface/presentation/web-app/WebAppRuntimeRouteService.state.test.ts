import * as http from 'http';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { WebAppRuntimeRouteService, type WebAppRuntimeRouteDeps } from '../../../../../src/domain/surface/presentation/web-app/WebAppRuntimeRouteService.js';

describe('WebAppRuntimeRouteService', () => {
  it('serves a lightweight canonical state payload for the web shell bootstrap', async () => {
    const routeService = new WebAppRuntimeRouteService();
    const writeJson = jest.fn();
    const req = { method: 'GET' } as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    const sessionId = 'session-web-1';
    const chatId = 'web:session-web-1';
    const url = new URL(`http://localhost/api/web/state?sessionId=${encodeURIComponent(sessionId)}`);

    const deps: WebAppRuntimeRouteDeps = {
      auth: {} as any,
      accessReadiness: {} as any,
      accessManifest: {} as any,
      installJourney: {} as any,
      officialRemoteAccess: {
        inspect: jest.fn(),
        runAction: jest.fn(),
      } as any,
      remoteAccess: {
        inspect: jest.fn(),
      } as any,
      surfaceParity: {} as any,
      consoleAssets: {} as any,
      runtime: {
        webUserId: 'telegram-admin',
      } as any,
      realtime: {
        getChatId: jest.fn(() => chatId),
        getSnapshot: jest.fn(() => ({
          sessionId,
          chatId,
          tasks: [{ task_id: 'task-1' }, { task_id: 'task-2' }],
          permissions: [{ permission_id: 'perm-1', status: 'pending' }],
          continuity: {
            principalId: 'telegram-admin',
          },
        })),
        getResolvedSnapshot: jest.fn(async () => ({
          sessionId,
          chatId,
          tasks: [{ task_id: 'task-1' }, { task_id: 'task-2' }],
          permissions: [{ permission_id: 'perm-1', status: 'pending' }],
          toolRuns: [
            {
              runId: 'task-task-1-01-apply-patch',
              toolName: 'apply_patch',
              filesTouched: ['C:/repo/src/app.ts'],
              artifacts: [{ id: 'artifact-1', name: 'patch.diff' }],
              diff: {
                summary: 'Patch aplicado.',
                patches: [{ path: 'C:/repo/src/app.ts', diff: '@@\\n+ok\\n', summary: null }],
              },
            },
          ],
          continuity: {
            principalId: 'telegram-admin',
          },
        })),
      } as any,
      gatewayRuntime: null,
      runtimeGateway: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-05T12:00:00.000Z',
          summary: {
            sessionTargets: 3,
            channelsReady: 2,
          },
          narrative: {
            headline: 'Gateway pronto.',
            operatorSummary: 'Resumo do gateway.',
          },
          memoryPlane: {
            generatedAt: '2026-04-05T12:00:00.000Z',
            summary: {
              artifacts: 2,
            },
            narrative: {
              headline: 'Memory, Replay & Artifacts',
              operatorSummary: 'Resumo enxuto do memory plane.',
            },
          },
          controlPlane: {
            generatedAt: '2026-04-05T12:00:00.000Z',
            summary: {
              toolFamilies: 4,
              remoteTransportsReady: 1,
            },
            narrative: {
              headline: 'Control plane',
              operatorSummary: 'Resumo enxuto do control plane.',
            },
          },
        })),
      } as any,
      runtimeSessionTools: null,
      sessionTools: null,
      runtimeGatewaySessionTools: {
        readHistoryFast: jest.fn(() => ({
          generatedAt: '2026-04-05T12:00:00.000Z',
          sessionId,
          chatId,
          platform: 'web',
          runtimeUserId: 'telegram-admin',
          sourceUserId: sessionId,
          continuity: {
            principalId: 'telegram-admin',
          },
          tasks: [{ task_id: 'task-1' }],
          permissions: [{ permission_id: 'perm-1' }],
        })),
      } as any,
      buildMemoryPlaneSnapshot: jest.fn(async () => null),
      buildLayeredMemoryStatus: jest.fn(async () => null),
      buildLearningPlaneStatus: jest.fn(async () => null),
      buildLearningPlaneSnapshot: jest.fn(async () => null),
      buildLearningPlaneMetrics: jest.fn(async () => null),
      executeLearningAction: jest.fn(),
      searchLayeredMemory: jest.fn(async () => null),
      readLayeredMemoryProcedures: jest.fn(async () => null),
      readLayeredMemoryMetrics: jest.fn(async () => null),
      hybridMemory: {
        previewRecall: jest.fn(async () => ({
          ok: true,
          contractVersion: 'hybrid-memory-v1',
          generatedAt: '2026-04-14T12:00:00.000Z',
          sessionId,
          query: '',
          mode: 'ledger_only',
          embeddingStatus: 'not_requested',
          budget: {
            topK: 5,
            contextTokenBudget: 2000,
            estimatedTokens: 0,
          },
          summary: {
            total: 0,
            ledger: 0,
            recall: 0,
            returned: 0,
            ledgerAuthoritative: true,
          },
          sources: [],
          context: '',
          warnings: [],
          commands: {
            preview: 'memory.recall.preview',
            sources: 'memory.sources.list',
            httpPreview: '/api/web/memory/recall',
            httpSources: '/api/web/memory/sources',
          },
        })),
        listSources: jest.fn(),
      },
      buildOpsQuality: jest.fn(async () => null),
      buildSessionPlaneSnapshot: jest.fn(async () => null),
      buildSessionPlaneStatusSummary: jest.fn(async () => ({
        generatedAt: '2026-04-05T12:00:00.000Z',
        summary: {
          sessions: 3,
          historyItems: 2,
          sendReady: true,
          spawnReady: true,
        },
        narrative: {
          headline: 'Session plane',
          operatorSummary: 'Resumo enxuto da sessao.',
        },
      })),
      processChatSend: jest.fn(),
      resolveSessionId: jest.fn(() => sessionId),
      resolveSessionIdFromPermission: jest.fn(),
      resolveSessionIdFromTask: jest.fn(),
      createWebContext: jest.fn(),
      openEventStream: jest.fn(),
      writeJson,
      readJsonBody: jest.fn(),
      getComposerCatalog: jest.fn(),
      getGatewaySessionTools: jest.fn(),
      capabilityLifecycle: {
        buildProductModeSnapshot: jest.fn(() => ({
          id: 'builder',
          label: 'Zavorth Builder',
          summary: 'Modo builder.',
          description: 'Builder',
          defaultRuntimeProfile: 'core',
          runtimeProfile: 'core',
          profileAligned: true,
          visibleSurfaces: ['chat', 'tool-cards'],
          hiddenByDefault: ['companions'],
          escalationTargets: ['operator'],
          commands: {
            show: '/mode',
            set: '/mode <chat|assistant|builder|operator>',
            cliStatus: 'npm run mode:status',
            cliSet: 'npm run mode:use -- <chat|assistant|builder|operator>',
          },
        })),
      } as any,
    };

    const handled = await routeService.handleRequest(req, res, url, '/api/web/state', deps);

    expect(handled).toBe(true);
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        productMode: expect.objectContaining({
          id: 'builder',
          runtimeProfile: 'core',
        }),
        uiSurfaceHints: expect.objectContaining({
          primarySurface: 'control',
          recommendedExternalChannel: 'telegram',
        }),
        snapshot: expect.objectContaining({
          sessionId,
          chatId,
          continuity: expect.anything(),
          taskCount: 2,
          toolRunCount: 1,
          toolRuns: expect.arrayContaining([
            expect.objectContaining({
              runId: 'task-task-1-01-apply-patch',
              toolName: 'apply_patch',
            }),
          ]),
          filesTouched: ['C:/repo/src/app.ts'],
          pendingPermissions: 1,
        }),
        gateway: expect.objectContaining({
          summary: expect.objectContaining({
            sessionTargets: 3,
          }),
        }),
        session: expect.objectContaining({
          chatId,
          continuity: expect.anything(),
          tasksCount: 1,
          permissionsCount: 1,
        }),
        memoryPlane: expect.objectContaining({
          narrative: expect.objectContaining({
            headline: 'Memory, Replay & Artifacts',
          }),
        }),
        memoryRecall: expect.objectContaining({
          contractVersion: 'hybrid-memory-v1',
          mode: 'ledger_only',
        }),
        controlPlane: expect.objectContaining({
          summary: expect.objectContaining({
            toolFamilies: 4,
          }),
        }),
        sessionPlane: expect.objectContaining({
          summary: expect.objectContaining({
            sessions: 3,
            sendReady: true,
            spawnReady: true,
          }),
        }),
      }),
      200,
    );
  });

  it('serves hybrid memory recall and source inventory through canonical memory routes', async () => {
    const routeService = new WebAppRuntimeRouteService();
    const writeJson = jest.fn();
    const req = { method: 'GET' } as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    const sessionId = 'session-web-1';
    const previewRecall = jest.fn(async (input) => ({
      ok: true,
      contractVersion: 'hybrid-memory-v1',
      generatedAt: '2026-04-14T12:00:00.000Z',
      sessionId: input.sessionId,
      query: input.query,
      mode: 'hybrid',
      embeddingStatus: 'ready',
      budget: {
        topK: input.limit,
        contextTokenBudget: 2000,
        estimatedTokens: 18,
      },
      summary: {
        total: 2,
        ledger: 1,
        recall: 1,
        returned: 2,
        ledgerAuthoritative: true,
      },
      sources: [
        {
          id: 'ledger:session',
          type: 'ledger',
          kind: 'session',
          label: 'Gateway ledger',
          summary: 'Sessao canonica.',
          source: 'memory-plane',
          score: 0.9,
          reason: 'Ledger factual.',
          lastValidatedAt: null,
          metadata: {},
        },
      ],
      context: '- [ledger/session] Gateway ledger: Sessao canonica.',
      warnings: [],
      commands: {
        preview: 'memory.recall.preview',
        sources: 'memory.sources.list',
        httpPreview: '/api/web/memory/recall',
        httpSources: '/api/web/memory/sources',
      },
    }));
    const listSources = jest.fn(async (input) => ({
      ok: true,
      contractVersion: 'hybrid-memory-v1',
      generatedAt: '2026-04-14T12:00:00.000Z',
      sessionId: input.sessionId,
      sources: [
        {
          id: 'ledger:session',
          type: 'ledger',
          kind: 'session',
          label: 'Session ledger',
          status: 'available',
          count: 1,
          reason: 'Fonte factual.',
        },
      ],
      warnings: [],
    }));
    const deps = {
      runtime: { webUserId: 'telegram-admin' },
      realtime: { getChatId: jest.fn(() => `web:${sessionId}`) },
      resolveSessionId: jest.fn(() => sessionId),
      writeJson,
      hybridMemory: {
        previewRecall,
        listSources,
      },
    } as any;

    const handledRecall = await routeService.handleRequest(
      req,
      res,
      new URL(`http://localhost/api/web/memory/recall?sessionId=${sessionId}&q=gateway&limit=3`),
      '/api/web/memory/recall',
      deps,
    );
    const handledSources = await routeService.handleRequest(
      req,
      res,
      new URL(`http://localhost/api/web/memory/sources?sessionId=${sessionId}`),
      '/api/web/memory/sources',
      deps,
    );

    expect(handledRecall).toBe(true);
    expect(handledSources).toBe(true);
    expect(previewRecall).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId,
        query: 'gateway',
        limit: 3,
      }),
    );
    expect(listSources).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId,
      }),
    );
    expect(writeJson).toHaveBeenNthCalledWith(
      1,
      res,
      expect.objectContaining({
        contractVersion: 'hybrid-memory-v1',
        mode: 'hybrid',
      }),
      200,
    );
    expect(writeJson).toHaveBeenNthCalledWith(
      2,
      res,
      expect.objectContaining({
        contractVersion: 'hybrid-memory-v1',
        sources: expect.arrayContaining([
          expect.objectContaining({ id: 'ledger:session' }),
        ]),
      }),
      200,
    );
  });

  it('serves tool run cards and diff payloads for the session artifact plane', async () => {
    const routeService = new WebAppRuntimeRouteService();
    const writeJson = jest.fn();
    const req = { method: 'GET' } as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    const sessionId = 'session-web-1';
    const toolRun = {
      runId: 'task-task-1-01-apply-patch',
      toolName: 'apply_patch',
      filesTouched: ['C:/repo/src/app.ts'],
      artifacts: [{ id: 'artifact-1', name: 'patch.diff' }],
      diff: {
        summary: 'Patch aplicado.',
        patches: [{ path: 'C:/repo/src/app.ts', diff: '@@\\n+ok\\n', summary: null }],
      },
    };
    const deps = {
      realtime: {
        getResolvedSnapshot: jest.fn(async () => ({
          sessionId,
          chatId: `web:${sessionId}`,
          toolRuns: [toolRun],
        })),
      },
      resolveSessionId: jest.fn(() => sessionId),
      writeJson,
    } as any;

    const handledList = await routeService.handleRequest(
      req,
      res,
      new URL(`http://localhost/api/web/tool-runs?sessionId=${sessionId}`),
      '/api/web/tool-runs',
      deps,
    );
    const handledDiff = await routeService.handleRequest(
      req,
      res,
      new URL(`http://localhost/api/web/tool-runs/${encodeURIComponent(toolRun.runId)}/diff?sessionId=${sessionId}`),
      `/api/web/tool-runs/${encodeURIComponent(toolRun.runId)}/diff`,
      deps,
    );

    expect(handledList).toBe(true);
    expect(handledDiff).toBe(true);
    expect(writeJson).toHaveBeenNthCalledWith(
      1,
      res,
      expect.objectContaining({
        ok: true,
        toolRuns: [toolRun],
        filesTouched: ['C:/repo/src/app.ts'],
        artifacts: [expect.objectContaining({ id: 'artifact-1' })],
      }),
      200,
    );
    expect(writeJson).toHaveBeenNthCalledWith(
      2,
      res,
      expect.objectContaining({
        ok: true,
        runId: toolRun.runId,
        diff: expect.objectContaining({
          patches: expect.arrayContaining([
            expect.objectContaining({ path: 'C:/repo/src/app.ts' }),
          ]),
        }),
      }),
      200,
    );
  });

  it('serves the desktop resource plane through the runtime resources route', async () => {
    const routeService = new WebAppRuntimeRouteService();
    const writeJson = jest.fn();
    const req = { method: 'GET' } as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    const snapshot = {
      generatedAt: '2026-04-14T14:05:00.000Z',
      host: {
        pressure: 'high',
      },
      groups: [
        {
          id: 'docker-desktop',
          label: 'Docker Desktop',
          metrics: { workingSetMb: 320 },
        },
      ],
    };

    const handled = await routeService.handleRequest(
      req,
      res,
      new URL('http://localhost/api/web/runtime/resources'),
      '/api/web/runtime/resources',
      {
        desktopResources: {
          inspectLive: jest.fn(async () => snapshot),
        },
        writeJson,
      } as any,
    );

    expect(handled).toBe(true);
    expect(writeJson).toHaveBeenCalledWith(
      res,
      {
        ok: true,
        snapshot,
      },
      200,
    );
  });

  it('serves and mutates the product mode through the runtime mode route', async () => {
    const routeService = new WebAppRuntimeRouteService();
    const writeJson = jest.fn();
    const readJsonBody = jest.fn(async () => ({ mode: 'operator' }));
    const buildProductModeSnapshot = jest
      .fn()
      .mockReturnValueOnce({
        id: 'builder',
        label: 'Zavorth Builder',
        summary: 'Modo builder.',
        description: 'Builder',
        defaultRuntimeProfile: 'core',
        runtimeProfile: 'core',
        profileAligned: true,
        visibleSurfaces: ['chat', 'tool-cards'],
        hiddenByDefault: ['companions'],
        escalationTargets: ['operator'],
        commands: {
          show: '/mode',
          set: '/mode <chat|assistant|builder|operator>',
          cliStatus: 'npm run mode:status',
          cliSet: 'npm run mode:use -- <chat|assistant|builder|operator>',
        },
      })
      .mockReturnValueOnce({
        id: 'operator',
        label: 'Zavorth Operator',
        summary: 'Modo operator.',
        description: 'Operator',
        defaultRuntimeProfile: 'ops',
        runtimeProfile: 'ops',
        profileAligned: true,
        visibleSurfaces: ['chat', 'mesh'],
        hiddenByDefault: [],
        escalationTargets: [],
        commands: {
          show: '/mode',
          set: '/mode <chat|assistant|builder|operator>',
          cliStatus: 'npm run mode:status',
          cliSet: 'npm run mode:use -- <chat|assistant|builder|operator>',
        },
      });
    const setProductMode = jest.fn(() => buildProductModeSnapshot());

    const deps = {
      runtime: { webUserId: 'telegram-admin' },
      capabilityLifecycle: {
        buildProductModeSnapshot,
        setProductMode,
      },
      readJsonBody,
      writeJson,
    } as any;

    const handledGet = await routeService.handleRequest(
      { method: 'GET' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/runtime/mode'),
      '/api/web/runtime/mode',
      deps,
    );
    const handledPost = await routeService.handleRequest(
      { method: 'POST' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/runtime/mode'),
      '/api/web/runtime/mode',
      deps,
    );

    expect(handledGet).toBe(true);
    expect(handledPost).toBe(true);
    expect(setProductMode).toHaveBeenCalledWith('operator', 'telegram-admin');
    expect(writeJson).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        ok: true,
        productMode: expect.objectContaining({ id: 'builder' }),
      }),
      200,
    );
    expect(writeJson).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        ok: true,
        productMode: expect.objectContaining({ id: 'operator', runtimeProfile: 'ops' }),
      }),
      200,
    );
  });

  it('serves and resolves mode escalation through runtime routes', async () => {
    const routeService = new WebAppRuntimeRouteService();
    const writeJson = jest.fn();
    const readJsonBody = jest.fn(async () => ({
      requestId: 'mode-escalation-builder-1',
      decision: 'approve',
      scope: 'session',
    }));
    const buildSnapshot = jest.fn(() => ({
      generatedAt: '2026-04-14T18:00:00.000Z',
      sessionId: 'session-web-1',
      baseMode: { id: 'chat' },
      effectiveMode: { id: 'chat' },
      status: 'pending',
      activeGrants: [],
      pendingRequest: { id: 'mode-escalation-builder-1' },
      recentRequests: [],
      commands: {
        show: '/mode',
        approve: '/mode approve <requestId> [once|session|host]',
        reject: '/mode reject <requestId>',
        inspect: '/api/web/runtime/mode-escalation?sessionId=:id',
        resolve: '/api/web/runtime/mode-escalation/resolve',
      },
    }));
    const resolveRequest = jest.fn(() => ({
      ok: true,
      decision: 'approve',
      request: { id: 'mode-escalation-builder-1' },
      grant: { scope: 'session', targetMode: 'builder' },
      snapshot: {
        generatedAt: '2026-04-14T18:01:00.000Z',
        sessionId: 'session-web-1',
        baseMode: { id: 'chat' },
        effectiveMode: { id: 'builder' },
        status: 'elevated',
        activeGrants: [{ targetMode: 'builder', scope: 'session' }],
        pendingRequest: null,
        recentRequests: [],
        commands: {
          show: '/mode',
          approve: '/mode approve <requestId> [once|session|host]',
          reject: '/mode reject <requestId>',
          inspect: '/api/web/runtime/mode-escalation?sessionId=:id',
          resolve: '/api/web/runtime/mode-escalation/resolve',
        },
      },
      summary: 'Escalonamento aprovado.',
    }));
    const deps = {
      runtime: { webUserId: 'telegram-admin' },
      resolveSessionId: jest.fn(() => 'session-web-1'),
      realtime: { createSession: jest.fn(() => 'session-web-1') },
      modeEscalation: {
        buildSnapshot,
        resolveRequest,
      },
      readJsonBody,
      writeJson,
    } as any;

    const handledGet = await routeService.handleRequest(
      { method: 'GET' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/runtime/mode-escalation?sessionId=session-web-1'),
      '/api/web/runtime/mode-escalation',
      deps,
    );
    const handledPost = await routeService.handleRequest(
      { method: 'POST' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/runtime/mode-escalation/resolve'),
      '/api/web/runtime/mode-escalation/resolve',
      deps,
    );

    expect(handledGet).toBe(true);
    expect(handledPost).toBe(true);
    expect(buildSnapshot).toHaveBeenCalledWith('session-web-1');
    expect(resolveRequest).toHaveBeenCalledWith({
      requestId: 'mode-escalation-builder-1',
      decision: 'approve',
      scope: 'session',
      requestedBy: 'telegram-admin',
    });
    expect(writeJson).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        ok: true,
        modeEscalation: expect.objectContaining({
          sessionId: 'session-web-1',
        }),
      }),
      200,
    );
    expect(writeJson).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        ok: true,
        decision: 'approve',
        summary: 'Escalonamento aprovado.',
      }),
      200,
    );
  });

  it('serves the companion control plane and actions through runtime companion routes', async () => {
    const routeService = new WebAppRuntimeRouteService();
    const writeJson = jest.fn();
    const req = { method: 'GET' } as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    const snapshot = {
      generatedAt: '2026-04-14T15:05:00.000Z',
      companions: [{ id: 'docker-desktop', status: 'idle' }],
    };
    const companion = {
      id: 'docker-desktop',
      status: 'idle',
      summary: 'Docker Desktop ativo e ocioso.',
    };
    const result = {
      ok: true,
      companionId: 'docker-desktop',
      actionId: 'stop-idle',
      requiresApproval: false,
      executed: true,
      summary: 'Docker Desktop encerrado com sucesso.',
    };
    const readJsonBody = jest.fn(async () => ({
      actionId: 'stop-idle',
      requestedBy: 'telegram-admin',
    }));

    const deps = {
      runtime: { webUserId: 'telegram-admin' },
      companions: {
        buildSnapshot: jest.fn(async () => snapshot),
        inspectCompanion: jest.fn(async () => companion),
        executeAction: jest.fn(async () => result),
      },
      readJsonBody,
      writeJson,
    } as any;

    const handledList = await routeService.handleRequest(
      req,
      res,
      new URL('http://localhost/api/web/runtime/companions'),
      '/api/web/runtime/companions',
      deps,
    );
    const handledInspect = await routeService.handleRequest(
      req,
      res,
      new URL('http://localhost/api/web/runtime/companions/docker-desktop'),
      '/api/web/runtime/companions/docker-desktop',
      deps,
    );
    const handledAction = await routeService.handleRequest(
      { method: 'POST' } as http.IncomingMessage,
      res,
      new URL('http://localhost/api/web/runtime/companions/docker-desktop/actions'),
      '/api/web/runtime/companions/docker-desktop/actions',
      deps,
    );

    expect(handledList).toBe(true);
    expect(handledInspect).toBe(true);
    expect(handledAction).toBe(true);
    expect(writeJson).toHaveBeenNthCalledWith(1, res, { ok: true, snapshot }, 200);
    expect(writeJson).toHaveBeenNthCalledWith(2, res, { ok: true, companion }, 200);
    expect(writeJson).toHaveBeenNthCalledWith(3, res, { ok: true, result }, 200);
  });

  it('serves workspace doctor and optimization preview/apply through runtime workspace routes', async () => {
    const routeService = new WebAppRuntimeRouteService();
    const writeJson = jest.fn();
    const res = {} as http.ServerResponse;
    const preview = {
      waitingApproval: true,
      blocked: false,
      mutationPlan: { id: 'plan-workspace-1' },
    };
    const result = {
      ok: true,
      applied: true,
      waitingApproval: false,
      blocked: false,
      mutationPlan: { id: 'plan-workspace-1' },
    };
    const readJsonBody = jest.fn()
      .mockResolvedValueOnce({
        presetId: 'zavorthBridge',
        workspaceRoot: process.cwd(),
      })
      .mockResolvedValueOnce({
        applyPlanId: 'plan-workspace-1',
      });
    const deps = {
      runtime: { webUserId: 'telegram-admin' },
      workspaceOptimizer: {
        buildLoadProfile: jest.fn(async () => ({
          workspaceName: 'Zavorth',
          pressure: 'moderate',
        })),
        previewOptimization: jest.fn(async () => preview),
        applyOptimization: jest.fn(async () => result),
      },
      readJsonBody,
      writeJson,
    } as any;

    const handledDoctor = await routeService.handleRequest(
      { method: 'GET' } as http.IncomingMessage,
      res,
      new URL('http://localhost/api/web/runtime/workspace/doctor'),
      '/api/web/runtime/workspace/doctor',
      deps,
    );
    const handledPreview = await routeService.handleRequest(
      { method: 'POST' } as http.IncomingMessage,
      res,
      new URL('http://localhost/api/web/runtime/workspace/optimize'),
      '/api/web/runtime/workspace/optimize',
      deps,
    );
    const handledApply = await routeService.handleRequest(
      { method: 'POST' } as http.IncomingMessage,
      res,
      new URL('http://localhost/api/web/runtime/workspace/optimize'),
      '/api/web/runtime/workspace/optimize',
      deps,
    );

    expect(handledDoctor).toBe(true);
    expect(handledPreview).toBe(true);
    expect(handledApply).toBe(true);
    expect(writeJson).toHaveBeenNthCalledWith(1, res, {
      ok: true,
      profile: expect.objectContaining({ workspaceName: 'Zavorth' }),
    }, 200);
    expect(writeJson).toHaveBeenNthCalledWith(2, res, { ok: true, preview }, 202);
    expect(writeJson).toHaveBeenNthCalledWith(3, res, { ok: true, result }, 200);
  });

  it('serves the authenticated remote access report for the web app host routes', async () => {
    const routeService = new WebAppRuntimeRouteService();
    const writeJson = jest.fn();
    const inspect = jest.fn(async () => ({
      generatedAt: '2026-04-06T10:00:00.000Z',
      summary: 'Acesso remoto oficial pronto.',
      official: {
        local: { ready: true, summary: 'Local pronto.' },
        remote: { ready: true, summary: 'Remoto pronto.' },
      },
      recommendedPathId: 'official-runtime-access',
      recommendedPathReason: 'Fluxo oficial pronto.',
      paths: [
        {
          id: 'official-runtime-access',
          label: 'Official runtime access',
          readiness: 'ready',
          summary: 'Use este caminho.',
        },
      ],
      nextSteps: ['Abra /app na URL oficial.'],
    }));
    const req = { method: 'GET' } as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    const url = new URL('http://localhost/api/web/host/remote-access');

    const deps: WebAppRuntimeRouteDeps = {
      auth: {} as any,
      accessReadiness: {} as any,
      accessManifest: {} as any,
      installJourney: {} as any,
      officialRemoteAccess: {
        inspect: jest.fn(),
        runAction: jest.fn(),
      } as any,
      remoteAccess: {
        inspect,
      } as any,
      surfaceParity: {} as any,
      consoleAssets: {} as any,
      runtime: {} as any,
      realtime: {} as any,
      gatewayRuntime: null,
      runtimeGateway: null,
      runtimeSessionTools: null,
      sessionTools: null,
      runtimeGatewaySessionTools: null,
      buildMemoryPlaneSnapshot: jest.fn(),
      buildLayeredMemoryStatus: jest.fn(async () => null),
      buildLearningPlaneStatus: jest.fn(),
      buildLearningPlaneSnapshot: jest.fn(),
      buildLearningPlaneMetrics: jest.fn(async () => null),
      executeLearningAction: jest.fn(),
      searchLayeredMemory: jest.fn(),
      readLayeredMemoryProcedures: jest.fn(),
      readLayeredMemoryMetrics: jest.fn(async () => null),
      buildOpsQuality: jest.fn(async () => null),
      buildSessionPlaneSnapshot: jest.fn(),
      buildSessionPlaneStatusSummary: jest.fn(),
      processChatSend: jest.fn(),
      resolveSessionId: jest.fn(),
      resolveSessionIdFromPermission: jest.fn(),
      resolveSessionIdFromTask: jest.fn(),
      createWebContext: jest.fn(),
      openEventStream: jest.fn(),
      writeJson,
      readJsonBody: jest.fn(),
      getComposerCatalog: jest.fn(),
      getGatewaySessionTools: jest.fn(),
    };

    const handled = await routeService.handleRequest(req, res, url, '/api/web/host/remote-access', deps);

    expect(handled).toBe(true);
    expect(inspect).toHaveBeenCalledTimes(1);
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        report: expect.objectContaining({
          summary: 'Acesso remoto oficial pronto.',
          recommendedPathId: 'official-runtime-access',
          paths: expect.arrayContaining([
            expect.objectContaining({
              id: 'official-runtime-access',
              readiness: 'ready',
            }),
          ]),
        }),
      }),
      200,
    );
  });

  it('serves the canonical gateway runtime snapshot for the web control plane', async () => {
    const routeService = new WebAppRuntimeRouteService();
    const writeJson = jest.fn();
    const req = { method: 'GET' } as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    const sessionId = 'session-runtime-1';
    const url = new URL(`http://localhost/api/web/gateway/runtime?sessionId=${encodeURIComponent(sessionId)}`);

    const deps: WebAppRuntimeRouteDeps = {
      auth: {} as any,
      accessReadiness: {} as any,
      accessManifest: {} as any,
      installJourney: {} as any,
      officialRemoteAccess: {
        inspect: jest.fn(),
        runAction: jest.fn(),
      } as any,
      remoteAccess: {
        inspect: jest.fn(),
      } as any,
      surfaceParity: {} as any,
      consoleAssets: {} as any,
      runtime: {
        webUserId: 'telegram-admin',
      } as any,
      realtime: {
        getChatId: jest.fn(() => `web:${sessionId}`),
      } as any,
      gatewayRuntime: {
        buildCanonicalSnapshot: jest.fn(async () => ({
          generatedAt: '2026-04-12T15:00:00.000Z',
          auth: {
            enabled: true,
            source: 'env',
            tokenFile: 'C:/tmp/token.txt',
          },
          health: {
            status: 'ready',
            runtimeAttached: true,
            operationsAttached: true,
            realtimeAttached: true,
            gatewayAvailable: true,
            sessionPlaneAvailable: true,
            authEnabled: true,
            gatewaySource: 'runtime',
            issues: [],
            summary: 'Gateway canÃ´nico pronto.',
          },
          sessionBus: {
            transport: 'sse',
            sessionsTracked: 1,
            listenersAttached: 1,
            activeSessionIds: [sessionId],
            pollIntervalMs: 2000,
          },
          gateway: {
            generatedAt: '2026-04-12T15:00:00.000Z',
            summary: {
              channelsReady: 2,
            },
            narrative: {
              headline: 'Gateway',
              operatorSummary: 'Gateway pronto.',
            },
          },
        })),
      } as any,
      runtimeGateway: null,
      runtimeSessionTools: null,
      sessionTools: null,
      runtimeGatewaySessionTools: null,
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
      resolveSessionId: jest.fn(() => sessionId),
      resolveSessionIdFromPermission: jest.fn(),
      resolveSessionIdFromTask: jest.fn(),
      createWebContext: jest.fn(),
      openEventStream: jest.fn(),
      writeJson,
      readJsonBody: jest.fn(),
      getComposerCatalog: jest.fn(),
      getGatewaySessionTools: jest.fn(),
    };

    const handled = await routeService.handleRequest(req, res, url, '/api/web/gateway/runtime', deps);

    expect(handled).toBe(true);
    expect(deps.gatewayRuntime?.buildCanonicalSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId,
        chatId: `web:${sessionId}`,
        userId: 'telegram-admin',
      }),
    );
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        runtime: expect.objectContaining({
          health: expect.objectContaining({
            status: 'ready',
            gatewaySource: 'runtime',
          }),
          sessionBus: expect.objectContaining({
            transport: 'sse',
          }),
        }),
      }),
      200,
    );
  });

});
