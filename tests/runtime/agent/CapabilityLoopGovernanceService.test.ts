import {
  CapabilityLoopGovernanceService,
  type UniversalAgentRun,
} from '../../../src/runtime/agent/index.js';

function createRun(overrides: Partial<UniversalAgentRun> = {}): UniversalAgentRun {
  const now = '2026-05-03T13:00:00.000Z';
  return {
    id: 'agent-run-c5',
    traceId: 'trace-c5',
    requestId: 'request-c5',
    sessionId: 'session-c5',
    userId: 'grey',
    channel: 'web',
    title: 'C5',
    input: 'use Echo',
    workspace: 'C:/repo/Zavorth',
    status: 'waiting_approval',
    createdAt: now,
    updatedAt: now,
    summary: 'Aguardando approval.',
    events: [
      {
        id: 'event-echo',
        runId: 'agent-run-c5',
        kind: 'approval',
        title: 'Aprovar Echo hands',
        detail: 'Echo exige approval.',
        status: 'pending',
        createdAt: now,
      },
    ],
    toolExposure: {
      mode: 'restricted',
      summary: '1 ferramenta exposta com policy restricted.',
      tools: [
        {
          id: 'echo_hands',
          label: 'Echo hands',
          capabilityId: 'echo_hands',
          group: 'local_control',
          risk: 'danger',
          requiresApproval: true,
          policyTags: ['capability:echo', 'approval-required'],
        },
      ],
      blockedTools: [],
    },
    replyPorts: [
      {
        id: 'web:primary',
        label: 'Command Center',
        kind: 'web',
        status: 'available',
        primary: true,
      },
    ],
    modelProfile: {
      providerLabel: 'OpenAI',
      modelLabel: 'gpt-5.2',
      routingPolicy: 'direct',
    },
    approvals: [],
    artifacts: [],
    memorySignals: [],
    metadata: {
      trustSlider: {
        level: 'collaborator',
        sandboxTier: 'workspace-scoped',
      },
    },
    ...overrides,
  };
}

describe('CapabilityLoopGovernanceService', () => {
  it('builds a C5 governance entry for every strong capability', () => {
    const service = new CapabilityLoopGovernanceService();
    const snapshot = service.buildSnapshot({
      run: createRun(),
      request: {
        userId: 'grey',
        channel: 'web',
        sessionId: 'session-c5',
        text: 'use Echo',
        requestedTools: ['echo_hands'],
      },
      generatedAt: '2026-05-03T13:00:00.000Z',
    });

    expect(snapshot).toEqual(expect.objectContaining({
      schemaVersion: 1,
      source: 'CapabilityLoopGovernanceService',
      trustMode: 'collaborator',
      sandboxTier: 'workspace-scoped',
    }));
    expect(snapshot.capabilities).toHaveLength(13);
    expect(snapshot.requestedCapabilityIds).toEqual(expect.arrayContaining([
      'echo.hands',
      'session.ownership',
      'timing.canonical',
    ]));

    const echo = snapshot.capabilities.find((entry) => entry.capabilityId === 'echo.hands');
    expect(echo).toEqual(expect.objectContaining({
      status: 'waiting_approval',
      requested: true,
      policy: expect.objectContaining({
        mode: 'governed-tool',
        permission: 'approval',
      }),
      exposureProfile: expect.objectContaining({
        exposedToolIds: ['echo_hands'],
        risk: 'danger',
        requiresApproval: true,
      }),
      fallback: expect.objectContaining({
        honest: true,
      }),
      controlSurface: expect.objectContaining({
        statusPath: '/control/runs/agent-run-c5#tools',
      }),
    }));
    expect(echo?.receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'policy' }),
      expect.objectContaining({ kind: 'request' }),
      expect.objectContaining({ kind: 'approval' }),
    ]));
    expect(echo?.observability.eventTitles).toContain('Aprovar Echo hands');
  });

  it('marks skill and MCP snapshots degraded when quarantine appears in cold context', () => {
    const service = new CapabilityLoopGovernanceService();
    const snapshot = service.buildSnapshot({
      run: createRun({
        status: 'completed',
        toolExposure: {
          mode: 'safe',
          summary: 'Sem tools fortes.',
          tools: [],
          blockedTools: [],
        },
        metadata: {
          trustSlider: {
            level: 'collaborator',
            sandboxTier: 'workspace-scoped',
          },
          importedCapabilityTrust: {
            skill: { trusted: 1, safe: 0, quarantined: 1 },
            mcp: { trusted: 1, safe: 0, quarantined: 1 },
          },
        },
      }),
      request: {
        userId: 'grey',
        channel: 'web',
        sessionId: 'session-c5',
        text: 'use skills e MCP',
        requestedTools: [],
      },
      generatedAt: '2026-05-03T13:05:00.000Z',
    });

    expect(snapshot.degradedCapabilityIds).toEqual(expect.arrayContaining([
      'skills.snapshot',
      'mcp.snapshot',
    ]));
    expect(snapshot.capabilities.find((entry) => entry.capabilityId === 'skills.snapshot'))
      .toEqual(expect.objectContaining({
        status: 'degraded',
        fallback: expect.objectContaining({
          summary: expect.stringContaining('quarentena'),
        }),
      }));
    expect(snapshot.capabilities.find((entry) => entry.capabilityId === 'mcp.snapshot')?.receipts)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: 'fallback' }),
      ]));
  });
});
