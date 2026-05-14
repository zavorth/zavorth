import * as http from 'http';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { WebAppRuntimeRouteService, type WebAppRuntimeRouteDeps } from '../../../../../src/domain/surface/presentation/web-app/WebAppRuntimeRouteService.js';

describe('WebAppRuntimeRouteService', () => {
  it('exposes the experimental session v2 routes without touching the canonical runtime flow', async () => {
    const routeService = new WebAppRuntimeRouteService();
    const writeJson = jest.fn();
    const experimentalSessionV2 = {
      listSessions: jest.fn(() => [{ sessionId: 'exp-1', state: { status: 'IDLE' } }]),
      createSession: jest.fn(() => ({
        sessionId: 'exp-1',
        createdAt: '2026-04-11T01:00:00.000Z',
        state: { id: 'exp-1', status: 'PROCESSING' },
        recording: { enabled: true, active: true, frameCount: 0, elapsedSeconds: 0, lastSavedPath: null },
        memory: { sessionId: 'exp-1', activeMessageCount: 0, activeTokenEstimate: 0, storedChunks: 0, totalCompressedTokens: 0 },
      })),
      getSession: jest.fn(() => ({
        sessionId: 'exp-1',
        createdAt: '2026-04-11T01:00:00.000Z',
        state: { id: 'exp-1', status: 'PROCESSING' },
        recording: { enabled: true, active: true, frameCount: 1, elapsedSeconds: 0.2, lastSavedPath: null },
        memory: { sessionId: 'exp-1', activeMessageCount: 1, activeTokenEstimate: 4, storedChunks: 0, totalCompressedTokens: 0 },
      })),
      writeSession: jest.fn(() => ({
        sessionId: 'exp-1',
        createdAt: '2026-04-11T01:00:00.000Z',
        state: { id: 'exp-1', status: 'PROCESSING' },
        recording: { enabled: true, active: true, frameCount: 2, elapsedSeconds: 0.3, lastSavedPath: null },
        memory: { sessionId: 'exp-1', activeMessageCount: 2, activeTokenEstimate: 8, storedChunks: 0, totalCompressedTokens: 0 },
      })),
      killSession: jest.fn(() => ({
        sessionId: 'exp-1',
        createdAt: '2026-04-11T01:00:00.000Z',
        state: { id: 'exp-1', status: 'IDLE' },
        recording: {
          enabled: true,
          active: false,
          frameCount: 2,
          elapsedSeconds: 0.3,
          lastSavedPath: '/tmp/exp-1.cast',
        },
        memory: { sessionId: 'exp-1', activeMessageCount: 2, activeTokenEstimate: 8, storedChunks: 0, totalCompressedTokens: 0 },
      })),
      listRecordings: jest.fn(() => [{ filename: 'exp-1-1.cast', path: '/tmp/exp-1-1.cast', sizeBytes: 128 }]),
      queryMemory: jest.fn(() => ({
        sessionId: 'exp-1',
        query: 'hello',
        snapshot: { sessionId: 'exp-1', activeMessageCount: 2, activeTokenEstimate: 8, storedChunks: 1, totalCompressedTokens: 10 },
        context: { recentMessages: ['[stdin] hello'], injectedMemories: [], totalEstimatedTokens: 8 },
      })),
    };
    const baseDeps: WebAppRuntimeRouteDeps = {
      auth: {} as any,
      accessReadiness: {} as any,
      accessManifest: {} as any,
      installJourney: {} as any,
      officialRemoteAccess: { inspect: jest.fn(), runAction: jest.fn() } as any,
      remoteAccess: { inspect: jest.fn() } as any,
      surfaceParity: {} as any,
      consoleAssets: {} as any,
      runtime: {} as any,
      realtime: {} as any,
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
      resolveSessionId: jest.fn(),
      resolveSessionIdFromPermission: jest.fn(),
      resolveSessionIdFromTask: jest.fn(),
      createWebContext: jest.fn(),
      openEventStream: jest.fn(),
      writeJson,
      readJsonBody: jest.fn(async () => ({
        sessionId: 'exp-1',
        input: 'hello',
        command: process.execPath,
        args: ['-e', "console.log('ok')"],
      })),
      getComposerCatalog: jest.fn(),
      getGatewaySessionTools: jest.fn(),
      experimentalSessionV2,
    };

    await routeService.handleRequest(
      { method: 'GET' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/experimental/session-v2'),
      '/api/web/experimental/session-v2',
      baseDeps,
    );
    await routeService.handleRequest(
      { method: 'POST' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/experimental/session-v2'),
      '/api/web/experimental/session-v2',
      baseDeps,
    );
    await routeService.handleRequest(
      { method: 'GET' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/experimental/session-v2/state?sessionId=exp-1'),
      '/api/web/experimental/session-v2/state',
      baseDeps,
    );
    await routeService.handleRequest(
      { method: 'POST' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/experimental/session-v2/write'),
      '/api/web/experimental/session-v2/write',
      baseDeps,
    );
    await routeService.handleRequest(
      { method: 'GET' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/experimental/session-v2/memory?sessionId=exp-1&query=hello'),
      '/api/web/experimental/session-v2/memory',
      baseDeps,
    );
    await routeService.handleRequest(
      { method: 'GET' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/experimental/session-v2/recordings?sessionId=exp-1'),
      '/api/web/experimental/session-v2/recordings',
      baseDeps,
    );
    await routeService.handleRequest(
      { method: 'POST' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/experimental/session-v2/kill'),
      '/api/web/experimental/session-v2/kill',
      baseDeps,
    );

    expect(experimentalSessionV2.listSessions).toHaveBeenCalledTimes(1);
    expect(experimentalSessionV2.createSession).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'exp-1',
      command: process.execPath,
    }));
    expect(experimentalSessionV2.getSession).toHaveBeenCalledWith('exp-1');
    expect(experimentalSessionV2.writeSession).toHaveBeenCalledWith('exp-1', 'hello');
    expect(experimentalSessionV2.queryMemory).toHaveBeenCalledWith('exp-1', 'hello');
    expect(experimentalSessionV2.listRecordings).toHaveBeenCalledWith('exp-1');
    expect(experimentalSessionV2.killSession).toHaveBeenCalledWith('exp-1');
    expect(writeJson).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        ok: true,
        experimental: true,
      }),
      200,
    );
  });

  it('exposes the experimental swarm v2 routes as an isolated surface', async () => {
    const routeService = new WebAppRuntimeRouteService();
    const writeJson = jest.fn();
    const experimentalSwarmV2 = {
      listSwarms: jest.fn(() => [{ swarmId: 'swarm-1', status: 'running' }]),
      launchSwarm: jest.fn(() => ({
        swarmId: 'swarm-1',
        status: 'running',
        objective: 'Inspect rollout',
        roles: [],
        startedAt: '2026-04-11T02:00:00.000Z',
        finishedAt: null,
        synthesizedOutput: null,
      })),
      getSwarm: jest.fn(() => ({
        swarmId: 'swarm-1',
        createdAt: '2026-04-11T02:00:00.000Z',
        status: 'completed',
        objective: 'Inspect rollout',
        roles: [],
        startedAt: '2026-04-11T02:00:00.000Z',
        finishedAt: '2026-04-11T02:00:02.000Z',
        synthesizedOutput: 'done',
      })),
      cancelSwarm: jest.fn(() => ({
        swarmId: 'swarm-1',
        createdAt: '2026-04-11T02:00:00.000Z',
        status: 'failed',
        objective: 'Inspect rollout',
        roles: [],
        startedAt: '2026-04-11T02:00:00.000Z',
        finishedAt: '2026-04-11T02:00:01.000Z',
        synthesizedOutput: null,
      })),
    };
    const baseDeps: WebAppRuntimeRouteDeps = {
      auth: {} as any,
      accessReadiness: {} as any,
      accessManifest: {} as any,
      installJourney: {} as any,
      officialRemoteAccess: { inspect: jest.fn(), runAction: jest.fn() } as any,
      remoteAccess: { inspect: jest.fn() } as any,
      surfaceParity: {} as any,
      consoleAssets: {} as any,
      runtime: {} as any,
      realtime: {} as any,
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
      resolveSessionId: jest.fn(),
      resolveSessionIdFromPermission: jest.fn(),
      resolveSessionIdFromTask: jest.fn(),
      createWebContext: jest.fn(),
      openEventStream: jest.fn(),
      writeJson,
      readJsonBody: jest.fn(async () => ({
        swarmId: 'swarm-1',
        objective: 'Inspect rollout',
        roles: [
          {
            id: 'research',
            label: 'Research',
            systemPrompt: 'Inspect rollout state.',
            command: process.execPath,
            args: ['-e', "console.log('ok')"],
          },
        ],
      })),
      getComposerCatalog: jest.fn(),
      getGatewaySessionTools: jest.fn(),
      experimentalSwarmV2,
    };

    await routeService.handleRequest(
      { method: 'GET' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/experimental/swarm-v2'),
      '/api/web/experimental/swarm-v2',
      baseDeps,
    );
    await routeService.handleRequest(
      { method: 'POST' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/experimental/swarm-v2'),
      '/api/web/experimental/swarm-v2',
      baseDeps,
    );
    await routeService.handleRequest(
      { method: 'GET' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/experimental/swarm-v2/state?swarmId=swarm-1'),
      '/api/web/experimental/swarm-v2/state',
      baseDeps,
    );
    await routeService.handleRequest(
      { method: 'POST' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/experimental/swarm-v2/cancel'),
      '/api/web/experimental/swarm-v2/cancel',
      baseDeps,
    );

    expect(experimentalSwarmV2.listSwarms).toHaveBeenCalledTimes(1);
    expect(experimentalSwarmV2.launchSwarm).toHaveBeenCalledWith(expect.objectContaining({
      swarmId: 'swarm-1',
      objective: 'Inspect rollout',
    }));
    expect(experimentalSwarmV2.getSwarm).toHaveBeenCalledWith('swarm-1');
    expect(experimentalSwarmV2.cancelSwarm).toHaveBeenCalledWith('swarm-1');
    expect(writeJson).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        ok: true,
        experimental: true,
      }),
      200,
    );
  });

  it('exposes canonical Watch Mode routes with approvals and screenshot replay', async () => {
    const screenshotPath = path.join(os.tmpdir(), `zavorth-watch-mode-route-${Date.now()}.png`);
    fs.writeFileSync(screenshotPath, Buffer.from('fake-png'));
    try {
      const routeService = new WebAppRuntimeRouteService();
      const writeJson = jest.fn();
      const res = {
        writeHead: jest.fn(),
        end: jest.fn(),
      } as any;
      const watchMode = {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-12T12:00:00.000Z',
          summary: {
            totalRuns: 1,
            runningRuns: 0,
            pausedRuns: 0,
            waitingApprovalRuns: 1,
            pendingApprovals: 1,
            lastStatus: 'waiting_approval',
          },
          policy: {
            strictApprovalDefault: true,
            allowedApps: ['chrome'],
            allowedSites: ['docs.example.com'],
          },
          activeRun: {
            runId: 'watch-1',
            status: 'waiting_approval',
            pendingApprovalCount: 1,
            nextOperatorStep: 'Revise o screenshot e libere a acao.',
            latestScreenshotPath: screenshotPath,
            approvals: [{ approvalId: 'approval-1', status: 'pending' }],
            timeline: [{ entryId: 'entry-1', type: 'approval_requested' }],
          },
          runs: [{ runId: 'watch-1', status: 'waiting_approval' }],
        })),
        listRuns: jest.fn(() => [{ runId: 'watch-1', status: 'waiting_approval' }]),
        getActiveRun: jest.fn(() => ({
          runId: 'watch-1',
          status: 'waiting_approval',
          pendingApprovalCount: 1,
          nextOperatorStep: 'Revise o screenshot e libere a acao.',
        })),
        startRun: jest.fn(async () => ({
          runId: 'watch-1',
          status: 'running',
          pendingApprovalCount: 0,
          nextOperatorStep: 'Acompanhe a timeline.',
        })),
        setStrictApprovalDefault: jest.fn(() => ({
          generatedAt: '2026-04-12T12:01:00.000Z',
          summary: {
            totalRuns: 1,
            runningRuns: 0,
            pausedRuns: 0,
            waitingApprovalRuns: 1,
            pendingApprovals: 1,
            lastStatus: 'waiting_approval',
          },
          policy: {
            strictApprovalDefault: false,
            allowedApps: ['chrome'],
            allowedSites: ['docs.example.com'],
          },
          activeRun: null,
          runs: [],
        })),
        allowApp: jest.fn(() => ({
          generatedAt: '2026-04-12T12:02:00.000Z',
          summary: {
            totalRuns: 1,
            runningRuns: 0,
            pausedRuns: 0,
            waitingApprovalRuns: 1,
            pendingApprovals: 1,
            lastStatus: 'waiting_approval',
          },
          policy: {
            strictApprovalDefault: false,
            allowedApps: ['chrome', 'discord'],
            allowedSites: ['docs.example.com'],
          },
          activeRun: null,
          runs: [],
        })),
        allowSite: jest.fn(() => ({
          generatedAt: '2026-04-12T12:03:00.000Z',
          summary: {
            totalRuns: 1,
            runningRuns: 0,
            pausedRuns: 0,
            waitingApprovalRuns: 1,
            pendingApprovals: 1,
            lastStatus: 'waiting_approval',
          },
          policy: {
            strictApprovalDefault: false,
            allowedApps: ['chrome', 'discord'],
            allowedSites: ['docs.example.com', 'discord.com'],
          },
          activeRun: null,
          runs: [],
        })),
        getRun: jest.fn((runId: string) => (runId === 'watch-1'
          ? {
              runId,
              status: 'waiting_approval',
              pendingApprovalCount: 1,
              approvals: [{ approvalId: 'approval-1', status: 'pending' }],
              timeline: [{ entryId: 'entry-1', type: 'approval_requested' }],
              latestScreenshotPath: screenshotPath,
              nextOperatorStep: 'Revise o screenshot e libere a acao.',
            }
          : null)),
        pauseRun: jest.fn(() => ({ runId: 'watch-1', status: 'paused' })),
        resumeRun: jest.fn(() => ({ runId: 'watch-1', status: 'running' })),
        stopRun: jest.fn(() => ({ runId: 'watch-1', status: 'cancelled' })),
        decideApproval: jest.fn(() => ({ runId: 'watch-1', status: 'running', pendingApprovalCount: 0 })),
        resolveScreenshotPath: jest.fn(() => screenshotPath),
      };
      const readJsonBody = jest.fn()
        .mockResolvedValueOnce({
          actionId: 'set-strict-default',
          strictApproval: false,
        })
        .mockResolvedValueOnce({
          actionId: 'allow-app',
          app: 'Discord',
        })
        .mockResolvedValueOnce({
          actionId: 'allow-site',
          site: 'discord.com',
        })
        .mockResolvedValueOnce({
          targetWindow: 'Chrome',
          objective: 'Revisar docs',
          siteUrl: 'docs.example.com',
          strictApproval: true,
        })
        .mockResolvedValueOnce({
          decision: 'approve',
        })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const deps: WebAppRuntimeRouteDeps = {
        auth: {} as any,
        accessReadiness: {} as any,
        accessManifest: {} as any,
        installJourney: {} as any,
        officialRemoteAccess: { inspect: jest.fn(), runAction: jest.fn() } as any,
        remoteAccess: { inspect: jest.fn() } as any,
        surfaceParity: {} as any,
        consoleAssets: {} as any,
        runtime: { webUserId: 'web-user' } as any,
        realtime: {} as any,
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
        resolveSessionId: jest.fn(),
        resolveSessionIdFromPermission: jest.fn(),
        resolveSessionIdFromTask: jest.fn(),
        createWebContext: jest.fn(),
        openEventStream: jest.fn(),
        writeJson,
        readJsonBody,
        getComposerCatalog: jest.fn(),
        getGatewaySessionTools: jest.fn(),
        watchMode: watchMode as any,
      };

      expect(await routeService.handleRequest(
        { method: 'GET' } as http.IncomingMessage,
        {} as http.ServerResponse,
        new URL('http://localhost/api/web/watch-mode?limit=8'),
        '/api/web/watch-mode',
        deps,
      )).toBe(true);
      expect(await routeService.handleRequest(
        { method: 'GET' } as http.IncomingMessage,
        {} as http.ServerResponse,
        new URL('http://localhost/api/web/watch-mode/policy'),
        '/api/web/watch-mode/policy',
        deps,
      )).toBe(true);
      expect(await routeService.handleRequest(
        { method: 'POST' } as http.IncomingMessage,
        {} as http.ServerResponse,
        new URL('http://localhost/api/web/watch-mode/policy'),
        '/api/web/watch-mode/policy',
        deps,
      )).toBe(true);
      expect(await routeService.handleRequest(
        { method: 'POST' } as http.IncomingMessage,
        {} as http.ServerResponse,
        new URL('http://localhost/api/web/watch-mode/policy'),
        '/api/web/watch-mode/policy',
        deps,
      )).toBe(true);
      expect(await routeService.handleRequest(
        { method: 'POST' } as http.IncomingMessage,
        {} as http.ServerResponse,
        new URL('http://localhost/api/web/watch-mode/policy'),
        '/api/web/watch-mode/policy',
        deps,
      )).toBe(true);
      expect(await routeService.handleRequest(
        { method: 'GET' } as http.IncomingMessage,
        {} as http.ServerResponse,
        new URL('http://localhost/api/web/watch-mode/runs?limit=5'),
        '/api/web/watch-mode/runs',
        deps,
      )).toBe(true);
      expect(await routeService.handleRequest(
        { method: 'POST' } as http.IncomingMessage,
        {} as http.ServerResponse,
        new URL('http://localhost/api/web/watch-mode/runs'),
        '/api/web/watch-mode/runs',
        deps,
      )).toBe(true);
      expect(await routeService.handleRequest(
        { method: 'GET' } as http.IncomingMessage,
        {} as http.ServerResponse,
        new URL('http://localhost/api/web/watch-mode/runs/watch-1'),
        '/api/web/watch-mode/runs/watch-1',
        deps,
      )).toBe(true);
      expect(await routeService.handleRequest(
        { method: 'POST' } as http.IncomingMessage,
        {} as http.ServerResponse,
        new URL('http://localhost/api/web/watch-mode/runs/watch-1/approvals/approval-1'),
        '/api/web/watch-mode/runs/watch-1/approvals/approval-1',
        deps,
      )).toBe(true);
      expect(await routeService.handleRequest(
        { method: 'POST' } as http.IncomingMessage,
        {} as http.ServerResponse,
        new URL('http://localhost/api/web/watch-mode/runs/watch-1/pause'),
        '/api/web/watch-mode/runs/watch-1/pause',
        deps,
      )).toBe(true);
      expect(await routeService.handleRequest(
        { method: 'POST' } as http.IncomingMessage,
        {} as http.ServerResponse,
        new URL('http://localhost/api/web/watch-mode/runs/watch-1/resume'),
        '/api/web/watch-mode/runs/watch-1/resume',
        deps,
      )).toBe(true);
      expect(await routeService.handleRequest(
        { method: 'POST' } as http.IncomingMessage,
        {} as http.ServerResponse,
        new URL('http://localhost/api/web/watch-mode/runs/watch-1/stop'),
        '/api/web/watch-mode/runs/watch-1/stop',
        deps,
      )).toBe(true);
      expect(await routeService.handleRequest(
        { method: 'GET' } as http.IncomingMessage,
        res as http.ServerResponse,
        new URL('http://localhost/api/web/watch-mode/runs/watch-1/screenshot'),
        '/api/web/watch-mode/runs/watch-1/screenshot',
        deps,
      )).toBe(true);

      expect(watchMode.buildSnapshot).toHaveBeenCalled();
      expect(watchMode.setStrictApprovalDefault).toHaveBeenCalledWith(false);
      expect(watchMode.allowApp).toHaveBeenCalledWith('Discord');
      expect(watchMode.allowSite).toHaveBeenCalledWith('discord.com');
      expect(watchMode.listRuns).toHaveBeenCalledWith(5);
      expect(watchMode.startRun).toHaveBeenCalledWith(expect.objectContaining({
        targetWindow: 'Chrome',
        objective: 'Revisar docs',
        siteUrl: 'docs.example.com',
        strictApproval: true,
        requestedBy: 'web-user',
      }));
      expect(watchMode.getRun).toHaveBeenCalledWith('watch-1');
      expect(watchMode.decideApproval).toHaveBeenCalledWith(expect.objectContaining({
        runId: 'watch-1',
        approvalId: 'approval-1',
        decision: 'approve',
        requestedBy: 'web-user',
      }));
      expect(watchMode.pauseRun).toHaveBeenCalledWith('watch-1', 'web-user');
      expect(watchMode.resumeRun).toHaveBeenCalledWith('watch-1', 'web-user');
      expect(watchMode.stopRun).toHaveBeenCalledWith('watch-1', 'web-user');
      expect(watchMode.resolveScreenshotPath).toHaveBeenCalledWith('watch-1', null);
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'image/png',
      }));
      expect(res.end).toHaveBeenCalledWith(expect.any(Buffer));
    } finally {
      if (fs.existsSync(screenshotPath)) {
        fs.unlinkSync(screenshotPath);
      }
    }
  });

  it('exposes Engineering Core run routes through the web runtime router', async () => {
    const routeService = new WebAppRuntimeRouteService();
    const writeJson = jest.fn();
    const engineeringCore = {
      listRuns: jest.fn(() => [{ runId: 'eng-1' }]),
      startRun: jest.fn(async () => ({ runId: 'eng-2', status: 'ready' })),
      getRun: jest.fn((runId: string) => (runId === 'eng-2' ? { runId, status: 'ready' } : null)),
      continueRun: jest.fn(async () => ({ runId: 'eng-2', status: 'dispatched' })),
      approveRun: jest.fn((runId: string) => ({ runId, status: 'ready' })),
      proposePatch: jest.fn(async () => ({ runId: 'eng-2', status: 'ready', plan: { patchProposal: { previewId: 'preview-1' } } })),
      applyPatch: jest.fn((runId: string) => ({ runId, status: 'ready' })),
      rollbackRun: jest.fn((runId: string) => ({ runId, status: 'ready' })),
      runCommand: jest.fn(async () => ({ runId: 'eng-2', status: 'completed', hostActions: [{ actionId: 'host-action-1' }] })),
      executeRun: jest.fn(async () => ({ runId: 'eng-2', status: 'completed', loop: { status: 'completed' } })),
      getReplay: jest.fn((runId: string) => ({ run: { runId }, session: null, recordings: [] })),
    };
    const readJsonBody = jest.fn()
      .mockResolvedValueOnce({ text: 'crie um servidor Express', dispatchTask: false })
      .mockResolvedValueOnce({ text: 'continue' })
      .mockResolvedValueOnce({ filePath: 'src/app.ts', instruction: 'corrija o export principal' })
      .mockResolvedValueOnce({ command: 'git status', approved: true, dryRun: false })
      .mockResolvedValueOnce({ approved: true, dryRun: false, maxAttempts: 2 });

    const deps: WebAppRuntimeRouteDeps = {
      auth: {} as any,
      accessReadiness: {} as any,
      accessManifest: {} as any,
      installJourney: {} as any,
      officialRemoteAccess: { inspect: jest.fn(), runAction: jest.fn() } as any,
      remoteAccess: { inspect: jest.fn() } as any,
      surfaceParity: {} as any,
      consoleAssets: {} as any,
      runtime: {
        webUserId: 'web-user',
        surfaceTaskDispatcher: { dispatchTaskMessage: jest.fn() },
      } as any,
      realtime: {} as any,
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
      resolveSessionId: jest.fn(),
      resolveSessionIdFromPermission: jest.fn(),
      resolveSessionIdFromTask: jest.fn(),
      createWebContext: jest.fn(() => ({
        platform: 'web',
        userId: 'web-user',
        chatId: 'web:engineering',
        isGroup: false,
      })),
      openEventStream: jest.fn(),
      writeJson,
      readJsonBody,
      getComposerCatalog: jest.fn(),
      getGatewaySessionTools: jest.fn(),
      engineeringCore: engineeringCore as any,
    };

    expect(await routeService.handleRequest(
      { method: 'GET' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/engineering/runs'),
      '/api/web/engineering/runs',
      deps,
    )).toBe(true);
    expect(await routeService.handleRequest(
      { method: 'POST' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/engineering/runs'),
      '/api/web/engineering/runs',
      deps,
    )).toBe(true);
    expect(await routeService.handleRequest(
      { method: 'GET' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/engineering/runs/eng-2'),
      '/api/web/engineering/runs/eng-2',
      deps,
    )).toBe(true);
    expect(await routeService.handleRequest(
      { method: 'GET' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/engineering/runs/eng-2/replay'),
      '/api/web/engineering/runs/eng-2/replay',
      deps,
    )).toBe(true);
    expect(await routeService.handleRequest(
      { method: 'POST' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/engineering/runs/eng-2/input'),
      '/api/web/engineering/runs/eng-2/input',
      deps,
    )).toBe(true);
    expect(await routeService.handleRequest(
      { method: 'POST' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/engineering/runs/eng-2/approve'),
      '/api/web/engineering/runs/eng-2/approve',
      deps,
    )).toBe(true);
    expect(await routeService.handleRequest(
      { method: 'POST' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/engineering/runs/eng-2/propose-patch'),
      '/api/web/engineering/runs/eng-2/propose-patch',
      deps,
    )).toBe(true);
    expect(await routeService.handleRequest(
      { method: 'POST' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/engineering/runs/eng-2/apply-patch'),
      '/api/web/engineering/runs/eng-2/apply-patch',
      deps,
    )).toBe(true);
    expect(await routeService.handleRequest(
      { method: 'POST' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/engineering/runs/eng-2/rollback'),
      '/api/web/engineering/runs/eng-2/rollback',
      deps,
    )).toBe(true);
    expect(await routeService.handleRequest(
      { method: 'POST' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/engineering/runs/eng-2/run-command'),
      '/api/web/engineering/runs/eng-2/run-command',
      deps,
    )).toBe(true);
    expect(await routeService.handleRequest(
      { method: 'POST' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/engineering/runs/eng-2/execute'),
      '/api/web/engineering/runs/eng-2/execute',
      deps,
    )).toBe(true);

    expect(engineeringCore.listRuns).toHaveBeenCalledTimes(1);
    expect(engineeringCore.startRun).toHaveBeenCalledWith(expect.objectContaining({
      rawText: 'crie um servidor Express',
      startSession: true,
    }));
    expect(engineeringCore.getRun).toHaveBeenCalledWith('eng-2');
    expect(engineeringCore.getReplay).toHaveBeenCalledWith('eng-2');
    expect(engineeringCore.continueRun).toHaveBeenCalledWith('eng-2', expect.anything(), expect.anything());
    expect(engineeringCore.approveRun).toHaveBeenCalledWith('eng-2');
    expect(engineeringCore.proposePatch).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'eng-2',
      filePath: 'src/app.ts',
      instruction: 'corrija o export principal',
    }));
    expect(engineeringCore.applyPatch).toHaveBeenCalledWith('eng-2');
    expect(engineeringCore.rollbackRun).toHaveBeenCalledWith('eng-2');
    expect(engineeringCore.runCommand).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'eng-2',
      command: 'git status',
      approved: true,
      dryRun: false,
    }));
    expect(engineeringCore.executeRun).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'eng-2',
      approved: true,
      dryRun: false,
      maxAttempts: 2,
    }));
  });

  it('exposes System Overlord control plane routes through the web runtime router', async () => {
    const routeService = new WebAppRuntimeRouteService();
    const writeJson = jest.fn();
    const systemOverlordControl = {
      buildSnapshot: jest.fn(() => ({
        generatedAt: '2026-04-10T10:00:00.000Z',
        summary: {
          capabilities: 11,
          adapters: 3,
          recentActions: 0,
          pendingApprovals: 0,
          blockedActions: 0,
          completedActions: 0,
          failedActions: 0,
          highestRiskLevel: null,
        },
        narrative: {
          headline: 'System Overlord supervisionado',
          operatorSummary: '3 adapters supervisionados disponiveis.',
        },
        profiles: [],
        autonomyLevels: [],
        capabilities: [],
        adapters: [],
        approvalQueue: [{ actionId: 'approval-1' }],
        recentActions: [],
      })),
      listApprovals: jest.fn(() => [{ actionId: 'approval-1' }]),
      decideApproval: jest.fn(async (input) => ({
        approval: {
          actionId: input.actionId,
          status: input.decision === 'reject' ? 'rejected' : 'dry_run',
        },
        snapshot: { generatedAt: '2026-04-10T10:00:02.000Z' },
      })),
      setKillSwitch: jest.fn(async () => ({
        killSwitch: {
          active: true,
          reason: 'maintenance',
        },
        affectedActions: [],
        snapshot: { generatedAt: '2026-04-10T10:00:03.000Z' },
      })),
      cancelAction: jest.fn(async (input) => ({
        action: {
          actionId: input.actionId,
          status: 'cancelled',
        },
        snapshot: { generatedAt: '2026-04-10T10:00:04.000Z' },
      })),
      rollbackAction: jest.fn(async (input) => ({
        action: {
          actionId: `rollback-${input.actionId}`,
          status: 'completed',
        },
        snapshot: { generatedAt: '2026-04-10T10:00:05.000Z' },
      })),
      executeAction: jest.fn(async (input) => ({
        action: {
          actionId: 'host-action-1',
          status: 'dry_run',
          request: input,
        },
        snapshot: { generatedAt: '2026-04-10T10:00:01.000Z' },
      })),
    };
    const readJsonBody = jest.fn(async () => ({
      capability: 'host.shell',
      command: 'git status',
      dryRun: true,
      requestedBy: 'web-user',
    }))
      .mockResolvedValueOnce({
        capability: 'host.shell',
        command: 'git status',
        dryRun: true,
        requestedBy: 'web-user',
      })
      .mockResolvedValueOnce({
        decision: 'approve',
        dryRun: true,
        reason: 'ok',
      })
      .mockResolvedValueOnce({
        active: true,
        cancelActive: true,
        reason: 'maintenance',
      })
      .mockResolvedValueOnce({
        reason: 'pare agora',
      })
      .mockResolvedValueOnce({
        reason: 'desfazer',
      });
    const deps = {
      runtime: { webUserId: 'web-user' },
      writeJson,
      readJsonBody,
      systemOverlordControl,
    } as any;

    expect(await routeService.handleRequest(
      { method: 'GET' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/system-overlord?limit=10'),
      '/api/web/system-overlord',
      deps,
    )).toBe(true);
    expect(await routeService.handleRequest(
      { method: 'POST' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/system-overlord/actions'),
      '/api/web/system-overlord/actions',
      deps,
    )).toBe(true);
    expect(await routeService.handleRequest(
      { method: 'GET' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/system-overlord/approvals?limit=7'),
      '/api/web/system-overlord/approvals',
      deps,
    )).toBe(true);
    expect(await routeService.handleRequest(
      { method: 'POST' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/system-overlord/approvals/approval-1'),
      '/api/web/system-overlord/approvals/approval-1',
      deps,
    )).toBe(true);
    expect(await routeService.handleRequest(
      { method: 'POST' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/system-overlord/kill-switch'),
      '/api/web/system-overlord/kill-switch',
      deps,
    )).toBe(true);
    expect(await routeService.handleRequest(
      { method: 'POST' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/system-overlord/actions/host-action-1/cancel'),
      '/api/web/system-overlord/actions/host-action-1/cancel',
      deps,
    )).toBe(true);
    expect(await routeService.handleRequest(
      { method: 'POST' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/system-overlord/actions/host-action-1/rollback'),
      '/api/web/system-overlord/actions/host-action-1/rollback',
      deps,
    )).toBe(true);

    expect(systemOverlordControl.buildSnapshot).toHaveBeenCalledWith(10);
    expect(systemOverlordControl.listApprovals).toHaveBeenCalledWith(7);
    expect(systemOverlordControl.executeAction).toHaveBeenCalledWith(expect.objectContaining({
      capability: 'host.shell',
      command: 'git status',
      requestedBy: 'web-user',
      surface: 'web-overlord',
      dryRun: true,
    }));
    expect(systemOverlordControl.decideApproval).toHaveBeenCalledWith(expect.objectContaining({
      actionId: 'approval-1',
      decision: 'approve',
      requestedBy: 'web-user',
      reason: 'ok',
      dryRun: true,
    }));
    expect(systemOverlordControl.setKillSwitch).toHaveBeenCalledWith(expect.objectContaining({
      active: true,
      cancelActive: true,
      requestedBy: 'web-user',
      reason: 'maintenance',
    }));
    expect(systemOverlordControl.cancelAction).toHaveBeenCalledWith(expect.objectContaining({
      actionId: 'host-action-1',
      requestedBy: 'web-user',
      reason: 'pare agora',
    }));
    expect(systemOverlordControl.rollbackAction).toHaveBeenCalledWith(expect.objectContaining({
      actionId: 'host-action-1',
      requestedBy: 'web-user',
      reason: 'desfazer',
    }));
    expect(writeJson).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        ok: true,
        snapshot: expect.objectContaining({
          narrative: expect.objectContaining({
            headline: 'System Overlord supervisionado',
          }),
        }),
      }),
      200,
    );
    expect(writeJson).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        ok: true,
        action: expect.any(Object),
      }),
      200,
    );
  });

});
