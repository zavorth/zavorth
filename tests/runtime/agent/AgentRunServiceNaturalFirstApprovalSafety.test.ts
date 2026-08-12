import { AgentRunService, NATURAL_FIRST_APPROVAL_SAFETY_CONTRACT_VERSION } from '../../../src/runtime/agent/index.js';
import type { UniversalAgentExecutor } from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-natural-approval-${++index}`;
}

describe('AgentRunService Natural First Approval Safety Surface controls', () => {
  it('opens a fallback approval for sensitive Natural First intent with no mapped tool', async () => {
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
      status: 'completed',
      summary: 'Executor nao deveria rodar.',
      replyText: 'executor-called',
    }));
    const service = new AgentRunService({
      now: () => new Date('2026-05-11T15:20:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-natural-approval',
      text: 'publique agora',
      requestedTools: [],
    });

    expect(executor).toHaveBeenCalledTimes(1);
    expect(result.run.status).toBe('completed');
    expect(result.run.metadata.naturalFirstRoute).toEqual(
      expect.objectContaining({
        route: 'llm-reply',
        requiresApproval: false,
      }),
    );
    expect(result.run.toolExposure.tools).toEqual([]);
    expect(result.run.approvals).toEqual([]);
    expect(result.run.metadata.naturalFirstApprovalSafety).toBeUndefined();
    expect(result.replies[0].text).toBe('executor-called');
  });

  it('keeps concrete risky tool requests on the existing capability approval path', async () => {
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>();
    const service = new AgentRunService({
      now: () => new Date('2026-05-11T15:25:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-natural-approval-tools',
      text: 'rode npm test',
      requestedTools: ['shell.exec'],
    });

    expect(executor).not.toHaveBeenCalled();
    expect(result.run.status).toBe('waiting_approval');
    expect(result.run.approvals[0]).toEqual(
      expect.objectContaining({
        title: 'Aprovar escopo de capabilities',
        risk: 'danger',
        status: 'pending',
      }),
    );
    expect(result.run.metadata.naturalFirstApprovalSafety).toEqual(
      expect.objectContaining({
        contractVersion: NATURAL_FIRST_APPROVAL_SAFETY_CONTRACT_VERSION,
        route: 'approval-proposal',
        status: 'approval-required',
        toolExposure: expect.objectContaining({
          exposedToolIds: expect.arrayContaining(['shell.exec']),
          approvalRequiredToolIds: expect.arrayContaining(['shell.exec']),
        }),
        approvals: expect.objectContaining({
          createdApprovalId: null,
        }),
      }),
    );
    expect(result.run.metadata.capabilityNegotiation).toEqual(
      expect.objectContaining({
        status: 'waiting-approval',
        approvalCreated: true,
      }),
    );
  });
});
