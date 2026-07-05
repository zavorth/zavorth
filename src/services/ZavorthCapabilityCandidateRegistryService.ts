import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import {
  ZAVORTH_CAPABILITY_CANDIDATE_REGISTRY_CONTRACT_VERSION,
  type ZavorthCapabilityCandidate,
  type ZavorthCapabilityCandidateEvidence,
  type ZavorthCapabilityCandidateHistoryEntry,
  type ZavorthCapabilityCandidateRegistryReceipt,
  type ZavorthCapabilityCandidateRegistryRegisterInput,
  type ZavorthCapabilityCandidateRegistrySnapshot,
  type ZavorthCapabilityCandidateRegistryTransitionInput,
  type ZavorthCapabilityCandidateStatus,
} from '../contracts/ZavorthCapabilityCandidateRegistryContract.js';
import type {
  ZavorthInnovationRadarCandidate,
  ZavorthInnovationRadarSnapshot,
} from '../contracts/native/ZavorthInnovationRadarContract.js';
import { ZavorthHomePathService } from './ZavorthHomePathService.js';
import { logger } from '../logger.js';

type Runtime = {
  projectRoot?: string;
  env?: Record<string, string | undefined>;
  now?: () => Date;
  storeFile?: string;
};

type Store = {
  contractVersion: typeof ZAVORTH_CAPABILITY_CANDIDATE_REGISTRY_CONTRACT_VERSION;
  updatedAt: string;
  candidates: ZavorthCapabilityCandidate[];
  receipts: ZavorthCapabilityCandidateRegistryReceipt[];
};

const MAX_STORE_BYTES = 2 * 1024 * 1024;
const MAX_RECEIPTS = 500;
const ALLOWED_TRANSITIONS: Record<ZavorthCapabilityCandidateStatus, ZavorthCapabilityCandidateStatus[]> = {
  observed: ['reviewed', 'archived'],
  reviewed: ['prototype_ready', 'archived'],
  prototype_ready: ['archived'],
  archived: ['observed'],
};

export class ZavorthCapabilityCandidateRegistryService {
  private readonly now: () => Date;
  private readonly storeFile: string;

  public constructor(runtime: Runtime = {}) {
    const projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    const env = runtime.env || process.env;
    const paths = new ZavorthHomePathService({ projectRoot, env }).resolvePaths();
    this.now = runtime.now || (() => new Date());
    this.storeFile = path.resolve(runtime.storeFile || path.join(paths.runtimeDir, 'capability-candidates.json'));
  }

  public snapshot(): ZavorthCapabilityCandidateRegistrySnapshot {
    return this.buildSnapshot(this.readStore());
  }

  public register(input: ZavorthCapabilityCandidateRegistryRegisterInput): ZavorthCapabilityCandidateRegistrySnapshot {
    this.assertRadarSnapshot(input.radar);
    const actor = clean(input.actor || 'operator');
    const selected = this.selectCandidates(input.radar, input.candidateIds || [], Boolean(input.allNew));
    const store = this.readStore();
    if (selected.length === 0) {
      store.receipts.push(this.receipt(actor, 'register', 'skipped', null, 'No eligible new radar candidate was selected.'));
      this.writeStore(store);
      return this.buildSnapshot(store);
    }

    for (const radarCandidate of selected) {
      const existing = store.candidates.find((candidate) => candidate.radarCandidateId === radarCandidate.id);
      if (existing) {
        const evidence = this.evidence(input.radar, radarCandidate);
        if (!existing.evidence.some((entry) => entry.id === evidence.id)) {
          existing.evidence.push(evidence);
          existing.sourceIds = unique([...existing.sourceIds, ...evidence.sourceIds]);
          existing.noveltyScore = Math.max(existing.noveltyScore, evidence.noveltyScore);
          existing.confidence = Math.max(existing.confidence, evidence.confidence);
          existing.updatedAt = this.timestamp();
          existing.history.push(this.history(actor, 'candidate.evidence.updated', existing.status, existing.status, 'Radar evidence merged into existing candidate.'));
          store.receipts.push(this.receipt(actor, 'register', 'applied', existing.id, 'Existing candidate received new radar evidence.'));
        } else {
          store.receipts.push(this.receipt(actor, 'register', 'skipped', existing.id, 'Candidate already contains this radar evidence.'));
        }
        continue;
      }
      const candidate = this.fromRadar(input.radar, radarCandidate, actor);
      store.candidates.push(candidate);
      store.receipts.push(this.receipt(actor, 'register', 'applied', candidate.id, 'Radar observation registered as capability candidate.'));
    }
    this.writeStore(store);
    return this.buildSnapshot(store);
  }

