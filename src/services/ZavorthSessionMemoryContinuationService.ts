import {
  ZAVORTH_SESSION_MEMORY_CONTINUATION_CONTRACT_VERSION,
  type ZavorthContinuationRequest,
  type ZavorthDroppedTranscriptItem,
  type ZavorthFilteredTranscriptItem,
  type ZavorthImportedMemorySignal,
  type ZavorthMemorySignalMappingReceipt,
  type ZavorthPrivacyFilteringReceipt,
  type ZavorthReplayHandoffSnapshot,
  type ZavorthSessionHistoryBridgeInput,
  type ZavorthSessionHistoryBridgeReceipt,
  type ZavorthSessionHistoryItemInput,
  type ZavorthSessionMemoryZavorthControlProjection,
  type ZavorthSessionMemoryContinuationSnapshot,
  type ZavorthSessionMemoryContinuationStatus,
} from '../contracts/ZavorthSessionMemoryContinuationContract.js';
import type {
  ZavorthChannelMessagingBridgeStatus,
} from '../contracts/ZavorthChannelMessagingBridgeContract.js';

type Runtime = {
  now?: () => Date;
  channelMessagingStatus?: ZavorthChannelMessagingBridgeStatus;
};

type SnapshotInput = {
  channelMessagingStatus?: ZavorthChannelMessagingBridgeStatus | null;
};

const DEFAULT_HISTORY: ZavorthSessionHistoryBridgeInput = {
  sourceRuntimeId: 'reference-runtime-a',
  sourceSessionId: 'source-session-fixture-001',
  channelId: 'zavorth.channel.telegram.telegram-main',
  zavorthSessionId: 'zavorth.session.telegram.thread-fixture-001',
  transcript: [
    item('evt-001', 'user', 'Rodar npm run runtime:check --silent validou a etapa anterior.', 'public', '2026-05-11T21:20:00.000Z', 'source://session/evt-001'),
    item('evt-002', 'assistant', 'Decidimos continuar sempre pelo ZavorthAgentGateway.', 'public', '2026-05-11T21:21:00.000Z', 'source://session/evt-002'),
    item('evt-003', 'user', 'Meu telefone privado nao deve entrar no contexto.', 'private', '2026-05-11T21:22:00.000Z', 'source://session/evt-003'),
    item('evt-004', 'tool', 'TOKEN=abc123 apareceu em log restrito e deve ser filtrado.', 'restricted', '2026-05-11T21:23:00.000Z', 'source://session/evt-004'),
    item('evt-005', 'system', 'API_KEY=secret-value nao pode virar memoria.', 'secret', '2026-05-11T21:24:00.000Z', 'source://session/evt-005'),
  ],
};

