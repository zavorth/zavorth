import * as http from 'http';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { WebAppRuntimeRouteService, type WebAppRuntimeRouteDeps } from '../../../../../src/domain/surface/presentation/web-app/WebAppRuntimeRouteService.js';

describe('WebAppRuntimeRouteService', () => {
  it('hydrates the canonical gateway state payload with approvals, artifacts, resources, companions and selfmod planes', async () => {
    const routeService = new WebAppRuntimeRouteService();
    const payload = await routeService.buildCanonicalStatePayload(
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
                  patches: [{ path: 'C:/repo/src/app.ts', diff: '@@\\n+ok\\n', summary: null }],
                },
              },
            ],
          })),
          getSnapshot: jest.fn(() => null),
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
        surfaceParity: {} as any,
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

  it('serves canonical session-v2 and swarm-v2 aliases without breaking experimental routes', async () => {
    const routeService = new WebAppRuntimeRouteService();
    const writeJson = jest.fn();
    const deps = {
      experimentalSessionV2: {
        listSessions: jest.fn(() => [{ sessionId: 'pty-1' }]),
      },
      experimentalSwarmV2: {
        listSwarms: jest.fn(() => [{ swarmId: 'swarm-1', status: 'running' }]),
      },
      writeJson,
    } as any;

    const handledSession = await routeService.handleRequest(
      { method: 'GET' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/gateway/session-v2'),
      '/api/web/gateway/session-v2',
      deps,
    );
    const handledSwarm = await routeService.handleRequest(
      { method: 'GET' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/gateway/swarm-v2'),
      '/api/web/gateway/swarm-v2',
      deps,
    );

    expect(handledSession).toBe(true);
    expect(handledSwarm).toBe(true);
    expect(writeJson).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        ok: true,
        experimental: false,
        sessions: [{ sessionId: 'pty-1' }],
      }),
      200,
    );
    expect(writeJson).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        ok: true,
        experimental: false,
        swarms: [{ swarmId: 'swarm-1', status: 'running' }],
      }),
      200,
    );
  });
});
