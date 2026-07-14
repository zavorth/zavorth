import { CanonicalExecutionPipelineService } from './CanonicalExecutionPipelineService.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type {
  NodeInvocationCompletion,
  NodeInvocationRecord,
  NodeInvocationStoreState,
  NodeMeshCapabilityId,
  NodeMeshTransport,
} from '../contracts/NodeMeshContract.js';

import { logger } from '../logger.js';

type NodeInvocationStoreRuntime = {
  now?: () => Date;
  stateFile?: string;
  claimLeaseMs?: number;
  pendingStaleMs?: number;
  claimedStaleMs?: number;
};

type EnqueueInvocationInput = {
  nodeId: string;
  capabilityId: NodeMeshCapabilityId;
  action: string;
  payload?: Record<string, unknown> | null;
  requestedBy?: string | null;
  transport?: NodeMeshTransport | null;
  surface?: string | null;
  sessionId?: string | null;
  traceId?: string | null;
  runId?: string | null;
  approvalId?: string | null;
  artifactId?: string | null;
};

export class NodeInvocationStoreService {
  private readonly now: () => Date;
  private readonly stateFile: string;
  private readonly claimLeaseMs: number;
  private readonly pendingStaleMs: number;
  private readonly claimedStaleMs: number;
  private readonly canonicalExecution: CanonicalExecutionPipelineService;

  constructor(runtime: NodeInvocationStoreRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.stateFile = runtime.stateFile || config.nodeMeshInvocationFile;
    this.claimLeaseMs = Math.max(
      5000,
      Number(runtime.claimLeaseMs || ((config.nodeMeshHeartbeatStaleMs || 45000) * 2)),
    );
    this.pendingStaleMs = Math.max(
      60000,
      Number(runtime.pendingStaleMs || config.nodeMeshInvocationPendingMaxAgeMs || 86400000),
    );
    this.claimedStaleMs = Math.max(this.claimLeaseMs, Number(runtime.claimedStaleMs || this.claimLeaseMs));
    this.canonicalExecution = new CanonicalExecutionPipelineService();
  }

  public enqueue(input: EnqueueInvocationInput): NodeInvocationRecord {
    const state = this.readState();
    const nowIso = this.now().toISOString();
    const record: NodeInvocationRecord = this.withLifecycle({
      id: `invoke-${crypto.randomUUID().slice(0, 12)}`,
      nodeId: String(input.nodeId || '').trim().toLowerCase(),
      capabilityId: input.capabilityId,
      action: String(input.action || '').trim() || 'run',
      payload: input.payload || null,
      requestedBy: String(input.requestedBy || '').trim() || null,
      transport: input.transport || null,
      status: 'pending',
      requestedAt: nowIso,
      queuedAt: nowIso,
      claimedAt: null,
      completedAt: null,
      ok: null,
      resultSummary: null,
      output: null,
      staleAt: null,
      staleReason: null,
    }, {
      status: 'planned',
      summary: `Node invocation queued: ${String(input.action || '').trim() || 'run'}.`,
      requestedBy: input.requestedBy || null,
      surface: input.surface || 'node-mesh',
      sessionId: input.sessionId || null,
      traceId: input.traceId || null,
      runId: input.runId || null,
      approvalId: input.approvalId || null,
      artifactId: input.artifactId || null,
      at: nowIso,
    });
    state.entries[record.id] = record;
    state.updatedAt = nowIso;
    this.writeState(state);
    return record;
  }

  public queue(
    input: EnqueueInvocationInput,
    overrides: { transport?: NodeMeshTransport | null } = {},
  ): NodeInvocationRecord {
    return this.enqueue({
      ...input,
      transport: overrides.transport ?? input.transport ?? null,
    });
  }

  public listByNode(nodeId: string | null | undefined): NodeInvocationRecord[] {
    const normalizedNodeId = this.normalizeNodeId(nodeId);
    return Object.values(this.readState().entries)
      .filter((entry) => entry.nodeId === normalizedNodeId)
      .sort((left, right) => left.queuedAt.localeCompare(right.queuedAt, 'en-US'));
  }

  public listRecent(nodeId: string | null | undefined, limit = 5): NodeInvocationRecord[] {
    return this.listByNode(nodeId)
      .sort((left, right) => {
        const leftKey = left.completedAt || left.claimedAt || left.queuedAt;
        const rightKey = right.completedAt || right.claimedAt || right.queuedAt;
        return rightKey.localeCompare(leftKey, 'en-US');
      })
      .slice(0, Math.max(1, limit));
  }

