import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { config } from '../config/index.js';
import type { ZavorthProviderReadinessEntry, ZavorthProviderReadinessMatrixSnapshot } from '../contracts/ZavorthProviderReadinessMatrixContract.js';
import type { AccessRouteHealthInput } from './providers/catalog/AccessRouteResolutionService.js';
import { logger } from '../logger.js';

export const ZAVORTH_PROVIDER_LIVE_PROOF_STORE_VERSION = 'zavorth-provider-live-proof-store/1' as const;

export type ZavorthProviderLiveProofStatus = 'healthy' | 'unhealthy';

export type ZavorthProviderLiveProofEntry = {
  providerId: string;
  keys: string[];
  status: ZavorthProviderLiveProofStatus;
  checkedAt: string;
  expiresAt: string;
  message: string;
  target: string | null;
  httpStatus: number | null;
  modelCount: number | null;
  evidenceHash: string | null;
  source: 'provider-readiness-live-probe' | 'speech-voice-live-smoke';
};

export type ZavorthProviderLiveProofDocument = {
  contractVersion: typeof ZAVORTH_PROVIDER_LIVE_PROOF_STORE_VERSION;
  schemaVersion: 1;
  updatedAt: string;
  entries: ZavorthProviderLiveProofEntry[];
};

type ZavorthProviderLiveProofStoreRuntime = {
  projectRoot?: string;
  now?: () => Date;
  ttlMs?: number;
  failedTtlMs?: number;
};

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_FAILED_TTL_MS = 60 * 60 * 1000;

export class ZavorthProviderLiveProofStoreService {
  private readonly projectRoot: string;
  private readonly now: () => Date;
  private readonly ttlMs: number;
  private readonly failedTtlMs: number;

  public constructor(runtime: ZavorthProviderLiveProofStoreRuntime = {}) {
    this.projectRoot = runtime.projectRoot || config.projectRoot;
    this.now = runtime.now || (() => new Date());
    this.ttlMs = runtime.ttlMs || readPositiveInt(process.env.ZAVORTH_PROVIDER_LIVE_PROOF_TTL_MS) || DEFAULT_TTL_MS;
    this.failedTtlMs = runtime.failedTtlMs || readPositiveInt(process.env.ZAVORTH_PROVIDER_LIVE_PROOF_FAILED_TTL_MS) || DEFAULT_FAILED_TTL_MS;
  }

  public get filePath(): string {
    return path.join(this.projectRoot, 'data', 'runtime', 'provider-live-proof.json');
  }

  public readDocument(): ZavorthProviderLiveProofDocument {
    try {
      if (!fs.existsSync(this.filePath)) {
        return this.emptyDocument();
      }
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as Partial<ZavorthProviderLiveProofDocument>;
      if (!parsed || !Array.isArray(parsed.entries)) {
        return this.emptyDocument();
      }
      return {
        contractVersion: ZAVORTH_PROVIDER_LIVE_PROOF_STORE_VERSION,
        schemaVersion: 1,
        updatedAt: asIso(parsed.updatedAt) || this.now().toISOString(),
        entries: parsed.entries
          .map(normalizeEntry)
          .filter((entry): entry is ZavorthProviderLiveProofEntry => Boolean(entry)),
      };
    } catch (error: unknown) {logger.warn('[Zavorth  Live Proof Store] parsing failed', error);
    return this.emptyDocument();
  }
  }

  public readFreshHealthMap(): Record<string, AccessRouteHealthInput> {
    const nowMs = this.now().getTime();
    const map: Record<string, AccessRouteHealthInput> = {};
    for (const entry of this.readDocument().entries) {
      const expiresAt = Date.parse(entry.expiresAt);
      if (!Number.isFinite(expiresAt) || expiresAt <= nowMs) {
        continue;
      }
      const health: AccessRouteHealthInput = {
        ready: entry.status === 'healthy',
        status: entry.status,
        message: entry.message || 'Stored live provider evidence.',
        checkedAt: entry.checkedAt,
      };
      for (const key of entry.keys) {
        map[key] = health;
      }
    }
    return map;
  }

  public writeFromMatrixSnapshot(snapshot: ZavorthProviderReadinessMatrixSnapshot): ZavorthProviderLiveProofDocument {
    const freshEntries = snapshot.entries
      .filter((entry) => entry.probe.mode === 'explicit_live_probe')
      .filter((entry) => entry.probe.status === 'passed' || entry.probe.status === 'failed')
      .map((entry) => this.entryFromProbe(snapshot.generatedAt, entry));
    if (freshEntries.length === 0) {
      return this.readDocument();
    }

    const freshIds = new Set(freshEntries.map((entry) => normalizeId(entry.providerId)));
    const existing = this.readDocument().entries.filter((entry) => !freshIds.has(normalizeId(entry.providerId)));
    const document: ZavorthProviderLiveProofDocument = {
      contractVersion: ZAVORTH_PROVIDER_LIVE_PROOF_STORE_VERSION,
      schemaVersion: 1,
      updatedAt: this.now().toISOString(),
      entries: [...existing, ...freshEntries].sort((a, b) => a.providerId.localeCompare(b.providerId)),
    };
    this.writeDocument(document);
    return document;
  }

