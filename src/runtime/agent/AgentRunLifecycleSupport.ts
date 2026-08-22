import {
  type AgentRunSteeringStreamAction,
} from './AgentRunSteeringStream.js';










import {  type AgentRunRiskReviewStage } from './security/AgentRunRiskHooks.js';
import type {
  UniversalAgentRun,
  UniversalAgentSteeringEntry} from './UniversalAgentRuntimeTypes.js';
import type {  AgentRunRuntimeEventBus, AgentRunService, AgentRunSteeringInput, SelfModificationRuntime, WatchModeRuntime } from './AgentRunService.js';
import { normalizeText } from './AgentRunValueHelpers.js';

export class AgentRunLifecycleSupport {
  public constructor(private readonly owner: AgentRunService) {}

  public attachSelfModificationService(service: SelfModificationRuntime | null | undefined): void {
      this.owner.selfModificationService = service || null;
    }

  public attachWatchModeService(service: WatchModeRuntime | null | undefined): void {
      this.owner.watchModeService = service || null;
    }

  public attachRuntimeEventBus(service: AgentRunRuntimeEventBus | null | undefined): void {
      this.owner.runtimeEventBus = service || null;
    }

  public addRuntimeEventBus(service: AgentRunRuntimeEventBus | null | undefined): void {
      if (!service || this.owner.runtimeEventBusSubscribers.includes(service)) {
        return;
      }
      this.owner.runtimeEventBusSubscribers.push(service);
    }

  public removeRuntimeEventBus(service: AgentRunRuntimeEventBus | null | undefined): void {
      if (!service) {
        return;
      }
      const index = this.owner.runtimeEventBusSubscribers.indexOf(service);
      if (index >= 0) {
        this.owner.runtimeEventBusSubscribers.splice(index, 1);
      }
    }

  public recordSteering(
      run: UniversalAgentRun,
      input: AgentRunSteeringInput,
    ): UniversalAgentSteeringEntry {
      const text = normalizeText(input.text);
      if (!text) {
        throw new Error('Steering requires text.');
      }
      const now = this.owner.now().toISOString();
      const backoffMs = Math.max(0, Number(input.backoffMs || 0));
      const maxAttempts = Math.max(1, Number(input.maxAttempts || 1));
      const entry: UniversalAgentSteeringEntry = {
        id: this.owner.idFactory('agent-steer'),
        runId: run.id,
        sessionId: normalizeText(input.sessionId, run.sessionId),
        text,
        source: normalizeText(input.source, 'operator-steering'),
        status: 'accepted',
        createdAt: now,
        updatedAt: now,
        ackId: this.owner.idFactory('steering-ack'),
        queueItemId: normalizeText(input.queueItemId) || null,
        replaceTargetId: normalizeText(input.replaceTargetId) || null,
        replacedById: null,
        cancelledAt: null,
        cancelReason: null,
        attempts: 0,
        maxAttempts,
        backoffMs,
        nextRetryAt: backoffMs > 0 ? new Date(Date.parse(now) + backoffMs).toISOString() : null,
        metadata: {
          ...(input.metadata || {}),
          nativeAgentRunSteering: true,
        },
      };
      run.steering = [...(run.steering || []), entry];
      run.updatedAt = now;
      run.events.push({
        id: `${entry.id}:accepted`,
        runId: run.id,
        kind: 'steering',
        title: 'Steering accepted',
        detail: text,
        status: 'done',
        createdAt: now,
        metadata: {
          steeringId: entry.id,
          ackId: entry.ackId,
          queueItemId: entry.queueItemId || null,
          replaceTargetId: entry.replaceTargetId || null,
          backoffMs,
          maxAttempts,
          nativeAgentRunSteering: true,
        },
      });
      this.owner.syncRunSteeringMetadata(run);
      this.owner.publishSteeringFrame(run, entry, 'accepted');
      return entry;
    }

