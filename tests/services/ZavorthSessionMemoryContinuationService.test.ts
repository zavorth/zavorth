import {
  ZAVORTH_SESSION_MEMORY_CONTINUATION_CONTRACT_VERSION,
  type ZavorthSessionHistoryBridgeInput,
} from '../../src/contracts/ZavorthSessionMemoryContinuationContract.js';
import { ZavorthSessionMemoryContinuationService } from '../../src/services/ZavorthSessionMemoryContinuationService.js';

describe('ZavorthSessionMemoryContinuationService Phase 6', () => {
  it('publishes the session memory continuation snapshot after Phase 5 readiness', () => {
    const snapshot = createService().buildSnapshot();

    expect(snapshot).toEqual(expect.objectContaining({
      generatedAt: '2026-05-11T22:00:00.000Z',
      contractVersion: ZAVORTH_SESSION_MEMORY_CONTINUATION_CONTRACT_VERSION,
      status: 'session-memory-continuation-ready',
      planId: '291 - Plano Zavorth External Runtime Absorption',
      phase: 'phase-6-sessions-memory-continuation',
      previousChannelMessagingStatus: 'channel-messaging-bridge-ready',
    }));
    expect(snapshot.summary).toEqual(expect.objectContaining({
      transcriptItemsReceived: 5,
      publicContextItems: 2,
      privateRestrictedSecretItemsFiltered: 3,
      memorySignals: 2,
      provenanceBackedSignals: 2,
      replayHandoffSnapshots: 1,
      continuationGatewayRequests: 1,
      memoryWritesPerformed: false,
      hiddenMemoryAuthorityCreated: false,
      sourceRuntimeCodeExecuted: false,
    }));
    expect(snapshot.commands.nextPhase).toBe('291 Phase 7 - Delegated Workers');
  });

  it('bridges source session history without making the source canonical', () => {
    const receipt = createService().bridgeSessionHistory(createHistory());

    expect(receipt).toEqual(expect.objectContaining({
      status: 'bridged',
      sourceRuntimeId: 'source-runtime-test',
      sourceSessionId: 'source-session-test',
      zavorthSessionId: 'zavorth.session.test',
      channelId: 'zavorth.channel.telegram.test',
      receivedItems: 4,
      canonicalOwner: 'Zavorth',
      safety: expect.objectContaining({
        sourceSessionNotCanonical: true,
        noSourceRuntimeCodeExecuted: true,
        noMemoryWritePerformed: true,
      }),
    }));
  });

  it('filters private, restricted, and secret transcript data before context and memory', () => {
    const receipt = createService().filterTranscriptForContext(createHistory());

    expect(receipt.status).toBe('filtered');
    expect(receipt.acceptedItems).toHaveLength(1);
    expect(receipt.acceptedItems[0]).toEqual(expect.objectContaining({
      sourceEventId: 'evt-public',
      visibility: 'public',
      originalVisibility: 'public',
      text: 'npm test passed with TOKEN=[REDACTED]',
      redactionApplied: true,
    }));
    expect(receipt.droppedItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceEventId: 'evt-private', originalVisibility: 'private', reason: 'private-filtered' }),
      expect.objectContaining({ sourceEventId: 'evt-restricted', originalVisibility: 'restricted', reason: 'restricted-filtered' }),
      expect.objectContaining({ sourceEventId: 'evt-secret', originalVisibility: 'secret', reason: 'secret-filtered' }),
    ]));
    expect(receipt.safety).toEqual(expect.objectContaining({
      privateFilteredBeforeContext: true,
      restrictedFilteredBeforeMemory: true,
      secretValuesRedacted: true,
      noPrivateContextLeak: true,
      noRawTranscriptMemoryWrite: true,
    }));
  });

  it('maps only filtered public items into provenance-backed advisory memory signals', () => {
    const service = createService();
    const history = createHistory();
    const filter = service.filterTranscriptForContext(history);
    const receipt = service.mapMemorySignals(history, filter);

    expect(receipt.status).toBe('signals-ready');
    expect(receipt.signals).toHaveLength(1);
    expect(receipt.signals[0]).toEqual(expect.objectContaining({
      sessionId: 'zavorth.session.test',
      kind: 'procedural',
      advisoryOnly: true,
      writePerformed: false,
      provenance: expect.objectContaining({
        sourceRuntimeId: 'source-runtime-test',
        sourceSessionId: 'source-session-test',
        sourceEventIds: ['evt-public'],
        provenanceRefs: ['source://evt-public'],
        importedAt: '2026-05-11T22:00:00.000Z',
      }),
    }));
    expect(receipt.safety).toEqual(expect.objectContaining({
      provenanceRequired: true,
      importedMemoryAdvisoryOnly: true,
      noMemoryWritePerformed: true,
      correctOrForgetRequired: true,
    }));
  });

  it('builds replay handoff snapshots from redacted context only', () => {
    const service = createService();
    const history = createHistory();
    const filter = service.filterTranscriptForContext(history);
    const signals = service.mapMemorySignals(history, filter);
    const replay = service.buildReplayHandoffSnapshot('zavorth.session.test', filter, signals);

    expect(replay).toEqual(expect.objectContaining({
      status: 'handoff-ready',
      replayId: 'zavorth.replay.zavorth-session-test',
      sessionId: 'zavorth.session.test',
      memorySignalRefs: [signals.signals[0].signalId],
      redactedBeforeContext: true,
      rawTranscriptIncluded: false,
      safety: expect.objectContaining({
        privateDataExcluded: true,
        restrictedDataExcluded: true,
        secretValuesRedacted: true,
        noMemoryWritePerformed: true,
      }),
    }));
    expect(replay.contextItems).toEqual([
      expect.objectContaining({
        sourceEventId: 'evt-public',
        text: 'npm test passed with TOKEN=[REDACTED]',
      }),
    ]);
  });

  it('creates continuation requests that run through ZavorthAgentGateway', () => {
    const service = createService();
    const history = createHistory();
    const filter = service.filterTranscriptForContext(history);
    const signals = service.mapMemorySignals(history, filter);
    const replay = service.buildReplayHandoffSnapshot('zavorth.session.test', filter, signals);
    const request = service.buildContinuationRequest(replay);

    expect(request).toEqual(expect.objectContaining({
      status: 'ready',
      sessionId: 'zavorth.session.test',
      replayId: 'zavorth.replay.zavorth-session-test',
      gatewayEntrypoint: 'ZavorthAgentGateway',
      naturalFirstRoute: 'memory-recall',
      sourceRuntimeDiagnosticsOnly: true,
      safety: expect.objectContaining({
        continuationThroughGateway: true,
        noDirectSourceContinuation: true,
        noToolExecution: true,
        noProviderCall: true,
      }),
    }));
  });

  it('projects session memory continuation state for Command Center', () => {
    const snapshot = createService().buildSnapshot();

    expect(snapshot.commandCenterProjection).toEqual(expect.objectContaining({
      title: 'Session Memory Continuation',
      status: 'session-memory-continuation-ready',
      tone: 'ready',
      policyPills: expect.arrayContaining([
        'privacy filtered',
        'restricted excluded',
        'provenance required',
        'advisory memory',
        'no memory write',
        'ZavorthAgentGateway continuation',
      ]),
      nextSafeAction: 'Proceed to 291 Phase 7 - Delegated Workers.',
    }));
    expect(snapshot.commandCenterProjection.cards.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'history',
      'filtered',
      'context',
      'signals',
      'replay',
      'continuation',
      'memory-write',
    ]));
  });

  it('blocks Phase 6 if Phase 5 channel messaging is not ready', () => {
    const snapshot = createService().buildSnapshot({ channelMessagingStatus: 'blocked' });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.previousChannelMessagingStatus).toBe('blocked');
    expect(snapshot.acceptanceMatrix.find((entry) => entry.requirementId === 'phase-5-channels-and-messaging-ready')).toEqual(expect.objectContaining({
      status: 'failed',
    }));
  });

  it('formats an operator summary for the session memory continuation pack', () => {
    const service = createService();
    const text = service.formatSnapshotText(service.buildSnapshot());

    expect(text).toContain('Zavorth Session Memory Continuation - Phase 6');
    expect(text).toContain('Status: session-memory-continuation-ready');
    expect(text).toContain('Filtered private/restricted/secret items: 3');
    expect(text).toContain('Memory writes performed: false');
    expect(text).toContain('Hidden memory authority created: false');
    expect(text).toContain('Next: 291 Phase 7 - Delegated Workers');
  });
});

