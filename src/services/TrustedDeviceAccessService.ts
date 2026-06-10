import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';

export const TRUSTED_DEVICE_ACCESS_SCOPES = [
  'chat:send',
  'chat:read',
  'approval:respond',
  'memory:read',
  'files:preview',
  'runtime:control',
] as const;

export type TrustedDeviceAccessScope = typeof TRUSTED_DEVICE_ACCESS_SCOPES[number];

export type TrustedDeviceIdentity = {
  authenticated: true;
  source: 'trusted-device';
  userId: string;
  profileId: string | null;
  deviceId: string;
  scopes: TrustedDeviceAccessScope[];
};

type TrustedDeviceRecord = {
  deviceId: string;
  name: string;
  tokenHash: string;
  scopes: TrustedDeviceAccessScope[];
  userId: string;
  profileId: string | null;
  createdAt: string;
  expiresAt: string | null;
  status: 'active' | 'revoked';
  revokedAt: string | null;
  revokedBy: string | null;
  revokeReason: string | null;
};

type TrustedDevicePairingRequest = {
  requestId: string;
  deviceName: string;
  pairingCodeHash: string;
  scopes: TrustedDeviceAccessScope[];
  requestedBy: string;
  createdAt: string;
  expiresAt: string;
  deviceTtlMs: number | null;
  status: 'pending' | 'approved' | 'expired' | 'rejected';
  approvedAt: string | null;
  approvedBy: string | null;
  deviceId: string | null;
};

type TrustedDeviceReceipt = {
  receiptId: string;
  action: 'trusted-device.pairing-created' | 'trusted-device.approved' | 'trusted-device.revoked';
  deviceId: string | null;
  requestId: string | null;
  actor: string;
  createdAt: string;
  scopes: TrustedDeviceAccessScope[];
  secretRedacted: true;
  reason?: string | null;
};

type TrustedDeviceAccessState = {
  version: 1;
  pairingRequests: Record<string, TrustedDevicePairingRequest>;
  devices: Record<string, TrustedDeviceRecord>;
  receipts: TrustedDeviceReceipt[];
};

export type TrustedDevicePublicDevice = {
  deviceId: string;
  name: string;
  scopes: TrustedDeviceAccessScope[];
  userId: string;
  profileId: string | null;
  createdAt: string;
  expiresAt: string | null;
  status: 'active' | 'revoked' | 'expired';
  revokedAt: string | null;
  revokedBy: string | null;
  revokeReason: string | null;
};

export type TrustedDeviceAccessOptions = {
  stateFilePath?: string;
  now?: () => Date;
  randomBytes?: (size: number) => Buffer;
  idFactory?: (prefix: string) => string;
  defaultPairingTtlMs?: number;
  defaultDeviceTtlMs?: number | null;
};

export class TrustedDeviceAccessService {
  public readonly stateFilePath: string;

  private readonly now: () => Date;
  private readonly randomBytes: (size: number) => Buffer;
  private readonly idFactory: (prefix: string) => string;
  private readonly defaultPairingTtlMs: number;
  private readonly defaultDeviceTtlMs: number | null;

  public constructor(options: TrustedDeviceAccessOptions = {}) {
    this.stateFilePath = options.stateFilePath || config.trustedDeviceAccessStateFile;
    this.now = options.now || (() => new Date());
    this.randomBytes = options.randomBytes || crypto.randomBytes;
    this.idFactory = options.idFactory || ((prefix) => `${prefix}-${crypto.randomUUID()}`);
    this.defaultPairingTtlMs = options.defaultPairingTtlMs ?? 5 * 60 * 1000;
    this.defaultDeviceTtlMs = options.defaultDeviceTtlMs === undefined
      ? 90 * 24 * 60 * 60 * 1000
      : options.defaultDeviceTtlMs;
  }

  public createPairingRequest(input: {
    deviceName: string;
    requestedScopes?: TrustedDeviceAccessScope[];
    requestedBy: string;
    ttlMs?: number | null;
    deviceTtlMs?: number | null;
  }): {
    ok: true;
    requestId: string;
    deviceName: string;
    pairingCode: string;
    scopes: TrustedDeviceAccessScope[];
    expiresAt: string;
    receipt: TrustedDeviceReceipt;
  } {
    const state = this.readState();
    const now = this.now();
    const requestId = this.idFactory('pairing');
    const pairingCode = this.generatePairingCode();
    const scopes = this.normalizeScopes(input.requestedScopes);
    const ttlMs = this.normalizePositiveMs(input.ttlMs, this.defaultPairingTtlMs);
    const expiresAt = new Date(now.getTime() + ttlMs).toISOString();
    const record: TrustedDevicePairingRequest = {
      requestId,
      deviceName: this.normalizeDeviceName(input.deviceName),
      pairingCodeHash: this.hashSecret(pairingCode),
      scopes,
      requestedBy: this.normalizeActor(input.requestedBy),
      createdAt: now.toISOString(),
      expiresAt,
      deviceTtlMs: this.normalizeNullablePositiveMs(input.deviceTtlMs, this.defaultDeviceTtlMs),
      status: 'pending',
      approvedAt: null,
      approvedBy: null,
      deviceId: null,
    };
    state.pairingRequests[requestId] = record;
    const receipt = this.pushReceipt(state, {
      action: 'trusted-device.pairing-created',
      deviceId: null,
      requestId,
      actor: record.requestedBy,
      scopes,
    });
    this.writeState(state);
    return {
      ok: true,
      requestId,
      deviceName: record.deviceName,
      pairingCode,
      scopes,
      expiresAt,
      receipt,
    };
  }

