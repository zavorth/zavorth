import { SecureStorageService } from './SecureStorageService.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type {
  NodeMeshAllowlistAudit,
  NodeMeshCapabilityId,
  NodeMeshDeviceProfileId,
  NodeMeshHostHints,
  NodeMeshNodeKind,
  NodeMeshPairingStatus,
  NodeMeshRegistryEntry,
  NodeMeshSecretsState,
  NodeMeshState,
  NodeMeshStatus,
  NodeMeshTransport,
} from '../contracts/NodeMeshContract.js';

import { NodeCapabilityService } from './NodeCapabilityService.js';
import { logger } from '../logger.js';

type NodeRegistryRuntime = {
  now?: () => Date;
  stateFile?: string;
  secretsFile?: string;
  heartbeatStaleMs?: number;
  pairingDraftStaleMs?: number;
  secureStorageService?: SecureStorageService;
  capabilityService?: NodeCapabilityService;
};

export class NodeRegistryService {
  private readonly now: () => Date;
  private readonly stateFile: string;
  private readonly secretsFile: string;
  private readonly heartbeatStaleMs: number;
  private readonly pairingDraftStaleMs: number;
  private readonly secureStorageService: SecureStorageService;
  private readonly capabilityService: NodeCapabilityService;

  constructor(runtime: NodeRegistryRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.stateFile = runtime.stateFile || config.nodeMeshStateFile;
    this.secretsFile = runtime.secretsFile || config.nodeMeshSecretsFile;
    this.heartbeatStaleMs = Math.max(
      5000,
      Number(runtime.heartbeatStaleMs || config.nodeMeshHeartbeatStaleMs || 45000),
    );
    this.pairingDraftStaleMs = Math.max(
      this.heartbeatStaleMs,
      Number(runtime.pairingDraftStaleMs || config.nodeMeshPairingDraftStaleMs || 43200000),
    );
    this.secureStorageService = runtime.secureStorageService || new SecureStorageService();
    this.capabilityService = runtime.capabilityService || new NodeCapabilityService();
  }

  public readState(): NodeMeshState {
    return this.readStateWithLifecycle();
  }

  public listNodes(): NodeMeshRegistryEntry[] {
    return Object.values(this.readState().entries)
      .map((entry) => this.applyLifecycleFreshness(this.applyHeartbeatFreshness(entry)))
      .sort((left, right) => left.label.localeCompare(right.label, 'en-US'));
  }

  public getNode(nodeId: string | null | undefined): NodeMeshRegistryEntry | null {
    const normalizedId = this.normalizeId(nodeId);
    if (!normalizedId) {
      return null;
    }

    const entry = this.readState().entries[normalizedId] || null;
    return entry ? this.applyLifecycleFreshness(this.applyHeartbeatFreshness(entry)) : null;
  }

  public upsertNode(entry: NodeMeshRegistryEntry): NodeMeshRegistryEntry {
    const state = this.readState();
    const current = state.entries[this.normalizeId(entry.id)];
    const nextEntry = this.normalizeEntry(entry, current || null);
    state.entries[nextEntry.id] = nextEntry;
    state.updatedAt = this.now().toISOString();
    this.writeJsonFile(this.stateFile, state);
    return nextEntry;
  }

  public patchNode(
    nodeId: string | null | undefined,
    patch: Partial<NodeMeshRegistryEntry>,
  ): NodeMeshRegistryEntry | null {
    const current = this.getNode(nodeId);
    if (!current) {
      return null;
    }

    return this.upsertNode({
      ...current,
      ...patch,
      id: current.id,
      createdAt: current.createdAt,
    });
  }

  public recordHeartbeat(
    nodeId: string | null | undefined,
    input: {
      status?: NodeMeshStatus;
      capabilityIds?: Array<string | null | undefined> | null;
      hostHints?: Partial<NodeMeshHostHints> | null;
    } = {},
  ): NodeMeshRegistryEntry | null {
    const current = this.getNode(nodeId);
    if (!current) {
      return null;
    }

    return this.patchNode(current.id, {
      status: input.status || 'online',
      lastSeenAt: this.now().toISOString(),
      capabilityIds: input.capabilityIds
        ? this.capabilityService.normalizeCapabilityIds(input.capabilityIds)
        : current.capabilityIds,
      approvedCapabilityIds: current.approvedCapabilityIds || null,
      hostHints: {
        ...current.hostHints,
        ...(input.hostHints || {}),
      },
      operatorSummary:
        input.status === 'online'
          ? 'Node responded to the latest heartbeat and appears ready for remote transport.'
          : current.operatorSummary,
    });
  }