  public transition(input: ZavorthCapabilityCandidateRegistryTransitionInput): ZavorthCapabilityCandidateRegistrySnapshot {
    const actor = clean(input.actor || 'operator');
    const store = this.readStore();
    const candidate = store.candidates.find((entry) => entry.id === clean(input.candidateId));
    if (!candidate) {
      store.receipts.push(this.receipt(actor, 'transition', 'blocked', null, 'Capability candidate was not found.'));
      this.writeStore(store);
      return this.buildSnapshot(store);
    }
    if (!ALLOWED_TRANSITIONS[candidate.status].includes(input.to)) {
      store.receipts.push(this.receipt(actor, 'transition', 'blocked', candidate.id, `Transition ${candidate.status} -> ${input.to} is not allowed.`));
      this.writeStore(store);
      return this.buildSnapshot(store);
    }
    const from = candidate.status;
    candidate.status = input.to;
    candidate.updatedAt = this.timestamp();
    candidate.nextSafeAction = nextSafeAction(candidate.status);
    candidate.history.push(this.history(actor, 'candidate.transitioned', from, candidate.status, `Candidate transitioned ${from} -> ${candidate.status}.`));
    store.receipts.push(this.receipt(actor, 'transition', 'applied', candidate.id, `Candidate transitioned ${from} -> ${candidate.status}.`));
    this.writeStore(store);
    return this.buildSnapshot(store);
  }

  public renderText(snapshot = this.snapshot()): string {
    const lines = [
      'Zavorth Capability Candidate Registry',
      '',
      `status=${snapshot.status}`,
      `store=${snapshot.storeFile}`,
      `total=${snapshot.summary.total} observed=${snapshot.summary.observed} reviewed=${snapshot.summary.reviewed} prototype_ready=${snapshot.summary.prototypeReady} archived=${snapshot.summary.archived}`,
      '',
      'Candidates:',
    ];
    if (snapshot.candidates.length === 0) lines.push('- none registered');
    for (const candidate of snapshot.candidates) {
      lines.push(`- ${candidate.id} [${candidate.status}] ${candidate.title}`);
      lines.push(`  evidence=${candidate.evidence.length} next=${candidate.nextSafeAction}`);
    }
    lines.push('', 'Safety: registry only; no prototype, installation, tool exposure or live activation occurred.');
    return lines.join('\n');
  }

  private selectCandidates(
    radar: ZavorthInnovationRadarSnapshot,
    candidateIds: string[],
    allNew: boolean,
  ): ZavorthInnovationRadarCandidate[] {
    const selectedIds = new Set(candidateIds.map(clean).filter(Boolean));
    return radar.candidates.filter((candidate) => {
      if (candidate.status !== 'new' || candidate.matchedExistingCapabilityIds.length > 0) return false;
      return allNew || selectedIds.has(candidate.id);
    });
  }

  private fromRadar(
    radar: ZavorthInnovationRadarSnapshot,
    candidate: ZavorthInnovationRadarCandidate,
    actor: string,
  ): ZavorthCapabilityCandidate {
    const timestamp = this.timestamp();
    const id = `capability-candidate:${safeId(candidate.id)}`;
    return {
      id,
      radarCandidateId: clean(candidate.id),
      title: redact(candidate.title),
      summary: redact(candidate.summary),
      category: candidate.category,
      tags: unique(candidate.tags.map(safeId).filter(Boolean)),
      status: 'observed',
      noveltyScore: clamp(candidate.noveltyScore),
      confidence: clamp(candidate.confidence),
      sourceIds: unique(candidate.sourceIds.map(safeId).filter(Boolean)),
      evidence: [this.evidence(radar, candidate)],
      history: [this.history(actor, 'candidate.registered', null, 'observed', 'Radar observation registered for operator review.')],
      createdAt: timestamp,
      updatedAt: timestamp,
      nextSafeAction: nextSafeAction('observed'),
    };
  }

