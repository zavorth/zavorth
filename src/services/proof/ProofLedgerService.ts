/**
 * Trust Loop unified receipt ledger service.
 *
 * Facade/projection over existing receipt systems. In-memory by default;
 * optional JSONL file adapter for local CLI persistence.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  PROOF_LEDGER_CONTRACT_VERSION,
  type ProofDesktopReceiptShape,
  type ProofEvent,
  type ProofEventKind,
  type ProofEventStatus,
  type ProofEvidenceRecordShape,
  type ProofLedgerListFilter,
  type ProofLedgerSnapshot,
  type ProofRiskLevel,
} from '../../contracts/proof/ProofLedgerContract.js';
import {
  desktopReceiptFromProofEvent,
  normalizeProofEventKind,
  normalizeProofEventStatus,
  normalizeProofRiskLevel,
  proofEventFromDesktopReceipt,
  proofEventFromEvidenceRecord,
} from './proofEventMappers.js';
import { safeWriteLocalTextFile } from '../security/LocalStatePathGuard.js';

export type ProofLedgerPersistenceAdapter = {
  load(): ProofEvent[];
  saveAll(events: ProofEvent[]): void;
  append?(event: ProofEvent): void;
};

export type ProofLedgerServiceOptions = {
  now?: () => Date;
  idFactory?: (prefix: string) => string;
  ledgerId?: string;
  adapter?: ProofLedgerPersistenceAdapter | null;
  /** When set, uses a JSONL file adapter at this path (unless adapter is provided). */
  jsonlPath?: string | null;
  seedEvents?: ProofEvent[];
};

export type ProofEventAppendInput = Omit<ProofEvent, 'id' | 'createdAt'> & {
  id?: string;
  createdAt?: string;
};

/** Keys that must never appear with raw secret values in proof exports (S1). */
const SECRET_METADATA_KEY_RE =
  /^(?:api[_-]?key|token|password|secret|authorization|auth|credential|private[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret)$/i;

/**
 * Redact secret-like substrings in operator-facing proof text.
 * Presence-oriented: never echo raw tokens into export/show surfaces.
 */
export function redactProofSecretLikeText(text: string): string {
  let out = String(text ?? '');
  // Headers / bearer first (value may contain spaces).
  out = out.replace(/\bAuthorization\s*:\s*[^\n\r]+/gi, 'Authorization: [REDACTED]');
  out = out.replace(/\bBearer\s+[A-Za-z0-9._\-+/=]{8,}\b/gi, 'Bearer [REDACTED]');
  out = out.replace(
    /\b(api[_-]?key|secret|token|password|credential|auth)\s*[=:]\s*['"]?[^\s'"]+/gi,
    '$1=[REDACTED]',
  );
  out = out.replace(/\bsk-[a-zA-Z0-9_-]{8,}\b/g, 'sk-[REDACTED]');
  out = out.replace(/\bgh[pousr]_[A-Za-z0-9_]{8,}\b/g, 'gh*_[REDACTED]');
  out = out.replace(/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, 'xox*-[REDACTED]');
  return out;
}

function isSecretMetadataKey(key: string): boolean {
  const k = String(key || '');
  return SECRET_METADATA_KEY_RE.test(k) || /secret|token|password|api[_-]?key|credential/i.test(k);
}

/** Deep-redact proof metadata for storage and public export (S1). */
export function redactProofMetadata(
  meta: Record<string, unknown> | undefined | null,
): Record<string, unknown> | undefined {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return meta === null || meta === undefined ? undefined : undefined;
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (isSecretMetadataKey(key)) {
      out[key] = '[REDACTED]';
      continue;
    }
    if (typeof value === 'string') {
      out[key] = redactProofSecretLikeText(value);
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = redactProofMetadata(value as Record<string, unknown>) ?? {};
      continue;
    }
    if (Array.isArray(value)) {
      out[key] = value.map((item) => {
        if (typeof item === 'string') return redactProofSecretLikeText(item);
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          return redactProofMetadata(item as Record<string, unknown>) ?? item;
        }
        return item;
      });
      continue;
    }
    out[key] = value;
  }
  return out;
}

function redactProofEventForExport(event: ProofEvent): ProofEvent {
  const redactedMeta = event.metadata
    ? redactProofMetadata(event.metadata as Record<string, unknown>)
    : undefined;
  return {
    ...event,
    title: redactProofSecretLikeText(event.title),
    summary: redactProofSecretLikeText(event.summary),
    ...(redactedMeta ? { metadata: redactedMeta } : {}),
  };
}

const HIGH_RISK: ReadonlySet<ProofRiskLevel> = new Set(['high', 'critical']);