function createService(): ZavorthSessionMemoryContinuationService {
  return new ZavorthSessionMemoryContinuationService({
    now: () => new Date('2026-05-11T22:00:00.000Z'),
    channelMessagingStatus: 'channel-messaging-bridge-ready',
  });
}

function createHistory(): ZavorthSessionHistoryBridgeInput {
  return {
    sourceRuntimeId: 'source-runtime-test',
    sourceSessionId: 'source-session-test',
    channelId: 'zavorth.channel.telegram.test',
    zavorthSessionId: 'zavorth.session.test',
    transcript: [
      {
        sourceEventId: 'evt-public',
        role: 'user',
        text: 'npm test passed with TOKEN=abc123',
        visibility: 'public',
        occurredAt: '2026-05-11T21:00:00.000Z',
        provenanceRef: 'source://evt-public',
      },
      {
        sourceEventId: 'evt-private',
        role: 'user',
        text: 'private phone number',
        visibility: 'private',
        occurredAt: '2026-05-11T21:01:00.000Z',
        provenanceRef: 'source://evt-private',
      },
      {
        sourceEventId: 'evt-restricted',
        role: 'tool',
        text: 'restricted command output',
        visibility: 'restricted',
        occurredAt: '2026-05-11T21:02:00.000Z',
        provenanceRef: 'source://evt-restricted',
      },
      {
        sourceEventId: 'evt-secret',
        role: 'system',
        text: 'API_KEY=super-secret',
        visibility: 'secret',
        occurredAt: '2026-05-11T21:03:00.000Z',
        provenanceRef: 'source://evt-secret',
      },
    ],
  };
}
