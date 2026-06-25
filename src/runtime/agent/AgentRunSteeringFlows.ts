import { AgentRunService, AgentRunSteeringInput, normalizeText } from './AgentRunService.js';
import { UniversalAgentRun, UniversalAgentSteeringEntry } from './UniversalAgentRuntimeTypes.js';
import { AgentRunSteeringStreamAction } from './AgentRunSteeringStream.js';

export class AgentRunSteeringFlows {
  constructor(private service: AgentRunService) {}

  public recordSteering(
    run: UniversalAgentRun,
    input: AgentRunSteeringInput,
  ): UniversalAgentSteeringEntry {
    const text = normalizeText(input.text);
    if (!text) {
      throw new Error('Steering requires text.');
    }
    const now = this.service.now().toISOString();
    const backoffMs = Math.max(0, Number(input.backoffMs || 0));
    const maxAttempts = Math.max(1, Number(input.maxAttempts || 1));
    const entry: UniversalAgentSteeringEntry = {
      id: this.service.idFactory('agent-steer'),
      runId: run.id,
      sessionId: normalizeText(input.sessionId, run.sessionId),
      text,
      source: normalizeText(input.source, 'operator-steering'),
      status: 'accepted',
      createdAt: now,
      updatedAt: now,
      ackId: this.service.idFactory('steering-ack'),
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
    this.syncRunSteeringMetadata(run);
    this.publishSteeringFrame(run, entry, 'accepted');
    return entry;
  }


  public cancelSteering(
    run: UniversalAgentRun,
    steeringId: string,
    reason = 'Cancelled by operator.',
    metadata: Record<string, unknown> | null = null,
  ): UniversalAgentSteeringEntry | null {
    const target = this.findSteeringEntry(run, steeringId);
    if (!target || target.status === 'cancelled') {
      return target || null;
    }
    const now = this.service.now().toISOString();
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
      detail: target.cancelReason,
      status: 'done',
      createdAt: now,
      metadata: {
        steeringId: target.id,
        ackId: target.ackId,
        nativeAgentRunSteering: true,
      },
    });
    this.syncRunSteeringMetadata(run);
    this.publishSteeringFrame(run, target, 'cancelled');
    return target;
  }


  public replaceSteering(
    run: UniversalAgentRun,
    steeringId: string,
    input: AgentRunSteeringInput,
  ): UniversalAgentSteeringEntry | null {
    const target = this.findSteeringEntry(run, steeringId);
    if (!target || target.status === 'cancelled') {
      return null;
    }
    const now = this.service.now().toISOString();
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
    const replacement = this.recordSteering(run, {
      ...input,
      replaceTargetId: target.id,
    });
    target.replacedById = replacement.id;
    target.updatedAt = replacement.createdAt;
    this.syncRunSteeringMetadata(run);
    this.publishSteeringFrame(run, target, 'superseded');
    return replacement;
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
    const frame = this.service.steeringStream.publish(run.id, entry, action);
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


  public markAcceptedSteeringApplied(run: UniversalAgentRun, now: string): void {
    const accepted = (run.steering || []).filter((entry) => entry.status === 'accepted');
    if (accepted.length === 0) return;
    for (const entry of accepted) {
      entry.status = 'applied';
      entry.updatedAt = now;
      run.events.push({
        id: `${entry.id}:applied`,
        runId: run.id,
        kind: 'steering',
        title: 'Steering applied',
        detail: entry.text,
        status: 'done',
        createdAt: now,
        metadata: {
          steeringId: entry.id,
          ackId: entry.ackId,
          nativeAgentRunSteering: true,
        },
      });
      this.publishSteeringFrame(run, entry, 'applied');
    }
  }


}