  public clear(providerId?: string | null): ZavorthProviderLiveProofDocument {
    const normalizedProviderId = normalizeId(providerId);
    const current = this.readDocument();
    const document: ZavorthProviderLiveProofDocument = {
      contractVersion: ZAVORTH_PROVIDER_LIVE_PROOF_STORE_VERSION,
      schemaVersion: 1,
      updatedAt: this.now().toISOString(),
      entries: normalizedProviderId
        ? current.entries.filter((entry) => normalizeId(entry.providerId) !== normalizedProviderId)
        : [],
    };
    this.writeDocument(document);
    return document;
  }

  public writeManualProof(input: {
    providerId: string;
    keys?: string[];
    status?: ZavorthProviderLiveProofStatus;
    message: string;
    target?: string | null;
    httpStatus?: number | null;
    modelCount?: number | null;
    evidenceHash?: string | null;
    source?: ZavorthProviderLiveProofEntry['source'];
  }): ZavorthProviderLiveProofDocument {
    const providerId = normalizeId(input.providerId);
    if (!providerId) return this.readDocument();
    const checkedAt = this.now().toISOString();
    const status = input.status || 'healthy';
    const ttl = status === 'healthy' ? this.ttlMs : this.failedTtlMs;
    const entry: ZavorthProviderLiveProofEntry = {
      providerId,
      keys: uniqueStrings([providerId, ...(input.keys || []).map(normalizeId)]),
      status,
      checkedAt,
      expiresAt: new Date(Date.parse(checkedAt) + ttl).toISOString(),
      message: input.message,
      target: input.target || null,
      httpStatus: input.httpStatus ?? null,
      modelCount: input.modelCount ?? null,
      evidenceHash: input.evidenceHash || hashEntry({
        providerId,
        status,
        checkedAt,
        target: input.target || null,
      }),
      source: input.source || 'provider-readiness-live-probe',
    };
    const existing = this.readDocument().entries.filter((item) => normalizeId(item.providerId) !== providerId);
    const document: ZavorthProviderLiveProofDocument = {
      contractVersion: ZAVORTH_PROVIDER_LIVE_PROOF_STORE_VERSION,
      schemaVersion: 1,
      updatedAt: this.now().toISOString(),
      entries: [...existing, entry].sort((a, b) => a.providerId.localeCompare(b.providerId)),
    };
    this.writeDocument(document);
    return document;
  }

  private entryFromProbe(generatedAt: string, entry: ZavorthProviderReadinessEntry): ZavorthProviderLiveProofEntry {
    const status: ZavorthProviderLiveProofStatus = entry.probe.status === 'passed' ? 'healthy' : 'unhealthy';
    const checkedAt = asIso(entry.probe.completedAt) || asIso(generatedAt) || this.now().toISOString();
    const ttl = status === 'healthy' ? this.ttlMs : this.failedTtlMs;
    const expiresAt = new Date(Date.parse(checkedAt) + ttl).toISOString();
    const keys = uniqueStrings([
      entry.id,
      entry.providerId,
      entry.providerName,
      ...entry.familyIds,
    ].map(normalizeId));
    return {
      providerId: normalizeId(entry.id),
      keys,
      status,
      checkedAt,
      expiresAt,
      message: entry.probe.summary || (status === 'healthy' ? 'Live provider probe passed.' : 'Live provider probe failed.'),
      target: entry.probe.target || null,
      httpStatus: entry.probe.httpStatus,
      modelCount: entry.probe.modelCount,
      evidenceHash: entry.probe.evidenceHash || hashEntry({
        providerId: entry.id,
        status,
        checkedAt,
        target: entry.probe.target || null,
      }),
      source: 'provider-readiness-live-probe',
    };
  }

  private emptyDocument(): ZavorthProviderLiveProofDocument {
    return {
      contractVersion: ZAVORTH_PROVIDER_LIVE_PROOF_STORE_VERSION,
      schemaVersion: 1,
      updatedAt: this.now().toISOString(),
      entries: [],
    };
  }

  private writeDocument(document: ZavorthProviderLiveProofDocument): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  }
}

function normalizeEntry(value: unknown): ZavorthProviderLiveProofEntry | null {
  const entry = value as Partial<ZavorthProviderLiveProofEntry> | null;
  if (!entry) {
    return null;
  }
  const providerId = normalizeId(entry.providerId);
  const status = entry.status === 'healthy' || entry.status === 'unhealthy' ? entry.status : null;
  const checkedAt = asIso(entry.checkedAt);
  const expiresAt = asIso(entry.expiresAt);
  if (!providerId || !status || !checkedAt || !expiresAt) {
    return null;
  }
  return {
    providerId,
    keys: uniqueStrings([providerId, ...(Array.isArray(entry.keys) ? entry.keys.map(normalizeId) : [])]),
    status,
    checkedAt,
    expiresAt,
    message: String(entry.message || 'Stored live provider evidence.'),
    target: typeof entry.target === 'string' ? entry.target : null,
    httpStatus: typeof entry.httpStatus === 'number' ? entry.httpStatus : null,
    modelCount: typeof entry.modelCount === 'number' ? entry.modelCount : null,
    evidenceHash: typeof entry.evidenceHash === 'string' ? entry.evidenceHash : null,
    source: entry.source === 'speech-voice-live-smoke' ? 'speech-voice-live-smoke' : 'provider-readiness-live-probe',
  };
}

function readPositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function normalizeId(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function asIso(value: unknown): string | null {
  const raw = String(value || '').trim();
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function hashEntry(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}
