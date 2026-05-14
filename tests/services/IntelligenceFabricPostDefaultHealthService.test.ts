import { IntelligenceFabricPostDefaultHealthService } from '../../src/services/IntelligenceFabricPostDefaultHealthService';
import type {
  UniversalAgentChannel,
  UniversalAgentRun,
  UniversalAgentRunStatus,
} from '../../src/runtime/agent';

const now = '2026-05-08T14:00:00.000Z';

describe('IntelligenceFabricPostDefaultHealthService', () => {
  it('keeps Fabric as default when fallback, error and latency rates are healthy', () => {
    const service = createService();
    const snapshot = service.buildSnapshot([
      run('web-a', 'web', 'observed', 'intelligence-fabric-default', true, 40),
      run('cli-a', 'cli', 'observed', 'intelligence-fabric-default', true, 60),
      run('api-a', 'api', 'observed', 'intelligence-fabric-default', true, 80),
    ]);

    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: 'zavorth-intelligence-fabric-post-default-health/v1',
      status: 'ready',
      recommendation: 'maintain_default',
      rollback: expect.objectContaining({
        available: true,
        demoteMode: 'disabled',
        destructive: false,
      }),
    }));
    expect(snapshot.summary).toEqual(expect.objectContaining({
      fabricRuns: 3,
      fallbackRate: 0,
      errorFallbackRate: 0,
      orientationRate: 1,
    }));
    expect(snapshot.findings).toEqual([
      expect.objectContaining({ id: 'post-default-health-ready', severity: 'info' }),
    ]);
  });

  it('observes when sample size is still too small', () => {
    const snapshot = createService().buildSnapshot([
      run('web-small', 'web', 'observed', 'intelligence-fabric-default', true, 45),
    ]);

    expect(snapshot.status).toBe('attention');
    expect(snapshot.recommendation).toBe('observe');
    expect(snapshot.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'insufficient-sample', severity: 'warning' }),
    ]));
  });

  it('recommends controlled demotion when error fallback or latency degrades', () => {
    const snapshot = createService().buildSnapshot([
      run('web-fallback', 'web', 'fallback-current-runtime', 'current-runtime-fallback', false, 900),
      run('cli-fallback', 'cli', 'fallback-current-runtime', 'current-runtime-fallback', false, 850),
      run('api-slow', 'api', 'observed', 'intelligence-fabric-default', true, 1000),
    ]);

    expect(snapshot.status).toBe('degraded');
    expect(snapshot.recommendation).toBe('auto_demote_controlled');
    expect(snapshot.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'error-fallback-rate-high', severity: 'blocker' }),
      expect.objectContaining({ id: 'p95-latency-high', severity: 'blocker' }),
    ]));
    expect(snapshot.receipts).toContain('intelligence-fabric-auto-demote-recommended');
  });
});

function createService(): IntelligenceFabricPostDefaultHealthService {
  return new IntelligenceFabricPostDefaultHealthService({
    now: () => new Date(now),
    thresholds: {
      minRuns: 3,
      maxFallbackRate: 0.4,
      maxErrorFallbackRate: 0.1,
      maxDisabledRate: 0.4,
      maxAverageLatencyMs: 250,
      maxP95LatencyMs: 600,
    },
  });
}

function run(
  id: string,
  channel: UniversalAgentChannel,
  fabricStatus: 'observed' | 'disabled' | 'fallback-current-runtime',
  selectedPath: 'intelligence-fabric-default' | 'current-runtime-fallback',
  oriented: boolean,
  latencyMs: number,
): UniversalAgentRun {
  return {
    id,
    requestId: `${id}-request`,
    traceId: `${id}-trace`,
    sessionId: `${id}-session`,
    userId: 'owner',
    channel,
    title: id,
    status: 'completed' as UniversalAgentRunStatus,
    createdAt: now,
    updatedAt: now,
    requestedTools: [],
    modelProfile: {
      providerLabel: 'Zavorth',
      modelLabel: 'modelo atual',
      routingPolicy: 'gateway',
      ready: true,
    },
    toolExposure: {
      mode: 'limited',
      allowed: [],
      blocked: [],
      risk: 'low',
      source: 'policy',
    },
    budget: {
      maxToolCalls: 0,
      maxRuntimeMs: 0,
      maxTokens: null,
    },
    approvals: [],
    artifacts: [],
    memorySignals: [],
    events: [],
    metadata: {
      intelligenceFabricCanary: {
        status: fabricStatus,
        selectedPath,
        orientation: {
          applied: oriented,
        },
        metrics: {
          totalLatencyMs: latencyMs,
        },
      },
    },
  };
}
