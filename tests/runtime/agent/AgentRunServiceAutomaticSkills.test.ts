import { AgentRunService } from '../../../src/runtime/agent/AgentRunService.js';
import type { UniversalAgentExecutor } from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-auto-skill-${++index}`;
}

describe('AgentRunService automatic skill path', () => {
  it('runs automatic skill invocation before the executor sees the run', async () => {
    const order: string[] = [];
    const autoSkillInvocation = {
      apply: jest.fn(async ({ run }: any) => {
        order.push('auto-skill');
        run.metadata = {
          ...run.metadata,
          autoSkillInvocation: {
            source: 'test',
            status: 'selected',
            selectedSkillName: 'debugging',
            promptEnvelopeText: 'Use the debugging skill safely.',
            rawSecretsSerialized: false,
          },
        };
        return run.metadata.autoSkillInvocation;
      }),
    };
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(({ run }) => {
      order.push('executor');
      expect(run.metadata.autoSkillInvocation).toMatchObject({
        status: 'selected',
        selectedSkillName: 'debugging',
      });
      return {
        status: 'completed',
        summary: 'auto skill reached executor',
        replyText: 'auto skill reached executor',
      };
    });
    const service = new AgentRunService({
      now: () => new Date('2026-06-10T15:10:00.000Z'),
      idFactory: createIdFactory(),
      executor,
      autoSkillInvocation: autoSkillInvocation as any,
    } as any);

    const result = await service.run({
      userId: 'operator',
      channel: 'cli',
      sessionId: 'session-auto-skill-path',
      text: 'responda oi',
      requestedTools: [],
      metadata: {
        capabilityNegotiationApproved: true,
      },
    });

    expect(result.ok).toBe(true);
    expect(order).toEqual(['auto-skill', 'executor']);
    expect(autoSkillInvocation.apply).toHaveBeenCalledTimes(1);
    expect(executor).toHaveBeenCalledTimes(1);
  });
});