  private evidence(
    radar: ZavorthInnovationRadarSnapshot,
    candidate: ZavorthInnovationRadarCandidate,
  ): ZavorthCapabilityCandidateEvidence {
    const sourceIds = unique(candidate.sourceIds.map(safeId).filter(Boolean));
    const sourceSignalIds = unique(candidate.sourceSignalIds.map(safeId).filter(Boolean));
    return {
      id: `evidence:${safeId(`${candidate.id}-${radar.generatedAt}-${sourceSignalIds.join('-')}`)}`,
      radarCandidateId: clean(candidate.id),
      radarGeneratedAt: normalizeDate(radar.generatedAt),
      reportFile: radar.reportFile ? redact(path.resolve(radar.reportFile)) : null,
      sourceSignalIds,
      sourceIds,
      noveltyScore: clamp(candidate.noveltyScore),
      confidence: clamp(candidate.confidence),
      capturedAt: this.timestamp(),
    };
  }

  private history(
    actor: string,
    event: ZavorthCapabilityCandidateHistoryEntry['event'],
    from: ZavorthCapabilityCandidateStatus | null,
    to: ZavorthCapabilityCandidateStatus,
    summary: string,
  ): ZavorthCapabilityCandidateHistoryEntry {
    return {
      id: `candidate-history:${randomUUID()}`,
      at: this.timestamp(),
      actor,
      event,
      from,
      to,
      summary: redact(summary),
    };
  }

  private receipt(
    actor: string,
    operation: ZavorthCapabilityCandidateRegistryReceipt['operation'],
    status: ZavorthCapabilityCandidateRegistryReceipt['status'],
    candidateId: string | null,
    summary: string,
  ): ZavorthCapabilityCandidateRegistryReceipt {
    return {
      id: `candidate-receipt:${randomUUID()}`,
      at: this.timestamp(),
      actor,
      operation,
      status,
      candidateId,
      summary: redact(summary),
    };
  }

  private assertRadarSnapshot(radar: ZavorthInnovationRadarSnapshot): void {
    if (!radar || radar.surface !== 'innovation-radar' || !Array.isArray(radar.candidates)) {
      throw new Error('Capability candidate registration requires a valid Innovation Radar snapshot.');
    }
  }

  private readStore(): Store {
    try {
      const stats = fs.statSync(this.storeFile);
      if (!stats.isFile() || stats.size > MAX_STORE_BYTES) return this.emptyStore();
      const parsed = JSON.parse(fs.readFileSync(this.storeFile, 'utf8')) as Partial<Store>;
      return {
        contractVersion: ZAVORTH_CAPABILITY_CANDIDATE_REGISTRY_CONTRACT_VERSION,
        updatedAt: normalizeDate(parsed.updatedAt || this.timestamp()),
        candidates: Array.isArray(parsed.candidates) ? parsed.candidates.map(normalizeCandidate).filter(isCandidate) : [],
        receipts: Array.isArray(parsed.receipts) ? parsed.receipts.map(normalizeReceipt).filter(isReceipt).slice(-MAX_RECEIPTS) : [],
      };
    } catch (error) {
    logger.warn('[Zavorth Capability Candidate Registry] parsing failed', error);
    return this.emptyStore();
  }
  }

