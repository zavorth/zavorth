import type { EchoExecutionEntry } from '../../../echo/types/EchoTypes.js';

/**
 * Small compatibility ledger used only by standalone Echo flows that still
 * expect an in-memory execution log from the orchestrator.
 */
export class EchoCompatibilityExecutionLogService {
  private readonly entries: EchoExecutionEntry[] = [];

  constructor(private readonly maxEntries = 100) {}

  public append(entry: EchoExecutionEntry): EchoExecutionEntry {
    const normalized = this.clone(entry);
    this.entries.push(normalized);
    if (this.entries.length > this.maxEntries) {
      this.entries.splice(0, this.entries.length - this.maxEntries);
    }
    return this.clone(normalized);
  }

  public list(limit?: number): EchoExecutionEntry[] {
    const safeLimit = Number(limit || 0);
    const items = safeLimit > 0
      ? this.entries.slice(-Math.max(1, Math.min(safeLimit, this.maxEntries)))
      : this.entries.slice();
    return items.map((entry) => this.clone(entry));
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
  }
}
