import type { NodeMeshCapabilityId, NodeMeshHostHints, NodeMeshRegistryEntry } from '../contracts/NodeMeshContract.js';
import { logger } from '../logger.js';

export type LiveNodeTransport = 'heartbeat' | 'sse' | 'websocket' | 'long-poll' | 'manual';

export type LiveNodeEventType =
  | 'node.claimed'
  | 'node.heartbeat'
  | 'node.disconnected'
  | 'node.capabilities.reapproval_required'
  | 'node.invocation.queued'
  | 'node.invocation.completed';

export type LiveNodeCapabilityDelta = {
  added: NodeMeshCapabilityId[];
  removed: NodeMeshCapabilityId[];
  unchanged: NodeMeshCapabilityId[];
};

export type LiveNodeSession = {
  sessionId: string;
  nodeId: string;
  label: string;
  status: 'online' | 'idle' | 'offline' | 'blocked' | 'pairing';
  pairingStatus: 'pending' | 'paired' | 'revoked';
  transport: LiveNodeTransport;
  connectedAt: string;
  lastSeenAt: string;
  capabilityIds: NodeMeshCapabilityId[];
  approvedCapabilityIds: NodeMeshCapabilityId[];
  hostHints: NodeMeshHostHints;
  assignmentsPending: number;
  acceptedResults: number;
  reapprovalRequired: boolean;
  capabilityDelta: LiveNodeCapabilityDelta | null;
  receiptId: string;
};

export type LiveNodeEvent = {
  seq: number;
  type: LiveNodeEventType;
  generatedAt: string;
  nodeId: string | null;
  sessionId: string | null;
  summary: string;
  payload: Record<string, unknown>;
};

export type LiveNodeSnapshot = {
  generatedAt: string;
  summary: {
    live: number;
    online: number;
    blocked: number;
    reapprovalRequired: number;
    sseSubscribers: number;
    events: number;
  };
  sessions: LiveNodeSession[];
  recentEvents: LiveNodeEvent[];
  safety: {
    rawSecretsSerialized: false;
    capabilityUpgradesRequireReapproval: true;
    liveSessionsAreMemoryOnly: true;
  };
};

type Listener = (event: LiveNodeEvent) => void;

type Runtime = {
  now?: () => Date;
  maxEvents?: number;
  sessionTtlMs?: number;
};

const DEFAULT_MAX_EVENTS = 120;
const DEFAULT_SESSION_TTL_MS = 60_000;

function normalizeText(input: unknown): string {
  return String(input || '').trim();
}

function uniqueSorted(entries: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(entries.map((entry) => normalizeText(entry)).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right, 'en-US'));
}

function buildSessionId(nodeId: string, nowIso: string): string {
  return `live-node:${nodeId}:${Buffer.from(nowIso).toString('base64url').slice(0, 10)}`;
}

function receiptId(type: LiveNodeEventType, nodeId: string | null, seq: number): string {
  return `node-live.${type}.${nodeId || 'none'}.${seq}`;
}

