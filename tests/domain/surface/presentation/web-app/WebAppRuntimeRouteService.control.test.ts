import * as http from 'http';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { WebAppRuntimeRouteService, type WebAppRuntimeRouteDeps } from '../../../../../src/domain/surface/presentation/web-app/WebAppRuntimeRouteService.js';

describe('WebAppRuntimeRouteService', () => {
  it('serves protected learning and layered memory routes for the shell', async () => {
    const routeService = new WebAppRuntimeRouteService();
    const writeJson = jest.fn();
    const readJsonBody = jest.fn(async () => ({
      candidateId: 'candidate:wf-1',
      actionId: 'promote',
    }));
    const learningSnapshot = {
      generatedAt: '2026-04-09T18:00:00.000Z',
      summary: {
        total: 1,
        pending: 0,
        approved: 1,
        rejected: 0,
        promoted: 1,
        published: 0,
        quarantined: 0,
        highConfidence: 1,
      },
      candidates: [
        {
          id: 'candidate:wf-1',
          title: 'Ship playbook',
        },
      ],
      narrative: {
        headline: 'Learning pronto.',
        operatorSummary: '1 promovido.',
      },
    };
    const procedures = {
      generatedAt: '2026-04-09T18:00:00.000Z',
      total: 1,
      data: [
        {
          id: 'candidate:wf-1',
          label: 'Ship playbook',
          steps: ['Inspect runtime', 'Publish release'],
        },
      ],
    };
    const executeLearningAction = jest.fn(() => ({
      generatedAt: '2026-04-09T18:01:00.000Z',
      candidateId: 'candidate:wf-1',
      actionId: 'promote',
      status: 'applied',
      ok: true,
      summary: 'Candidate promovido.',
      details: ['trusted local'],
    }));
    const baseDeps: WebAppRuntimeRouteDeps = {
      auth: {} as any,
      accessReadiness: {} as any,
      accessManifest: {} as any,
      installJourney: {} as any,
      officialRemoteAccess: { inspect: jest.fn(), runAction: jest.fn() } as any,
      remoteAccess: { inspect: jest.fn() } as any,
      surfaceConsistency: {} as any,
      consoleAssets: {} as any,
      runtime: {} as any,
      realtime: {} as any,
      runtimeGateway: null,
      runtimeSessionTools: null,
      sessionTools: null,
      runtimeGatewaySessionTools: null,
      buildMemoryPlaneSnapshot: jest.fn(async () => null),
      buildLayeredMemoryStatus: jest.fn(async () => null),
      buildLearningPlaneStatus: jest.fn(async () => learningSnapshot),
      buildLearningPlaneSnapshot: jest.fn(async () => learningSnapshot),
      buildLearningPlaneMetrics: jest.fn(async () => ({
        generatedAt: '2026-04-09T18:00:00.000Z',
        summary: {
          totalCandidates: 1,
          acceptedRate: 1,
          rejectedRate: 0,
          promotedRate: 1,
          averageScore: 0.91,
        },
        counts: {
          pending: 0,
          approved: 1,
          rejected: 0,
          promoted: 1,
          published: 0,
          quarantined: 0,
          highConfidence: 1,
        },
      })),
      executeLearningAction,
      searchLayeredMemory: jest.fn(async () => ({
        generatedAt: '2026-04-09T18:00:00.000Z',
        query: 'ship',
        total: 1,
        data: [{ id: 'candidate:wf-1', label: 'Ship playbook' }],
      })),
      readLayeredMemoryProcedures: jest.fn(async () => procedures),
      readLayeredMemoryMetrics: jest.fn(async () => ({
        generatedAt: '2026-04-09T18:00:00.000Z',
        summary: {
          totalEntries: 3,
          episodic: 1,
          semantic: 1,
          procedural: 1,
          averageBudgetUsage: 0.22,
          pressure: 'ok',
        },
        budgets: {
          perLayer: 12,
          episodicUsage: 0.08,
          semanticUsage: 0.08,
          proceduralUsage: 0.5,
        },
        procedures: {
          total: 1,
          trustedLocal: 1,
          learnedDraft: 0,
          implicit: 0,
        },
      })),
      buildOpsQuality: jest.fn(async () => ({
        generatedAt: '2026-04-09T18:00:00.000Z',
        score: 0.89,
        healthy: true,
        summary: {
          recoveryState: 'ready',
          learningPending: 0,
          quarantinedItems: 0,
          memoryPressure: 'ok',
        },
        operations: {
          uptime: 123,
          components: {
            database: 'ok',
            eventBus: 'ok',
          },
        },
        learning: {
          totalCandidates: 1,
          acceptedRate: 1,
          rejectedRate: 0,
          promotedRate: 1,
          averageScore: 0.91,
          pending: 0,
          quarantined: 0,
        },
        memory: {
          totalEntries: 3,
          episodic: 1,
          semantic: 1,
          procedural: 1,
          averageBudgetUsage: 0.22,
          pressure: 'ok',
        },
        platform: {
          total: 2,
          trusted: 1,
          reviewPending: 0,
          quarantined: 0,
          learnedLocal: 1,
        },
      })),
      buildSessionPlaneSnapshot: jest.fn(async () => null),
      buildSessionPlaneStatusSummary: jest.fn(async () => null),
      processChatSend: jest.fn(),
      resolveSessionId: jest.fn(() => 'session-web-1'),
      resolveSessionIdFromPermission: jest.fn(),
      resolveSessionIdFromTask: jest.fn(),
      createWebContext: jest.fn(),
      openEventStream: jest.fn(),
      writeJson,
      readJsonBody,
      getComposerCatalog: jest.fn(),
      getGatewaySessionTools: jest.fn(),
    };

    const learningHandled = await routeService.handleRequest(
      { method: 'GET' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/learning'),
      '/api/web/learning',
      baseDeps,
    );
    const proceduresHandled = await routeService.handleRequest(
      { method: 'GET' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/memory/procedures'),
      '/api/web/memory/procedures',
      baseDeps,
    );
    const searchHandled = await routeService.handleRequest(
      { method: 'GET' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/memory/search?q=ship'),
      '/api/web/memory/search',
      baseDeps,
    );
    const learningMetricsHandled = await routeService.handleRequest(
      { method: 'GET' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/learning/metrics'),
      '/api/web/learning/metrics',
      baseDeps,
    );
    const memoryMetricsHandled = await routeService.handleRequest(
      { method: 'GET' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/memory/metrics'),
      '/api/web/memory/metrics',
      baseDeps,
    );
    const qualityHandled = await routeService.handleRequest(
      { method: 'GET' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/ops/quality'),
      '/api/web/ops/quality',
      baseDeps,
    );
    const actionHandled = await routeService.handleRequest(
      { method: 'POST' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/learning/actions'),
      '/api/web/learning/actions',
      baseDeps,
    );

    expect(learningHandled).toBe(true);
    expect(proceduresHandled).toBe(true);
    expect(searchHandled).toBe(true);
    expect(learningMetricsHandled).toBe(true);
    expect(memoryMetricsHandled).toBe(true);
    expect(qualityHandled).toBe(true);
    expect(actionHandled).toBe(true);
    expect(executeLearningAction).toHaveBeenCalledWith({
      candidateId: 'candidate:wf-1',
      actionId: 'promote',
    });
    expect(writeJson).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        ok: true,
        snapshot: expect.objectContaining({
          summary: expect.objectContaining({
            promoted: 1,
          }),
        }),
      }),
      200,
    );
    expect(writeJson).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        ok: true,
        procedures: expect.objectContaining({
          total: 1,
        }),
      }),
      200,
    );
    expect(writeJson).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        ok: true,
        search: expect.objectContaining({
          query: 'ship',
          total: 1,
        }),
      }),
      200,
    );
    expect(writeJson).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        ok: true,
        metrics: expect.objectContaining({
          summary: expect.objectContaining({
            totalCandidates: 1,
          }),
        }),
      }),
      200,
    );
    expect(writeJson).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        ok: true,
        metrics: expect.objectContaining({
          summary: expect.objectContaining({
            totalEntries: 3,
            pressure: 'ok',
          }),
        }),
      }),
      200,
    );
    expect(writeJson).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        ok: true,
        quality: expect.objectContaining({
          score: 0.89,
          summary: expect.objectContaining({
            recoveryState: 'ready',
          }),
        }),
      }),
      200,
    );
    expect(writeJson).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        ok: true,
        execution: expect.objectContaining({
          candidateId: 'candidate:wf-1',
          actionId: 'promote',
        }),
      }),
      200,
    );
  });

  it('executes the local install journey action route and returns refreshed host state', async () => {
    const routeService = new WebAppRuntimeRouteService();
    const writeJson = jest.fn();
    const installJourneyReport = {
      generatedAt: '2026-04-09T10:00:00.000Z',
      summary: 'Host oficial pronto.',
      manifest: {
        local: { ready: true, appUrl: 'http://127.0.0.1:33333/app' },
        remote: { ready: false, appUrl: null },
        auth: { authorizedHost: true },
      },
      phases: [
        { id: 'go', title: 'Atalho oficial', status: 'ready', summary: 'Tudo pronto.', command: null },
      ],
    };
    const runInstallJourney = jest.fn(async () => installJourneyReport);
    const inspectReadiness = jest.fn(async () => ({
      local: { ready: true, issues: [] },
    }));
    const inspectOfficialRemote = jest.fn(async () => ({
      summary: 'Remoto ainda pendente.',
      actions: {
        canVerify: true,
      },
    }));
    const inspectRemote = jest.fn(async () => ({
      summary: 'Sem remoto oficial ainda.',
    }));
    const req = { method: 'POST' } as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    const url = new URL('http://localhost/api/web/host/install-journey/actions');

    const deps: WebAppRuntimeRouteDeps = {
      auth: {
        getStatus: jest.fn(() => ({
          enabled: true,
          source: 'env',
          tokenFile: null,
        })),
      } as any,
      accessReadiness: {
        inspectLive: inspectReadiness,
      } as any,
      accessManifest: {
        buildManifestFromReadiness: jest.fn(() => installJourneyReport.manifest),
      } as any,
      installJourney: {
        run: runInstallJourney,
      } as any,
      officialRemoteAccess: {
        inspect: inspectOfficialRemote,
        runAction: jest.fn(),
      } as any,
      remoteAccess: {
        inspect: inspectRemote,
      } as any,
      surfaceConsistency: {} as any,
      consoleAssets: {} as any,
      runtime: {
        hostIdentityService: {
          getStatus: jest.fn(() => ({ authorized: true })),
        },
      } as any,
      realtime: {} as any,
      runtimeGateway: null,
      runtimeSessionTools: null,
      sessionTools: null,
      runtimeGatewaySessionTools: null,
      buildMemoryPlaneSnapshot: jest.fn(),
      buildLayeredMemoryStatus: jest.fn(async () => null),
      buildLearningPlaneStatus: jest.fn(async () => null),
      buildLearningPlaneSnapshot: jest.fn(async () => null),
      buildLearningPlaneMetrics: jest.fn(async () => null),
      executeLearningAction: jest.fn(),
      searchLayeredMemory: jest.fn(async () => null),
      readLayeredMemoryProcedures: jest.fn(async () => null),
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
      readJsonBody: jest.fn(async () => ({ action: 'go' })),
      getComposerCatalog: jest.fn(),
      getGatewaySessionTools: jest.fn(),
    };

    const handled = await routeService.handleRequest(
      req,
      res,
      url,
      '/api/web/host/install-journey/actions',
      deps,
    );

    expect(handled).toBe(true);
    expect(runInstallJourney).toHaveBeenNthCalledWith(1, expect.objectContaining({
      dryRun: false,
      requireMutableAccess: false,
    }));
    expect(runInstallJourney).toHaveBeenNthCalledWith(2, expect.objectContaining({
      dryRun: true,
      requireMutableAccess: false,
    }));
    expect(inspectOfficialRemote).toHaveBeenCalledWith(expect.objectContaining({
      dryRun: true,
      requireMutableAccess: false,
    }));
    expect(inspectRemote).toHaveBeenCalledTimes(1);
    expect(writeJson).toHaveBeenCalledTimes(1);
    expect(writeJson.mock.calls[0][0]).toBe(res);
    expect(writeJson.mock.calls[0][2]).toBe(200);
    expect(writeJson.mock.calls[0][1]).toEqual(expect.objectContaining({
      ok: true,
      action: 'go',
      report: expect.objectContaining({
        summary: 'Host oficial pronto.',
      }),
      readiness: expect.objectContaining({
        local: expect.objectContaining({
          ready: true,
        }),
      }),
      manifest: expect.objectContaining({
        local: expect.objectContaining({
          ready: true,
        }),
      }),
      installJourney: expect.objectContaining({
        summary: 'Host oficial pronto.',
      }),
      officialRemoteAccess: expect.objectContaining({
        summary: 'Remoto ainda pendente.',
      }),
    }));
  });

  it('rejects invalid local install journey actions', async () => {
    const routeService = new WebAppRuntimeRouteService();
    const writeJson = jest.fn();
    const req = { method: 'POST' } as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    const url = new URL('http://localhost/api/web/host/install-journey/actions');

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
      surfaceConsistency: {} as any,
      consoleAssets: {} as any,
      runtime: {} as any,
      realtime: {} as any,
      runtimeGateway: null,
      runtimeSessionTools: null,
      sessionTools: null,
      runtimeGatewaySessionTools: null,
      buildMemoryPlaneSnapshot: jest.fn(),
      buildLayeredMemoryStatus: jest.fn(async () => null),
      buildLearningPlaneStatus: jest.fn(async () => null),
      buildLearningPlaneSnapshot: jest.fn(async () => null),
      buildLearningPlaneMetrics: jest.fn(async () => null),
      executeLearningAction: jest.fn(),
      searchLayeredMemory: jest.fn(async () => null),
      readLayeredMemoryProcedures: jest.fn(async () => null),
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
      readJsonBody: jest.fn(async () => ({ action: 'unknown' })),
      getComposerCatalog: jest.fn(),
      getGatewaySessionTools: jest.fn(),
    };

    const handled = await routeService.handleRequest(
      req,
      res,
      url,
      '/api/web/host/install-journey/actions',
      deps,
    );

    expect(handled).toBe(true);
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: false,
        error: 'action obrigatoria.',
      }),
      400,
    );
  });

  it('injects contextual action consistency when the host consistency route receives a session id', async () => {
    const routeService = new WebAppRuntimeRouteService();
    const writeJson = jest.fn();
    const req = { method: 'GET' } as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    const sessionId = 'session-web-2';
    const url = new URL(`http://localhost/api/web/host/surface-consistency?sessionId=${encodeURIComponent(sessionId)}`);
    const consistencySnapshot = {
      generatedAt: '2026-04-06T12:00:00.000Z',
      summary: 'Paridade pronta.',
      surfaces: {
        web: { ready: true, summary: 'Web pronta.' },
        telegram: { ready: true, summary: 'Telegram pronto.' },
        discord: {
          enabled: true,
          commandExposure: 'operator',
          publicServerMode: false,
          slashReadyCount: 1,
          summary: 'Discord pronto.',
        },
      },
      counts: {
        total: 1,
        webReady: 1,
        telegramReady: 1,
        discordSlashReadyCount: 1,
      },
      actions: [
        {
          actionId: 'continue-latest-context:task-001',
          actionType: 'continue-latest-context',
        },
      ],
      recommended: [],
      commands: [],
    };
    const buildManifest = jest.fn(() => consistencySnapshot);
    const accessManifest = {
      recommendedPlan: {
        primaryAction: 'remote',
        primaryLabel: 'Fechar acesso remoto oficial',
        primarySummary: 'Continue o rollout remoto oficial.',
        primaryCommand: 'npm run ops:remote:go',
        openTarget: 'https://zavorth.example.com/app',
      },
      local: {
        appUrl: 'http://127.0.0.1:33333/app',
      },
      remote: {
        appUrl: 'https://zavorth.example.com/app',
      },
    };
    const getResolvedSnapshot = jest.fn(async () => ({
      sessionId,
      chatId: `web:${sessionId}`,
      continuity: {
        suggestedAction: {
          kind: 'resume-active',
          label: 'Continuar',
          reason: 'Ha um contexto recente para retomar.',
          prompt: 'Retome o briefing final no mesmo contexto.',
        },
        workspaceContext: {
          followupPrompt: 'Retome o briefing final no mesmo contexto.',
          recentArtifact: {
            name: 'briefing-final.md',
            path: 'artifacts/briefing-final.md',
            taskId: 'task-001',
          },
          activeFocus: {
            label: 'Finalizar briefing',
            reason: 'Ainda falta consolidar a versao final.',
            taskId: 'task-001',
          },
        },
      },
      tasks: [
        {
          task_id: 'task-001',
          artifacts: [
            {
              id: 'artifact-001',
              path: 'artifacts/briefing-final.md',
            },
          ],
        },
      ],
      permissions: [
        {
          permission_id: 'perm-001',
          task_id: 'task-001',
          status: 'pending',
        },
      ],
      workflowRuns: [
        {
          workflow_run_id: 'workflow-001',
          resume_stage: {
            id: 'delivery',
            label: 'Entrega final',
          },
        },
      ],
    }));

    const deps: WebAppRuntimeRouteDeps = {
      auth: {} as any,
      accessReadiness: {} as any,
      accessManifest: {
        buildManifest: jest.fn(async () => accessManifest),
      } as any,
      installJourney: {} as any,
      officialRemoteAccess: {
        inspect: jest.fn(),
        runAction: jest.fn(),
      } as any,
      remoteAccess: {
        inspect: jest.fn(),
      } as any,
      surfaceConsistency: {
        buildManifest,
      } as any,
      consoleAssets: {} as any,
      runtime: {} as any,
      realtime: {
        getResolvedSnapshot,
      } as any,
      runtimeGateway: null,
      runtimeSessionTools: null,
      sessionTools: null,
      runtimeGatewaySessionTools: null,
      buildMemoryPlaneSnapshot: jest.fn(),
      buildLayeredMemoryStatus: jest.fn(async () => null),
      buildLearningPlaneStatus: jest.fn(async () => null),
      buildLearningPlaneSnapshot: jest.fn(async () => null),
      buildLearningPlaneMetrics: jest.fn(async () => null),
      executeLearningAction: jest.fn(),
      searchLayeredMemory: jest.fn(async () => null),
      readLayeredMemoryProcedures: jest.fn(async () => null),
      readLayeredMemoryMetrics: jest.fn(async () => null),
      buildOpsQuality: jest.fn(async () => null),
      buildSessionPlaneSnapshot: jest.fn(),
      buildSessionPlaneStatusSummary: jest.fn(),
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

    const handled = await routeService.handleRequest(req, res, url, '/api/web/host/surface-consistency', deps);

    expect(handled).toBe(true);
    expect(getResolvedSnapshot).toHaveBeenCalledWith(sessionId);
    expect(buildManifest).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          continuity: expect.objectContaining({
            suggestedAction: expect.objectContaining({
              prompt: 'Retome o briefing final no mesmo contexto.',
            }),
          }),
          tasks: expect.arrayContaining([
            expect.objectContaining({
              task_id: 'task-001',
            }),
          ]),
          permissions: expect.arrayContaining([
            expect.objectContaining({
              permission_id: 'perm-001',
            }),
          ]),
          access: expect.objectContaining({
            recommendedPlan: expect.objectContaining({
              primaryAction: 'remote',
              primaryCommand: 'npm run ops:remote:go',
            }),
          }),
          workflowRuns: expect.arrayContaining([
            expect.objectContaining({
              workflow_run_id: 'workflow-001',
            }),
          ]),
        }),
      }),
    );
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        consistency: expect.objectContaining({
          actions: expect.arrayContaining([
            expect.objectContaining({
              actionType: 'continue-latest-context',
            }),
          ]),
        }),
      }),
      200,
    );
  });

  it('serves the canonical official remote access report and accepts remote actions', async () => {
    const routeService = new WebAppRuntimeRouteService();
    const writeJson = jest.fn();
    const inspect = jest.fn(async () => ({
      summary: 'Acesso remoto oficial pronto.',
      remote: { ready: true, appUrl: 'https://zavorth.example.com/app' },
      rollout: { activeId: 'local-cloudflare', recommendedId: null, candidates: [] },
      state: { status: 'ready', provider: 'local-cloudflare' },
    }));
    const runAction = jest.fn(async () => ({
      summary: 'A validacao do acesso remoto oficial ainda encontrou pendencias.',
      remote: {
        ready: false,
        appUrl: 'https://zavorth.example.com/app',
        issues: ['Probe remoto pendente.'],
      },
      rollout: { activeId: 'local-cloudflare', recommendedId: 'local-cloudflare', candidates: [] },
      state: { status: 'failed', provider: 'local-cloudflare', lastAction: 'go' },
    }));
    const res = {} as http.ServerResponse;

    const deps: WebAppRuntimeRouteDeps = {
      auth: {
        getStatus: jest.fn(() => ({
          enabled: true,
          source: 'env',
          tokenFile: '/runtime/web-token.txt',
        })),
      } as any,
      accessReadiness: {
        inspectLive: jest.fn(async () => ({
          local: { ready: true, appUrl: 'http://127.0.0.1:33333/app' },
          remote: { ready: false, appUrl: null, baseUrl: null, issues: [] },
          summary: 'pending',
        })),
      } as any,
      accessManifest: {
        buildManifest: jest.fn(async () => ({ local: { ready: true }, remote: { ready: false } })),
      } as any,
      installJourney: {
        run: jest.fn(async () => ({ summary: 'journey ok' })),
      } as any,
      officialRemoteAccess: {
        inspect,
        runAction,
      } as any,
      remoteAccess: {
        inspect: jest.fn(async () => ({ summary: 'compat' })),
      } as any,
      surfaceConsistency: {} as any,
      consoleAssets: {} as any,
      runtime: {
        hostIdentityService: {
          getStatus: jest.fn(() => ({ authorized: true })),
        },
      } as any,
      realtime: {} as any,
      runtimeGateway: null,
      runtimeSessionTools: null,
      sessionTools: null,
      runtimeGatewaySessionTools: null,
      buildMemoryPlaneSnapshot: jest.fn(),
      buildLayeredMemoryStatus: jest.fn(async () => null),
      buildLearningPlaneStatus: jest.fn(async () => null),
      buildLearningPlaneSnapshot: jest.fn(async () => null),
      buildLearningPlaneMetrics: jest.fn(async () => null),
      executeLearningAction: jest.fn(),
      searchLayeredMemory: jest.fn(async () => null),
      readLayeredMemoryProcedures: jest.fn(async () => null),
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
      readJsonBody: jest.fn(async () => ({ action: 'go', provider: 'local-cloudflare' })),
      getComposerCatalog: jest.fn(),
      getGatewaySessionTools: jest.fn(),
    };

    const getHandled = await routeService.handleRequest(
      { method: 'GET' } as http.IncomingMessage,
      res,
      new URL('http://localhost/api/web/host/official-remote-access'),
      '/api/web/host/official-remote-access',
      deps,
    );
    const postHandled = await routeService.handleRequest(
      { method: 'POST' } as http.IncomingMessage,
      res,
      new URL('http://localhost/api/web/host/official-remote-access/actions'),
      '/api/web/host/official-remote-access/actions',
      deps,
    );

    expect(getHandled).toBe(true);
    expect(postHandled).toBe(true);
    expect(inspect).toHaveBeenCalledTimes(1);
    expect(runAction).toHaveBeenCalledWith('go', expect.objectContaining({
      provider: 'local-cloudflare',
      autoTrustLocal: true,
      dryRun: false,
    }));
    expect(writeJson).toHaveBeenNthCalledWith(
      1,
      res,
      expect.objectContaining({
        ok: true,
        report: expect.objectContaining({
          summary: 'Acesso remoto oficial pronto.',
        }),
      }),
      200,
    );
    expect(writeJson).toHaveBeenNthCalledWith(
      2,
      res,
      expect.objectContaining({
        ok: true,
        action: 'go',
        report: expect.objectContaining({
          state: expect.objectContaining({
            status: 'failed',
            provider: 'local-cloudflare',
          }),
        }),
      }),
      200,
    );
  });

  it('keeps the legacy official remote alias available for compatibility', async () => {
    const routeService = new WebAppRuntimeRouteService();
    const writeJson = jest.fn();
    const inspect = jest.fn(async () => ({
      summary: 'Acesso remoto oficial pronto.',
      remote: { ready: true, appUrl: 'https://zavorth.example.com/app' },
      rollout: { activeId: 'local-cloudflare', recommendedId: null, candidates: [] },
      state: { status: 'ready', provider: 'local-cloudflare' },
    }));
    const deps: WebAppRuntimeRouteDeps = {
      auth: {} as any,
      accessReadiness: {} as any,
      accessManifest: {} as any,
      installJourney: {} as any,
      officialRemoteAccess: {
        inspect,
        runAction: jest.fn(),
      } as any,
      remoteAccess: {
        inspect: jest.fn(),
      } as any,
      surfaceConsistency: {} as any,
      consoleAssets: {} as any,
      runtime: {} as any,
      realtime: {} as any,
      runtimeGateway: null,
      runtimeSessionTools: null,
      sessionTools: null,
      runtimeGatewaySessionTools: null,
      buildMemoryPlaneSnapshot: jest.fn(),
      buildLayeredMemoryStatus: jest.fn(async () => null),
      buildLearningPlaneStatus: jest.fn(async () => null),
      buildLearningPlaneSnapshot: jest.fn(async () => null),
      buildLearningPlaneMetrics: jest.fn(async () => null),
      executeLearningAction: jest.fn(),
      searchLayeredMemory: jest.fn(async () => null),
      readLayeredMemoryProcedures: jest.fn(async () => null),
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

    const handled = await routeService.handleRequest(
      { method: 'GET' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/host/official-remote'),
      '/api/web/host/official-remote',
      deps,
    );

    expect(handled).toBe(true);
    expect(inspect).toHaveBeenCalledTimes(1);
    expect(writeJson).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        ok: true,
        report: expect.objectContaining({
          summary: 'Acesso remoto oficial pronto.',
        }),
      }),
      200,
    );
  });

});