  public approvePairingRequest(input: {
    requestId: string;
    approvedBy: string;
    userId?: string | null;
    profileId?: string | null;
  }):
    | {
      ok: true;
      deviceToken: string;
      device: TrustedDevicePublicDevice;
      receipt: TrustedDeviceReceipt;
    }
    | { ok: false; reason: 'not-found' | 'expired' | 'not-pending' } {
    const state = this.readState();
    const requestId = String(input.requestId || '').trim();
    const request = state.pairingRequests[requestId];
    if (!request) {
      return { ok: false, reason: 'not-found' };
    }
    const now = this.now();
    if (request.status !== 'pending') {
      return { ok: false, reason: 'not-pending' };
    }
    if (new Date(request.expiresAt).getTime() <= now.getTime()) {
      request.status = 'expired';
      this.writeState(state);
      return { ok: false, reason: 'expired' };
    }

    const deviceToken = this.generateDeviceToken();
    const deviceId = this.idFactory('device');
    const actor = this.normalizeActor(input.approvedBy);
    const expiresAt = request.deviceTtlMs === null
      ? null
      : new Date(now.getTime() + request.deviceTtlMs).toISOString();
    const device: TrustedDeviceRecord = {
      deviceId,
      name: request.deviceName,
      tokenHash: this.hashSecret(deviceToken),
      scopes: [...request.scopes],
      userId: this.normalizeActor(input.userId || request.requestedBy || 'local-owner'),
      profileId: this.normalizeProfileId(input.profileId),
      createdAt: now.toISOString(),
      expiresAt,
      status: 'active',
      revokedAt: null,
      revokedBy: null,
      revokeReason: null,
    };
    state.devices[deviceId] = device;
    request.status = 'approved';
    request.approvedAt = now.toISOString();
    request.approvedBy = actor;
    request.deviceId = deviceId;
    const receipt = this.pushReceipt(state, {
      action: 'trusted-device.approved',
      deviceId,
      requestId,
      actor,
      scopes: device.scopes,
    });
    this.writeState(state);
    return {
      ok: true,
      deviceToken,
      device: this.toPublicDevice(device),
      receipt,
    };
  }

  public revokeDevice(input: {
    deviceId: string;
    revokedBy: string;
    reason?: string | null;
  }):
    | { ok: true; device: TrustedDevicePublicDevice; receipt: TrustedDeviceReceipt }
    | { ok: false; reason: 'not-found' } {
    const state = this.readState();
    const deviceId = String(input.deviceId || '').trim();
    const device = state.devices[deviceId];
    if (!device) {
      return { ok: false, reason: 'not-found' };
    }
    const now = this.now().toISOString();
    device.status = 'revoked';
    device.revokedAt = now;
    device.revokedBy = this.normalizeActor(input.revokedBy);
    device.revokeReason = String(input.reason || '').trim() || null;
    const receipt = this.pushReceipt(state, {
      action: 'trusted-device.revoked',
      deviceId,
      requestId: null,
      actor: device.revokedBy,
      scopes: device.scopes,
      reason: device.revokeReason,
    });
    this.writeState(state);
    return {
      ok: true,
      device: this.toPublicDevice(device),
      receipt,
    };
  }

  public listDevices(): TrustedDevicePublicDevice[] {
    const state = this.readState();
    return Object.values(state.devices)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map((device) => this.toPublicDevice(device));
  }

  public validateBearerToken(inputToken: string | null | undefined, options: {
    requiredScopes?: TrustedDeviceAccessScope[];
  } = {}):
    | { ok: true; identity: TrustedDeviceIdentity }
    | { ok: false; reason: 'missing' | 'invalid' | 'revoked' | 'expired' | 'missing-scope' } {
    const token = String(inputToken || '').trim();
    if (!token) {
      return { ok: false, reason: 'missing' };
    }
    const state = this.readState();
    const tokenHash = this.hashSecret(token);
    const device = Object.values(state.devices).find((candidate) => (
      this.timingSafeStringEquals(candidate.tokenHash, tokenHash)
    ));
    if (!device) {
      return { ok: false, reason: 'invalid' };
    }
    if (device.status === 'revoked') {
      return { ok: false, reason: 'revoked' };
    }
    if (device.expiresAt && new Date(device.expiresAt).getTime() <= this.now().getTime()) {
      return { ok: false, reason: 'expired' };
    }
    const requiredScopes = options.requiredScopes?.length
      ? this.normalizeScopes(options.requiredScopes)
      : [];
    if (requiredScopes.some((scope) => !device.scopes.includes(scope))) {
      return { ok: false, reason: 'missing-scope' };
    }
    return {
      ok: true,
      identity: {
        authenticated: true,
        source: 'trusted-device',
        userId: device.userId,
        profileId: device.profileId,
        deviceId: device.deviceId,
        scopes: [...device.scopes],
      },
    };
  }