  public markNodeOffline(nodeId: string | null | undefined, summary?: string | null): NodeMeshRegistryEntry | null {
    const current = this.getNode(nodeId);
    if (!current) {
      return null;
    }

    if (current.pairingStatus !== 'paired') {
      return current;
    }

    return this.patchNode(current.id, {
      status: 'offline',
      operatorSummary: String(summary || 'No recent heartbeat. Node waiting to reconnect.').trim(),
    });
  }

  public setApprovedCapabilities(
    nodeId: string | null | undefined,
    capabilityIds: Array<NodeMeshCapabilityId | null | undefined> | null | undefined,
    input: {
      approvedBy?: string | null;
      reason?: string | null;
      mode?: string | null;
    } = {},
  ): NodeMeshRegistryEntry | null {
    const current = this.getNode(nodeId);
    if (!current) {
      return null;
    }

    const normalized = this.normalizeApprovedCapabilityIds(current.capabilityIds, capabilityIds);
    const nowIso = this.now().toISOString();
    return this.patchNode(current.id, {
      approvedCapabilityIds: normalized,
      allowlistAudit: {
        approvedAt: nowIso,
        approvedBy: String(input.approvedBy || current.requestedBy || '').trim() || null,
        reason:
          String(input.reason || '').trim() ||
          (normalized.length > 0 ? 'Allowlist updated no shell oficial.' : 'Allowlist limpa no shell oficial.'),
        mode: String(input.mode || '').trim() || (normalized.length > 0 ? 'custom' : 'clear'),
      },
      operatorSummary:
        normalized.length > 0
          ? `Node com allowlist ativa (${normalized.length} approved capability(s)(s)).`
          : 'Node without active allowlist; all declared capabilities remain available according to local policy.',
    });
  }

  public storeSecret(
    nodeId: string | null | undefined,
    secretId: string | null | undefined,
    secretValue: string | null | undefined,
  ): void {
    const normalizedNodeId = this.normalizeId(nodeId);
    const normalizedSecretId = String(secretId || '').trim();
    if (!normalizedNodeId || !normalizedSecretId || secretValue === null || secretValue === undefined) {
      return;
    }

    const state = this.readSecretsState();
    const bucket = state.entries[normalizedNodeId] || {};
    const encrypted = this.secureStorageService.encryptString(String(secretValue).trim());
    if (!encrypted) {
      return;
    }
    bucket[normalizedSecretId] = encrypted;
    state.entries[normalizedNodeId] = bucket;
    state.updatedAt = this.now().toISOString();
    this.writeJsonFile(this.secretsFile, state);
  }

  public getSecretValue(nodeId: string | null | undefined, secretId: string | null | undefined): string | null {
    const normalizedNodeId = this.normalizeId(nodeId);
    const normalizedSecretId = String(secretId || '').trim();
    if (!normalizedNodeId || !normalizedSecretId) {
      return null;
    }

    const state = this.readSecretsState();
    return this.secureStorageService.decryptString(state.entries[normalizedNodeId]?.[normalizedSecretId] || null);
  }

  public getStoredSecretKeys(nodeId: string | null | undefined): string[] {
    const normalizedNodeId = this.normalizeId(nodeId);
    if (!normalizedNodeId) {
      return [];
    }

    const state = this.readSecretsState();
    return Object.keys(state.entries[normalizedNodeId] || {}).sort((left, right) => left.localeCompare(right, 'en-US'));
  }

  public deleteSecret(nodeId: string | null | undefined, secretId: string | null | undefined): void {
    const normalizedNodeId = this.normalizeId(nodeId);
    const normalizedSecretId = String(secretId || '').trim();
    if (!normalizedNodeId || !normalizedSecretId) {
      return;
    }

    const state = this.readSecretsState();
    const bucket = state.entries[normalizedNodeId];
    if (!bucket || !bucket[normalizedSecretId]) {
      return;
    }

    delete bucket[normalizedSecretId];
    if (Object.keys(bucket).length === 0) {
      delete state.entries[normalizedNodeId];
    } else {
      state.entries[normalizedNodeId] = bucket;
    }
    state.updatedAt = this.now().toISOString();
    this.writeJsonFile(this.secretsFile, state);
  }

