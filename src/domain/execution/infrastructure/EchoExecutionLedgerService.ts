import type { EchoExecutionEntry } from '../../../echo/types/EchoTypes.js';
import fs from 'fs';
import path from 'path';
import { logger } from '../../../logger.js';type EchoExecutionLedgerOptions = {
  maxEntries?: number;
  filePath?: string | null;
};

export class EchoExecutionLedgerService {
  private readonly entries: EchoExecutionEntry[] = [];
  private readonly maxEntries: number;
  private readonly filePath: string | null;

  constructor(options: number | EchoExecutionLedgerOptions = 200) {
    if (typeof options === 'number') {
      this.maxEntries = options;
      this.filePath = null;
    } else {
      this.maxEntries = options.maxEntries || 200;
      this.filePath = options.filePath ? path.resolve(options.filePath) : null;
    }
    this.loadFromDisk();
  }

  public append(entry: EchoExecutionEntry): EchoExecutionEntry {
    const normalized = this.clone(entry);
    this.entries.push(normalized);
    if (this.entries.length > this.maxEntries) {
      this.entries.splice(0, this.entries.length - this.maxEntries);
    }
    this.persist();
    return this.clone(normalized);
  }

  public list(limit?: number): EchoExecutionEntry[] {
    const items = Number(limit || 0) > 0
      ? this.entries.slice(-Math.max(1, Math.min(Number(limit), this.maxEntries)))
      : this.entries.slice();
    return items.map((entry) => this.clone(entry));
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
  }

  private loadFromDisk(): void {
    if (!this.filePath || !fs.existsSync(this.filePath)) {
      return;
    }

    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      const records: unknown[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.entries) ? parsed.entries : [];
      this.entries.splice(
        0,
        this.entries.length,
        ...records.map((entry): EchoExecutionEntry => this.clone(entry as EchoExecutionEntry)).slice(-this.maxEntries),
      );
    } catch (error: unknown) {this.entries.splice(0, this.entries.length);
    }
  }

  private persist(): void {
    if (!this.filePath) {
      return;
    }

    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(
        this.filePath,
        JSON.stringify({ entries: this.entries.slice(-this.maxEntries) }, null, 2),
        'utf8',
      );
    } catch (error: unknown) {// Persistence is best-effort; callers still receive the in-process ledger.
      logger.warn('[Execution Ledger] filesystem operation failed', error);
    }
  }
}
