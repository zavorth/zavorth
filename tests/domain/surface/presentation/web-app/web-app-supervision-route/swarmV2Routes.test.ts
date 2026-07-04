import { handleSwarmV2Routes } from '../../../../../../src/domain/surface/presentation/web-app/web-app-supervision-route/swarmV2Routes.js';

describe('handleSwarmV2Routes swarm scale dynamic configuration', () => {
  it('configures a swarm scale run through the gateway surface', async () => {
    const writes: Array<{ payload: any; status: number }> = [];
    const configureRun = jest.fn().mockReturnValue({
      runId: 'swarm-run-1',
      status: 'paused',
      dynamicConfig: {
        revision: 2,
        sourceSurface: 'dashboard',
        executionBackend: 'modal',
        cloudSandboxEnabled: true,
        deviceNodeRouting: true,
      },
    });

    const handled = await handleSwarmV2Routes({
      req: { method: 'POST' } as any,
      res: {} as any,
      url: new URL('http://localhost/api/web/gateway/swarm-scale/configure'),
      pathname: '/api/web/gateway/swarm-scale/configure',
      deps: {
        readJsonBody: async () => ({
          runId: 'swarm-run-1',
          sourceSurface: 'dashboard',
          actorId: 'operator',
          reason: 'Move queued workers to managed sandboxes.',
          maxConcurrency: 4,
          maxSteps: 40,
          executionBackend: 'modal',
          cloudSandbox: 'on',
          deviceRouting: 'on',
        }),
        writeJson: (_res: unknown, payload: any, status: number) => writes.push({ payload, status }),
      } as any,
      experimentalAlias: false,
      sessionV2Service: null,
      swarmV2Service: null,
      swarmScalePlaneService: { configureRun },
      sessionV2Label: 'Session V2',
      swarmV2Label: 'Swarm V2',
      isSessionV2Route: () => false,
      isSessionV2RecordingRoute: false,
      isSwarmV2Route: () => false,
      isSwarmScaleRoute: (suffix = '') => `/api/web/gateway/swarm-scale${suffix}` === '/api/web/gateway/swarm-scale/configure',
    });

    expect(handled).toBe(true);
    expect(configureRun).toHaveBeenCalledWith({
      runId: 'swarm-run-1',
      sourceSurface: 'dashboard',
      actorId: 'operator',
      reason: 'Move queued workers to managed sandboxes.',
      persistState: true,
      patch: {
        maxConcurrency: 4,
        maxSteps: 40,
        executionMode: undefined,
        executionBackend: 'modal',
        cloudSandboxEnabled: true,
        deviceNodeRouting: true,
        pauseReason: undefined,
      },
    });
    expect(writes).toEqual([
      {
        status: 200,
        payload: expect.objectContaining({
          ok: true,
          surface: 'swarm-scale-plane',
          snapshot: expect.objectContaining({
            runId: 'swarm-run-1',
          }),
        }),
      },
    ]);
  });
});