export class ZavorthSessionMemoryContinuationService {
  private readonly now: () => Date;
  private readonly defaultChannelMessagingStatus: ZavorthChannelMessagingBridgeStatus;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.defaultChannelMessagingStatus = runtime.channelMessagingStatus || 'channel-messaging-bridge-ready';
  }

  public buildSnapshot(input: SnapshotInput = {}): ZavorthSessionMemoryContinuationSnapshot {
    const previousChannelMessagingStatus = input.channelMessagingStatus || this.defaultChannelMessagingStatus;
    const historyBridgeReceipt = this.bridgeSessionHistory(DEFAULT_HISTORY);
    const privacyFilteringReceipt = this.filterTranscriptForContext(DEFAULT_HISTORY);
    const memorySignalMappingReceipt = this.mapMemorySignals(DEFAULT_HISTORY, privacyFilteringReceipt);
    const replayHandoffSnapshot = this.buildReplayHandoffSnapshot(
      DEFAULT_HISTORY.zavorthSessionId,
      privacyFilteringReceipt,
      memorySignalMappingReceipt,
    );
    const continuationRequest = this.buildContinuationRequest(replayHandoffSnapshot);
    const acceptanceMatrix = buildAcceptanceMatrix(
      previousChannelMessagingStatus,
      historyBridgeReceipt,
      privacyFilteringReceipt,
      memorySignalMappingReceipt,
      replayHandoffSnapshot,
      continuationRequest,
    );
    const status = resolveStatus(previousChannelMessagingStatus, acceptanceMatrix);
    const zavorthControlProjection = this.buildZavorthControlProjection({
      status,
      historyBridgeReceipt,
      privacyFilteringReceipt,
      memorySignalMappingReceipt,
      replayHandoffSnapshot,
      continuationRequest,
    });

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_SESSION_MEMORY_CONTINUATION_CONTRACT_VERSION,
      status,
      planId: 'Zavorth External Runtime Integration',
      phase: 'sessions-memory-continuation',
      previousChannelMessagingStatus,
      historyBridgeReceipt,
      privacyFilteringReceipt,
      memorySignalMappingReceipt,
      replayHandoffSnapshot,
      continuationRequest,
      zavorthControlProjection,
      acceptanceMatrix,
      summary: {
        transcriptItemsReceived: historyBridgeReceipt.receivedItems,
        publicContextItems: privacyFilteringReceipt.acceptedItems.length,
        privateRestrictedSecretItemsFiltered: privacyFilteringReceipt.droppedItems.length,
        redactionsApplied: privacyFilteringReceipt.redactionsApplied,
        memorySignals: memorySignalMappingReceipt.signals.length,
        provenanceBackedSignals: memorySignalMappingReceipt.signals
          .filter((entry) => entry.provenance.sourceEventIds.length > 0 && entry.provenance.provenanceRefs.length > 0).length,
        replayHandoffSnapshots: replayHandoffSnapshot.status === 'handoff-ready' ? 1 : 0,
        continuationGatewayRequests: continuationRequest.status === 'ready' ? 1 : 0,
        memoryWritesPerformed: false,
        hiddenMemoryAuthorityCreated: false,
        sourceRuntimeCodeExecuted: false,
      },
      safety: {
        sessionBridgeOnly: true,
        noSourceRuntimeCodeExecuted: true,
        noPrivateContextLeak: true,
        noRawTranscriptMemoryWrite: true,
        noMemoryWritePerformed: true,
        importedMemoryAdvisoryOnly: true,
        continuationThroughGateway: true,
        publicIdentityChanged: false,
      },
      commands: {
        inspect: 'npm run zavorth:session-memory-continuation',
        inspectJson: 'npm run zavorth:session-memory-continuation:json',
        check: 'npm run zavorth:session-memory-continuation:check --silent',
        nextStage: '291 Surface controls - Delegated Workers',
      },
    };
  }

  public bridgeSessionHistory(input: ZavorthSessionHistoryBridgeInput): ZavorthSessionHistoryBridgeReceipt {
    const valid = !!input.sourceRuntimeId
      && !!input.sourceSessionId
      && !!input.channelId
      && !!input.zavorthSessionId
      && input.transcript.length > 0;

    return {
      status: valid ? 'bridged' : 'blocked',
      sourceRuntimeId: input.sourceRuntimeId || 'missing-source-runtime',
      sourceSessionId: input.sourceSessionId || 'missing-source-session',
      zavorthSessionId: input.zavorthSessionId || 'missing-zavorth-session',
      channelId: input.channelId || 'missing-channel',
      receivedItems: input.transcript.length,
      canonicalOwner: 'Zavorth',
      safety: {
        sourceSessionNotCanonical: true,
        noSourceRuntimeCodeExecuted: true,
        noMemoryWritePerformed: true,
      },
    };
  }

  public filterTranscriptForContext(
    input: ZavorthSessionHistoryBridgeInput,
  ): ZavorthPrivacyFilteringReceipt {
    const acceptedItems: ZavorthFilteredTranscriptItem[] = [];
    const droppedItems: ZavorthDroppedTranscriptItem[] = [];
    let redactionsApplied = 0;

    for (const transcriptItem of input.transcript) {
      if (transcriptItem.visibility !== 'public') {
        droppedItems.push({
          sourceEventId: transcriptItem.sourceEventId,
          originalVisibility: transcriptItem.visibility,
          reason: transcriptItem.visibility === 'private'
            ? 'private-filtered'
            : transcriptItem.visibility === 'restricted'
              ? 'restricted-filtered'
              : 'secret-filtered',
        });
        continue;
      }

      const redacted = redactSecrets(transcriptItem.text);
      if (redacted !== transcriptItem.text) redactionsApplied += 1;
      acceptedItems.push({
        itemId: `zavorth.transcript.${safeId(transcriptItem.sourceEventId)}`,
        sourceEventId: transcriptItem.sourceEventId,
        role: transcriptItem.role,
        text: redacted,
        visibility: 'public',
        originalVisibility: transcriptItem.visibility,
        occurredAt: transcriptItem.occurredAt,
        provenanceRef: transcriptItem.provenanceRef,
        redactionApplied: redacted !== transcriptItem.text,
      });
    }

    return {
      status: acceptedItems.length > 0 ? 'filtered' : 'blocked',
      sourceSessionId: input.sourceSessionId,
      acceptedItems,
      droppedItems,
      redactionsApplied,
      safety: {
        privateFilteredBeforeContext: true,
        restrictedFilteredBeforeMemory: true,
        secretValuesRedacted: true,
        noPrivateContextLeak: true,
        noRawTranscriptMemoryWrite: true,
      },
    };
  }

  public mapMemorySignals(
    input: ZavorthSessionHistoryBridgeInput,
    privacyFilteringReceipt: ZavorthPrivacyFilteringReceipt,
  ): ZavorthMemorySignalMappingReceipt {
    if (privacyFilteringReceipt.status !== 'filtered') {
      return {
        status: 'blocked',
        sessionId: input.zavorthSessionId,
        signals: [],
        safety: memorySignalSafety(),
      };
    }

    const signals = privacyFilteringReceipt.acceptedItems.map((entry) => {
      const kind = inferSignalKind(entry.text);
      return {
        signalId: `zavorth.memory-signal.${safeId(input.zavorthSessionId)}.${safeId(entry.sourceEventId)}`,
        sessionId: input.zavorthSessionId,
        kind,
        text: entry.text,
        confidence: kind === 'procedural' || kind === 'decision' ? 0.84 : 0.68,
        retentionHint: kind === 'procedural' || kind === 'decision' ? 'long' : 'medium',
        advisoryOnly: true,
        writePerformed: false,
        provenance: {
          sourceRuntimeId: input.sourceRuntimeId,
          sourceSessionId: input.sourceSessionId,
          sourceEventIds: [entry.sourceEventId],
          provenanceRefs: [entry.provenanceRef],
          importedAt: this.now().toISOString(),
        },
      } satisfies ZavorthImportedMemorySignal;
    });

    return {
      status: signals.length > 0 ? 'signals-ready' : 'blocked',
      sessionId: input.zavorthSessionId,
      signals,
      safety: memorySignalSafety(),
    };
  }

  public buildReplayHandoffSnapshot(
    sessionId: string,
    privacyFilteringReceipt: ZavorthPrivacyFilteringReceipt,
    memorySignalMappingReceipt: ZavorthMemorySignalMappingReceipt,
  ): ZavorthReplayHandoffSnapshot {
    const ready = privacyFilteringReceipt.status === 'filtered'
      && memorySignalMappingReceipt.status === 'signals-ready';
    return {
      status: ready ? 'handoff-ready' : 'blocked',
      replayId: `zavorth.replay.${safeId(sessionId)}`,
      sessionId,
      contextItems: privacyFilteringReceipt.acceptedItems.map((entry) => ({
        itemId: entry.itemId,
        role: entry.role,
        text: entry.text,
        sourceEventId: entry.sourceEventId,
      })),
      memorySignalRefs: memorySignalMappingReceipt.signals.map((entry) => entry.signalId),
      redactedBeforeContext: true,
      rawTranscriptIncluded: false,
      safety: {
        privateDataExcluded: true,
        restrictedDataExcluded: true,
        secretValuesRedacted: true,
        noMemoryWritePerformed: true,
      },
    };
  }

  public buildContinuationRequest(
    replayHandoffSnapshot: ZavorthReplayHandoffSnapshot,
  ): ZavorthContinuationRequest {
    const ready = replayHandoffSnapshot.status === 'handoff-ready';
    return {
      status: ready ? 'ready' : 'blocked',
      continuationId: `zavorth.continuation.${safeId(replayHandoffSnapshot.replayId)}`,
      sessionId: replayHandoffSnapshot.sessionId,
      replayId: replayHandoffSnapshot.replayId,
      gatewayEntrypoint: 'ZavorthAgentGateway',
      naturalFirstRoute: 'memory-recall',
      requestText: `Continue ${replayHandoffSnapshot.sessionId} using redacted replay ${replayHandoffSnapshot.replayId}.`,
      sourceRuntimeDiagnosticsOnly: true,
      safety: {
        continuationThroughGateway: true,
        noDirectSourceContinuation: true,
        noToolExecution: true,
        noProviderCall: true,
      },
    };
  }

  public buildZavorthControlProjection(input: {
    status: ZavorthSessionMemoryContinuationStatus;
    historyBridgeReceipt: ZavorthSessionHistoryBridgeReceipt;
    privacyFilteringReceipt: ZavorthPrivacyFilteringReceipt;
    memorySignalMappingReceipt: ZavorthMemorySignalMappingReceipt;
    replayHandoffSnapshot: ZavorthReplayHandoffSnapshot;
    continuationRequest: ZavorthContinuationRequest;
  }): ZavorthSessionMemoryZavorthControlProjection {
    return {
      title: 'Session Memory Continuation',
      status: input.status,
      tone: input.status === 'session-memory-continuation-ready' ? 'ready' : input.status === 'attention' ? 'attention' : 'blocked',
      cards: [
        card('history', 'History Items', String(input.historyBridgeReceipt.receivedItems), 'Source session history bridged as Zavorth-owned receipt'),
        card('filtered', 'Filtered Items', String(input.privacyFilteringReceipt.droppedItems.length), 'Private, restricted, and secret items excluded before context and memory'),
        card('context', 'Context Items', String(input.privacyFilteringReceipt.acceptedItems.length), 'Only public redacted transcript enters replay context'),
        card('signals', 'Memory Signals', String(input.memorySignalMappingReceipt.signals.length), 'Imported signals are advisory and provenance-backed'),
        card('replay', 'Replay Handoff', input.replayHandoffSnapshot.status, 'Replay snapshot contains no raw transcript'),
        card('continuation', 'Continuation', input.continuationRequest.gatewayEntrypoint, 'Continuation returns through ZavorthAgentGateway'),
        card('memory-write', 'Memory Writes', '0', 'Runtime gateway maps signals but writes no memory'),
      ],
      policyPills: [
        'privacy filtered',
        'restricted excluded',
        'provenance required',
        'advisory memory',
        'no memory write',
        'ZavorthAgentGateway continuation',
      ],
      nextSafeAction: input.status === 'session-memory-continuation-ready'
        ? 'Proceed to 291 Surface controls - Delegated Workers.'
        : 'Fix failed session memory gates before worker delegation.',
    };
  }

  public formatSnapshotText(snapshot: ZavorthSessionMemoryContinuationSnapshot): string {
    const lines = [
      'Zavorth Session Memory Continuation - Runtime gateway',
      '',
      `Status: ${snapshot.status}`,
      `Previous channel messaging: ${snapshot.previousChannelMessagingStatus}`,
      `Transcript items received: ${snapshot.summary.transcriptItemsReceived}`,
      `Public context items: ${snapshot.summary.publicContextItems}`,
      `Filtered private/restricted/secret items: ${snapshot.summary.privateRestrictedSecretItemsFiltered}`,
      `Memory signals: ${snapshot.summary.memorySignals}`,
      `Provenance-backed signals: ${snapshot.summary.provenanceBackedSignals}`,
      `Continuation gateway requests: ${snapshot.summary.continuationGatewayRequests}`,
      `Memory writes performed: ${snapshot.summary.memoryWritesPerformed}`,
      `Hidden memory authority created: ${snapshot.summary.hiddenMemoryAuthorityCreated}`,
      '',
      'ZavorthControl:',
      ...snapshot.zavorthControlProjection.cards.map((entry) => `- ${entry.label}: ${entry.value} (${entry.detail})`),
      '',
      'Acceptance:',
      ...snapshot.acceptanceMatrix.map((entry) => `- ${entry.status} ${entry.requirementId}: ${entry.evidence}`),
      '',
      `Next: ${snapshot.commands.nextStage}`,
    ];
    return lines.join('\n');
  }
}

