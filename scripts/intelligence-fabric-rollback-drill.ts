import {
  AgentRunService,
  queryUniversalAgentRuns,
  type UniversalAgentExecutor,
  type UniversalAgentRun,
} from '../src/runtime/agent/index.js';

type DrillScenario = {
  id: string;
  run: UniversalAgentRun;
  expectedStatus: 'disabled' | 'fallback-current-runtime';
};

type DrillResult = {
  id: string;
  runId: string;
  status: 'passed' | 'failed';
  details: string[];
};

const asJson = process.argv.includes('--json');

let idIndex = 0;
const idFactory = (prefix: string) => {
  idIndex += 1;
  return `${prefix}-fabric-rollback-${idIndex}`;
};

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const scenarios = await buildScenarios();
  const snapshot = queryUniversalAgentRuns({
    runs: scenarios.map((scenario) => scenario.run),
    generatedAt: '2026-05-08T14:00:00.000Z',
  });
  const results = scenarios.map((scenario) => validateScenario(scenario, snapshot.receipts));
  const failed = results.filter((result) => result.status === 'failed');
  const output = {
    generatedAt: '2026-05-08T14:00:00.000Z',
    status: failed.length > 0 ? 'failed' : 'passed',
    summary: {
      scenarios: results.length,
      passed: results.length - failed.length,
      failed: failed.length,
      observatoryReceipts: snapshot.receipts.length,
      fabricReceipts: snapshot.receipts.filter((receipt) => receipt.source === 'AgentRunIntelligenceFabricCanary').length,
    },
    results,
  };

  if (asJson) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log('[intelligence-fabric-rollback] checking rollback and observability drill');
    for (const result of results) {
      const marker = result.status === 'passed' ? 'ok' : 'fail';
      console.log(`[intelligence-fabric-rollback] ${marker} ${result.id} (${result.runId})`);
      for (const detail of result.details) {
        console.log(`  - ${detail}`);
      }
    }
  }

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

async function buildScenarios(): Promise<DrillScenario[]> {
  const scenarios: DrillScenario[] = [];

  scenarios.push(await runScenario({
    id: 'request-disabled',
    service: new AgentRunService({
      now: () => new Date('2026-05-08T14:00:00.000Z'),
      idFactory,
      executor: executorFor('request-disabled'),
    }),
    text: 'responda sem usar o fabric nesta execucao',
    metadata: {
      capabilityNegotiationApproved: true,
      intelligenceFabricMode: 'disabled',
    },
    expectedStatus: 'disabled',
  }));

  scenarios.push(await runScenario({
    id: 'runtime-disabled',
    service: new AgentRunService({
      now: () => new Date('2026-05-08T14:00:00.000Z'),
      idFactory,
      executor: executorFor('runtime-disabled'),
      intelligenceFabricMode: 'disabled',
    }),
    text: 'responda com fabric desligado no runtime',
    metadata: {
      capabilityNegotiationApproved: true,
    },
    expectedStatus: 'disabled',
  }));

  scenarios.push(await runScenario({
    id: 'fabric-error-fallback',
    service: new AgentRunService({
      now: () => new Date('2026-05-08T14:00:00.000Z'),
      idFactory,
      executor: executorFor('fabric-error-fallback'),
      intelligenceFabric: {
        buildShadowSnapshot: () => {
          throw new Error('rollback drill fixture failure');
        },
      },
    }),
    text: 'responda mesmo se o fabric falhar',
    metadata: {
      capabilityNegotiationApproved: true,
    },
    expectedStatus: 'fallback-current-runtime',
  }));

  return scenarios;
}

function executorFor(label: string): UniversalAgentExecutor {
  const executor: UniversalAgentExecutor = () => ({
    status: 'completed',
    summary: `Runtime atual respondeu no drill ${label}.`,
    replyText: `Runtime atual respondeu no drill ${label}.`,
  });
  return executor;
}

async function runScenario(input: {
  id: string;
  service: AgentRunService;
  text: string;
  metadata: Record<string, unknown>;
  expectedStatus: 'disabled' | 'fallback-current-runtime';
}): Promise<DrillScenario> {
  const service = input.service;
  const originalRun = service.run.bind(service);
  const result = await originalRun({
    userId: 'owner',
    channel: 'web',
    sessionId: `${input.id}-session`,
    text: input.text,
    requestedTools: [],
    metadata: input.metadata,
  });
  return {
    id: input.id,
    run: result.run,
    expectedStatus: input.expectedStatus,
  };
}

function validateScenario(
  scenario: DrillScenario,
  receipts: Array<{ runId: string; source: string; title: string; metadata?: Record<string, unknown> }>,
): DrillResult {
  const details: string[] = [];
  const metadata = record(scenario.run.metadata.intelligenceFabricCanary);
  const orientation = record(metadata.orientation);
  const safety = record(metadata.safety);
  const fallback = record(metadata.fallback);
  const receipt = receipts.find((entry) => (
    entry.runId === scenario.run.id
    && entry.source === 'AgentRunIntelligenceFabricCanary'
  ));
  const receiptMetadata = record(receipt?.metadata);

  expect(details, scenario.run.status === 'completed', `run should complete through current runtime, got ${scenario.run.status}`);
  expect(details, metadata.status === scenario.expectedStatus, `expected fabric status ${scenario.expectedStatus}, got ${String(metadata.status)}`);
  expect(details, metadata.selectedPath === 'current-runtime-fallback', 'selected path must stay current-runtime-fallback');
  expect(details, metadata.dispatchTarget === 'current-runtime', 'dispatch target must stay current-runtime');
  expect(details, fallback.route === 'current-runtime', 'fallback route must stay current-runtime');
  expect(details, safety.currentRuntimeFallbackRetained === true, 'current runtime fallback must be retained');
  expect(details, safety.defaultRuntimeChanged === false, 'default runtime must not be changed');
  expect(details, orientation.applied === false, 'rollback drill must not apply orientation');
  expect(details, scenario.run.metadata.intelligenceFabricContextPack === undefined, 'disabled/fallback drill must not attach context pack');
  expect(details, scenario.run.metadata.modelPickerSelection === undefined || scenario.run.metadata.modelPickerSelection === null, 'disabled/fallback drill must not override model selection');
  expect(details, Boolean(receipt), 'Run Observatory must expose an Intelligence Fabric receipt');
  expect(details, receiptMetadata.status === scenario.expectedStatus, `receipt must expose ${scenario.expectedStatus}`);
  expect(details, receiptMetadata.selectedPath === 'current-runtime-fallback', 'receipt must expose current-runtime-fallback path');
  expect(details, receiptMetadata.currentRuntimeFallbackRetained === true, 'receipt must expose retained fallback');

  return {
    id: scenario.id,
    runId: scenario.run.id,
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
