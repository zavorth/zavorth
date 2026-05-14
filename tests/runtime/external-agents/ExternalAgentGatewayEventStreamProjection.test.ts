import {
  buildZavorthCommandCenterAssimilationSnapshot,
} from '../../../src/ai-gateway/app/(dashboard)/control/command-center/projections/index.js';
import {
  COMMAND_CENTER_RUNTIME_PROJECTION_VERSION,
  type CommandCenterRuntimeProjection,
} from '../../../src/ai-gateway/app/(dashboard)/control/command-center/projections/commandCenterRuntimeProjection.js';
import {
  EXTERNAL_AGENT_WAVE1_FIXTURE_NOW,
  EXTERNAL_AGENT_WAVE1_SOURCE_RUNTIME_NAME,
  createWave1GatewayEventStreamFixtures,
  normalizeWave1GatewayEventStream,
} from '../../../src/runtime/external-agents/index.js';

function buildProjectionFromWave1Stream(
  normalized: ReturnType<typeof normalizeWave1GatewayEventStream>,
): CommandCenterRuntimeProjection {
  return {
    projectionVersion: COMMAND_CENTER_RUNTIME_PROJECTION_VERSION,
    generatedAt: EXTERNAL_AGENT_WAVE1_FIXTURE_NOW,
    adapterSource: {
      kind: 'universal-agent-runtime',
      label: 'Zavorth Agent Gateway',
      version: 'wave1-event-stream-fixture',
    },
    runtimeStatus: 'ready',
    wsStatus: 'connected',
    runtime: {
      status: 'ready',
    },
    activeSessionId: 'external:wave1-source-session',
    effectiveSessionId: 'external:wave1-source-session',
    productModeId: 'agent',
    productModeLabel: 'agent',
    agentRun: null,
    sessions: [
      {
        id: 'external:wave1-source-session',
        title: 'Wave 1 projected source session',
        updatedAt: EXTERNAL_AGENT_WAVE1_FIXTURE_NOW,
        status: 'active',
        channelLabel: 'api',
        messageCount: normalized.envelopes.length,
      },
    ],
    messages: [],
    tasks: [],
    events: normalized.envelopes.map((envelope) => ({
      id: envelope.id,
      kind: envelope.kind === 'health' ? 'status' : 'tool',
      title: 'External event normalized',
      detail: `${envelope.payload.rawType} order:${envelope.payload.data?.sequence}`,
      status: 'done',
    })),
    approvals: [],
    artifacts: [],
    memorySignals: [],
    capabilities: [],
    toolExposure: {
      mode: 'unknown',
      summary: 'Wave 1 event stream projection fixture.',
      tools: [],
    },
    budget: null,
    replay: null,
    replyPorts: [],
    modelProfile: null,
    health: {
      status: 'ready',
      summary: 'Wave 1 event stream projected through Zavorth.',
      checks: [],
    },
    releaseStatus: null,
    integrations: [],
    identity: null,
    logs: [],
    workflowJobs: [],
    runtimeWarnings: [],
  };
}

describe('Wave 1 gateway event stream projection fixture parity', () => {
  it('orders and deduplicates source event fixtures before Command Center projection', () => {
    const normalized = normalizeWave1GatewayEventStream(createWave1GatewayEventStreamFixtures());
    const projection = buildProjectionFromWave1Stream(normalized);
    const snapshot = buildZavorthCommandCenterAssimilationSnapshot({
      projection,
      identityLeakTerms: [EXTERNAL_AGENT_WAVE1_SOURCE_RUNTIME_NAME],
      now: () => new Date(EXTERNAL_AGENT_WAVE1_FIXTURE_NOW),
    });

    expect(normalized.sourceEventBusIntroduced).toBe(false);
    expect(normalized.order).toEqual([
      {
        id: 'wave1-stream-event-1',
        sequence: 1,
        idempotencyKey: 'wave1-stream-key-1',
      },
      {
        id: 'wave1-stream-event-2',
        sequence: 2,
        idempotencyKey: 'wave1-stream-key-2',
      },
    ]);
    expect(normalized.duplicateEventIds).toEqual(['wave1-stream-event-2-duplicate']);
    expect(snapshot.operationalEvents.map((event) => event.id)).toEqual([
      'zavorth-event:wave1-stream-event-1',
      'zavorth-event:wave1-stream-event-2',
    ]);
    expect(snapshot.operationalEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: 'zavorth',
        status: 'done',
        severity: 'info',
        sessionId: 'external:wave1-source-session',
      }),
    ]));
    expect(snapshot.identityLeakScan).toEqual(expect.objectContaining({
      checked: true,
      passed: true,
      leakCount: 0,
    }));
  });
});
