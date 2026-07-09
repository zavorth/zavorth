import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { config } from '../config/index.js';
import { logger } from '../logger.js';

export type ZavorthBridgeAccessLeaseMode = 'public' | 'lan';
export type ZavorthBridgeAccessLeaseStatus = 'active' | 'revoked' | 'expired' | 'missing';

export type ZavorthBridgeAccessLeaseRecord = {
  leaseId: string;
  status: Exclude<ZavorthBridgeAccessLeaseStatus, 'missing'>;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  requestedBy: string | null;
  mode: ZavorthBridgeAccessLeaseMode;
  accessUrl: string;
  localUrl: string | null;
  publicUrl: string | null;
  baseUrl: string | null;
  requiresPassword: boolean;
  startedSidecar: boolean;
  activatedRemoteMode: boolean;
  startedPublicTunnel: boolean;
  note: string | null;
};

export type ZavorthBridgeAccessLeaseSnapshot = {
  status: ZavorthBridgeAccessLeaseStatus;
  active: boolean;
  leaseId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  expiresAt: string | null;
  remainingMs: number | null;
  requestedBy: string | null;
  mode: ZavorthBridgeAccessLeaseMode | 'none';
  accessUrl: string | null;
  localUrl: string | null;
  publicUrl: string | null;
  baseUrl: string | null;
  requiresPassword: boolean;
  startedSidecar: boolean;
  activatedRemoteMode: boolean;
  startedPublicTunnel: boolean;
  note: string | null;
};

type LeaseHistoryEvent = {
  event: 'issued' | 'revoked' | 'expired';
  at: string;
  reason: string | null;
  requestedBy: string | null;
  lease: ZavorthBridgeAccessLeaseRecord;
};

type ZavorthBridgeAccessLeaseRuntime = {
  now?: () => Date;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  appendFileSync?: typeof fs.appendFileSync;
  mkdirSync?: typeof fs.mkdirSync;
  leaseFile?: string;
  historyFile?: string;
  ttlMs?: number;
};

export class ZavorthBridgeAccessLeaseService {
  private readonly now: () => Date;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly appendFileSync: typeof fs.appendFileSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly leaseFile: string;
  private readonly historyFile: string;
  private readonly ttlMs: number;

  constructor(runtime: ZavorthBridgeAccessLeaseRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.appendFileSync = runtime.appendFileSync || fs.appendFileSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.leaseFile = runtime.leaseFile || config.zavorthBridgeMobileLeaseFile;
    this.historyFile = runtime.historyFile || config.zavorthBridgeMobileLeaseHistoryFile;
    this.ttlMs = Number(runtime.ttlMs || config.zavorthBridgeMobileLeaseTtlMs) || 2 * 60 * 60 * 1000;
  }

  public readSnapshot(): ZavorthBridgeAccessLeaseSnapshot {
    const lease = this.readRecord();
    if (!lease) {
      return this.buildMissingSnapshot();
    }

    if (lease.status === 'active' && this.isExpired(lease.expiresAt)) {
      const expired = this.persistLease({
        ...lease,
        status: 'expired',
        updatedAt: this.now().toISOString(),
      });
      this.appendHistory('expired', expired, 'lease-expired', expired.requestedBy);
      return this.toSnapshot(expired);
    }

    return this.toSnapshot(lease);
  }

  public issue(input: {
    requestedBy?: string | null;
    mode: ZavorthBridgeAccessLeaseMode;
    accessUrl: string;
    localUrl?: string | null;
    publicUrl?: string | null;
    baseUrl?: string | null;
    requiresPassword: boolean;
    startedSidecar?: boolean;
    activatedRemoteMode?: boolean;
    startedPublicTunnel?: boolean;
    note?: string | null;
    ttlMs?: number | null;
  }): ZavorthBridgeAccessLeaseSnapshot {
    const requestedBy = String(input.requestedBy || '').trim() || null;
    const now = this.now().toISOString();
    const expiresAt = new Date(this.now().getTime() + (Number(input.ttlMs || this.ttlMs) || this.ttlMs)).toISOString();
    const lease = this.persistLease({
      leaseId: randomUUID(),
      status: 'active',
      createdAt: now,
      updatedAt: now,
      expiresAt,
      requestedBy,
      mode: input.mode,
      accessUrl: String(input.accessUrl || '').trim(),
      localUrl: String(input.localUrl || '').trim() || null,
      publicUrl: String(input.publicUrl || '').trim() || null,
      baseUrl: String(input.baseUrl || '').trim() || null,
      requiresPassword: input.requiresPassword === true,
      startedSidecar: input.startedSidecar === true,
      activatedRemoteMode: input.activatedRemoteMode === true,
      startedPublicTunnel: input.startedPublicTunnel === true,
      note: String(input.note || '').trim() || null,
    });
    this.appendHistory('issued', lease, null, requestedBy);
    return this.toSnapshot(lease);
  }