  private writeStore(store: Store): void {
    const normalized: Store = {
      contractVersion: ZAVORTH_CAPABILITY_CANDIDATE_REGISTRY_CONTRACT_VERSION,
      updatedAt: this.timestamp(),
      candidates: store.candidates.sort((left, right) => left.id.localeCompare(right.id)),
      receipts: store.receipts.slice(-MAX_RECEIPTS),
    };
    fs.mkdirSync(path.dirname(this.storeFile), { recursive: true });
    const tempFile = `${this.storeFile}.${process.pid}.${randomUUID()}.tmp`;
    fs.writeFileSync(tempFile, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
    fs.renameSync(tempFile, this.storeFile);
  }

  private emptyStore(): Store {
    return {
      contractVersion: ZAVORTH_CAPABILITY_CANDIDATE_REGISTRY_CONTRACT_VERSION,
      updatedAt: this.timestamp(),
      candidates: [],
      receipts: [],
    };
  }

  private buildSnapshot(store: Store): ZavorthCapabilityCandidateRegistrySnapshot {
    const candidates = clone(store.candidates);
    const receipts = clone(store.receipts);
    return {
      contractVersion: ZAVORTH_CAPABILITY_CANDIDATE_REGISTRY_CONTRACT_VERSION,
      generatedAt: this.timestamp(),
      surface: 'capability-candidate-registry',
      status: receipts.some((entry) => entry.status === 'blocked') ? 'attention' : 'ready',
      storeFile: this.storeFile,
      summary: {
        total: candidates.length,
        observed: candidates.filter((candidate) => candidate.status === 'observed').length,
        reviewed: candidates.filter((candidate) => candidate.status === 'reviewed').length,
        prototypeReady: candidates.filter((candidate) => candidate.status === 'prototype_ready').length,
        archived: candidates.filter((candidate) => candidate.status === 'archived').length,
        receipts: receipts.length,
      },
      candidates,
      receipts,
      safety: {
        registrationExplicitOnly: true,
        radarObservationRequired: true,
        knownCapabilitiesRejected: true,
        atomicPersistence: true,
        secretsRedacted: true,
        noPrototypeCreated: true,
        noCapabilityInstalled: true,
        noToolExposed: true,
        noLiveActivation: true,
      },
      commands: {
        list: 'npm run zavorth:capability-candidates --silent -- --list',
        registerAllNew: 'npm run zavorth:capability-candidates --silent -- --register --all-new',
        registerSelected: 'npm run zavorth:capability-candidates --silent -- --register --candidate <radar-candidate-id>',
        review: 'npm run zavorth:capability-candidates --silent -- --transition <candidate-id>:reviewed',
        preparePrototype: 'npm run zavorth:capability-candidates --silent -- --transition <candidate-id>:prototype_ready',
        nextStage: 'Prototype reviewed capability candidates inside a sandbox.',
      },
    };
  }

  private timestamp(): string {
    return this.now().toISOString();
  }
}

function normalizeCandidate(input: unknown): ZavorthCapabilityCandidate | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as ZavorthCapabilityCandidate;
  if (!clean(value.id) || !clean(value.radarCandidateId) || !clean(value.title) || !isStatus(value.status)) return null;
  return {
    id: clean(value.id),
    radarCandidateId: clean(value.radarCandidateId),
    title: redact(value.title),
    summary: redact(value.summary),
    category: value.category || 'unknown',
    tags: unique((value.tags || []).map(safeId).filter(Boolean)),
    status: value.status,
    noveltyScore: clamp(value.noveltyScore),
    confidence: clamp(value.confidence),
    sourceIds: unique((value.sourceIds || []).map(safeId).filter(Boolean)),
    evidence: Array.isArray(value.evidence) ? value.evidence.map(normalizeEvidence).filter(isEvidence) : [],
    history: Array.isArray(value.history) ? value.history.map(normalizeHistory).filter(isHistory) : [],
    createdAt: normalizeDate(value.createdAt),
    updatedAt: normalizeDate(value.updatedAt),
    nextSafeAction: nextSafeAction(value.status),
  };
}

