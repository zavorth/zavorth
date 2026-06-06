import * as http from 'http';
import {
  IntelligenceFabricPostDefaultHealthService,
  type IntelligenceFabricPostDefaultHealthSnapshot,
} from '../src/services/IntelligenceFabricPostDefaultHealthService.js';
import { WebAppRuntimeInteractionRouteService } from '../src/domain/surface/presentation/web-app/WebAppRuntimeInteractionRouteService.js';
import type { WebAppRuntimeRouteDeps } from '../src/domain/surface/presentation/web-app/WebAppRuntimeRouteService.js';
import type {
  UniversalAgentChannel,
  UniversalAgentRun,
  UniversalAgentRunStatus,
} from '../src/runtime/agent/UniversalAgentRuntimeTypes.js';

const operationalCycleSafetyInvariant = 'No external action, install, deploy, secret access, or shell execution';

type CycleCheck = {
  id: string;
  status: 'passed' | 'failed';
  details: string[];
};

const asJson = process.argv.includes('--json');
const now = '2026-05-08T15:00:00.000Z';

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const health = buildDegradedHealth();
  const routeResult = await runZavorthControlDemoteRoute(health);
  const checks = [
    checkHealthDemotionReadiness(health),
    checkZavorthControlDemoteRequest(routeResult),
    checkRollbackPath(routeResult),
  ];
  const failed = checks.filter((check) => check.status === 'failed');
  const output = {
    generatedAt: now,
    status: failed.length > 0 ? 'failed' : 'passed',
    summary: {
      checks: checks.length,
      passed: checks.length - failed.length,
      failed: failed.length,
      healthStatus: health.status,
      recommendation: health.recommendation,
      demoteEndpoint: '/api/web/agent-runs/demote-fabric',
      modeApplied: routeResult.response?.demote?.mode ?? null,
      globalRuntimeChanged: routeResult.response?.demote?.globalRuntimeChanged ?? null,
    },
    checks,
  };

  if (asJson) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log('[intelligence-fabric-operational-cycle] checking degraded health to controlled demote cycle');
    for (const check of checks) {
      const marker = check.status === 'passed' ? 'ok' : 'fail';
      console.log(`[intelligence-fabric-operational-cycle] ${marker} ${check.id}`);
      for (const detail of check.details) {
        console.log(`  - ${detail}`);
      }
    }
  }

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

function buildDegradedHealth(): IntelligenceFabricPostDefaultHealthSnapshot {
  const service = new IntelligenceFabricPostDefaultHealthService({
    now: () => new Date(now),
    thresholds: {
      minRuns: 3,
      maxFallbackRate: 0.25,
      maxErrorFallbackRate: 0.05,
      maxDisabledRate: 0.4,
      maxAverageLatencyMs: 250,
      maxP95LatencyMs: 600,
    },
  });
  return service.buildSnapshot([
    run('cycle-fallback-web', 'web', 'fallback-current-runtime', 'current-runtime-fallback', false, 950),
    run('cycle-fallback-cli', 'cli', 'fallback-current-runtime', 'current-runtime-fallback', false, 875),
    run('cycle-observed-api', 'api', 'observed', 'intelligence-fabric-default', true, 1000),
  ]);
}

