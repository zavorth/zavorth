









import type {    UniversalAgentRun } from './UniversalAgentRuntimeTypes.js';
import { asErrorLike } from '../../utils/errorLike.js';
import type {  AgentRunRuntimeEventBus, AgentRunRuntimeEventType, AgentRunService } from './AgentRunService.js';
import { normalizeText, recordOrNull } from './AgentRunValueHelpers.js';

export class AgentRunRuntimeEventSupport {
  public constructor(private readonly owner: AgentRunService) {}

  public async publishRuntimeEvent(run: UniversalAgentRun, type: AgentRunRuntimeEventType, payload: Record<string, unknown> = {}): Promise<void> {
    const eventBuses = this.owner.getRuntimeEventBuses();
    const receipt = {
      type,
      emittedAt: this.owner.now().toISOString(),
      runId: run.id,
      status: run.status,
    };
    this.owner.appendRuntimeEventReceipt(run, {
      ...receipt,
      delivery: eventBuses.length > 0 ? 'pending' : 'not-configured',
    });
    if (eventBuses.length === 0) {
      return;
    }

    const runtimePayload = {
      ...payload,
      runId: run.id,
      traceId: run.traceId,
      requestId: run.requestId,
      sessionId: run.sessionId,
      userId: run.userId,
      channel: run.channel,
      status: run.status,
      surfaceChatId: this.owner.resolveRuntimeEventSurfaceChatId(run),
      surfaceThreadId: this.owner.resolveRuntimeEventMetadataText(run, 'threadId'),
      surfaceTaskId: this.owner.resolveRuntimeEventMetadataText(run, 'taskId'),
    };
    let delivered = 0;
    const errors: string[] = [];
    try {
      for (const eventBus of eventBuses) {
        try {
          await eventBus.emit(type, runtimePayload);
          delivered += 1;
        } catch (error: unknown) {
          const err = asErrorLike(error);
          errors.push(error instanceof Error ? err.message : String(error));
        }
      }
      if (delivered === 0 && errors.length > 0) {
        throw new Error(errors.join('; '));
      }
      this.owner.appendRuntimeEventReceipt(run, {
        ...receipt,
        delivery: errors.length > 0 ? 'partial' : 'delivered',
        delivered,
        failed: errors.length,
        error: errors.length > 0 ? errors.join('; ') : undefined,
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      this.owner.appendRuntimeEventReceipt(run, {
        ...receipt,
        delivery: 'failed',
        error: error instanceof Error ? err.message : String(error),
      });
    }
  }

  public async publishAssistantReplyStream(run: UniversalAgentRun, text: string, metadata: Record<string, unknown> = {}): Promise<void> {
    const replyText = normalizeText(text);
    if (!replyText) {
      return;
    }
    const chunks = this.owner.chunkAssistantStreamText(replyText);
    const streamId = `${run.id}:assistant`;
    await this.owner.publishRuntimeEvent(run, 'agent.stream.assistant', {
      ...metadata,
      streamId,
      phase: 'start',
      done: false,
      chunkIndex: 0,
      totalChunks: chunks.length,
      accumulated: '',
      delta: '',
      rawChainOfThoughtExposed: false,
    });

    let accumulated = '';
    for (let index = 0; index < chunks.length; index += 1) {
      accumulated += chunks[index];
      await this.owner.publishRuntimeEvent(run, 'agent.stream.assistant', {
        ...metadata,
        streamId,
        phase: 'delta',
        done: false,
        chunkIndex: index + 1,
        totalChunks: chunks.length,
        accumulated,
        delta: chunks[index],
        rawChainOfThoughtExposed: false,
      });
    }

    await this.owner.publishRuntimeEvent(run, 'agent.stream.assistant', {
      ...metadata,
      streamId,
      phase: 'done',
      done: true,
      chunkIndex: chunks.length,
      totalChunks: chunks.length,
      accumulated,
      delta: '',
      rawChainOfThoughtExposed: false,
    });
  }

  public async publishAssistantReplyStreamDone(run: UniversalAgentRun, text: string, metadata: Record<string, unknown> = {}): Promise<void> {
    const replyText = normalizeText(text);
    if (!replyText) {
      return;
    }
    await this.owner.publishRuntimeEvent(run, 'agent.stream.assistant', {
      ...metadata,
      streamId: `${run.id}:assistant`,
      phase: 'done',
      done: true,
      chunkIndex: 0,
      totalChunks: null,
      accumulated: replyText,
      delta: '',
      rawChainOfThoughtExposed: false,
    });
  }

  public chunkAssistantStreamText(text: string): string[] {
    const normalized = String(text || '');
    const maxChars = 180;
    const chunks: string[] = [];
    let current = '';
    for (const token of normalized.split(/(\s+)/)) {
      if (!token) continue;
      if (current && current.length + token.length > maxChars) {
        chunks.push(current);
        current = token;
        continue;
      }
      current += token;
    }
    if (current) {
      chunks.push(current);
    }
    return chunks.length > 0 ? chunks : [normalized];
  }

  public appendRuntimeEventReceipt(run: UniversalAgentRun, receipt: Record<string, unknown>): void {
    const existing = recordOrNull(run.metadata.runtimeEventBus);
    const events = Array.isArray(existing?.events) ? existing.events.slice(-19) : [];
    run.metadata = {
      ...run.metadata,
      runtimeEventBus: {
        source: 'AgentRunService',
        stage: 2,
        gate: 'source-agent-runtime-bridge',
        configured: this.owner.getRuntimeEventBuses().length > 0,
        subscriberCount: this.owner.getRuntimeEventBuses().length,
        snapshot: this.owner.readRuntimeEventBusSnapshot(),
        events: [...events, receipt],
      },
    };
  }

  public getRuntimeEventBuses(): AgentRunRuntimeEventBus[] {
    return [this.owner.runtimeEventBus, ...this.owner.runtimeEventBusSubscribers].filter((eventBus): eventBus is AgentRunRuntimeEventBus => Boolean(eventBus));
  }

  public readRuntimeEventBusSnapshot(): unknown {
    return this.owner.getRuntimeEventBuses().map((eventBus, index) => {
      if (!eventBus.snapshot) {
        return { index, snapshot: null };
      }
      try {
        return { index, snapshot: eventBus.snapshot() };
      } catch (error: unknown) {
        return { index, snapshot: null };
      }
    });
  }

  public resolveRuntimeEventSurfaceChatId(run: UniversalAgentRun): string | null {
    return this.owner.resolveRuntimeEventMetadataText(run, 'chatId') || this.owner.resolveRuntimeEventMetadataText(run, 'surfaceChatId') || run.sessionId || null;
  }

  public resolveRuntimeEventMetadataText(run: UniversalAgentRun, key: string): string | null {
    const metadata = recordOrNull(run.metadata);
    const text = String(metadata?.[key] ?? '').trim();
    return text || null;
  }

  public applyCachedEvidenceSnapshot<TSnapshot extends Record<string, unknown>>(run: UniversalAgentRun, key: string, buildSnapshot: () => TSnapshot, attachSnapshot: (snapshot: TSnapshot) => void): TSnapshot {
    const fingerprint = this.owner.metadataEvidenceHelpers.buildEvidenceSnapshotFingerprint(run);
    const existing = recordOrNull(run.metadata[key]);
    if (this.owner.metadataEvidenceHelpers.readEvidenceSnapshotFingerprint(run, key) === fingerprint) {
      const cached = existing || this.owner.metadataEvidenceHelpers.readCachedEvidenceSnapshot(run, key);
      if (cached) {
        this.owner.metadataEvidenceHelpers.recordCoreDietSnapshot(run, key, 'cache-hit');
        return cached as TSnapshot;
      }
    }

    const snapshot = buildSnapshot();
    const material = existing || this.owner.metadataEvidenceHelpers.isMaterialEvidenceSnapshot(snapshot);
    this.owner.metadataEvidenceHelpers.writeCachedEvidenceSnapshot(run, key, snapshot);
    this.owner.evidenceStore.put(run, key, snapshot, Boolean(material));
    if (!material) {
      this.owner.metadataEvidenceHelpers.writeEvidenceSnapshotFingerprint(run, key, fingerprint);
      this.owner.metadataEvidenceHelpers.recordCoreDietSnapshot(run, key, 'built-skipped');
      return snapshot;
    }

    attachSnapshot(snapshot);
    this.owner.metadataEvidenceHelpers.writeEvidenceSnapshotFingerprint(run, key, fingerprint);
    this.owner.metadataEvidenceHelpers.recordCoreDietSnapshot(run, key, 'built-attached');
    return snapshot;
  }
}