function normalizeEvidence(input: unknown): ZavorthCapabilityCandidateEvidence | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as ZavorthCapabilityCandidateEvidence;
  if (!clean(value.id) || !clean(value.radarCandidateId)) return null;
  return {
    id: clean(value.id),
    radarCandidateId: clean(value.radarCandidateId),
    radarGeneratedAt: normalizeDate(value.radarGeneratedAt),
    reportFile: value.reportFile ? redact(value.reportFile) : null,
    sourceSignalIds: unique((value.sourceSignalIds || []).map(safeId).filter(Boolean)),
    sourceIds: unique((value.sourceIds || []).map(safeId).filter(Boolean)),
    noveltyScore: clamp(value.noveltyScore),
    confidence: clamp(value.confidence),
    capturedAt: normalizeDate(value.capturedAt),
  };
}

function normalizeHistory(input: unknown): ZavorthCapabilityCandidateHistoryEntry | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as ZavorthCapabilityCandidateHistoryEntry;
  if (!clean(value.id) || !clean(value.actor) || !isStatus(value.to)) return null;
  return {
    id: clean(value.id),
    at: normalizeDate(value.at),
    actor: clean(value.actor),
    event: value.event,
    from: value.from && isStatus(value.from) ? value.from : null,
    to: value.to,
    summary: redact(value.summary),
  };
}

function normalizeReceipt(input: unknown): ZavorthCapabilityCandidateRegistryReceipt | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as ZavorthCapabilityCandidateRegistryReceipt;
  if (!clean(value.id) || !clean(value.actor)) return null;
  return {
    id: clean(value.id),
    at: normalizeDate(value.at),
    actor: clean(value.actor),
    operation: value.operation === 'transition' ? 'transition' : 'register',
    status: ['applied', 'skipped', 'blocked'].includes(value.status) ? value.status : 'blocked',
    candidateId: value.candidateId ? clean(value.candidateId) : null,
    summary: redact(value.summary),
  };
}

function isCandidate(value: ZavorthCapabilityCandidate | null): value is ZavorthCapabilityCandidate {
  return Boolean(value);
}

function isEvidence(value: ZavorthCapabilityCandidateEvidence | null): value is ZavorthCapabilityCandidateEvidence {
  return Boolean(value);
}

function isHistory(value: ZavorthCapabilityCandidateHistoryEntry | null): value is ZavorthCapabilityCandidateHistoryEntry {
  return Boolean(value);
}

function isReceipt(value: ZavorthCapabilityCandidateRegistryReceipt | null): value is ZavorthCapabilityCandidateRegistryReceipt {
  return Boolean(value);
}

function isStatus(value: unknown): value is ZavorthCapabilityCandidateStatus {
  return ['observed', 'reviewed', 'prototype_ready', 'archived'].includes(String(value || ''));
}

function nextSafeAction(status: ZavorthCapabilityCandidateStatus): string {
  if (status === 'observed') return 'Review evidence and decide whether this candidate deserves sandbox prototype work.';
  if (status === 'reviewed') return 'Mark prototype_ready only after the scope and safety assumptions are clear.';
  if (status === 'prototype_ready') return 'Create an isolated sandbox prototype; do not activate it live.';
  return 'Restore to observed only if new evidence justifies another review.';
}

function normalizeDate(value: unknown): string {
  const date = new Date(String(value || ''));
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date(0).toISOString();
}

function redact(value: unknown): string {
  return String(value || '')
    .replace(/\bsk-[A-Za-z0-9_-]{6,}\b/g, '[REDACTED]')
    .replace(/\bxox[baprs]-[A-Za-z0-9-]{6,}\b/g, '[REDACTED]')
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{6,}\b/g, '[REDACTED]')
    .replace(/\bAIza[0-9A-Za-z_-]{8,}\b/g, '[REDACTED]')
    .replace(/\b(token|secret|password|api[_ -]?key)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .trim()
    .slice(0, 2_000);
}

function safeId(value: unknown): string {
  return clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 200);
}

function clean(value: unknown): string {
  return redact(value).replace(/\s+/gu, ' ').trim();
}

function clamp(value: unknown): number {
  const normalized = Number(value || 0);
  return Math.max(0, Math.min(1, Number(normalized.toFixed(2))));
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
