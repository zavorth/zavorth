import {
  TOOL_REHEARSAL_CONTRACT_VERSION,
  ZavorthAgentGateway,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-agent-tool-rehearsal-${++index}`;
}

// Contention budget: agent-run pipeline tests exceed the 5s Jest default
// when full-group parallel workers load the machine.
jest.setTimeout(120000);

describe('AgentRunService Tool Rehearsal Tool Rehearsal', () => {
  it('runs Tool Rehearsal after scope approval and before executor', async () => {
    const executor = jest.fn(() => ({
      status: 'completed' as const,
      summary: 'Executado apos rehearsal aprovado.',
      replyText: 'ok',
    }));
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-04T00:36:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const first = await gateway.handle({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-agent-tool-rehearsal',
      text: 'corrija a runtime cycle e rode testes',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read', 'write_file', 'shell.exec'],
      metadata: {
        toolRehearsalRequired: true,
        targetPaths: ['src/runtime/agent', 'tests/runtime/agent'],
      },
    });

    expect(first.run.status).toBe('waiting_approval');
    expect(first.run.approvals[0]?.title).toBe('Approve capability scope');
    expect(executor).not.toHaveBeenCalled();

    const afterScope = await gateway.approve(first.run.id);
    const rehearsal = afterScope?.run.metadata.toolRehearsal as any;

    expect(afterScope?.run.status).toBe('waiting_approval');
    expect(rehearsal).toEqual(expect.objectContaining({
      contractVersion: TOOL_REHEARSAL_CONTRACT_VERSION,
      status: 'waiting-approval',
      approvalCreated: true,
      summary: expect.objectContaining({
        callCount: 3,
        scopeApproved: true,
      }),
      policy: expect.objectContaining({
        noToolExecuted: true,
        noShellSpawned: true,
        realExecutionLimitedToRehearsedScope: true,
      }),
    }));
    expect(afterScope?.run.approvals.some((approval) => (
      approval.title === 'Approve tool rehearsal'
      && approval.status === 'pending'
    ))).toBe(true);
    expect(executor).not.toHaveBeenCalled();

    const rehearsalApproval = afterScope?.run.approvals.find((approval) => (
      approval.title === 'Approve tool rehearsal'
      && approval.status === 'pending'
    ));
    const afterRehearsal = await gateway.approve(rehearsalApproval?.id || '');

    expect(afterRehearsal?.run.status).toBe('completed');
    expect(executor).toHaveBeenCalledTimes(1);
    expect((afterRehearsal?.run.metadata.toolRehearsal as any).status).toBe('approved');
  });
});
