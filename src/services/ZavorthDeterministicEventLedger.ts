import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type ZavorthLedgerEventPayload = unknown;

export type ZavorthLedgerEventRecord = {
  sessionId: string;
  sequenceNumber: number;
  eventType: string;
  actorId: string;
  payload: ZavorthLedgerEventPayload;
  previousHash: string;
  hash: string;
  recordedAt: string;
};

export type ZavorthLedgerRecordResult = {
  sequenceNumber: number;
  hash: string;
  previousHash: string;
};

export type ZavorthLedgerIntegrityResult = {
  valid: boolean;
};

const GENESIS_HASH = '0'.repeat(64);
const HASH_SEPARATOR = '|';

export class ZavorthDeterministicEventLedger {
  private readonly sessionId: string;
  private readonly ledgerPath: string | undefined;
  private corruptedFile = false;
  private events: ZavorthLedgerEventRecord[] = [];

  constructor(storageDir: string | undefined, sessionId: string) {
    this.sessionId = sessionId;
    if (storageDir) {
      fs.mkdirSync(storageDir, { recursive: true });
      this.ledgerPath = path.join(storageDir, `${sanitizeFileName(sessionId)}.jsonl`);
      this.events = this.loadEvents();
    }
  }

  public recordEvent(eventType: string, actorId: string, payload: ZavorthLedgerEventPayload = undefined): ZavorthLedgerRecordResult {
    const sequenceNumber = this.events.length + 1;
    const previousHash = this.events.length > 0
      ? this.events[this.events.length - 1].hash
      : GENESIS_HASH;
    const event: ZavorthLedgerEventRecord = {
      sessionId: this.sessionId,
      sequenceNumber,
      eventType,
      actorId,
      payload,
      previousHash,
      hash: this.computeEventHash(previousHash, sequenceNumber, eventType, actorId, payload),
      recordedAt: new Date().toISOString(),
    };
    this.events.push(event);
    if (this.ledgerPath) {
      fs.appendFileSync(this.ledgerPath, `${JSON.stringify(event)}\n`);
    }
    return {
      sequenceNumber: event.sequenceNumber,
      hash: event.hash,
      previousHash: event.previousHash,
    };
  }

  public verifyIntegrity(): ZavorthLedgerIntegrityResult {
    const events = this.ledgerPath ? this.loadEvents() : this.events;
    if (this.corruptedFile) {
      return { valid: false };
    }
    let previousHash = GENESIS_HASH;
    for (const event of events) {
      if (event.previousHash !== previousHash) {
        return { valid: false };
      }
      const expectedHash = this.computeEventHash(
        event.previousHash,
        event.sequenceNumber,
        event.eventType,
        event.actorId,
        event.payload,
      );
      if (event.hash !== expectedHash) {
        return { valid: false };
      }
      previousHash = event.hash;
    }
    return { valid: true };
  }

  private computeEventHash(
    previousHash: string,
    sequenceNumber: number,
    eventType: string,
    actorId: string,
    payload: ZavorthLedgerEventPayload,
  ): string {
    const material = [
      previousHash,
      String(sequenceNumber),
      eventType,
      actorId,
      JSON.stringify(payload),
    ].join(HASH_SEPARATOR);
    return createHash('sha256').update(material).digest('hex');
  }

  private loadEvents(): ZavorthLedgerEventRecord[] {
    if (!this.ledgerPath || !fs.existsSync(this.ledgerPath)) {
      return [];
    }
    const lines = fs.readFileSync(this.ledgerPath, 'utf8').split('\n');
    const events: ZavorthLedgerEventRecord[] = [];
    for (const line of lines) {
      if (line.trim().length === 0) {
        continue;
      }
      try {
        events.push(JSON.parse(line) as ZavorthLedgerEventRecord);
      } catch {
        this.corruptedFile = true;
      }
    }
    return events;
  }
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, '_');
}