export class InMemoryProofLedgerAdapter implements ProofLedgerPersistenceAdapter {
  private events: ProofEvent[] = [];

  constructor(seed: ProofEvent[] = []) {
    this.events = seed.map((e) => ({ ...e, artifacts: [...(e.artifacts || [])] }));
  }

  public load(): ProofEvent[] {
    return this.events.map((e) => ({ ...e, artifacts: [...(e.artifacts || [])] }));
  }

  public saveAll(events: ProofEvent[]): void {
    this.events = events.map((e) => ({ ...e, artifacts: [...(e.artifacts || [])] }));
  }

  // No append(): service pushes to its cache then saveAll() so memory stays single-copy.
}

export class JsonlProofLedgerAdapter implements ProofLedgerPersistenceAdapter {
  constructor(private readonly filePath: string) {}

  public load(): ProofEvent[] {
    if (!fs.existsSync(this.filePath)) {
      return [];
    }
    const raw = fs.readFileSync(this.filePath, 'utf8');
    const events: ProofEvent[] = [];
    for (const line of raw.split(/\r\n|\r|\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed) as ProofEvent;
        if (parsed && typeof parsed === 'object' && parsed.id) {
          events.push(sanitizeStoredEvent(parsed));
        }
      } catch {
        // skip corrupt lines
      }
    }
    return events;
  }

  public saveAll(events: ProofEvent[]): void {
    const payload = events.map((e) => JSON.stringify(e)).join('\n');
    // S9: refuse symlink overwrite; write via temp+rename under the store path.
    safeWriteLocalTextFile(this.filePath, payload ? `${payload}\n` : '');
  }

  public append(event: ProofEvent): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.appendFileSync(this.filePath, `${JSON.stringify(event)}\n`, 'utf8');
  }
}

export function defaultProofLedgerJsonlPath(cwd: string = process.cwd()): string {
  return path.join(cwd, '.zavorth', 'proof-ledger.jsonl');
}

