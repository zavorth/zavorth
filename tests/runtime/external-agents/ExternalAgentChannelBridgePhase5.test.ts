import {
  ZavorthAgentGateway,
} from '../../../src/runtime/agent/index.js';
import {
  ExternalAgentChannelBridge,
} from '../../../src/runtime/external-agents/index.js';
import {
  FixtureExternalExecutorSidecarClient,
  QuarantinedExternalExecutorSidecarAdapter,
} from '../../../src/runtime/external-agents/external-executor/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => {
    index += 1;
    return `${prefix}-${index}`;
  };
}

describe('Plan 111 Phase 5 external channel and messaging bridge', () => {
  it('bridges one source channel end-to-end through Zavorth sessions, reply pipeline and delivery receipts', async () => {
    const client = new FixtureExternalExecutorSidecarClient();
    const adapter = new QuarantinedExternalExecutorSidecarAdapter({
      client,
      now: () => new Date('2026-04-27T19:00:00.000Z'),
    });
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-27T19:01:00.000Z'),
      idFactory: createIdFactory(),
      executor: ({ run }) => ({
        status: 'completed',
        summary: 'Mensagem externa tratada pelo gateway Zavorth.',
        replyText: `Resposta Zavorth para ${run.sessionId}.`,
      }),
    });
    const bridge = new ExternalAgentChannelBridge({
      adapter,
      gateway,
      now: () => new Date('2026-04-27T19:02:00.000Z'),
    });

    const [sourceEvent] = await adapter.pullTestEvents();
    const result = await bridge.bridgeInboundEvent(sourceEvent);
    const gatewaySnapshot = gateway.buildSnapshot({
      activeSessionId: result.result.run.sessionId,
    });

    expect(result.channelHealth.summary).toEqual({
      total: 1,
      available: 1,
      degraded: 0,
      offline: 0,
      replyPipelineOnly: 1,
    });
    expect(result.channelHealth.channels).toEqual([
      expect.objectContaining({
        id: 'external-channel:external-channel:source-inbox',
        inbound: true,
        outbound: 'reply-pipeline-only',
        replyPort: expect.objectContaining({
          kind: 'api',
          status: 'available',
          primary: true,
        }),
      }),
    ]);
    expect(result.mediaAttachments).toEqual([
      expect.objectContaining({
        id: 'external-media:source-image-1',
        kind: 'image',
        artifactPolicy: 'map-to-zavorth-artifact',
        status: 'mapped',
      }),
      expect.objectContaining({
        id: 'external-media:source-log-1',
        kind: 'file',
        artifactPolicy: 'map-to-zavorth-artifact',
        status: 'mapped',
      }),
    ]);
    expect(result.message).toEqual(expect.objectContaining({
      sessionId: 'external:source-session-1',
      channel: 'api',
      metadata: expect.objectContaining({
        attachmentPolicy: 'map-to-zavorth-artifacts',
        mediaAttachments: result.mediaAttachments,
      }),
    }));
    expect(result.result.run).toEqual(expect.objectContaining({
      sessionId: 'external:source-session-1',
      status: 'completed',
      summary: 'Mensagem externa tratada pelo gateway Zavorth.',
    }));
    expect(result.result.replies).toHaveLength(1);
    expect(result.result.replies[0]).toEqual(expect.objectContaining({
      runId: result.result.run.id,
      text: 'Resposta Zavorth para external:source-session-1.',
      metadata: expect.objectContaining({
        channel: 'api',
        sessionId: 'external:source-session-1',
      }),
    }));
    expect(result.deliveries).toEqual([
      expect.objectContaining({
        replyPacketId: result.result.replies[0].id,
        runId: result.result.run.id,
        sessionId: 'external:source-session-1',
        status: 'delivered',
        sourceReceiptId: `receipt:external-reply-action:${result.result.replies[0].id}`,
      }),
    ]);
    expect(client.dispatchedActions).toEqual([
      expect.objectContaining({
        kind: 'message',
        label: 'Zavorth reply pipeline delivery',
        replyBoundary: 'zavorth-reply-port-only',
        payload: expect.objectContaining({
          text: 'Resposta Zavorth para external:source-session-1.',
          data: expect.objectContaining({
            replyPacketId: result.result.replies[0].id,
            runId: result.result.run.id,
            channel: 'api',
          }),
        }),
      }),
    ]);
    expect(result.history).toEqual([
      expect.objectContaining({
        role: 'user',
        sessionId: 'external:source-session-1',
        eventId: sourceEvent.id,
        attachments: result.mediaAttachments,
      }),
      expect.objectContaining({
        role: 'assistant',
        sessionId: 'external:source-session-1',
        runId: result.result.run.id,
        replyPacketId: result.result.replies[0].id,
      }),
    ]);
    expect(gatewaySnapshot.runs).toEqual([
      expect.objectContaining({
        id: result.result.run.id,
        sessionId: 'external:source-session-1',
      }),
    ]);
    expect(JSON.stringify(result.channelHealth)).not.toContain('ExternalExecutor');
    expect(JSON.stringify(result.deliveries)).not.toContain('ExternalExecutor');
    expect(JSON.stringify(result.history)).not.toContain('ExternalExecutor');
  });
});
