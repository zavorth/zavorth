/**
 * Proof OS unified receipt ledger service.
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
    for (const line of raw.split(/\r?\n/)) {
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
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const payload = events.map((e) => JSON.stringify(e)).join('\n');
    fs.writeFileSync(this.filePath, payload ? `${payload}\n` : '', 'utf8');
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
    return JSON.stringify(snapshot, null, 2);
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
      for (const event of snapshot.events) {
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
    return {
      id: String(input.id || '').trim() || this.idFactory('proof'),
      runId: input.runId === undefined || input.runId === null || !String(input.runId).trim()
        ? null
        : String(input.runId).trim(),
      kind,
      surface: String(input.surface || 'runtime').trim() || 'runtime',
      title: String(input.title || 'Proof event').trim() || 'Proof event',
      summary: String(input.summary || '').trim() || 'No details.',
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
      ...(input.metadata ? { metadata: { ...input.metadata } } : {}),
    };
  }

  private persistAll(): void {
    this.adapter.saveAll(this.events);
  }
}

function sanitizeStoredEvent(raw: ProofEvent): ProofEvent {
  return {
    id: String(raw.id || '').trim() || `proof-orphan-${Date.now().toString(36)}`,
    runId: raw.runId === undefined || raw.runId === null || !String(raw.runId).trim()
      ? null
      : String(raw.runId).trim(),
    kind: normalizeProofEventKind(raw.kind),
    surface: String(raw.surface || 'runtime').trim() || 'runtime',
    title: String(raw.title || 'Proof event').trim() || 'Proof event',
    summary: String(raw.summary || '').trim() || 'No details.',
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
    ...(raw.metadata ? { metadata: { ...raw.metadata } } : {}),
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