async function runZavorthControlDemoteRoute(health: IntelligenceFabricPostDefaultHealthSnapshot): Promise<{
  response: Record<string, any> | null;
  statusCode: number | null;
  gatewayRequest: Record<string, any> | null;
}> {
  const service = new WebAppRuntimeInteractionRouteService();
  const sourceRun = {
    id: 'cycle-health-run',
    traceId: 'cycle-health-trace',
    sessionId: 'cycle-session',
    userId: 'owner',
    workspace: 'C:/repo',
    modelProfile: {
      providerLabel: 'Zavorth',
      modelLabel: 'modelo atual',
    },
  };
  const demoteRun = {
    ...sourceRun,
    id: 'cycle-demote-run',
    status: 'completed',
    summary: 'Demote controlado aplicado.',
  };
  let response: Record<string, any> | null = null;
  let statusCode: number | null = null;
  let gatewayRequest: Record<string, any> | null = null;
  const deps: WebAppRuntimeRouteDeps = {
    runtime: {
      webUserId: 'owner',
    } as any,
    agentGateway: {
      buildSnapshot: (options?: any) => ({
        generatedAt: now,
        activeRun: options?.activeRunId === demoteRun.id ? demoteRun : sourceRun,
        runs: [sourceRun, demoteRun],
      }),
      handle: async (request: any) => {
        gatewayRequest = request;
        return {
          ok: true,
          run: demoteRun,
          replies: [
            {
              id: 'cycle-demote-reply',
              runId: demoteRun.id,
              text: 'Fabric desativado por health degradado.',
            },
          ],
        };
      },
    } as any,
    readJsonBody: async () => ({
      runId: sourceRun.id,
      sessionId: sourceRun.sessionId,
      status: health.status,
      recommendation: health.recommendation,
      rollbackInstruction: health.rollback.instruction,
      confirmOwnerControlledDemote: true,
    }),
    writeJson: (_res: http.ServerResponse, payload: any, code: number) => {
      response = payload;
      statusCode = code;
    },
  } as any;

  await service.handleRequest(
    { method: 'POST' } as http.IncomingMessage,
    {} as http.ServerResponse,
    new URL('http://localhost/api/web/agent-runs/demote-fabric'),
    '/api/web/agent-runs/demote-fabric',
    deps,
    {} as any,
  );

  return { response, statusCode, gatewayRequest };
}

function checkHealthDemotionReadiness(health: IntelligenceFabricPostDefaultHealthSnapshot): CycleCheck {
  const details: string[] = [];
  expect(details, health.status === 'degraded', `expected degraded health, got ${health.status}`);
  expect(details, health.recommendation === 'auto_demote_controlled', `expected auto_demote_controlled, got ${health.recommendation}`);
  expect(details, health.rollback.available === true, 'controlled rollback must be available');
  expect(details, health.rollback.demoteMode === 'disabled', 'controlled demote mode must be disabled');
  expect(details, health.rollback.destructive === false, 'controlled demote must be non-destructive');
  return result('degraded-health-recommends-controlled-demote', details);
}

function checkZavorthControlDemoteRequest(routeResult: {
  response: Record<string, any> | null;
  statusCode: number | null;
  gatewayRequest: Record<string, any> | null;
}): CycleCheck {
  const details: string[] = [];
  const request = routeResult.gatewayRequest || {};
  const metadata = record(request.metadata);
  const demote = record(metadata.zavorthControlDemoteFabric);
  expect(details, routeResult.statusCode === 200, `expected HTTP 200, got ${String(routeResult.statusCode)}`);
  expect(details, request.requestId === 'zavorthControl-demote-fabric', 'demote must re-enter the canonical agent gateway');
  expect(details, metadata.intelligenceFabricMode === 'disabled', 'demote request must set request-level disabled mode');
  expect(details, metadata.intelligenceFabricDemoteControlled === true, 'demote request must carry controlled receipt marker');
  expect(details, demote.confirmOwnerControlledDemote === true, 'demote must require explicit owner confirmation');
  expect(details, demote.recommendation === 'auto_demote_controlled', 'demote metadata must preserve health recommendation');
  return result('zavorthControl-demote-route-is-owner-confirmed', details);
}

function checkRollbackPath(routeResult: {
  response: Record<string, any> | null;
  statusCode: number | null;
  gatewayRequest: Record<string, any> | null;
}): CycleCheck {
  const details: string[] = [];
  const response = routeResult.response || {};
  const demote = record(response.demote);
  expect(details, demote.mode === 'disabled', 'response must expose disabled demote mode');
  expect(details, demote.appliedTo === 'request', 'demote must be scoped to request/runtime metadata, not hidden global mutation');
  expect(details, demote.globalRuntimeChanged === false, 'demote must not silently mutate global runtime defaults');
  expect(details, typeof demote.rollbackInstruction === 'string' && demote.rollbackInstruction.includes('intelligenceFabricMode=disabled'), 'rollback instruction must explain how to re-enable');
  return result('rollback-path-is-non-destructive-and-explicit', details);
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

function result(id: string, details: string[]): CycleCheck {
  return {
    id,
    status: details.length > 0 ? 'failed' : 'passed',
    details,
  };
}

function expect(details: string[], condition: boolean, message: string): void {
  if (!condition) {
    details.push(message);
  }
}

function record(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}
