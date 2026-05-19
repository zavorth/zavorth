import {
  CAPABILITY_NEGOTIATION_CONTRACT_VERSION,
  ZavorthAgentGateway,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-capability-negotiation-${++index}`;
}

describe('AgentRunService Capability Negotiation Capability Negotiation', () => {
  it('creates a negotiated scope approval before executing sensitive tools', async () => {
    const executor = jest.fn(({ run }) => ({
      status: 'completed' as const,
      summary: 'Execucao realizada dentro do escopo aprovado.',
      replyText: 'ok',
      metadata: {
        executorSawNegotiation: Boolean(run.metadata.capabilityNegotiation),
      },
    }));
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-04T00:35:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-agent-capability-negotiation',
      text: 'corrija a wave 35 e rode os testes',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read', 'write_file', 'shell.exec'],
      metadata: {
        targetPaths: ['src/runtime/agent', 'tests/runtime/agent'],
      },
    });

    const negotiation = result.run.metadata.capabilityNegotiation as any;
    expect(result.run.status).toBe('waiting_approval');
    expect(executor).not.toHaveBeenCalled();
    expect(negotiation).toEqual(expect.objectContaining({
      contractVersion: CAPABILITY_NEGOTIATION_CONTRACT_VERSION,
      status: 'waiting-approval',
      approvalCreated: true,
      scope: expect.objectContaining({
        allowedToolIds: expect.arrayContaining(['write_file', 'shell.exec']),
        approvalRequired: true,
      }),
      policy: expect.objectContaining({
        noExecutionPerformed: true,
        approvedScopeLimitsTools: true,
        approvedScopeLimitsPaths: true,
      }),
    }));
    expect(result.run.approvals[0]).toEqual(expect.objectContaining({
      title: 'Aprovar escopo de capabilities',
      status: 'pending',
      risk: 'danger',
    }));
    expect(result.replies[0]?.text).toContain('Capability Negotiation - Capability Negotiation');

    const approved = await gateway.approve(result.run.id);

    expect(approved?.resumed).toBe(true);
    expect(executor).toHaveBeenCalledTimes(1);
    expect(approved?.run.status).toBe('completed');
    expect((approved?.run.metadata.capabilityNegotiation as any).status).toBe('approved');
    expect((approved?.run.metadata.capabilityNegotiation as any).scope.approved).toBe(true);
  });
});
