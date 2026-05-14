import { ZavorthProviderLiveCanaryService } from '../../src/services/ZavorthProviderLiveCanaryService.js';

describe('ZavorthProviderLiveCanaryService', () => {
  it('blocks live canary when no provider credentials are available', async () => {
    const service = new ZavorthProviderLiveCanaryService({
      now,
      llmRuntime: {
        getPreferredProviderName: () => 'gemini',
        isProviderAvailable: () => false,
      },
      subagentRuntime: {
        execute: jest.fn(),
      },
    });

    const snapshot = await service.buildSnapshot({ runLive: true });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.live.executed).toBe(false);
    expect(snapshot.live.error).toContain('No configured provider credentials');
  });

  it('performs a dry-run without invoking the provider', async () => {
    const execute = jest.fn();
    const service = new ZavorthProviderLiveCanaryService({
      now,
      llmRuntime: {
        getPreferredProviderName: () => 'gemini',
        isProviderAvailable: (name) => name === 'gemini',
      },
      subagentRuntime: { execute },
    });

    const snapshot = await service.buildSnapshot();

    expect(snapshot.status).toBe('attention');
    expect(snapshot.mode).toBe('dry-run');
    expect(snapshot.selectedProviderName).toBe('gemini');
    expect(snapshot.live.executed).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  it('passes when the live subagent canary observes the marker', async () => {
    const execute = jest.fn().mockResolvedValue({
      status: 'completed',
      summary: {
        workerResults: 1,
        failedWorkerResults: 0,
        externalIoPerformed: true,
        workspaceMutationPerformed: false,
        upstreamRuntimeCodeExecuted: false,
      },
      runs: [{
        summary: 'completed',
        output: 'ZAVORTH_LIVE_SUBAGENT_CANARY_OK',
        workerResults: [],
      }],
    });
    const service = new ZavorthProviderLiveCanaryService({
      now,
      llmRuntime: {
        getPreferredProviderName: () => 'gemini',
        isProviderAvailable: (name) => name === 'gemini',
      },
      subagentRuntime: { execute },
    });

    const snapshot = await service.buildSnapshot({ runLive: true, timeoutMs: 1000 });

    expect(snapshot.status).toBe('passed');
    expect(snapshot.live.executed).toBe(true);
    expect(snapshot.live.markerObserved).toBe(true);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      live: true,
      providerName: 'gemini',
      maxLiveWorkers: 1,
      maxToolCalls: 0,
      persistState: false,
    }));
  });

  it('returns attention when provider completes without the exact marker', async () => {
    const service = new ZavorthProviderLiveCanaryService({
      now,
      llmRuntime: {
        getPreferredProviderName: () => 'openai',
        isProviderAvailable: (name) => name === 'openai',
      },
      subagentRuntime: {
        execute: jest.fn().mockResolvedValue({
          status: 'completed',
          summary: {
            workerResults: 1,
            failedWorkerResults: 0,
            externalIoPerformed: true,
            workspaceMutationPerformed: false,
            upstreamRuntimeCodeExecuted: false,
          },
          runs: [{ summary: 'completed', output: 'ok but no marker', workerResults: [] }],
        }),
      },
    });

    const snapshot = await service.buildSnapshot({ runLive: true });

    expect(snapshot.status).toBe('attention');
    expect(snapshot.live.completed).toBe(true);
    expect(snapshot.live.markerObserved).toBe(false);
  });
});

function now(): Date {
  return new Date('2026-05-10T16:00:00.000Z');
}
