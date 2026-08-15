import {
  ZavorthAgentGateway,
  type UniversalAgentExecutor,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-${++index}`;
}

describe('ZavorthAgentGateway runtime promotion governance', () => {
  it('exposes C6 promotion status without selling experimental components as ready', async () => {
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
      status: 'completed',
      summary: 'Run com status C6.',
      replyText: 'ok',
    }));
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-03T14:10:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'cli:c6',
      text: 'responda com status',
      requestedTools: [],
    });
    const snapshot = gateway.buildSnapshot({ activeRunId: result.run.id });

    expect(snapshot.runtimePromotionGovernance).toEqual(expect.objectContaining({
      source: 'RuntimePromotionGovernanceService',
      officialItemIds: expect.arrayContaining(['session-v2-pty']),
      experimentalItemIds: expect.arrayContaining([
        'session-recorder',
        'replay-dvr',
        'local-voice',
      ]),
    }));
    expect(snapshot.runtimePromotionGovernance.entries.find((entry) => entry.itemId === 'session-v2-pty'))
      .toEqual(expect.objectContaining({
        decision: 'promote-product-adapter',
        publicStatus: 'official',
        productAdapterId: 'session.ownership',
        agentLoopIntegrated: true,
        publicClaimAllowed: false,
      }));
    expect(snapshot.runtimePromotionGovernance.prohibitedPublicClaims).toEqual(expect.arrayContaining([
      expect.objectContaining({
        itemId: 'session-v2-pty',
        claim: 'PTY / Session V2 is ready/stable',
      }),
      expect.objectContaining({
        itemId: 'session-recorder',
      }),
    ]));
  });
});
