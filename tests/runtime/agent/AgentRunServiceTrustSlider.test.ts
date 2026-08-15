import { AgentRunService } from '../../../src/runtime/agent/index.js';
import type { UniversalAgentExecutor } from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-${++index}`;
}

describe('AgentRunService Trust Slider enforcement', () => {
  it('records Trust Slider snapshot on every run before the executor', async () => {
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(({ run }) => ({
      status: 'completed',
      summary: 'Executado depois do Trust Slider.',
      replyText: String((run.metadata.trustSlider as any).sandboxTier),
    }));
    const service = new AgentRunService({
      now: () => new Date('2026-05-03T12:00:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'web',
      sessionId: 'web:trust',
      text: 'responda oi',
      requestedTools: [],
    });

    expect(executor).toHaveBeenCalledTimes(1);
    expect(result.run.metadata.trustSlider).toEqual(expect.objectContaining({
      level: 'collaborator',
      decision: 'allow',
      sandboxTier: 'workspace-scoped',
      permissionScope: 'none',
      blocked: false,
    }));
    expect(result.run.metadata.trustPosture).toEqual(expect.objectContaining({
      source: 'TrustSliderPolicyService',
      trustMode: 'collaborator',
      permissionScope: 'none',
      sandboxTier: 'workspace-scoped',
    }));
    expect(result.run.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: 'Trust Slider applied',
        status: 'done',
      }),
    ]));
  });

  it('blocks protected host scope before executor or tools run', async () => {
    const executor = jest.fn();
    const service = new AgentRunService({
      now: () => new Date('2026-05-03T12:05:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'cli:trust',
      text: 'rode comando no host inteiro',
      requestedTools: ['shell.exec'],
      metadata: {
        trustMode: 'protected',
        hostScopeRequested: true,
      },
    });

    expect(executor).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.run.status).toBe('failed');
    expect(result.run.summary).toBe('Trust Slider blocked execution in protected mode.');
    expect(result.run.metadata.trustSlider).toEqual(expect.objectContaining({
      level: 'protected',
      decision: 'block',
      sandboxTier: 'safe-core',
      permissionBoundary: 'container-first',
      blocked: true,
    }));
    expect(result.replies[0].text).toContain('No tools were executed.');
  });

  it('requires owner/operator and kill switch for Overlord runs', async () => {
    const executor = jest.fn();
    const service = new AgentRunService({
      now: () => new Date('2026-05-03T12:10:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await service.run({
      userId: 'operator',
      channel: 'cli',
      sessionId: 'cli:overlord',
      text: 'rode um comando como operador',
      requestedTools: ['shell.exec'],
      metadata: {
        trustMode: 'overlord',
      },
    });

    expect(executor).not.toHaveBeenCalled();
    expect(result.run.status).toBe('failed');
    expect(result.run.metadata.trustSlider).toEqual(expect.objectContaining({
      level: 'overlord',
      decision: 'block',
      killSwitchRequired: true,
      ownerOrOperatorRequired: true,
    }));
    expect((result.run.metadata.trustSlider as any).blockReason).toContain('kill switch');
  });
});
