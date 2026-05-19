import {
  AgentRunService,
  TOOL_REHEARSAL_CONTRACT_VERSION,
  ToolRehearsalService,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-tool-rehearsal-${++index}`;
}

function createSensitiveRun() {
  return new AgentRunService({
    now: () => new Date('2026-05-04T00:36:00.000Z'),
    idFactory: createIdFactory(),
  }).createRun({
    userId: 'grey',
    channel: 'cli',
    sessionId: 'session-tool-rehearsal',
    text: 'corrija arquivos e rode npm test',
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    requestedTools: ['workspace.read', 'write_file', 'shell.exec'],
    metadata: {
      toolRehearsalRequired: true,
      targetPaths: ['src/runtime/agent', 'tests/runtime/agent'],
      requireApprovalFor: ['write_file', 'shell.exec'],
    },
  });
}

describe('ToolRehearsalService Tool Rehearsal', () => {
  it('builds a no-effect rehearsal proposal inside an approved scope', () => {
    const run = createSensitiveRun();
    const negotiation = run.metadata.capabilityNegotiation as any;
    run.metadata.capabilityNegotiation = {
      ...negotiation,
      status: 'approved',
      scope: {
        ...negotiation.scope,
        approved: true,
      },
    };

    const snapshot = new ToolRehearsalService({
      now: () => new Date('2026-05-04T00:37:00.000Z'),
    }).buildSnapshot({ run });

    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: TOOL_REHEARSAL_CONTRACT_VERSION,
      source: 'ToolRehearsalService',
      status: 'proposal',
      summary: expect.objectContaining({
        callCount: 3,
        dangerousCallCount: 2,
        scopeApproved: true,
        highestRisk: 'danger',
        budgetAllowed: true,
      }),
      policy: expect.objectContaining({
        noToolExecuted: true,
        noFilesystemMutation: true,
        noShellSpawned: true,
        noNetworkCall: true,
        realExecutionLimitedToRehearsedScope: true,
        secretsSerialized: false,
      }),
    }));
    expect(snapshot.calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        toolId: 'write_file',
        allowedByScope: true,
        approximateArguments: expect.objectContaining({
          patchMode: 'preview',
          mutationApplied: false,
        }),
      }),
      expect.objectContaining({
        toolId: 'shell.exec',
        expectedOutput: expect.stringContaining('exit code'),
      }),
    ]));
  });

  it('waits for Capability Negotiation when scope is not approved yet', () => {
    const snapshot = new ToolRehearsalService().buildSnapshot({
      run: createSensitiveRun(),
    });

    expect(snapshot.status).toBe('waiting-scope');
    expect(snapshot.summary.scopeApproved).toBe(false);
    expect(snapshot.nextSafeAction).toContain('Capability Negotiation');
    expect(snapshot.policy.noToolExecuted).toBe(true);
  });
});