  private normalizeScopes(input: TrustedDeviceAccessScope[] = []): TrustedDeviceAccessScope[] {
    const rawScopes = input.length > 0 ? input : ['chat:send', 'chat:read'];
    const scopes = new Set<TrustedDeviceAccessScope>();
    for (const raw of rawScopes) {
      const scope = String(raw || '').trim().toLowerCase() as TrustedDeviceAccessScope;
      if (!TRUSTED_DEVICE_ACCESS_SCOPES.includes(scope)) {
        throw new Error(`Unsupported trusted-device scope: ${String(raw)}`);
      }
      scopes.add(scope);
    }
    return Array.from(scopes);
  }

  private normalizeDeviceName(value: string): string {
    const normalized = String(value || '').trim().replace(/\s+/g, ' ');
    return normalized.slice(0, 80) || 'Trusted device';
  }

  private normalizeActor(value: string): string {
    return String(value || '').trim() || 'local-owner';
  }

  private normalizeProfileId(inputValue: string | null | undefined): string | null {
    if (inputValue === null) {
      return null;
    }
    return String(inputValue ?? 'default').trim() || 'default';
  }

  private normalizePositiveMs(value: number | null | undefined, fallback: number): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : fallback;
  }

  private normalizeNullablePositiveMs(value: number | null | undefined, fallback: number | null): number | null {
    if (value === null) {
      return null;
    }
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      return Math.floor(numeric);
    }
    return fallback;
  }

  private generatePairingCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = this.randomBytes(8);
    const chars = Array.from(bytes).map((byte) => alphabet[byte % alphabet.length]).join('');
    return `ZV-${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
  }

  private generateDeviceToken(): string {
    return `zv_ld_${this.randomBytes(32).toString('base64url')}`;
  }

  private hashSecret(secret: string): string {
    return crypto
      .createHash('sha256')
      .update('zavorth-trusted-device:')
      .update(secret)
      .digest('base64url');
  }

  private timingSafeStringEquals(expected: string, provided: string): boolean {
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const providedBuffer = Buffer.from(provided || '', 'utf8');
    return expectedBuffer.length === providedBuffer.length
      && crypto.timingSafeEqual(expectedBuffer, providedBuffer);
  }

  private pushReceipt(state: TrustedDeviceAccessState, input: Omit<TrustedDeviceReceipt, 'receiptId' | 'createdAt' | 'secretRedacted'>): TrustedDeviceReceipt {
    const receipt: TrustedDeviceReceipt = {
      receiptId: this.idFactory('receipt'),
      createdAt: this.now().toISOString(),
      secretRedacted: true,
      ...input,
    };
    state.receipts.push(receipt);
    state.receipts = state.receipts.slice(-100);
    return receipt;
  }

  private toPublicDevice(device: TrustedDeviceRecord): TrustedDevicePublicDevice {
    const expired = device.expiresAt && new Date(device.expiresAt).getTime() <= this.now().getTime();
    return {
      deviceId: device.deviceId,
      name: device.name,
      scopes: [...device.scopes],
      userId: device.userId,
      profileId: device.profileId,
      createdAt: device.createdAt,
      expiresAt: device.expiresAt,
      status: device.status === 'active' && expired ? 'expired' : device.status,
      revokedAt: device.revokedAt,
      revokedBy: device.revokedBy,
      revokeReason: device.revokeReason,
    };
  }

  private readState(): TrustedDeviceAccessState {
    try {
      if (!fs.existsSync(this.stateFilePath)) {
        return this.emptyState();
      }
      const parsed = JSON.parse(fs.readFileSync(this.stateFilePath, 'utf8')) as Partial<TrustedDeviceAccessState>;
      return {
        version: 1,
        pairingRequests: this.normalizeRecord(parsed.pairingRequests),
        devices: this.normalizeRecord(parsed.devices),
        receipts: Array.isArray(parsed.receipts) ? parsed.receipts.slice(-100) as TrustedDeviceReceipt[] : [],
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read trusted-device access state at ${this.stateFilePath}: ${detail}`);
    }
  }

  private writeState(state: TrustedDeviceAccessState): void {
    fs.mkdirSync(path.dirname(this.stateFilePath), { recursive: true });
    const tmpPath = `${this.stateFilePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    });
    try {
      fs.chmodSync(tmpPath, 0o600);
    } catch {
      // Some platforms ignore POSIX permissions; state still contains hashes, not raw secrets.
    }
    fs.renameSync(tmpPath, this.stateFilePath);
    try {
      fs.chmodSync(this.stateFilePath, 0o600);
    } catch {
      // Best-effort hardening for Windows and filesystems without chmod support.
    }
  }

  private emptyState(): TrustedDeviceAccessState {
    return {
      version: 1,
      pairingRequests: {},
      devices: {},
      receipts: [],
    };
  }

  private normalizeRecord<T>(value: unknown): Record<string, T> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, T>
      : {};
  }
}
