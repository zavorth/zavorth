import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { AuditEvent } from './AuditLogger.js';

export type SecurityAuditTrailSnapshot = {
  trailDir: string;
  eventsFile: string;
  ledgerFile: string;
  latestEventId: string | null;
  totalEvents: number;
  latestChainHash: string | null;
  latestEventType: string | null;
  latestTaskId: string | null;
  latestTimestamp: string | null;
};

type SecurityAuditTrailRecord = {
  event_id: string;
  sequence: number;
  timestamp: string;
  event_type: string;
  task_id: string;
  user_id: string;
  risk_level: number;
  policy_decision: string;
  operational_mode: string;
  executor: string | null;
  execution_success: boolean | null;
  payload_hash: string;
  metadata_hash: string;
  previous_chain_hash: string | null;
  chain_hash: string;
};

type SecurityAuditTrailLedger = {
  version: 1;
  updatedAt: string;
  totalEvents: number;
  latestEventId: string | null;
  latestChainHash: string | null;
  latestEventType: string | null;
  latestTaskId: string | null;
  latestTimestamp: string | null;
  paths: {
    trailDir: string;
    eventsFile: string;
    ledgerFile: string;
  };
};

type SecurityAuditTrailRuntime = {
  trailDir: string;
  statusFile: string;
  now?: () => Date;
  mkdirSync?: typeof fs.mkdirSync;
  writeFileSync?: typeof fs.writeFileSync;
  appendFileSync?: typeof fs.appendFileSync;
  readFileSync?: typeof fs.readFileSync;
  existsSync?: typeof fs.existsSync;
};

export class SecurityAuditTrailService {
  private readonly trailDir: string;
  private readonly statusFile: string;
  private readonly now: () => Date;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly appendFileSync: typeof fs.appendFileSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly existsSync: typeof fs.existsSync;

  constructor(runtime: SecurityAuditTrailRuntime) {
    this.trailDir = runtime.trailDir;
    this.statusFile = runtime.statusFile;
    this.now = runtime.now || (() => new Date());
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.appendFileSync = runtime.appendFileSync || fs.appendFileSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
  }

  public append(event: AuditEvent): SecurityAuditTrailSnapshot {
    const timestamp = this.now().toISOString();
    const ledger = this.readLedger();
    const sequence = Number(ledger?.totalEvents || 0) + 1;
    const eventId = `audit-${String(sequence).padStart(7, '0')}`;
    const previousChainHash = ledger?.latestChainHash || null;
    const canonicalPayload = this.buildCanonicalPayload(event);
    const payloadHash = this.hash(this.stableSerialize(canonicalPayload));
    const metadataHash = this.hash(this.stableSerialize(event.metadata || {}));
    const record: SecurityAuditTrailRecord = {
      event_id: eventId,
      sequence,
      timestamp: String(event.timestamp || '').trim() || timestamp,
      event_type: String(event.event_type || '').trim() || 'UNKNOWN',
      task_id: String(event.task_id || '').trim() || 'unknown-task',
      user_id: String(event.user_id || '').trim(),
      risk_level: Math.max(0, Number(event.risk_level || 0)),
      policy_decision: String(event.policy_decision || 'ALLOWED').trim() || 'ALLOWED',
      operational_mode: String(event.operational_mode || '').trim(),
      executor: String(event.executor || '').trim() || null,
      execution_success:
        typeof event.execution_success === 'boolean' ? event.execution_success : null,
      payload_hash: payloadHash,
      metadata_hash: metadataHash,
      previous_chain_hash: previousChainHash,
      chain_hash: this.hash(this.stableSerialize({
        event_id: eventId,
        sequence,
        timestamp: String(event.timestamp || '').trim() || timestamp,
        event_type: String(event.event_type || '').trim() || 'UNKNOWN',
        task_id: String(event.task_id || '').trim() || 'unknown-task',
        payload_hash: payloadHash,
        metadata_hash: metadataHash,
        previous_chain_hash: previousChainHash,
      })),
    };

    const nextLedger: SecurityAuditTrailLedger = {
      version: 1,
      updatedAt: timestamp,
      totalEvents: sequence,
      latestEventId: record.event_id,
      latestChainHash: record.chain_hash,
      latestEventType: record.event_type,
      latestTaskId: record.task_id,
      latestTimestamp: record.timestamp,
      paths: {
        trailDir: this.trailDir,
        eventsFile: this.getEventsFile(),
        ledgerFile: this.getLedgerFile(),
      },
    };

    this.mkdirSync(this.trailDir, { recursive: true });
    this.appendFileSync(this.getEventsFile(), `${JSON.stringify(record)}\n`, 'utf8');
    this.writeFileSync(this.getLedgerFile(), `${JSON.stringify(nextLedger, null, 2)}\n`, 'utf8');
    this.writeStatusFile({
      generatedAt: timestamp,
      ok: true,
      summary: `${sequence} chained event(s); latest ${record.event_type} on ${record.task_id}; chain ${record.chain_hash.slice(0, 10)}.`,
      totalEvents: sequence,
      latestEventType: record.event_type,
      latestTaskId: record.task_id,
      latestChainHash: record.chain_hash,
    });

    return this.describe();
  }