export class LiveNodeRegistryService {
  private readonly now: () => Date;
  private readonly maxEvents: number;
  private readonly sessionTtlMs: number;
  private readonly sessions = new Map<string, LiveNodeSession>();
  private readonly listeners = new Set<Listener>();
  private readonly events: LiveNodeEvent[] = [];
  private seq = 0;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.maxEvents = Math.max(20, Number(runtime.maxEvents || DEFAULT_MAX_EVENTS));
    this.sessionTtlMs = Math.max(5_000, Number(runtime.sessionTtlMs || DEFAULT_SESSION_TTL_MS));
  }

  public recordClaim(input: {
    node: NodeMeshRegistryEntry;
    assignmentsPending?: number | null;
    transport?: LiveNodeTransport | null;
  }): LiveNodeSession {
    const session = this.upsertSession({
      node: input.node,
      transport: input.transport || 'heartbeat',
      assignmentsPending: Number(input.assignmentsPending || 0),
      acceptedResults: 0,
      capabilityDelta: null,
      reapprovalRequired: false,
    });
    this.publish('node.claimed', input.node.id, session.sessionId, `${input.node.label} joined the live Node Mesh.`, {
      nodeId: input.node.id,
      label: input.node.label,
      transport: session.transport,
      assignmentsPending: session.assignmentsPending,
    });
    return session;
  }

  public recordHeartbeat(input: {
    node: NodeMeshRegistryEntry;
    assignmentsPending?: number | null;
    acceptedResults?: number | null;
    transport?: LiveNodeTransport | null;
  }): LiveNodeSession {
    const session = this.upsertSession({
      node: input.node,
      transport: input.transport || 'heartbeat',
      assignmentsPending: Number(input.assignmentsPending || 0),
      acceptedResults: Number(input.acceptedResults || 0),
      capabilityDelta: null,
      reapprovalRequired: false,
    });
    this.publish('node.heartbeat', input.node.id, session.sessionId, `${input.node.label} published a live heartbeat.`, {
      nodeId: input.node.id,
      status: input.node.status,
      assignmentsPending: session.assignmentsPending,
      acceptedResults: session.acceptedResults,
    });
    return session;
  }

  public recordReapprovalRequired(input: {
    node: NodeMeshRegistryEntry;
    delta: LiveNodeCapabilityDelta;
    reason: string;
  }): LiveNodeSession {
    const session = this.upsertSession({
      node: input.node,
      transport: 'heartbeat',
      assignmentsPending: 0,
      acceptedResults: 0,
      capabilityDelta: input.delta,
      reapprovalRequired: true,
    });
    this.publish(
      'node.capabilities.reapproval_required',
      input.node.id,
      session.sessionId,
      input.reason,
      {
        nodeId: input.node.id,
        added: input.delta.added,
        removed: input.delta.removed,
        approvedCapabilityIds: session.approvedCapabilityIds,
      },
    );
    return session;
  }

  public recordInvocationQueued(input: {
    nodeId: string | null | undefined;
    invocationId?: string | null;
    capabilityId?: string | null;
    action?: string | null;
    status?: string | null;
  }): void {
    const nodeId = normalizeText(input.nodeId) || null;
    this.publish('node.invocation.queued', nodeId, nodeId ? this.sessions.get(nodeId)?.sessionId || null : null, 'Node invocation queued.', {
      nodeId,
      invocationId: normalizeText(input.invocationId) || null,
      capabilityId: normalizeText(input.capabilityId) || null,
      action: normalizeText(input.action) || null,
      status: normalizeText(input.status) || null,
    });
  }

  public recordInvocationCompleted(input: {
    nodeId: string | null | undefined;
    invocationId?: string | null;
    ok?: boolean | null;
    resultSummary?: string | null;
  }): void {
    const nodeId = normalizeText(input.nodeId) || null;
    this.publish('node.invocation.completed', nodeId, nodeId ? this.sessions.get(nodeId)?.sessionId || null : null, 'Node invocation completed.', {
      nodeId,
      invocationId: normalizeText(input.invocationId) || null,
      ok: Boolean(input.ok),
      resultSummary: normalizeText(input.resultSummary) || null,
    });
  }

  public markDisconnected(nodeId: string | null | undefined, reason?: string | null): void {
    const normalizedNodeId = normalizeText(nodeId);
    if (!normalizedNodeId) {
      return;
    }
    const session = this.sessions.get(normalizedNodeId);
    if (session) {
      this.sessions.set(normalizedNodeId, {
        ...session,
        status: 'offline',
        lastSeenAt: this.now().toISOString(),
      });
    }
    this.publish('node.disconnected', normalizedNodeId, session?.sessionId || null, normalizeText(reason) || 'Node disconnected from live registry.', {
      nodeId: normalizedNodeId,
      reason: normalizeText(reason) || null,
    });
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public buildSnapshot(): LiveNodeSnapshot {
    this.pruneStaleSessions();
    const sessions = Array.from(this.sessions.values()).sort((left, right) =>
      left.label.localeCompare(right.label, 'en-US'),
    );
    return {
      generatedAt: this.now().toISOString(),
      summary: {
        live: sessions.length,
        online: sessions.filter((session) => session.status === 'online' || session.status === 'idle').length,
        blocked: sessions.filter((session) => session.status === 'blocked').length,
        reapprovalRequired: sessions.filter((session) => session.reapprovalRequired).length,
        sseSubscribers: this.listeners.size,
        events: this.events.length,
      },
      sessions,
      recentEvents: this.events.slice(-20),
      safety: {
        rawSecretsSerialized: false,
        capabilityUpgradesRequireReapproval: true,
        liveSessionsAreMemoryOnly: true,
      },
    };
  }

  private upsertSession(input: {
    node: NodeMeshRegistryEntry;
    transport: LiveNodeTransport;
    assignmentsPending: number;
    acceptedResults: number;
    reapprovalRequired: boolean;
    capabilityDelta: LiveNodeCapabilityDelta | null;
  }): LiveNodeSession {
    const nowIso = this.now().toISOString();
    const current = this.sessions.get(input.node.id);
    const session: LiveNodeSession = {
      sessionId: current?.sessionId || buildSessionId(input.node.id, nowIso),
      nodeId: input.node.id,
      label: input.node.label || input.node.id,
      status: input.node.status,
      pairingStatus: input.node.pairingStatus,
      transport: input.transport,
      connectedAt: current?.connectedAt || nowIso,
      lastSeenAt: nowIso,
      capabilityIds: uniqueSorted(input.node.capabilityIds) as NodeMeshCapabilityId[],
      approvedCapabilityIds: uniqueSorted(input.node.approvedCapabilityIds || []) as NodeMeshCapabilityId[],
      hostHints: input.node.hostHints,
      assignmentsPending: input.assignmentsPending,
      acceptedResults: input.acceptedResults,
      reapprovalRequired: input.reapprovalRequired,
      capabilityDelta: input.capabilityDelta,
      receiptId: current?.receiptId || receiptId('node.heartbeat', input.node.id, this.seq + 1),
    };
    this.sessions.set(input.node.id, session);
    return session;
  }

  private publish(
    type: LiveNodeEventType,
    nodeId: string | null,
    sessionId: string | null,
    summary: string,
    payload: Record<string, unknown>,
  ): LiveNodeEvent {
    const event: LiveNodeEvent = {
      seq: ++this.seq,
      type,
      generatedAt: this.now().toISOString(),
      nodeId,
      sessionId,
      summary,
      payload: {
        ...payload,
        receiptId: receiptId(type, nodeId, this.seq),
        rawSecretsSerialized: false,
      },
    };
    this.events.push(event);
    while (this.events.length > this.maxEvents) {
      this.events.shift();
    }
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error: any) {
      // Listener failures must not break node heartbeats.
      logger.warn('[Live Node Registry] load operation failed', error);
    }
    }
    return event;
  }

  private pruneStaleSessions(): void {
    const nowMs = this.now().getTime();
    for (const [nodeId, session] of this.sessions.entries()) {
      const lastSeenMs = Date.parse(session.lastSeenAt);
      if (!Number.isFinite(lastSeenMs)) {
        continue;
      }
      if (nowMs - lastSeenMs > this.sessionTtlMs && session.status !== 'offline') {
        this.sessions.set(nodeId, {
          ...session,
          status: 'offline',
        });
      }
    }
  }
}

export const globalLiveNodeRegistry = new LiveNodeRegistryService();