  public cancelSteering(
      run: UniversalAgentRun,
      steeringId: string,
      reason = 'Cancelled by operator.',
      metadata: Record<string, unknown> | null = null,
    ): UniversalAgentSteeringEntry | null {
      const target = this.owner.findSteeringEntry(run, steeringId);
      if (!target || target.status === 'cancelled') {
        return target || null;
      }
      const now = this.owner.now().toISOString();
      target.status = 'cancelled';
      target.cancelledAt = now;
      target.cancelReason = normalizeText(reason, 'Cancelled by operator.');
      target.updatedAt = now;
      target.metadata = {
        ...(target.metadata || {}),
        ...(metadata || {}),
      };
      run.updatedAt = now;
      run.events.push({
        id: `${target.id}:cancelled`,
        runId: run.id,
        kind: 'steering',
        title: 'Steering cancelled',
        detail: target.cancelReason || undefined,
        status: 'done',
        createdAt: now,
        metadata: {
          steeringId: target.id,
          ackId: target.ackId,
          nativeAgentRunSteering: true,
        },
      });
      this.owner.syncRunSteeringMetadata(run);
      this.owner.publishSteeringFrame(run, target, 'cancelled');
      return target;
    }

  public replaceSteering(
      run: UniversalAgentRun,
      steeringId: string,
      input: AgentRunSteeringInput,
    ): UniversalAgentSteeringEntry | null {
      const target = this.owner.findSteeringEntry(run, steeringId);
      if (!target || target.status === 'cancelled') {
        return null;
      }
      const now = this.owner.now().toISOString();
      target.status = 'superseded';
      target.updatedAt = now;
      run.events.push({
        id: `${target.id}:superseded`,
        runId: run.id,
        kind: 'steering',
        title: 'Steering superseded',
        detail: target.text,
        status: 'done',
        createdAt: now,
        metadata: {
          steeringId: target.id,
          ackId: target.ackId,
          nativeAgentRunSteering: true,
        },
      });
      const replacement = this.owner.recordSteering(run, {
        ...input,
        replaceTargetId: target.id,
      });
      target.replacedById = replacement.id;
      target.updatedAt = replacement.createdAt;
      this.owner.syncRunSteeringMetadata(run);
      this.owner.publishSteeringFrame(run, target, 'superseded');
      return replacement;
    }

  public recordLifecycleDefenseReview(
      run: UniversalAgentRun,
      phase: AgentRunRiskReviewStage,
      now: string = this.owner.now().toISOString(),
    ): void {
      this.owner.applyDefenseReview(run, phase, run.metadata, now);
      run.updatedAt = now;
    }

  public readEvidenceSnapshot(
      run: UniversalAgentRun,
      keyOrRefId: string,
    ): Record<string, unknown> | null {
      return this.owner.evidenceStore.get(run, keyOrRefId)
        || this.owner.evidenceStore.getByRef(run, keyOrRefId);
    }

  public snapshotEvidenceRefs(run: UniversalAgentRun) {
      return this.owner.evidenceStore.snapshot(run);
    }

  public findSteeringEntry(
      run: UniversalAgentRun,
      steeringId: string,
    ): UniversalAgentSteeringEntry | null {
      const id = normalizeText(steeringId);
      if (!id) return null;
      return (run.steering || []).find((entry) => entry.id === id || entry.id.startsWith(id)) || null;
    }

  public syncRunSteeringMetadata(run: UniversalAgentRun): void {
      const entries = (run.steering || []).slice(-50);
      const active = entries.filter((entry) => entry.status === 'accepted' || entry.status === 'applied');
      run.metadata = {
        ...run.metadata,
        agentRunSteering: {
          schemaVersion: 1,
          source: 'AgentRunService',
          total: entries.length,
          active: active.length,
          latestAckId: entries.at(-1)?.ackId || null,
          entries,
        },
      };
    }

  public publishSteeringFrame(
      run: UniversalAgentRun,
      entry: UniversalAgentSteeringEntry,
      action: AgentRunSteeringStreamAction,
    ): void {
      const frame = this.owner.steeringStream.publish(run.id, entry, action);
      run.metadata = {
        ...run.metadata,
        agentRunSteeringStream: {
          schemaVersion: 1,
          source: 'AgentRunSteeringStream',
          lastSequence: frame.sequence,
          lastAction: frame.action,
          lastAckId: frame.ackId,
        },
      };
    }
}
