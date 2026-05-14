import {
  ZavorthAgentGateway,
} from '../../../src/runtime/agent/index.js';
import {
  ExternalAgentChannelBridge,
  ExternalAgentSessionMemoryBridge,
  type ExternalAgentTranscriptEntry,
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

describe('Plan 111 Phase 6 external sessions, history and memory bridge', () => {
  it('imports source session history into Zavorth-native context without bypassing privacy rules', async () => {
    const client = new FixtureExternalExecutorSidecarClient();
    const adapter = new QuarantinedExternalExecutorSidecarAdapter({
      client,
      now: () => new Date('2026-04-27T20:00:00.000Z'),
    });
    const ingressGateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-27T20:01:00.000Z'),
      idFactory: createIdFactory(),
      executor: ({ run }) => ({
        status: 'completed',
        summary: 'Mensagem externa normalizada antes do bridge de memoria.',
        replyText: `Resposta Zavorth para ${run.sessionId}.`,
      }),
    });
    const channelBridge = new ExternalAgentChannelBridge({
      adapter,
      gateway: ingressGateway,
      now: () => new Date('2026-04-27T20:02:00.000Z'),
    });

    const [sourceEvent] = await adapter.pullTestEvents();
    const channelResult = await channelBridge.bridgeInboundEvent(sourceEvent);
    const [sourceSession] = await adapter.listSessions();
    const transcript: ExternalAgentTranscriptEntry[] = [
      {
        id: 'source-transcript-public-1',
        sessionId: 'source-session-1',
        role: 'assistant',
        text: 'O canal externo confirmou health e attachments mapeados.',
        createdAt: '2026-04-27T20:03:00.000Z',
        visibility: 'public',
      },
      {
        id: 'source-transcript-restricted-1',
        sessionId: 'source-session-1',
        role: 'user',
        text: 'segredo restrito que nao deve entrar no contexto',
        createdAt: '2026-04-27T20:04:00.000Z',
        visibility: 'restricted',
      },
      {
        id: 'source-transcript-private-1',
        sessionId: 'source-session-1',
        role: 'user',
        text: 'sk-private-should-not-leak',
        createdAt: '2026-04-27T20:05:00.000Z',
        visibility: 'private',
      },
    ];
    const bridge = new ExternalAgentSessionMemoryBridge({
      adapter,
      now: () => new Date('2026-04-27T20:06:00.000Z'),
    });

    const readModel = await bridge.importSession({
      session: sourceSession,
      channelHistory: channelResult.history,
      transcript,
    });
    const history = bridge.querySessionHistory('source-session-1');

    expect(readModel.id).toBe('external:source-session-1');
    expect(readModel.runtimeId).toBe('external-runtime:primary-sidecar');
    expect(readModel.privacy).toEqual(expect.objectContaining({
      totalEntries: 5,
      visibleEntries: 3,
      redactedEntries: 1,
      blockedPrivateEntries: 1,
    }));
    expect(history).toHaveLength(4);
    expect(history).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'external-history:source-transcript-restricted-1',
        privacy: 'redacted',
        text: '[redacted by Zavorth external session privacy policy]',
      }),
    ]));
    expect(readModel.memorySignals).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'external-memory:external-history:source-transcript-public-1',
        layer: 'episodic',
      }),
    ]));
    expect(readModel.context).toEqual(expect.objectContaining({
      sessionId: 'external:source-session-1',
      memoryPrompt: expect.stringContaining('O canal externo confirmou health'),
      metadata: expect.objectContaining({
        externalSessionBridge: true,
        sourceRuntimeQuarantined: true,
        canonicalSessionId: 'external:source-session-1',
        contextDepth: 'cold',
      }),
    }));
    expect(readModel.context.cold?.metadata).toEqual(expect.objectContaining({
      privateEntriesIncluded: false,
      memorySignalCount: readModel.memorySignals.length,
    }));
    expect(readModel.replay).toEqual(expect.objectContaining({
      id: 'external-replay:external:source-session-1',
      sessionId: 'external:source-session-1',
      status: 'available',
      eventCount: 4,
      artifactCount: 2,
    }));
    expect(readModel.handoff).toEqual(expect.objectContaining({
      id: 'external-handoff:external:source-session-1',
      sessionId: 'external:source-session-1',
      status: 'ready',
      artifact: expect.objectContaining({
        kind: 'handoff',
        status: 'ready',
      }),
    }));

    const serializedReadModel = JSON.stringify(readModel);
    expect(serializedReadModel).not.toContain('sk-private-should-not-leak');
    expect(serializedReadModel).not.toContain('segredo restrito');
    expect(serializedReadModel).not.toContain('ExternalExecutor');
  });

  it('builds a continuation request that lets Zavorth summarize or continue from bridged context', async () => {
    const client = new FixtureExternalExecutorSidecarClient();
    const adapter = new QuarantinedExternalExecutorSidecarAdapter({
      client,
      now: () => new Date('2026-04-27T21:00:00.000Z'),
    });
    const [sourceSession] = await adapter.listSessions();
    const bridge = new ExternalAgentSessionMemoryBridge({
      adapter,
      now: () => new Date('2026-04-27T21:01:00.000Z'),
    });
    const readModel = await bridge.importSession({
      session: sourceSession,
      transcript: [
        {
          id: 'source-transcript-public-2',
          sessionId: 'source-session-1',
          role: 'user',
          text: 'Continue o trabalho a partir do inventario externo ja importado.',
          createdAt: '2026-04-27T21:02:00.000Z',
          visibility: 'public',
        },
      ],
    });
    const continuationRequest = bridge.buildContinuationRequest({
      sessionId: 'source-session-1',
      userId: 'source-user-1',
    });
    const executor = jest.fn(({ request }) => ({
      status: 'completed',
      summary: 'Zavorth continuou usando contexto importado.',
      replyText: 'Resumo e proximo passo preparados pelo Zavorth.',
      metadata: {
        continuedFrom: request.metadata?.externalSessionHandoff,
      },
    }));
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-27T21:03:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await gateway.handle(continuationRequest);

    expect(continuationRequest).toEqual(expect.objectContaining({
      sessionId: 'external:source-session-1',
      channel: 'api',
      workspace: '<repo>',
      metadata: expect.objectContaining({
        context: readModel.context,
        externalSessionReplay: readModel.replay,
        externalSessionHandoff: readModel.handoff,
        importedMemorySignals: readModel.memorySignals,
        externalSessionPrivacy: readModel.privacy,
      }),
    }));
    expect(executor).toHaveBeenCalledWith(expect.objectContaining({
      request: continuationRequest,
    }));
    expect(result.run).toEqual(expect.objectContaining({
      sessionId: 'external:source-session-1',
      status: 'completed',
      summary: 'Zavorth continuou usando contexto importado.',
      metadata: expect.objectContaining({
        continuedFrom: readModel.handoff,
      }),
    }));
    expect(result.replies[0]).toEqual(expect.objectContaining({
      text: 'Resumo e proximo passo preparados pelo Zavorth.',
      metadata: expect.objectContaining({
        sessionId: 'external:source-session-1',
      }),
    }));
    expect(JSON.stringify(result.run.metadata)).not.toContain('ExternalExecutor');
  });
});
