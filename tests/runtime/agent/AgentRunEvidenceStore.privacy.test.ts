import { AgentRunEvidenceStore } from '../../../src/runtime/agent/AgentRunEvidenceStore.js';
import type { UniversalAgentRun } from '../../../src/runtime/agent/UniversalAgentRuntimeTypes.js';

function createRun(): UniversalAgentRun {
  return {
    id: 'run-privacy',
    traceId: 'trace-privacy',
    requestId: 'request-privacy',
    sessionId: 'session-privacy',
    userId: 'user-privacy',
    channel: 'web',
    title: 'Privacy run',
    input: 'hello',
    status: 'running',
    createdAt: '2026-05-07T00:00:00.000Z',
    updatedAt: '2026-05-07T00:00:00.000Z',
    summary: 'summary',
    events: [],
    toolExposure: {
      mode: 'safe',
      summary: 'safe',
      tools: [],
    },
    replyPorts: [],
    modelProfile: {
      providerLabel: 'test',
      modelLabel: 'test',
      routingPolicy: 'direct',
    },
    approvals: [],
    artifacts: [],
    memorySignals: [],
    metadata: {},
  };
}

describe('AgentRunEvidenceStore privacy', () => {
  it('redacts sensitive values before serializing evidence snapshots into run metadata', () => {
    const store = new AgentRunEvidenceStore();
    const run = createRun();

    store.put(run, 'providerSnapshot', {
      status: 'ready',
      generatedAt: '2026-05-07T00:00:00.000Z',
      apiKey: 'sk-testabcdefghijklmnopqrstuvwxyz',
      authorization: 'Bearer abcdefghijklmnopqrstuvwxyz',
      contact: 'owner@example.com',
      nested: {
        client_secret: 'secret-value',
      },
    });

    const serialized = JSON.stringify(run.metadata.evidenceRefs);

    expect(serialized).toContain('[redacted]');
    expect(serialized).toContain('[email-redacted]');
    expect(serialized).not.toContain('sk-test');
    expect(serialized).not.toContain('abcdefghijklmnopqrstuvwxyz');
    expect(serialized).not.toContain('owner@example.com');
    expect(serialized).not.toContain('secret-value');
  });
});
