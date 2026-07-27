import {
  AgentRunService,
  type UniversalAgentExecutor,
} from '../../../src/runtime/agent/index.js';
import { ReplyPipeline } from '../../../src/runtime/reply/index.js';

describe('P0-002c CoreMessageTool reconciliation', () => {
  it('keeps normal outbound replies on replyText plus the existing ReplyPipeline', async () => {
    let sequence = 0;
    const executor: UniversalAgentExecutor = async ({ run }) => ({
      status: 'completed',
      summary: `Prepared response for ${run.sessionId}.`,
      replyText: 'Resposta pelo pipeline de reply existente.',
      events: [
        {
          kind: 'reply',
        title: 'Resposta preparada',
          detail: 'Executor returned replyText; ReplyPipeline assembled the output package.',
          status: 'done',
        },
      ],
    });
    const service = new AgentRunService({
      now: () => new Date('2026-04-27T12:00:00.000Z'),
      idFactory: (prefix) => `${prefix}-${++sequence}`,
      executor,
      replyPipeline: new ReplyPipeline(),
    });

    const result = await service.run({
      requestId: 'request-core-message-tool-reconcile',
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-core-message-tool-reconcile',
      text: 'answer without creating a message tool',
      requestedTools: [],
    });

    expect(result.ok).toBe(true);
    expect(result.run.toolExposure.tools).toEqual([]);
    expect(result.run.toolExposure.summary).toBe('No tools were exposed for this execution.');
    expect(result.run.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'reply',
        title: 'Resposta preparada',
      }),
    ]));
    expect(result.replies).toHaveLength(1);
    expect(result.replies[0]).toEqual(expect.objectContaining({
      id: `${result.run.id}:reply:1`,
      text: 'Resposta pelo pipeline de reply existente.',
      port: expect.objectContaining({
        id: 'web:primary',
        kind: 'web',
        primary: true,
      }),
      metadata: expect.objectContaining({
        channel: 'web',
        sessionId: 'session-core-message-tool-reconcile',
        chunkIndex: 0,
        chunkCount: 1,
      }),
    }));
  });
});