  public listActive(nodeId: string | null | undefined, limit = 5): NodeInvocationRecord[] {
    return this.listByNode(nodeId)
      .filter((entry) => entry.status === 'pending' || entry.status === 'claimed')
      .sort((left, right) => left.queuedAt.localeCompare(right.queuedAt, 'en-US'))
      .slice(0, Math.max(1, limit));
  }

  public claimPending(nodeId: string | null | undefined, limit = 3): NodeInvocationRecord[] {
    const normalizedNodeId = this.normalizeNodeId(nodeId);
    if (!normalizedNodeId) {
      return [];
    }

    const state = this.readState();
    const nowIso = this.now().toISOString();
    const nowMs = this.now().getTime();
    const claimable = Object.values(state.entries)
      .filter((entry) => {
        if (entry.nodeId !== normalizedNodeId) {
          return false;
        }
        if (entry.status === 'pending') {
          return true;
        }
        if (entry.status !== 'claimed' || !entry.claimedAt) {
          return false;
        }
        const claimedAtMs = Date.parse(entry.claimedAt);
        return Number.isFinite(claimedAtMs) && (nowMs - claimedAtMs >= this.claimLeaseMs);
      })
      .sort((left, right) => left.queuedAt.localeCompare(right.queuedAt, 'en-US'))
      .slice(0, Math.max(1, limit));

    for (const entry of claimable) {
      state.entries[entry.id] = {
        ...entry,
        status: 'claimed',
        claimedAt: nowIso,
      };
      state.entries[entry.id] = this.withLifecycle(state.entries[entry.id], {
        status: 'running',
        summary: `Node invocation claimed by ${normalizedNodeId}.`,
        requestedBy: entry.requestedBy,
        surface: 'node-mesh',
        at: nowIso,
      });
    }

    if (claimable.length > 0) {
      state.updatedAt = nowIso;
      this.writeState(state);
    }

    return claimable.map((entry) => state.entries[entry.id]);
  }

  public claimPendingForNode(nodeId: string | null | undefined, limit = 3): NodeInvocationRecord[] {
    return this.claimPending(nodeId, limit);
  }

  public requeueStaleClaimed(nodeId: string | null | undefined, limit = 10): NodeInvocationRecord[] {
    const normalizedNodeId = this.normalizeNodeId(nodeId);
    if (!normalizedNodeId) {
      return [];
    }

    const state = this.readState();
    const nowMs = this.now().getTime();
    const requeued = Object.values(state.entries)
      .filter((entry) => entry.nodeId === normalizedNodeId && this.isStaleClaimed(entry, nowMs))
      .sort((left, right) => left.queuedAt.localeCompare(right.queuedAt, 'en-US'))
      .slice(0, Math.max(1, limit));

    if (requeued.length === 0) {
      return [];
    }

    const nowIso = this.now().toISOString();
    for (const entry of requeued) {
      state.entries[entry.id] = this.withLifecycle({
        ...entry,
        status: 'pending',
        claimedAt: null,
        staleAt: null,
        staleReason: null,
        resultSummary: entry.resultSummary || 'Invocaction recolocada na fila apos recover operacional.',
        completedAt: null,
      }, {
        status: 'planned',
        summary: 'Node invocation requeued after stale claim recovery.',
        requestedBy: entry.requestedBy,
        surface: 'node-mesh',
        at: nowIso,
      });
    }
    state.updatedAt = nowIso;
    this.writeState(state);

    return requeued.map((entry) => state.entries[entry.id]);
  }

