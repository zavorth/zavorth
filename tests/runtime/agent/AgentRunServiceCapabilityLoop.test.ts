import { AgentRunService, ZavorthAgentGateway } from '../../../src/runtime/agent/index.js';
import type { UniversalAgentExecutor } from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-${++index}`;
}

describe('AgentRunService capability loop governance', () => {
  it('records C5 governance metadata on ordinary runs', async () => {
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
      status: 'completed',
      summary: 'Run comum completed.',
      replyText: 'ok',
    }));
    const service = new AgentRunService({
      now: () => new Date('2026-05-03T13:10:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'cli:c5',
      text: 'responda oi',
      requestedTools: [],
    });

    expect(result.run.metadata.capabilityLoopGovernance).toEqual(
      expect.objectContaining({
        schemaVersion: 1,
        source: 'CapabilityLoopGovernanceService',
        trustMode: 'collaborator',
        sandboxTier: 'workspace-scoped',
        capabilities: expect.arrayContaining([
          expect.objectContaining({
            capabilityId: 'session.ownership',
            status: 'requested',
            policy: expect.objectContaining({ mode: 'runtime-invariant' }),
            receipts: expect.arrayContaining([expect.objectContaining({ kind: 'policy' })]),
          }),
          expect.objectContaining({
            capabilityId: 'timing.canonical',
            status: 'requested',
            controlSurface: expect.objectContaining({
              command: 'zavorth status --run agent-run-2',
            }),
          }),
        ]),
      }),
    );
    expect(result.run.metadata.capabilityLoopStatus).toEqual(
      expect.objectContaining({
        source: 'CapabilityLoopGovernanceService',
        requestedCapabilityIds: expect.arrayContaining(['session.ownership', 'timing.canonical']),
      }),
    );
    expect(result.run.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Governed capability loop',
          status: 'done',
        }),
      ]),
    );
  });

  it('projects Echo Hands as a governed strong capability waiting for approval', async () => {
    const executor = jest.fn();
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-03T13:15:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'web:c5-echo',
      text: 'abra o navegador com Echo',
      requestedTools: ['echo_hands'],
    });
    const snapshot = gateway.buildSnapshot({ activeRunId: result.run.id });

    expect(executor).not.toHaveBeenCalled();
    expect(result.run.status).toBe('waiting_approval');
    expect(snapshot.capabilityLoopGovernance).toEqual(
      expect.objectContaining({
        source: 'CapabilityLoopGovernanceService',
        requestedCapabilityIds: expect.arrayContaining(['echo.hands']),
      }),
    );
    expect(
      snapshot.capabilityLoopGovernance?.capabilities.find((entry) => entry.capabilityId === 'echo.hands'),
    ).toEqual(
      expect.objectContaining({
        status: 'waiting_approval',
        policy: expect.objectContaining({
          mode: 'governed-tool',
          permission: 'approval',
        }),
        exposureProfile: expect.objectContaining({
          exposedToolIds: ['echo_hands'],
          requiresApproval: true,
        }),
        receipts: expect.arrayContaining([expect.objectContaining({ kind: 'approval' })]),
      }),
    );
  });
});