  public removeNodes(nodeIds: Array<string | null | undefined>): {
    removedNodeIds: string[];
    removedEntries: number;
    removedSecretBuckets: number;
    removedSecretKeys: number;
  } {
    const normalizedNodeIds = Array.from(
      new Set((nodeIds || []).map((nodeId) => this.normalizeId(nodeId)).filter(Boolean)),
    );
    if (normalizedNodeIds.length === 0) {
      return {
        removedNodeIds: [],
        removedEntries: 0,
        removedSecretBuckets: 0,
        removedSecretKeys: 0,
      };
    }

    const state = this.readStateWithLifecycle();
    const secrets = this.readSecretsState();
    const nowIso = this.now().toISOString();
    const removedNodeIds: string[] = [];
    let removedSecretBuckets = 0;
    let removedSecretKeys = 0;

    for (const nodeId of normalizedNodeIds) {
      if (!state.entries[nodeId]) {
        continue;
      }

      delete state.entries[nodeId];
      removedNodeIds.push(nodeId);

      const bucket = secrets.entries[nodeId];
      if (bucket) {
        removedSecretBuckets += 1;
        removedSecretKeys += Object.keys(bucket).length;
        delete secrets.entries[nodeId];
      }
    }

    if (removedNodeIds.length === 0) {
      return {
        removedNodeIds: [],
        removedEntries: 0,
        removedSecretBuckets: 0,
        removedSecretKeys: 0,
      };
    }

    state.updatedAt = nowIso;
    secrets.updatedAt = nowIso;
    this.writeJsonFile(this.stateFile, state);
    this.writeJsonFile(this.secretsFile, secrets);

    return {
      removedNodeIds,
      removedEntries: removedNodeIds.length,
      removedSecretBuckets,
      removedSecretKeys,
    };
  }

  private readSecretsState(): NodeMeshSecretsState {
    return this.readJsonFile<NodeMeshSecretsState>(this.secretsFile, {
      version: 1,
      updatedAt: this.now().toISOString(),
      entries: {},
    });
  }

  private readStateWithLifecycle(): NodeMeshState {
    const state = this.readJsonFile<NodeMeshState>(this.stateFile, {
      version: 1,
      updatedAt: this.now().toISOString(),
      entries: {},
    });
    const secrets = this.readSecretsState();
    const nowIso = this.now().toISOString();
    let stateChanged = false;
    let secretsChanged = false;

    for (const [nodeId, entry] of Object.entries(state.entries)) {
      const nextEntry = this.expirePendingDraft(entry, nowIso);
      if (!nextEntry) {
        continue;
      }

      state.entries[nodeId] = nextEntry;
      stateChanged = true;
      const bucket = secrets.entries[nodeId];
      if (bucket?.pairingCode || bucket?.sharedSecret) {
        delete bucket.pairingCode;
        delete bucket.sharedSecret;
        if (Object.keys(bucket).length === 0) {
          delete secrets.entries[nodeId];
        } else {
          secrets.entries[nodeId] = bucket;
        }
        secretsChanged = true;
      }
    }

    if (stateChanged) {
      state.updatedAt = nowIso;
      this.writeJsonFile(this.stateFile, state);
    }
    if (secretsChanged) {
      secrets.updatedAt = nowIso;
      this.writeJsonFile(this.secretsFile, secrets);
    }

    return state;
  }