  public complete(
    nodeId: string | null | undefined,
    completion: NodeInvocationCompletion,
  ): NodeInvocationRecord | null {
    const normalizedNodeId = this.normalizeNodeId(nodeId);
    const invocationId = String(completion.invocationId || '').trim();
    if (!normalizedNodeId || !invocationId) {
      return null;
    }

    const state = this.readState();
    const current = state.entries[invocationId];
    if (!current || current.nodeId !== normalizedNodeId) {
      return null;
    }

    const completedAt = this.now().toISOString();
    const next: NodeInvocationRecord = this.withLifecycle({
      ...current,
      status: completion.ok ? 'completed' : 'failed',
      completedAt,
      ok: Boolean(completion.ok),
      resultSummary: String(completion.resultSummary || '').trim()
        || (completion.ok ? 'Invocacao concluida com sucesso.' : 'Invocacao falhou no node host.'),
      output: {
        stdout: String(completion.stdout || '').trim() || null,
        stderr: String(completion.stderr || '').trim() || null,
        exitCode: Number.isFinite(completion.exitCode as number) ? Number(completion.exitCode) : null,
        data: completion.data || null,
      },
    }, {
      status: completion.ok ? 'completed' : 'failed',
      summary: String(completion.resultSummary || '').trim()
        || (completion.ok ? 'Node invocation completed.' : 'Node invocation failed.'),
      requestedBy: current.requestedBy,
      surface: 'node-mesh',
      at: completedAt,
    });
    state.entries[next.id] = next;
    state.updatedAt = completedAt;
    this.writeState(state);
    return next;
  }

  public completeInvocation(
    nodeId: string | null | undefined,
    completion: NodeInvocationCompletion,
  ): NodeInvocationRecord | null {
    return this.complete(nodeId, completion);
  }

  public summarizeNode(nodeId: string | null | undefined): {
    pending: number;
    claimed: number;
    completedRecently: number;
    stalePending: number;
    staleClaimed: number;
    recent: NodeInvocationRecord | null;
  } {
    const recentWindowMs = 1000 * 60 * 60 * 6;
    const nowMs = this.now().getTime();
    const cutoff = nowMs - recentWindowMs;
    const entries = this.listByNode(nodeId);
    return {
      pending: entries.filter((entry) => entry.status === 'pending').length,
      claimed: entries.filter((entry) => entry.status === 'claimed').length,
      completedRecently: entries.filter((entry) => {
        if (!entry.completedAt) {
          return false;
        }
        const timestamp = Date.parse(entry.completedAt);
        return Number.isFinite(timestamp) && timestamp >= cutoff;
      }).length,
      stalePending: entries.filter((entry) => entry.staleReason === 'pending-expired').length,
      staleClaimed: entries.filter((entry) => this.isStaleClaimed(entry, nowMs)).length,
      recent: entries
        .sort((left, right) => {
          const leftKey = left.completedAt || left.claimedAt || left.queuedAt;
          const rightKey = right.completedAt || right.claimedAt || right.queuedAt;
          return rightKey.localeCompare(leftKey, 'en-US');
        })[0] || null,
    };
  }

  public readState(): NodeInvocationStoreState {
    return this.readStateWithLifecycle();
  }

  public pruneByNodeIds(
    nodeIds: Array<string | null | undefined>,
    input: {
      keepActive?: boolean;
    } = {},
  ): {
    removedInvocationIds: string[];
    removedEntries: number;
    blockedNodeIds: string[];
  } {
    const normalizedNodeIds = new Set(
      (nodeIds || [])
        .map((nodeId) => this.normalizeNodeId(nodeId))
        .filter(Boolean),
    );
    if (normalizedNodeIds.size === 0) {
      return {
        removedInvocationIds: [],
        removedEntries: 0,
        blockedNodeIds: [],
      };
    }

    const state = this.readStateWithLifecycle();
    const keepActive = input.keepActive !== false;
    const blockedNodeIds = keepActive
      ? Array.from(
          new Set(
            Object.values(state.entries)
              .filter((entry) =>
                normalizedNodeIds.has(entry.nodeId)
                && (entry.status === 'pending' || entry.status === 'claimed'))
              .map((entry) => entry.nodeId),
          ),
        ).sort((left, right) => left.localeCompare(right, 'en-US'))
      : [];
    const removableNodeIds = keepActive
      ? new Set(Array.from(normalizedNodeIds).filter((nodeId) => !blockedNodeIds.includes(nodeId)))
      : normalizedNodeIds;

    const removedInvocationIds: string[] = [];
    for (const [invocationId, entry] of Object.entries(state.entries)) {
      if (!removableNodeIds.has(entry.nodeId)) {
        continue;
      }
      removedInvocationIds.push(invocationId);
      delete state.entries[invocationId];
    }

    if (removedInvocationIds.length > 0) {
      state.updatedAt = this.now().toISOString();
      this.writeState(state);
    }

    return {
      removedInvocationIds,
      removedEntries: removedInvocationIds.length,
      blockedNodeIds,
    };
  }