  public describe(): SecurityAuditTrailSnapshot {
    const ledger = this.readLedger();
    return {
      trailDir: this.trailDir,
      eventsFile: this.getEventsFile(),
      ledgerFile: this.getLedgerFile(),
      latestEventId: ledger?.latestEventId || null,
      totalEvents: Number(ledger?.totalEvents || 0),
      latestChainHash: ledger?.latestChainHash || null,
      latestEventType: ledger?.latestEventType || null,
      latestTaskId: ledger?.latestTaskId || null,
      latestTimestamp: ledger?.latestTimestamp || null,
    };
  }

  public recordFailure(error: unknown): void {
    const timestamp = this.now().toISOString();
    this.writeStatusFile({
      generatedAt: timestamp,
      ok: false,
      summary: `Failed to persist cryptographic audit trail: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  private buildCanonicalPayload(event: AuditEvent): Record<string, unknown> {
    return {
      timestamp: String(event.timestamp || '').trim(),
      event_type: String(event.event_type || '').trim(),
      task_id: String(event.task_id || '').trim(),
      user_id: String(event.user_id || '').trim(),
      intent: event.intent || null,
      plan_id: event.plan_id || null,
      risk_level: Math.max(0, Number(event.risk_level || 0)),
      policy_decision: String(event.policy_decision || 'ALLOWED').trim() || 'ALLOWED',
      operational_mode: String(event.operational_mode || '').trim(),
      executor: String(event.executor || '').trim() || null,
      execution_success:
        typeof event.execution_success === 'boolean' ? event.execution_success : null,
      user_input_hash: this.hash(String(event.user_input || '')),
      policy_violations_hash: this.hash(String(event.policy_violations || '')),
      execution_summary_hash: this.hash(String(event.execution_summary || '')),
      metadata_hash: this.hash(this.stableSerialize(event.metadata || {})),
    };
  }

  private readLedger(): SecurityAuditTrailLedger | null {
    if (!this.existsSync(this.getLedgerFile())) {
      return null;
    }

    try {
      return JSON.parse(this.readFileSync(this.getLedgerFile(), 'utf8')) as SecurityAuditTrailLedger;
    } catch {
      return null;
    }
  }

  private writeStatusFile(payload: Record<string, unknown>): void {
    const statusDir = path.dirname(this.statusFile);
    this.mkdirSync(statusDir, { recursive: true });
    this.writeFileSync(this.statusFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }

  private getEventsFile(): string {
    return path.join(this.trailDir, 'events.ndjson');
  }

  private getLedgerFile(): string {
    return path.join(this.trailDir, 'ledger.json');
  }

  private hash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private stableSerialize(value: unknown): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      return `[${value.map((entry) => this.stableSerialize(entry)).join(',')}]`;
    }

    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${this.stableSerialize(record[key])}`).join(',')}}`;
  }
}