  private normalizeEntry(entry: NodeMeshRegistryEntry, current: NodeMeshRegistryEntry | null): NodeMeshRegistryEntry {
    const normalizedId = this.normalizeId(entry.id) || `node-${crypto.randomUUID().slice(0, 8)}`;
    const pairingStatus = this.resolvePairingStatus(entry.pairingStatus || current?.pairingStatus || 'pending');
    const defaultStatus = pairingStatus === 'pending' ? 'pairing' : pairingStatus === 'revoked' ? 'blocked' : 'offline';
    const status = this.resolveStatus(entry.status || current?.status || defaultStatus);
    const shouldResetCreatedAt =
      pairingStatus === 'pending' &&
      Boolean(current) &&
      Boolean(String(entry.createdAt || '').trim()) &&
      String(entry.createdAt || '').trim() !== String(current?.createdAt || '').trim();
    const createdAt = shouldResetCreatedAt
      ? String(entry.createdAt || this.now().toISOString()).trim()
      : current?.createdAt || entry.createdAt || this.now().toISOString();
    const updatedAt = this.now().toISOString();

    return {
      id: normalizedId,
      label: String(entry.label || current?.label || normalizedId).trim() || normalizedId,
      profileId: this.normalizeProfileId(entry.profileId || current?.profileId || null),
      kind: this.resolveKind(entry.kind || current?.kind || 'headless'),
      transport: this.resolveTransport(entry.transport || current?.transport || 'bridge'),
      status: pairingStatus === 'pending' ? 'pairing' : pairingStatus === 'revoked' ? 'blocked' : status,
      pairingStatus,
      paired: pairingStatus === 'paired',
      createdAt,
      updatedAt,
      pairedAt:
        pairingStatus === 'paired'
          ? String(entry.pairedAt || current?.pairedAt || updatedAt).trim()
          : pairingStatus === 'revoked'
            ? null
            : current?.pairedAt || null,
      lastSeenAt: String(entry.lastSeenAt || current?.lastSeenAt || '').trim() || null,
      requestedBy: String(entry.requestedBy || current?.requestedBy || '').trim() || null,
      capabilityIds: this.capabilityService.normalizeCapabilityIds(entry.capabilityIds || current?.capabilityIds || []),
      approvedCapabilityIds: this.normalizeApprovedCapabilityIds(
        this.capabilityService.normalizeCapabilityIds(entry.capabilityIds || current?.capabilityIds || []),
        entry.approvedCapabilityIds !== undefined ? entry.approvedCapabilityIds : current?.approvedCapabilityIds,
      ),
      allowlistAudit: this.normalizeAllowlistAudit(
        entry.allowlistAudit !== undefined ? entry.allowlistAudit : current?.allowlistAudit,
      ),
      hostHints: this.normalizeHostHints(entry.hostHints || current?.hostHints || {}),
      notes: Array.from(
        new Set((entry.notes || current?.notes || []).map((item) => String(item || '').trim()).filter(Boolean)),
      ).slice(0, 12),
      operatorSummary: String(entry.operatorSummary || current?.operatorSummary || '').trim() || null,
    };
  }

  private normalizeApprovedCapabilityIds(
    declaredCapabilityIds: Array<NodeMeshCapabilityId | null | undefined> | null | undefined,
    approvedCapabilityIds: Array<NodeMeshCapabilityId | null | undefined> | null | undefined,
  ): NodeMeshCapabilityId[] {
    const declared = new Set(this.capabilityService.normalizeCapabilityIds(declaredCapabilityIds || []));
    return this.capabilityService
      .normalizeCapabilityIds(approvedCapabilityIds || [])
      .filter((capabilityId) => declared.has(capabilityId));
  }

  private normalizeAllowlistAudit(
    input: Partial<NodeMeshAllowlistAudit> | null | undefined,
  ): NodeMeshAllowlistAudit | null {
    if (!input || typeof input !== 'object') {
      return null;
    }

    const approvedAt = String(input.approvedAt || '').trim() || null;
    const approvedBy = String(input.approvedBy || '').trim() || null;
    const reason = String(input.reason || '').trim() || null;
    const mode = String(input.mode || '').trim() || null;
    if (!approvedAt && !approvedBy && !reason && !mode) {
      return null;
    }

    return {
      approvedAt,
      approvedBy,
      reason,
      mode,
    };
  }

  private applyHeartbeatFreshness(entry: NodeMeshRegistryEntry): NodeMeshRegistryEntry {
    if (entry.pairingStatus !== 'paired' || entry.status !== 'online' || !entry.lastSeenAt) {
      return entry;
    }

    const lastSeenAt = Date.parse(entry.lastSeenAt);
    if (!Number.isFinite(lastSeenAt)) {
      return entry;
    }

    const ageMs = this.now().getTime() - lastSeenAt;
    if (ageMs <= this.heartbeatStaleMs) {
      return entry;
    }

    return {
      ...entry,
      status: 'offline',
      operatorSummary: 'No recent heartbeat. Node needs to reattach remote transport.',
    };
  }