  private readStateWithLifecycle(): NodeInvocationStoreState {
    const state = this.readJsonFile<NodeInvocationStoreState>(this.stateFile, {
      version: 1,
      updatedAt: this.now().toISOString(),
      entries: {},
    });
    const nowIso = this.now().toISOString();
    let changed = false;

    for (const [invocationId, entry] of Object.entries(state.entries)) {
      const expiredEntry = this.expirePendingInvocation(entry, nowIso);
      if (!expiredEntry) {
        continue;
      }
      state.entries[invocationId] = expiredEntry;
      changed = true;
    }

    if (changed) {
      state.updatedAt = nowIso;
      this.writeState(state);
    }

    return state;
  }

  private expirePendingInvocation(
    entry: NodeInvocationRecord,
    nowIso: string,
  ): NodeInvocationRecord | null {
    if (!this.isStalePending(entry, this.now().getTime())) {
      return null;
    }

    return this.withLifecycle({
      ...entry,
      status: 'cancelled',
      completedAt: nowIso,
      ok: false,
      resultSummary: entry.resultSummary || 'Invocaction cancelada automaticamente apos expirar na fila do Node Mesh.',
      staleAt: entry.staleAt || nowIso,
      staleReason: entry.staleReason || 'pending-expired',
    }, {
      status: 'failed',
      summary: 'Node invocation expired before being claimed.',
      requestedBy: entry.requestedBy,
      surface: 'node-mesh',
      at: nowIso,
    });
  }

  private withLifecycle(
    record: NodeInvocationRecord,
    input: {
      status: 'planned' | 'running' | 'completed' | 'failed';
      summary: string;
      requestedBy?: string | null;
      surface?: string | null;
      sessionId?: string | null;
      traceId?: string | null;
      runId?: string | null;
      approvalId?: string | null;
      artifactId?: string | null;
      at?: string | null;
    },
  ): NodeInvocationRecord {
    const link = this.canonicalExecution.buildLink({
      engine: 'node-invoke',
      kind: 'execution',
      id: record.id,
      status: input.status,
      summary: input.summary,
      requestedBy: input.requestedBy || record.requestedBy || null,
      surface: input.surface || 'node-mesh',
      traceId: input.traceId || record.traceId || null,
      runId: input.runId || record.runId || record.id,
      sessionId: input.sessionId || record.sessionId || null,
      approvalId: input.approvalId || record.approvalId || null,
      artifactId: input.artifactId || record.artifactId || null,
      at: input.at || null,
      metadata: {
        nodeId: record.nodeId,
        capabilityId: record.capabilityId,
        action: record.action,
        transport: record.transport,
      },
    });
    return {
      ...record,
      traceId: link.traceId,
      runId: link.runId,
      sessionId: link.sessionId,
      approvalId: link.approvalId,
      artifactId: link.artifactId,
      execution_lifecycle: this.canonicalExecution.mergeLifecycle(record.execution_lifecycle, link.lifecycle),
    };
  }

  private normalizeNodeId(input: string | null | undefined): string {
    return String(input || '').trim().toLowerCase();
  }

  private isStalePending(entry: NodeInvocationRecord, nowMs: number): boolean {
    if (entry.status !== 'pending') {
      return false;
    }

    const queuedAtMs = Date.parse(entry.queuedAt);
    return Number.isFinite(queuedAtMs) && (nowMs - queuedAtMs >= this.pendingStaleMs);
  }

  private isStaleClaimed(entry: NodeInvocationRecord, nowMs: number): boolean {
    if (entry.status !== 'claimed' || !entry.claimedAt) {
      return false;
    }

    const claimedAtMs = Date.parse(entry.claimedAt);
    return Number.isFinite(claimedAtMs) && (nowMs - claimedAtMs >= this.claimedStaleMs);
  }

  private readJsonFile<T>(filePath: string, fallback: T): T {
    try {
      if (!fs.existsSync(filePath)) {
        return fallback;
      }
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
    } catch (error: unknown) {logger.warn('[Node Invocation Store] JSON parse failed', error); return fallback; }
  }

  private writeState(payload: NodeInvocationStoreState): void {
    fs.mkdirSync(path.dirname(this.stateFile), { recursive: true });
    fs.writeFileSync(this.stateFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }
}