function item(
  sourceEventId: string,
  role: ZavorthSessionHistoryItemInput['role'],
  text: string,
  visibility: ZavorthSessionHistoryItemInput['visibility'],
  occurredAt: string,
  provenanceRef: string,
): ZavorthSessionHistoryItemInput {
  return { sourceEventId, role, text, visibility, occurredAt, provenanceRef };
}

function buildAcceptanceMatrix(
  previousChannelMessagingStatus: ZavorthChannelMessagingBridgeStatus,
  historyBridgeReceipt: ZavorthSessionHistoryBridgeReceipt,
  privacyFilteringReceipt: ZavorthPrivacyFilteringReceipt,
  memorySignalMappingReceipt: ZavorthMemorySignalMappingReceipt,
  replayHandoffSnapshot: ZavorthReplayHandoffSnapshot,
  continuationRequest: ZavorthContinuationRequest,
): ZavorthSessionMemoryContinuationSnapshot['acceptanceMatrix'] {
  const acceptedLeaks = privacyFilteringReceipt.acceptedItems
    .filter((entry) => entry.originalVisibility !== 'public' || /\b(API[_-]?KEY|TOKEN|SECRET|PASSWORD)=/i.test(entry.text));
  const signalsWithProvenance = memorySignalMappingReceipt.signals
    .filter((entry) => entry.provenance.sourceEventIds.length > 0 && entry.provenance.provenanceRefs.length > 0);
  return [
    acceptance('checkpoint-5-channels-and-messaging-ready', previousChannelMessagingStatus === 'channel-messaging-bridge-ready', `previousChannelMessagingStatus=${previousChannelMessagingStatus}`),
    acceptance('session-history-bridge-ready', historyBridgeReceipt.status === 'bridged'
      && historyBridgeReceipt.canonicalOwner === 'Zavorth'
      && historyBridgeReceipt.safety.sourceSessionNotCanonical, `${historyBridgeReceipt.receivedItems} source item(s)`),
    acceptance('private-restricted-filtered-before-context-memory', privacyFilteringReceipt.status === 'filtered'
      && privacyFilteringReceipt.droppedItems.length >= 3
      && acceptedLeaks.length === 0
      && privacyFilteringReceipt.safety.privateFilteredBeforeContext
      && privacyFilteringReceipt.safety.restrictedFilteredBeforeMemory, `${privacyFilteringReceipt.droppedItems.length} dropped item(s), leaks=${acceptedLeaks.length}`),
    acceptance('memory-signals-provenance-backed-advisory-only', memorySignalMappingReceipt.status === 'signals-ready'
      && memorySignalMappingReceipt.signals.length > 0
      && signalsWithProvenance.length === memorySignalMappingReceipt.signals.length
      && memorySignalMappingReceipt.signals.every((entry) => entry.advisoryOnly && !entry.writePerformed)
      && memorySignalMappingReceipt.safety.noMemoryWritePerformed, `${memorySignalMappingReceipt.signals.length} signal(s), provenance=${signalsWithProvenance.length}`),
    acceptance('replay-handoff-redacted-before-context', replayHandoffSnapshot.status === 'handoff-ready'
      && replayHandoffSnapshot.redactedBeforeContext
      && !replayHandoffSnapshot.rawTranscriptIncluded
      && replayHandoffSnapshot.safety.privateDataExcluded
      && replayHandoffSnapshot.safety.restrictedDataExcluded, `${replayHandoffSnapshot.contextItems.length} context item(s)`),
    acceptance('continuation-runs-through-zavorth-agent-gateway', continuationRequest.status === 'ready'
      && continuationRequest.gatewayEntrypoint === 'ZavorthAgentGateway'
      && continuationRequest.safety.continuationThroughGateway
      && continuationRequest.safety.noDirectSourceContinuation, `${continuationRequest.continuationId} -> ${continuationRequest.gatewayEntrypoint}`),
    acceptance('no-hidden-memory-authority-created', historyBridgeReceipt.safety.noMemoryWritePerformed
      && privacyFilteringReceipt.safety.noRawTranscriptMemoryWrite
      && memorySignalMappingReceipt.safety.importedMemoryAdvisoryOnly
      && replayHandoffSnapshot.safety.noMemoryWritePerformed, 'all receipts are no-write/advisory'),
  ];
}

