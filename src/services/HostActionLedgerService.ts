import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type { SystemOverlordActionRecord } from '../contracts/SystemOverlordContract.js';
import { logger } from '../logger.js';

export class HostActionLedgerService {
  private readonly ledgerFile: string;

  constructor(options: { ledgerFile?: string | null } = {}) {
    this.ledgerFile = options.ledgerFile || path.join(config.projectRoot, 'data', 'runtime', 'host-actions-ledger.jsonl');
  }

  public record(record: SystemOverlordActionRecord): SystemOverlordActionRecord {
    fs.mkdirSync(path.dirname(this.ledgerFile), { recursive: true });
    fs.appendFileSync(this.ledgerFile, `${JSON.stringify(record)}\n`, 'utf8');
    return record;
  }

  public list(limit: number = 50): SystemOverlordActionRecord[] {
    if (!fs.existsSync(this.ledgerFile)) {
      return [];
    }
    const lines = fs.readFileSync(this.ledgerFile, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    return lines
      .slice(-Math.max(1, limit))
      .map((line) => this.safeParse(line))
      .filter((entry): entry is SystemOverlordActionRecord => Boolean(entry))
      .reverse();
  }

  public find(actionId: string): SystemOverlordActionRecord | null {
    const normalized = String(actionId || '').trim();
    if (!normalized) {
      return null;
    }
    return this.list(500).find((entry) => entry.actionId === normalized) || null;
  }

  private safeParse(line: string): SystemOverlordActionRecord | null {
    try {
      return JSON.parse(line) as SystemOverlordActionRecord;
    } catch (error: unknown) {logger.warn('[Host Action Ledger] JSON parse failed', error); return null; }
  }
}
