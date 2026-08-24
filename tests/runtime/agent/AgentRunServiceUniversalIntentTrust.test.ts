import {
  AgentRunService,
  type UniversalAgentExecutor,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-uni-trust-${++index}`;
}

// Contention budget: agent-run pipeline tests exceed the 5s Jest default
// when full-group parallel workers load the machine.
jest.setTimeout(120000);

describe('AgentRunService UNI / Trust enforcement Channel mesh4', () => {
  it('publishes universalIntentTrustEnforcement before the executor runs', async () => {
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(({ run }) => ({
      status: 'completed',
      summary: 'Executor viu UNI / Trust.',
      replyText: String((run.metadata.universalIntentTrustEnforcement as any).summary.trustLevel),
    }));
    const service = new AgentRunService({
      now: () => new Date('2026-05-04T00:44:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-agent-uni-trust',
      text: 'explique o runtime em uma frase',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: [],
      metadata: {
        trustMode: 'collaborator',
      },
    });

    expect(executor).toHaveBeenCalledTimes(1);
    expect(result.run.metadata.universalIntentTrustEnforcement).toEqual(expect.objectContaining({
      contractVersion: '2026-05-04.trust-enforcement',
      status: 'allow',
      summary: expect.objectContaining({
        trustLevel: 'collaborator',
        trustDecision: 'allow',
        requiresPermission: false,
      }),
      policy: expect.objectContaining({
        trustSliderEnforcedBeforeExecutor: true,
        noToolExecutedBySnapshot: true,
      }),
    }));
    expect(result.run.metadata.universalIntent).toEqual(expect.objectContaining({
      intent: 'conversation',
      risk: 'safe',
    }));
    expect(result.run.metadata.trustSlider).toEqual(expect.objectContaining({
      level: 'collaborator',
      decision: 'allow',
    }));
  });

  it('blocks the executor when UNI resolves protected host scope as blocked', async () => {
    const executor = jest.fn();
    const service = new AgentRunService({
      now: () => new Date('2026-05-04T00:44:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-agent-uni-trust-block',
      text: 'rode comando no host inteiro',
      requestedTools: ['shell.exec'],
      metadata: {
        trustMode: 'protected',
        hostScopeRequested: true,
      },
    });

    expect(executor).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.run.metadata.universalIntentTrustEnforcement).toEqual(expect.objectContaining({
      status: 'blocked',
      summary: expect.objectContaining({
        trustLevel: 'protected',
        trustDecision: 'block',
        blocked: true,
      }),
    }));
    expect(result.run.summary).toBe('Trust Slider blocked execution in protected mode.');
  });
});
