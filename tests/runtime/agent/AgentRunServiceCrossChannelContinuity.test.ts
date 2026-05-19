import {
  AgentRunService,
  CROSS_CHANNEL_CONTINUITY_CONTRACT_VERSION,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-cross-channel-${++index}`;
}

describe('AgentRunService Cross-Channel Continuity Channel mesh1', () => {
  it('publishes run.metadata.crossChannelContinuity during the agent run lifecycle', async () => {
    const service = new AgentRunService({
      now: () => new Date('2026-05-04T00:41:00.000Z'),
      idFactory: createIdFactory(),
      executor: () => ({
        status: 'completed' as const,
        summary: 'Continuity observou channel mesh.',
        replyText: 'ok',
      }),
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-agent-cross-channel',
      text: 'continue a conversa no telegram depois',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: {
        channelMeshBridge: {
          source: 'ZavorthAgentGateway.attachChannelMeshEventBus',
          channels: [
            {
              id: 'telegram:ops',
              label: 'Telegram Ops',
              kind: 'telegram',
              status: 'available',
            },
          ],
        },
      },
    });

    const continuity = result.run.metadata.crossChannelContinuity as any;
    expect(result.run.status).toBe('waiting_approval');
    expect(continuity).toEqual(expect.objectContaining({
      contractVersion: CROSS_CHANNEL_CONTINUITY_CONTRACT_VERSION,
      source: 'CrossChannelContinuityService',
      status: 'handoff-ready',
      summary: expect.objectContaining({
        channelCount: expect.any(Number),
        handoffCount: expect.any(Number),
        bridgeDetected: true,
        sameGateway: true,
      }),
      policy: expect.objectContaining({
        noCrossChannelMessageSent: true,
        noSessionForkCreated: true,
        approvalRequiredForChannelSwitch: true,
      }),
    }));
    expect(continuity.channels.some((channel: any) => channel.kind === 'telegram')).toBe(true);
  });
});
