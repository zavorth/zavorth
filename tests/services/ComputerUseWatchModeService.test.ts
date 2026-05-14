import fs from 'fs';
import os from 'os';
import path from 'path';
import { ComputerUseWatchModeService } from '../../src/services/ComputerUseWatchModeService.js';

const flushAsync = async () => new Promise((resolve) => setImmediate(resolve));

function stableRuntimeStabilityControlPlaneService() {
  return {
    buildSnapshot: jest.fn(() => ({
      gate: { status: 'passed' },
      summary: { posture: 'healthy' },
    })),
  };
}

describe('ComputerUseWatchModeService', () => {
  it('creates a pending approval for mutating actions, records the timeline, and serves the screenshot path', async () => {
    const screenshotPath = path.join(os.tmpdir(), `zavorth-watch-mode-${Date.now()}.png`);
    fs.writeFileSync(screenshotPath, Buffer.from('fake-png'));
    try {
      const service = new ComputerUseWatchModeService({
        mutationGuardEnabled: false,
        isExecutionAllowed: () => true,
        runtimeStabilityControlPlaneService: stableRuntimeStabilityControlPlaneService() as any,
        createAgent: () => ({
          pause: jest.fn(),
          resume: jest.fn(),
          stop: jest.fn(),
          getSnapshot: jest.fn(() => ({
            status: 'idle',
            iteration: 0,
            maxIterations: 4,
            objective: 'Abrir o dashboard',
            targetWindow: 'Chrome',
            lastAction: null,
            lastScreenshotPath: null,
            history: [],
            startedAt: null,
            finishedAt: null,
            error: null,
          })),
          run: jest.fn(async (config) => {
            const baseSnapshot = {
              status: 'running' as const,
              iteration: 1,
              maxIterations: 4,
              objective: config.objective,
              targetWindow: config.targetWindow,
              lastAction: null,
              lastScreenshotPath: screenshotPath,
              history: [],
              startedAt: '2026-04-12T10:00:00.000Z',
              finishedAt: null,
              error: null,
            };
            await config.hooks?.onScreenshot?.({
              snapshot: baseSnapshot,
              screenshotPath,
            });
            const action = await config.hooks?.onActionPlanned?.({
              snapshot: baseSnapshot,
              action: {
                action: 'click-element',
                targetText: 'Entrar',
                reasoning: 'A UI mostra o CTA principal.',
              },
            });
            await config.hooks?.onActionExecuted?.({
              snapshot: {
                ...baseSnapshot,
                lastAction: action || null,
                history: [
                  {
                    iteration: 1,
                    action: action || { action: 'done' },
                    result: 'ok',
                  },
                ],
              },
              action: action!,
              result: 'ok',
            });
            return {
              status: 'completed' as const,
              iteration: 1,
              maxIterations: 4,
              objective: config.objective,
              targetWindow: config.targetWindow,
              lastAction: action || null,
              lastScreenshotPath: screenshotPath,
              history: [
                {
                  iteration: 1,
                  action: action || { action: 'done' },
                  result: 'ok',
                },
              ],
              startedAt: '2026-04-12T10:00:00.000Z',
              finishedAt: '2026-04-12T10:00:02.000Z',
              error: null,
            };
          }),
        }) as any,
      });

      const started = await service.startRun({
        targetWindow: 'Chrome',
        objective: 'Abrir o dashboard',
        requestedBy: 'tester',
      });

      expect(started.status).toBe('running');
      await flushAsync();

      const pending = service.getActiveRun();
      expect(pending?.status).toBe('waiting_approval');
      expect(pending?.pendingApprovalCount).toBe(1);
      expect(pending?.timeline.some((entry) => entry.type === 'approval_requested')).toBe(true);

      const approvalId = pending?.approvals.find((entry) => entry.status === 'pending')?.approvalId;
      expect(approvalId).toBeTruthy();
      expect(pending?.approvals[0]).toEqual(expect.objectContaining({
        screenshotPath: path.resolve(screenshotPath),
        riskLevel: 'high',
        screenshotRedactionMode: 'redacted',
        sensitiveScreenPolicy: 'pause',
      }));

      const afterDecision = service.decideApproval({
        runId: pending!.runId,
        approvalId: approvalId!,
        decision: 'approve',
        requestedBy: 'tester',
      });
      expect(afterDecision.pendingApprovalCount).toBe(0);

      await flushAsync();

      const finalRun = service.getRun(pending!.runId);
      expect(finalRun?.status).toBe('completed');
      expect(finalRun?.timeline.some((entry) => entry.type === 'executed')).toBe(true);
      expect(service.resolveScreenshotPath(pending!.runId)).toBe(path.resolve(screenshotPath));
      expect(service.buildSnapshot().summary.pendingApprovals).toBe(0);
      expect(service.buildSnapshot().summary.activeVisualHandles).toBe(0);
      expect(finalRun?.buffers.artifactEntries).toBe(1);
      expect(finalRun?.buffers.persistedArtifacts).toBe(1);
    } finally {
      if (fs.existsSync(screenshotPath)) {
        fs.unlinkSync(screenshotPath);
      }
    }
  });

  it('throttles noisy screenshot events while retaining a bounded artifact buffer', async () => {
    const screenshotPaths = [
      path.join(os.tmpdir(), `zavorth-watch-mode-a-${Date.now()}.png`),
      path.join(os.tmpdir(), `zavorth-watch-mode-b-${Date.now()}.png`),
      path.join(os.tmpdir(), `zavorth-watch-mode-c-${Date.now()}.png`),
    ];
    screenshotPaths.forEach((entry) => fs.writeFileSync(entry, Buffer.from('fake-png')));

    try {
      const service = new ComputerUseWatchModeService({
        mutationGuardEnabled: false,
        isExecutionAllowed: () => true,
        runtimeStabilityControlPlaneService: stableRuntimeStabilityControlPlaneService() as any,
        screenshotThrottleMs: 10_000,
        artifactLimit: 2,
        createAgent: () => ({
          pause: jest.fn(),
          resume: jest.fn(),
          stop: jest.fn(),
          getSnapshot: jest.fn(() => ({
            status: 'running',
            iteration: 0,
            maxIterations: 4,
            objective: 'Observar UI',
            targetWindow: 'Chrome',
            lastAction: null,
            lastScreenshotPath: null,
            history: [],
            startedAt: null,
            finishedAt: null,
            error: null,
          })),
          run: jest.fn(async (config) => {
            for (let index = 0; index < screenshotPaths.length; index += 1) {
              await config.hooks?.onScreenshot?.({
                snapshot: {
                  status: 'running',
                  iteration: index + 1,
                  maxIterations: 4,
                  objective: config.objective,
                  targetWindow: config.targetWindow,
                  lastAction: null,
                  lastScreenshotPath: screenshotPaths[index],
                  history: [],
                  startedAt: '2026-04-18T12:00:00.000Z',
                  finishedAt: null,
                  error: null,
                },
                screenshotPath: screenshotPaths[index],
              });
            }

            return {
              status: 'completed' as const,
              iteration: 3,
              maxIterations: 4,
              objective: config.objective,
              targetWindow: config.targetWindow,
              lastAction: null,
              lastScreenshotPath: screenshotPaths[2],
              history: [],
              startedAt: '2026-04-18T12:00:00.000Z',
              finishedAt: '2026-04-18T12:00:01.000Z',
              error: null,
            };
          }),
        }) as any,
      });

      const started = await service.startRun({
        targetWindow: 'Chrome',
        objective: 'Observar UI',
      });

      await flushAsync();

      const finalRun = service.getRun(started.runId);
      const snapshot = service.buildSnapshot();

      expect(finalRun?.status).toBe('completed');
      expect(finalRun?.buffers.throttledScreenshots).toBeGreaterThanOrEqual(2);
      expect(finalRun?.buffers.artifactEntries).toBe(2);
      expect(finalRun?.buffers.persistedArtifacts).toBe(3);
      expect(finalRun?.buffers.deletedScreenshotBytes).toBeGreaterThan(0);
      expect(finalRun?.artifacts.map((entry) => entry.screenshotPath)).toEqual([
        path.resolve(screenshotPaths[2]),
        path.resolve(screenshotPaths[1]),
      ]);
      expect(snapshot.summary.throttledScreenshots).toBeGreaterThanOrEqual(2);
      expect(snapshot.summary.artifactEntries).toBe(2);
    } finally {
      screenshotPaths.forEach((entry) => {
        if (fs.existsSync(entry)) {
          fs.unlinkSync(entry);
        }
      });
    }
  });

  it('supports pause, resume, and stop on a long-running visual supervision run', async () => {
    let released = false;
    let resolveRun: (() => void) | null = null;
    const pause = jest.fn();
    const resume = jest.fn();
    const stop = jest.fn(() => {
      released = true;
      resolveRun?.();
    });

    const service = new ComputerUseWatchModeService({
      mutationGuardEnabled: false,
      isExecutionAllowed: () => true,
      runtimeStabilityControlPlaneService: stableRuntimeStabilityControlPlaneService() as any,
      createAgent: () => ({
        pause,
        resume,
        stop,
        getSnapshot: jest.fn(() => ({
          status: 'running',
          iteration: 1,
          maxIterations: 4,
          objective: 'Inspecionar runtime',
          targetWindow: 'Chrome',
          lastAction: null,
          lastScreenshotPath: null,
          history: [],
          startedAt: '2026-04-12T11:00:00.000Z',
          finishedAt: null,
          error: null,
        })),
        run: jest.fn(async () => {
          await new Promise<void>((resolve) => {
            resolveRun = resolve;
          });
          return {
            status: released ? ('cancelled' as const) : ('completed' as const),
            iteration: 1,
            maxIterations: 4,
            objective: 'Inspecionar runtime',
            targetWindow: 'Chrome',
            lastAction: null,
            lastScreenshotPath: null,
            history: [],
            startedAt: '2026-04-12T11:00:00.000Z',
            finishedAt: '2026-04-12T11:00:05.000Z',
            error: null,
          };
        }),
      }) as any,
    });

    const started = await service.startRun({
      targetWindow: 'Chrome',
      objective: 'Inspecionar runtime',
    });
    expect(started.status).toBe('running');

    const paused = service.pauseRun(started.runId, 'tester');
    expect(pause).toHaveBeenCalledTimes(1);
    expect(paused.status).toBe('paused');

    const resumed = service.resumeRun(started.runId, 'tester');
    expect(resume).toHaveBeenCalledTimes(1);
    expect(resumed.status).toBe('running');

    const stopped = service.stopRun(started.runId, 'tester');
    expect(stop).toHaveBeenCalledTimes(1);
    expect(stopped.status).toBe('cancelled');
    expect(stopped.buffers.activeVisualHandles).toBe(0);

    await flushAsync();

    const finalRun = service.getRun(started.runId);
    expect(finalRun?.status).toBe('cancelled');
    expect(finalRun?.timeline.some((entry) => entry.type === 'paused')).toBe(true);
    expect(finalRun?.timeline.some((entry) => entry.type === 'resumed')).toBe(true);
    expect(finalRun?.timeline.some((entry) => entry.type === 'stopped')).toBe(true);
  });

  it('blocks start when the runtime stability gate is failed', async () => {
    const createAgent = jest.fn();
    const service = new ComputerUseWatchModeService({
      mutationGuardEnabled: false,
      isExecutionAllowed: () => true,
      runtimeStabilityControlPlaneService: {
        buildSnapshot: jest.fn(() => ({
          gate: { status: 'failed' },
          summary: { posture: 'critical' },
        })),
      } as any,
      createAgent,
    });

    await expect(service.startRun({
      targetWindow: 'Chrome',
      objective: 'Inspecionar runtime',
    })).rejects.toThrow(/Runtime Stability Gate/);
    expect(createAgent).not.toHaveBeenCalled();
  });

  it('supports metadata-only screenshot policy without serving image bytes', async () => {
    const screenshotPath = path.join(os.tmpdir(), `zavorth-watch-mode-metadata-${Date.now()}.png`);
    fs.writeFileSync(screenshotPath, Buffer.from('fake-png'));
    try {
      const service = new ComputerUseWatchModeService({
        mutationGuardEnabled: false,
        isExecutionAllowed: () => true,
        runtimeStabilityControlPlaneService: stableRuntimeStabilityControlPlaneService() as any,
        createAgent: () => ({
          pause: jest.fn(),
          resume: jest.fn(),
          stop: jest.fn(),
          getSnapshot: jest.fn(),
          run: jest.fn(async (config) => {
            await config.hooks?.onScreenshot?.({
              snapshot: {
                status: 'running',
                iteration: 1,
                maxIterations: 1,
                objective: config.objective,
                targetWindow: config.targetWindow,
                lastAction: null,
                lastScreenshotPath: screenshotPath,
                history: [],
                startedAt: '2026-04-18T12:00:00.000Z',
                finishedAt: null,
                error: null,
              },
              screenshotPath,
            });
            return {
              status: 'completed' as const,
              iteration: 1,
              maxIterations: 1,
              objective: config.objective,
              targetWindow: config.targetWindow,
              lastAction: null,
              lastScreenshotPath: screenshotPath,
              history: [],
              startedAt: '2026-04-18T12:00:00.000Z',
              finishedAt: '2026-04-18T12:00:01.000Z',
              error: null,
            };
          }),
        }) as any,
      });

      const started = await service.startRun({
        targetWindow: 'Chrome',
        objective: 'Observar sem armazenar imagem',
        screenshotRedactionMode: 'metadata-only',
      });
      await flushAsync();

      const finalRun = service.getRun(started.runId);
      expect(finalRun?.budget.screenshotRedactionMode).toBe('metadata-only');
      expect(finalRun?.buffers.artifactEntries).toBe(0);
      expect(finalRun?.buffers.throttledScreenshots).toBeGreaterThanOrEqual(1);
      expect(service.resolveScreenshotPath(started.runId)).toBeNull();
    } finally {
      if (fs.existsSync(screenshotPath)) {
        fs.unlinkSync(screenshotPath);
      }
    }
  });

  it('persists policy and snapshots through the canonical watch mode services', async () => {
    const saveSnapshot = jest.fn();
    const savePolicy = jest.fn((input) => ({
      version: 1,
      updatedAt: '2026-04-12T12:30:00.000Z',
      strictApprovalDefault: input.strictApprovalDefault !== false,
      allowedApps: input.allowedApps || [],
      allowedSites: input.allowedSites || [],
    }));
    const service = new ComputerUseWatchModeService({
      mutationGuardEnabled: false,
      isExecutionAllowed: () => true,
      policyFileService: {
        readPolicy: jest.fn(() => ({
          version: 1,
          updatedAt: null,
          strictApprovalDefault: true,
          allowedApps: ['chrome'],
          allowedSites: ['docs.example.com'],
        })),
        savePolicy,
        setStrictApprovalDefault: jest.fn(),
        allowApp: jest.fn(),
        allowSite: jest.fn(),
      } as any,
      stateFileService: {
        readSnapshot: jest.fn(() => null),
        saveSnapshot,
      } as any,
      createAgent: () => ({
        pause: jest.fn(),
        resume: jest.fn(),
        stop: jest.fn(),
        getSnapshot: jest.fn(() => ({
          status: 'idle',
          iteration: 0,
          maxIterations: 4,
          objective: 'Observar',
          targetWindow: 'Chrome',
          lastAction: null,
          lastScreenshotPath: null,
          history: [],
          startedAt: null,
          finishedAt: null,
          error: null,
        })),
        run: jest.fn(async () => ({
          status: 'completed' as const,
          iteration: 1,
          maxIterations: 4,
          objective: 'Observar',
          targetWindow: 'Chrome',
          lastAction: { action: 'done' },
          lastScreenshotPath: null,
          history: [],
          startedAt: '2026-04-12T12:30:00.000Z',
          finishedAt: '2026-04-12T12:30:01.000Z',
          error: null,
        })),
      }) as any,
    });

    const strictSnapshot = service.setStrictApprovalDefault(false);
    const appSnapshot = service.allowApp('Discord');
    const siteSnapshot = service.allowSite('https://discord.com/channels');

    expect(strictSnapshot.policy.strictApprovalDefault).toBe(false);
    expect(appSnapshot.policy.allowedApps).toEqual(expect.arrayContaining(['chrome', 'discord']));
    expect(siteSnapshot.policy.allowedSites).toEqual(expect.arrayContaining(['docs.example.com', 'discord.com']));
    expect(savePolicy).toHaveBeenCalled();
    expect(saveSnapshot).toHaveBeenCalled();
  });
});