  private applyLifecycleFreshness(entry: NodeMeshRegistryEntry): NodeMeshRegistryEntry {
    if (entry.pairingStatus !== 'pending') {
      if (entry.pairingStatus === 'revoked' && entry.lifecycle?.pairingDraftStale) {
        return entry;
      }
      return entry.lifecycle ? { ...entry, lifecycle: null } : entry;
    }

    const createdAtMs = Date.parse(entry.createdAt);
    if (!Number.isFinite(createdAtMs)) {
      return entry;
    }

    const pairingDraftAgeMs = Math.max(0, this.now().getTime() - createdAtMs);
    if (pairingDraftAgeMs < this.pairingDraftStaleMs) {
      return entry.lifecycle ? { ...entry, lifecycle: null } : entry;
    }

    return {
      ...entry,
      lifecycle: {
        pairingDraftAgeMs,
        pairingDraftStale: true,
      },
    };
  }

  private expirePendingDraft(entry: NodeMeshRegistryEntry, nowIso: string): NodeMeshRegistryEntry | null {
    if (entry.pairingStatus !== 'pending') {
      return null;
    }

    const createdAtMs = Date.parse(entry.createdAt);
    if (!Number.isFinite(createdAtMs)) {
      return null;
    }

    const pairingDraftAgeMs = Math.max(0, this.now().getTime() - createdAtMs);
    if (pairingDraftAgeMs < this.pairingDraftStaleMs) {
      return null;
    }

    return {
      ...entry,
      status: 'blocked',
      pairingStatus: 'revoked',
      paired: false,
      pairedAt: null,
      updatedAt: nowIso,
      lifecycle: {
        pairingDraftAgeMs,
        pairingDraftStale: true,
      },
      notes: Array.from(new Set([...entry.notes, 'Pairing draft expired automatically.'].filter(Boolean))).slice(0, 12),
      operatorSummary: 'Pairing draft expired automatically. Generate a new code before pairing this node.',
    };
  }

  private normalizeHostHints(input: Partial<NodeMeshHostHints>): NodeMeshHostHints {
    const batteryLevel = Number(input.batteryLevel);
    return {
      hostname: String(input.hostname || '').trim() || null,
      platform: String(input.platform || '').trim() || null,
      workspace: String(input.workspace || '').trim() || null,
      surface: String(input.surface || '').trim() || null,
      arch: String(input.arch || '').trim() || null,
      osRelease: String(input.osRelease || '').trim() || null,
      nodeVersion: String(input.nodeVersion || '').trim() || null,
      deviceModel: String(input.deviceModel || '').trim() || null,
      appVersion: String(input.appVersion || '').trim() || null,
      networkType: String(input.networkType || '').trim() || null,
      batteryLevel: Number.isFinite(batteryLevel) ? batteryLevel : null,
      batteryState: String(input.batteryState || '').trim() || null,
      locationLabel: String(input.locationLabel || '').trim() || null,
      latencyMs: Number.isFinite(Number(input.latencyMs)) ? Math.max(0, Number(input.latencyMs)) : null,
      costScore: Number.isFinite(Number(input.costScore)) ? Math.max(0, Number(input.costScore)) : null,
    };
  }

  private resolveKind(input: string): NodeMeshNodeKind {
    return ['headless', 'desktop', 'mobile', 'browser'].includes(String(input || '').trim())
      ? (String(input || '').trim() as NodeMeshNodeKind)
      : 'headless';
  }

  private resolveTransport(input: string): NodeMeshTransport {
    return ['local', 'bridge', 'sidecar', 'remote'].includes(String(input || '').trim())
      ? (String(input || '').trim() as NodeMeshTransport)
      : 'bridge';
  }

  private resolveStatus(input: string): NodeMeshStatus {
    return ['online', 'idle', 'offline', 'blocked', 'pairing'].includes(String(input || '').trim())
      ? (String(input || '').trim() as NodeMeshStatus)
      : 'offline';
  }

  private resolvePairingStatus(input: string): NodeMeshPairingStatus {
    return ['pending', 'paired', 'revoked'].includes(String(input || '').trim())
      ? (String(input || '').trim() as NodeMeshPairingStatus)
      : 'pending';
  }

  private normalizeId(input: string | null | undefined): string {
    return String(input || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-');
  }

  private normalizeProfileId(input: NodeMeshDeviceProfileId | null | undefined): NodeMeshDeviceProfileId | null {
    return (
      String(input || '')
        .trim()
        .toLowerCase() || null
    );
  }

  private readJsonFile<T>(filePath: string, fallback: T): T {
    try {
      if (!fs.existsSync(filePath)) {
        return fallback;
      }

      return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
    } catch (error: unknown) {
      logger.warn('[Node Registry] JSON parse failed', error);
      return fallback;
    }
  }

  private writeJsonFile(filePath: string, payload: unknown): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }
}