  public revoke(input: {
    requestedBy?: string | null;
    reason?: string | null;
  } = {}): ZavorthBridgeAccessLeaseSnapshot {
    const lease = this.readRecord();
    if (!lease) {
      return this.buildMissingSnapshot();
    }

    const revoked = this.persistLease({
      ...lease,
      status: lease.status === 'expired' ? 'expired' : 'revoked',
      updatedAt: this.now().toISOString(),
      note: String(input.reason || '').trim() || lease.note,
    });
    this.appendHistory(
      revoked.status === 'expired' ? 'expired' : 'revoked',
      revoked,
      String(input.reason || '').trim() || null,
      String(input.requestedBy || '').trim() || lease.requestedBy,
    );
    return this.toSnapshot(revoked);
  }

  private readRecord(): ZavorthBridgeAccessLeaseRecord | null {
    try {
      if (!this.leaseFile || !this.existsSync(this.leaseFile)) {
        return null;
      }
      const parsed = JSON.parse(this.readFileSync(this.leaseFile, 'utf8')) as Partial<ZavorthBridgeAccessLeaseRecord>;
      if (!parsed || typeof parsed !== 'object' || !parsed.leaseId) {
        return null;
      }
      const status = String(parsed.status || '').trim().toLowerCase();
      if (status !== 'active' && status !== 'revoked' && status !== 'expired') {
        return null;
      }
      const mode = String(parsed.mode || '').trim().toLowerCase();
      if (mode !== 'public' && mode !== 'lan') {
        return null;
      }
      return {
        leaseId: String(parsed.leaseId),
        status,
        createdAt: String(parsed.createdAt || ''),
        updatedAt: String(parsed.updatedAt || parsed.createdAt || ''),
        expiresAt: String(parsed.expiresAt || ''),
        requestedBy: String(parsed.requestedBy || '').trim() || null,
        mode,
        accessUrl: String(parsed.accessUrl || '').trim(),
        localUrl: String(parsed.localUrl || '').trim() || null,
        publicUrl: String(parsed.publicUrl || '').trim() || null,
        baseUrl: String(parsed.baseUrl || '').trim() || null,
        requiresPassword: parsed.requiresPassword === true,
        startedSidecar: parsed.startedSidecar === true,
        activatedRemoteMode: parsed.activatedRemoteMode === true,
        startedPublicTunnel: parsed.startedPublicTunnel === true,
        note: String(parsed.note || '').trim() || null,
      };
    } catch (error: unknown) {logger.warn('[Zavorth Bridge Access Lease] parsing failed', error); return null; }
  }

  private persistLease(record: ZavorthBridgeAccessLeaseRecord): ZavorthBridgeAccessLeaseRecord {
    this.mkdirSync(path.dirname(this.leaseFile), { recursive: true });
    this.writeFileSync(this.leaseFile, JSON.stringify(record, null, 2), 'utf8');
    return record;
  }

  private appendHistory(
    event: LeaseHistoryEvent['event'],
    lease: ZavorthBridgeAccessLeaseRecord,
    reason: string | null,
    requestedBy: string | null,
  ): void {
    this.mkdirSync(path.dirname(this.historyFile), { recursive: true });
    const payload: LeaseHistoryEvent = {
      event,
      at: this.now().toISOString(),
      reason,
      requestedBy,
      lease,
    };
    this.appendFileSync(this.historyFile, `${JSON.stringify(payload)}\n`, 'utf8');
  }

  private isExpired(expiresAt: string): boolean {
    const value = new Date(expiresAt).getTime();
    return Number.isFinite(value) && value <= this.now().getTime();
  }

  private toSnapshot(lease: ZavorthBridgeAccessLeaseRecord): ZavorthBridgeAccessLeaseSnapshot {
    const expiresAtMs = new Date(lease.expiresAt).getTime();
    const remainingMs =
      Number.isFinite(expiresAtMs)
        ? Math.max(0, expiresAtMs - this.now().getTime())
        : null;
    return {
      status: lease.status,
      active: lease.status === 'active',
      leaseId: lease.leaseId,
      createdAt: lease.createdAt,
      updatedAt: lease.updatedAt,
      expiresAt: lease.expiresAt,
      remainingMs,
      requestedBy: lease.requestedBy,
      mode: lease.mode,
      accessUrl: lease.accessUrl,
      localUrl: lease.localUrl,
      publicUrl: lease.publicUrl,
      baseUrl: lease.baseUrl,
      requiresPassword: lease.requiresPassword,
      startedSidecar: lease.startedSidecar,
      activatedRemoteMode: lease.activatedRemoteMode,
      startedPublicTunnel: lease.startedPublicTunnel,
      note: lease.note,
    };
  }

  private buildMissingSnapshot(): ZavorthBridgeAccessLeaseSnapshot {
    return {
      status: 'missing',
      active: false,
      leaseId: null,
      createdAt: null,
      updatedAt: null,
      expiresAt: null,
      remainingMs: null,
      requestedBy: null,
      mode: 'none',
      accessUrl: null,
      localUrl: null,
      publicUrl: null,
      baseUrl: null,
      requiresPassword: false,
      startedSidecar: false,
      activatedRemoteMode: false,
      startedPublicTunnel: false,
      note: null,
    };
  }
}