export class ProofLedgerService {
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string) => string;
  private readonly adapter: ProofLedgerPersistenceAdapter;
  private readonly ledgerId: string;
  private events: ProofEvent[] = [];
  private sequence = 0;

  constructor(options: ProofLedgerServiceOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.idFactory = options.idFactory
      ?? ((prefix) => `${prefix}-${this.now().getTime().toString(36)}-${++this.sequence}`);
    this.ledgerId = options.ledgerId || this.idFactory('ledger');

    if (options.adapter) {
      this.adapter = options.adapter;
    } else if (options.jsonlPath) {
      this.adapter = new JsonlProofLedgerAdapter(options.jsonlPath);
    } else {
      this.adapter = new InMemoryProofLedgerAdapter(options.seedEvents || []);
    }

    this.events = this.adapter.load();
    if (options.seedEvents && options.seedEvents.length > 0 && this.events.length === 0) {
      for (const seed of options.seedEvents) {
        this.events.push(sanitizeStoredEvent(seed));
      }
      this.persistAll();
    }
  }

  public append(input: ProofEventAppendInput): ProofEvent {
    const event = this.normalizeAppendInput(input);
    this.events.push(event);
    if (typeof this.adapter.append === 'function') {
      this.adapter.append(event);
    } else {
      this.persistAll();
    }
    return { ...event, artifacts: [...event.artifacts] };
  }

  public list(filter: ProofLedgerListFilter = {}): ProofEvent[] {
    let result = this.events.slice();

    if (filter.kind) {
      const kind = String(filter.kind).toLowerCase();
      result = result.filter((e) => e.kind === kind);
    }
    if (filter.status) {
      const status = String(filter.status).toLowerCase();
      result = result.filter((e) => e.status === status);
    }
    if (filter.runId !== undefined && filter.runId !== null && String(filter.runId).trim()) {
      const runId = String(filter.runId).trim();
      result = result.filter((e) => e.runId === runId);
    }
    if (filter.query && String(filter.query).trim()) {
      const q = String(filter.query).trim().toLowerCase();
      result = result.filter((e) => {
        const hay = `${e.title} ${e.summary} ${e.source} ${e.kind} ${e.id}`.toLowerCase();
        return hay.includes(q);
      });
    }

    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (filter.limit !== undefined && filter.limit !== null && Number.isFinite(filter.limit)) {
      const limit = Math.max(0, Math.floor(Number(filter.limit)));
      result = result.slice(0, limit);
    }

    return result.map((e) => ({ ...e, artifacts: [...(e.artifacts || [])] }));
  }

  public get(id: string): ProofEvent | null {
    const normalized = String(id || '').trim();
    if (!normalized) return null;
    const found = this.events.find((e) => e.id === normalized);
    return found ? { ...found, artifacts: [...(found.artifacts || [])] } : null;
  }

  public buildSnapshot(filter: ProofLedgerListFilter = {}): ProofLedgerSnapshot {
    const events = this.list(filter);
    const byKind: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let highRiskOrAbove = 0;

    for (const event of events) {
      byKind[event.kind] = (byKind[event.kind] || 0) + 1;
      byStatus[event.status] = (byStatus[event.status] || 0) + 1;
      if (HIGH_RISK.has(event.riskLevel)) {
        highRiskOrAbove += 1;
      }
    }

    return {
      contractVersion: PROOF_LEDGER_CONTRACT_VERSION,
      source: 'proof-ledger',
      generatedAt: this.now().toISOString(),
      ledgerId: this.ledgerId,
      events,
      summary: {
        total: events.length,
        byKind,
        byStatus,
        highRiskOrAbove,
      },
    };
  }

  public projectFromEvidenceRecords(
    records: ProofEvidenceRecordShape[],
    defaults: { surface?: string; source?: string } = {},
  ): ProofEvent[] {
    return (records || []).map((record) => proofEventFromEvidenceRecord(record, defaults));
  }

  public projectFromDesktopReceipts(
    receipts: ProofDesktopReceiptShape[],
    defaults: { surface?: string; source?: string } = {},
  ): ProofEvent[] {
    return (receipts || []).map((receipt) => proofEventFromDesktopReceipt(receipt, defaults));
  }

  public mergeSources(...eventArrays: ProofEvent[][]): ProofEvent[] {
    const byId = new Map<string, ProofEvent>();
    for (const arr of eventArrays) {
      for (const event of arr || []) {
        if (!event || !event.id) continue;
        // Later sources win on id collision so call order can override earlier projections.
        byId.set(event.id, {
          ...event,
          artifacts: [...(event.artifacts || [])],
        });
      }
    }
    return Array.from(byId.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  public ingestProjected(events: ProofEvent[]): ProofEvent[] {
    const ingested: ProofEvent[] = [];
    for (const event of events) {
      if (this.get(event.id)) continue;
      ingested.push(this.append({
        ...event,
        id: event.id,
        createdAt: event.createdAt,
      }));
    }
    return ingested;
  }

  public toJson(snapshot: ProofLedgerSnapshot): string {
    // Always redact secret-like content for public/CLI JSON export (S1).
    const safe: ProofLedgerSnapshot = {
      ...snapshot,
      events: snapshot.events.map((event) => redactProofEventForExport(event)),
    };
    return JSON.stringify(safe, null, 2);
  }

  public toMarkdown(snapshot: ProofLedgerSnapshot): string {
    const lines: string[] = [];
    lines.push('# Zavorth Proof Ledger');
    lines.push('');
    lines.push(`- contract: ${snapshot.contractVersion}`);
    lines.push(`- ledgerId: ${snapshot.ledgerId}`);
    lines.push(`- generatedAt: ${snapshot.generatedAt}`);
    lines.push(`- total: ${snapshot.summary.total}`);
    lines.push(`- highRiskOrAbove: ${snapshot.summary.highRiskOrAbove}`);
    lines.push('');
    lines.push('## Summary by kind');
    const kindEntries = Object.entries(snapshot.summary.byKind).sort((a, b) => b[1] - a[1]);
    if (kindEntries.length === 0) {
      lines.push('- none');
    } else {
      for (const [kind, count] of kindEntries) {
        lines.push(`- ${kind}: ${count}`);
      }
    }
    lines.push('');
    lines.push('## Summary by status');
    const statusEntries = Object.entries(snapshot.summary.byStatus).sort((a, b) => b[1] - a[1]);
    if (statusEntries.length === 0) {
      lines.push('- none');
    } else {
      for (const [status, count] of statusEntries) {
        lines.push(`- ${status}: ${count}`);
      }
    }
    lines.push('');
    lines.push('## Events');
    if (snapshot.events.length === 0) {
      lines.push('- none');
    } else {
      for (const event of snapshot.events.map((e) => redactProofEventForExport(e))) {
        lines.push(
          `- **${event.title}** · \`${event.kind}\` · ${event.status} · risk=${event.riskLevel} · ${event.createdAt}`,
        );
        lines.push(`  - id: \`${event.id}\``);
        lines.push(`  - ${event.summary}`);
        if (event.runId) {
          lines.push(`  - runId: \`${event.runId}\``);
        }
        if (event.source) {
          lines.push(`  - source: ${event.source}`);
        }
      }
    }
    lines.push('');
    return lines.join('\n');
  }

  /** Public-safe view of a single event (CLI show --json, etc.). */
  public toPublicEvent(event: ProofEvent): ProofEvent {
    return redactProofEventForExport(event);
  }

  public toDesktopReceipt(event: ProofEvent): ProofDesktopReceiptShape {
    return desktopReceiptFromProofEvent(event);
  }

  public reload(): void {
    this.events = this.adapter.load();
  }

  private normalizeAppendInput(input: ProofEventAppendInput): ProofEvent {
    const kind = normalizeProofEventKind(input.kind) as ProofEventKind;
    const status = normalizeProofEventStatus(input.status) as ProofEventStatus;
    const riskLevel = normalizeProofRiskLevel(input.riskLevel);
    const title = redactProofSecretLikeText(String(input.title || 'Proof event').trim() || 'Proof event');
    const summary = redactProofSecretLikeText(String(input.summary || '').trim() || 'No details.');
    const metadata = input.metadata
      ? redactProofMetadata(input.metadata as Record<string, unknown>)
      : undefined;
    return {
      id: String(input.id || '').trim() || this.idFactory('proof'),
      runId: input.runId === undefined || input.runId === null || !String(input.runId).trim()
        ? null
        : String(input.runId).trim(),
      kind,
      surface: String(input.surface || 'runtime').trim() || 'runtime',
      title,
      summary,
      status,
      riskLevel,
      approvalId: input.approvalId === undefined || input.approvalId === null || !String(input.approvalId).trim()
        ? null
        : String(input.approvalId).trim(),
      artifacts: Array.isArray(input.artifacts)
        ? input.artifacts.map((a) => ({
          id: String(a.id || '').trim(),
          type: String(a.type || 'artifact').trim() || 'artifact',
          ...(a.label !== undefined ? { label: String(a.label) } : {}),
        })).filter((a) => a.id)
        : [],
      createdAt: String(input.createdAt || this.now().toISOString()),
      source: String(input.source || 'proof-ledger').trim() || 'proof-ledger',
      ...(metadata ? { metadata } : {}),
    };
  }

  private persistAll(): void {
    this.adapter.saveAll(this.events);
  }
}

function sanitizeStoredEvent(raw: ProofEvent): ProofEvent {
  const metadata = raw.metadata
    ? redactProofMetadata(raw.metadata as Record<string, unknown>)
    : undefined;
  return {
    id: String(raw.id || '').trim() || `proof-orphan-${Date.now().toString(36)}`,
    runId: raw.runId === undefined || raw.runId === null || !String(raw.runId).trim()
      ? null
      : String(raw.runId).trim(),
    kind: normalizeProofEventKind(raw.kind),
    surface: String(raw.surface || 'runtime').trim() || 'runtime',
    title: redactProofSecretLikeText(String(raw.title || 'Proof event').trim() || 'Proof event'),
    summary: redactProofSecretLikeText(String(raw.summary || '').trim() || 'No details.'),
    status: normalizeProofEventStatus(raw.status),
    riskLevel: normalizeProofRiskLevel(raw.riskLevel),
    approvalId: raw.approvalId === undefined || raw.approvalId === null || !String(raw.approvalId).trim()
      ? null
      : String(raw.approvalId).trim(),
    artifacts: Array.isArray(raw.artifacts)
      ? raw.artifacts
        .filter((a) => a && a.id)
        .map((a) => ({
          id: String(a.id),
          type: String(a.type || 'artifact'),
          ...(a.label !== undefined ? { label: String(a.label) } : {}),
        }))
      : [],
    createdAt: String(raw.createdAt || new Date().toISOString()),
    source: String(raw.source || 'proof-ledger').trim() || 'proof-ledger',
    ...(metadata ? { metadata } : {}),
  };
}

/** Demo fixtures for CLI smoke and tests. */
export function createProofLedgerDemoEvents(now: () => Date = () => new Date()): ProofEvent[] {
  const ts = now().toISOString();
  return [
    {
      id: 'proof-demo-chat-1',
      runId: 'run-demo-1',
      kind: 'chat',
      surface: 'cli',
      title: 'Demo chat receipt',
      summary: 'Sample chat proof event for smoke testing.',
      status: 'ok',
      riskLevel: 'none',
      approvalId: null,
      artifacts: [],
      createdAt: ts,
      source: 'proof-ledger-demo',
      metadata: { demo: true },
    },
    {
      id: 'proof-demo-approval-1',
      runId: 'run-demo-1',
      kind: 'approval',
      surface: 'desktop',
      title: 'Demo approval receipt',
      summary: 'Sample approval proof event with elevated risk.',
      status: 'pending',
      riskLevel: 'high',
      approvalId: 'appr-demo-1',
      artifacts: [{ id: 'art-demo-1', type: 'diff', label: 'Proposed change' }],
      createdAt: ts,
      source: 'proof-ledger-demo',
      metadata: { demo: true },
    },
  ];
}