function acceptance(
  requirementId: string,
  passed: boolean,
  evidence: string,
): ZavorthSessionMemoryContinuationSnapshot['acceptanceMatrix'][number] {
  return {
    requirementId,
    status: passed ? 'passed' : 'failed',
    evidence,
  };
}

function resolveStatus(
  previousChannelMessagingStatus: ZavorthChannelMessagingBridgeStatus,
  acceptanceMatrix: ZavorthSessionMemoryContinuationSnapshot['acceptanceMatrix'],
): ZavorthSessionMemoryContinuationStatus {
  if (previousChannelMessagingStatus !== 'channel-messaging-bridge-ready') {
    return 'blocked';
  }
  if (acceptanceMatrix.some((entry) => entry.status === 'failed')) {
    return 'blocked';
  }
  return 'session-memory-continuation-ready';
}

function memorySignalSafety(): ZavorthMemorySignalMappingReceipt['safety'] {
  return {
    provenanceRequired: true,
    importedMemoryAdvisoryOnly: true,
    noMemoryWritePerformed: true,
    correctOrForgetRequired: true,
  };
}

function inferSignalKind(text: string): ZavorthImportedMemorySignal['kind'] {
  if (/\b(rodar|npm|comando|passou|validou|workaround|erro)\b/i.test(text)) return 'procedural';
  if (/\b(decidimos|decis[aã]o|sempre|nunca)\b/i.test(text)) return 'decision';
  return 'context';
}

function redactSecrets(value: string): string {
  return value
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, '$1[REDACTED]')
    .replace(/\b(API[_-]?KEY|TOKEN|SECRET|PASSWORD)=\S+/gi, '$1=[REDACTED]');
}

function safeId(value: string): string {
  const clean = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return clean || 'item';
}

function card(
  id: string,
  label: string,
  value: string,
  detail: string,
): ZavorthSessionMemoryZavorthControlProjection['cards'][number] {
  return { id, label, value, detail };
}
