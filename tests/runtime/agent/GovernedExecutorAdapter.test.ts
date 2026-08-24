import {
  AgentRunService,
  createGovernedExecutorAdapter,
  type UniversalAgentExecutor,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => {
    index += 1;
    return `${prefix}-${index}`;
  };
}

// Contention budget: agent-run pipeline tests exceed the 5s Jest default
// when full-group parallel workers load the machine.
jest.setTimeout(120000);

describe('GovernedExecutorAdapter', () => {
  it('wraps legacy supervised execution behind AgentRunService and UniversalAgentExecutorResult', async () => {
    const legacyExecutor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
      status: 'completed',
      summary: 'Execucao supervisionada encapsulada.',
      replyText: 'Executor governado retornou pelo modelo universal.',
      metadata: {
        legacySupervisedExecutorCalled: true,
      },
    }));
    const adapter = createGovernedExecutorAdapter({
      id: 'legacy-supervised-fixture',
      label: 'Legacy supervised fixture',
      executor: legacyExecutor,
    });
    const service = new AgentRunService({
      now: () => new Date('2026-04-27T16:30:00.000Z'),
      idFactory: createIdFactory(),
      executor: adapter.asUniversalAgentExecutor(),
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'cli:governed-executor',
      text: 'processe pelo executor governado',
      requestedTools: ['read_file'],
    });

    expect(legacyExecutor).toHaveBeenCalledTimes(1);
    expect(result).toEqual(expect.objectContaining({
      ok: true,
      replies: [
        expect.objectContaining({
          text: 'Executor governado retornou pelo modelo universal.',
        }),
      ],
    }));
    expect(result.run.metadata.governedExecutor).toEqual(expect.objectContaining({
      id: 'legacy-supervised-fixture',
      boundary: expect.objectContaining({
        entrypoint: 'AgentRunService',
        resultContract: 'UniversalAgentExecutorResult',
        directExternalInvocationAllowed: false,
      }),
    }));
  });

  it('keeps risky execution behind approval before invoking the governed executor', async () => {
    const legacyExecutor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
      status: 'completed',
      summary: 'Risco executado somente apos approval.',
      replyText: 'Approval liberou o executor governado.',
    }));
    const adapter = createGovernedExecutorAdapter({
      id: 'legacy-risky-fixture',
      label: 'Legacy risky fixture',
      executor: legacyExecutor,
    });
    const service = new AgentRunService({
      now: () => new Date('2026-04-27T16:35:00.000Z'),
      idFactory: createIdFactory(),
      executor: adapter.asUniversalAgentExecutor(),
    });
    const request = {
      userId: 'grey',
      channel: 'cli' as const,
      sessionId: 'cli:risky-governed-executor',
      text: 'execute comando sensivel',
      requestedTools: ['shell.exec'],
    };

    const pending = await service.run(request);
    expect(pending.run.status).toBe('waiting_approval');
    const resumed = await service.resumeApprovedRun(pending.run, request);

    expect(legacyExecutor).toHaveBeenCalledTimes(1);
    expect(resumed.run.status).toBe('completed');
    expect(resumed.run.metadata.governedExecutor).toEqual(expect.objectContaining({
      id: 'legacy-risky-fixture',
    }));
  });
});
