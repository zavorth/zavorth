import { ZavorthAgentGateway } from '../src/runtime/agent/ZavorthAgentGateway.js';
import type {
  UniversalAgentChannel,
  UniversalAgentExecutor,
  UniversalAgentRun,
} from '../src/runtime/agent/UniversalAgentRuntimeTypes.js';

type SurfaceScenario = {
  id: string;
  channel: UniversalAgentChannel;
  text: string;
};

type GateResult = {
  id: string;
  channel: UniversalAgentChannel;
  runId?: string;
  status: 'passed' | 'failed';
  details: string[];
};

const asJson = process.argv.includes('--json');

let idIndex = 0;
const idFactory = (prefix: string) => {
  idIndex += 1;
  return `${prefix}-surface-default-${idIndex}`;
};

const executorCalls: string[] = [];
const executor: UniversalAgentExecutor = ({ request }) => {
  executorCalls.push(`${request.channel}:${request.sessionId || 'session'}`);
  return {
    status: 'completed',
    summary: `Surface ${request.channel} respondeu pelo runtime atual.`,
    replyText: `Resposta ${request.channel} pelo runtime atual.`,
    metadata: {
      surfaceDefaultGateExecutor: true,
    },
  };
};

const gateway = new ZavorthAgentGateway({
  now: () => new Date('2026-05-08T14:00:00.000Z'),
  idFactory,
  executor,
});

const scenarios: SurfaceScenario[] = [
  { id: 'web-control', channel: 'web', text: 'oi, responda em uma frase' },
  { id: 'cli-command', channel: 'cli', text: 'explique rapidamente o status do projeto' },
  { id: 'telegram-chat', channel: 'telegram', text: 'oi zavorth' },
  { id: 'discord-chat', channel: 'discord', text: 'oi zavorth' },
  { id: 'public-api', channel: 'api', text: 'resuma a tarefa atual' },
  { id: 'unknown-safe-fallback', channel: 'unknown', text: 'hello, write a short response' },
];

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const results: GateResult[] = [];
  const originalConsoleLog = console.log;
  if (asJson) {
    console.log = () => undefined;
  }

  try {
    for (const scenario of scenarios) {
      const result = await gateway.handle({
        requestId: `${scenario.id}-request`,
        traceId: `${scenario.id}-trace`,
        userId: 'owner',
        sessionId: `${scenario.id}-session`,
        channel: scenario.channel,
        text: scenario.text,
        requestedTools: [],
        metadata: {
          capabilityNegotiationApproved: true,
          surfaceDefaultGate: scenario.id,
        },
      });
      results.push(validateRun(scenario, result.run));
    }
  } finally {
    console.log = originalConsoleLog;
  }

  const snapshot = gateway.buildSnapshot({ runLimit: 20 });
  const snapshotRunIds = new Set(snapshot.runs.map((run) => run.id));
  for (const result of results) {
    if (result.runId && !snapshotRunIds.has(result.runId)) {
      result.status = 'failed';
      result.details.push('run missing from gateway snapshot');
    }
  }

  const failed = results.filter((result) => result.status === 'failed');
  const output = {
    generatedAt: new Date('2026-05-08T14:00:00.000Z').toISOString(),
    status: failed.length > 0 ? 'failed' : 'passed',
    summary: {
      scenarios: results.length,
      passed: results.length - failed.length,
      failed: failed.length,
      executorCalls: executorCalls.length,
    },
    results,
  };

  if (asJson) {
    originalConsoleLog(JSON.stringify(output, null, 2));
  } else {
    originalConsoleLog('[intelligence-fabric-surfaces] checking surface default routing');
    for (const result of results) {
      const marker = result.status === 'passed' ? 'ok' : 'fail';
      originalConsoleLog(`[intelligence-fabric-surfaces] ${marker} ${result.id} (${result.channel})`);
      for (const detail of result.details) {
        originalConsoleLog(`  - ${detail}`);
      }
    }
  }

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

function validateRun(scenario: SurfaceScenario, run: UniversalAgentRun): GateResult {
  const details: string[] = [];
  const metadata = record(run.metadata);
  const fabric = record(metadata.intelligenceFabricCanary);
  const fabricSnapshot = record(fabric.fabric);
  const contextPack = record(metadata.intelligenceFabricContextPack);
  const orientation = record(fabric.orientation);
  const fallback = record(fabric.fallback);
  const safety = record(fabric.safety);

  expect(details, run.channel === scenario.channel, `run channel changed from ${scenario.channel} to ${run.channel}`);
  expect(details, fabric.mode === 'default', 'Fabric mode must be default');
  expect(details, fabric.selectedPath === 'intelligence-fabric-default', 'Fabric must select the default path');
  expect(details, fabric.dispatchTarget === 'current-runtime', 'Fabric must retain current runtime dispatch');
  expect(details, fallback.route === 'current-runtime', 'Fallback route must remain current runtime');
  expect(details, safety.currentRuntimeFallbackRetained === true, 'Current runtime fallback must be retained');
  expect(details, safety.defaultRuntimeChanged === false, 'Default promotion must not replace executor dispatch');
  expect(details, orientation.applied === true, 'Risk 0-2 orientation must apply for safe surface requests');
  expect(details, orientation.scope === 'risk-0-2-safe', 'Safe surface request must stay in risk-0-2 orientation');
  expect(details, orientation.executorDispatchChanged === false, 'Executor dispatch must not change');
  expect(details, orientation.toolExecutionChanged === false, 'Tool execution must not change');
  expect(details, contextPack.source === 'IntelligenceFabricDefault', 'Context pack must be sourced from Fabric default');
  expect(details, contextPack.riskLevel === 0, 'Surface default smoke request must remain risk 0');
  expect(details, fabricSnapshot.trustMode === 'local_owner', 'Local owner must be the default trust mode for owner-run surfaces');
  expect(details, fabricSnapshot.trustSource === 'owner_local_default', 'Owner-run surfaces must use the local owner default trust source');
  expect(details, fabricSnapshot.trustOwnerLocalDefault === true, 'Owner-run surfaces must mark owner local default');
  expect(details, run.status === 'completed', `run should complete, got ${run.status}`);

  return {
    id: scenario.id,
    channel: scenario.channel,
    runId: run.id,
    status: details.length > 0 ? 'failed' : 'passed',
    details,
  };
}

function expect(details: string[], condition: boolean, message: string): void {
  if (!condition) {
    details.push(message);
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
