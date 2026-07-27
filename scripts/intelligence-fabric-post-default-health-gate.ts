import {
  IntelligenceFabricPostDefaultHealthService,
  type IntelligenceFabricPostDefaultHealthSnapshot,
} from '../src/services/IntelligenceFabricPostDefaultHealthService.js';
import type {
  UniversalAgentChannel,
  UniversalAgentRun,
  UniversalAgentRunStatus,
} from '../src/runtime/agent/UniversalAgentRuntimeTypes.js';

type GateResult = {
  id: string;
  status: 'passed' | 'failed';
  details: string[];
  snapshot: IntelligenceFabricPostDefaultHealthSnapshot;
};

const asJson = process.argv.includes('--json');
const now = '2026-05-08T14:00:00.000Z';

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const service = new IntelligenceFabricPostDefaultHealthService({
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
  const healthy = service.buildSnapshot([
    run('healthy-web', 'web', 'observed', 'intelligence-fabric-default', true, 42),
    run('healthy-cli', 'cli', 'observed', 'intelligence-fabric-default', true, 55),
    run('healthy-api', 'api', 'observed', 'intelligence-fabric-default', true, 61),
  ]);
  const attention = service.buildSnapshot([
    run('attention-web', 'web', 'observed', 'intelligence-fabric-default', true, 42),
  ]);
  const degraded = service.buildSnapshot([
    run('degraded-a', 'web', 'fallback-current-runtime', 'current-runtime-fallback', false, 900),
    run('degraded-b', 'cli', 'fallback-current-runtime', 'current-runtime-fallback', false, 850),
    run('degraded-c', 'api', 'observed', 'intelligence-fabric-default', true, 1000),
  ]);

  const results = [
    expectSnapshot('healthy-maintain-default', healthy, 'ready', 'maintain_default', [
      'post-default-health-ready',
    ]),
    expectSnapshot('small-sample-observe', attention, 'attention', 'observe', [
      'insufficient-sample',
    ]),
    expectSnapshot('degraded-auto-demote', degraded, 'degraded', 'auto_demote_controlled', [
      'error-fallback-rate-high',
      'p95-latency-high',
    ]),
  ];
  const failed = results.filter((result) => result.status === 'failed');
  const output = {
    generatedAt: now,
    status: failed.length > 0 ? 'failed' : 'passed',
    summary: {
      scenarios: results.length,
      passed: results.length - failed.length,
      failed: failed.length,
    },
    results,
  };

  if (asJson) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log('[intelligence-fabric-health] checking post-default health gate');
    for (const result of results) {
      const marker = result.status === 'passed' ? 'ok' : 'fail';
      console.log(`[intelligence-fabric-health] ${marker} ${result.id}: ${result.snapshot.status}/${result.snapshot.recommendation}`);
      for (const detail of result.details) {
        console.log(`  - ${detail}`);
      }
    }
  }

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

function expectSnapshot(
  id: string,
  snapshot: IntelligenceFabricPostDefaultHealthSnapshot,
  status: IntelligenceFabricPostDefaultHealthSnapshot['status'],
  recommendation: IntelligenceFabricPostDefaultHealthSnapshot['recommendation'],
  findingIds: string[],
): GateResult {
  const details: string[] = [];
  expect(details, snapshot.status === status, `expected status ${status}, got ${snapshot.status}`);
  expect(details, snapshot.recommendation === recommendation, `expected recommendation ${recommendation}, got ${snapshot.recommendation}`);
  for (const findingId of findingIds) {
    expect(details, snapshot.findings.some((finding) => finding.id === findingId), `missing finding ${findingId}`);
  }
  expect(details, snapshot.rollback.available === true, 'rollback must be available');
  expect(details, snapshot.rollback.demoteMode === 'disabled', 'demote mode must be disabled');
  expect(details, snapshot.receipts.includes('intelligence-fabric-post-default-health'), 'health receipt missing');
  return {
    id,
    status: details.length > 0 ? 'failed' : 'passed',
    details,
    snapshot,
  };
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
      modelLabel: 'modelo current',
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
        source: 'AgentRunIntelligenceFabricCanary',
        mode: 'default',
        status: fabricStatus,
        selectedPath,
        dispatchTarget: 'current-runtime',
        fallback: {
          route: 'current-runtime',
          reason: fabricStatus === 'fallback-current-runtime'
            ? 'fixture fallback'
            : 'fallback retained',
        },
        rollback: {
          strategy: 'Set intelligenceFabricMode=disabled at runtime or request metadata.',
        },
        safety: {
          currentRuntimeFallbackRetained: true,
          defaultRuntimeChanged: false,
        },
        orientation: {
          applied: oriented,
          scope: oriented ? 'risk-0-2-safe' : 'fallback',
        },
        metrics: {
          totalLatencyMs: latencyMs,
        },
      },
    },
  };
}

function expect(details: string[], condition: boolean, message: string): void {
  if (!condition) {
    details.push(message);
  }
}
