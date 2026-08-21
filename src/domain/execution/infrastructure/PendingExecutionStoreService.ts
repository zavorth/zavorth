import type {
  ZavorthBoundaryCorrelation,
  ExecutionIntent,
} from '../../../contracts/InternalBoundaryContract.js';
import type { ToolCategory } from '../../../tool-runtime/types/IZavorthTool.js';
import fs from 'fs';
import path from 'path';
import { logger } from '../../../logger.js';
export type EchoPendingExecutionKind = 'tool' | 'intent';

export type EchoPendingExecutionRecord = {
  permissionId: string;
  kind: EchoPendingExecutionKind;
  prompt: string;
  toolName: string | null;
  args: Record<string, any>;
  category?: ToolCategory;
  sessionId?: string | null;
  requestedAt: string;
  correlation: Partial<ZavorthBoundaryCorrelation> | null;
  intent: ExecutionIntent | null;
  metadata?: Record<string, unknown>;
};

export class EchoPendingExecutionStoreService {
  private readonly records = new Map<string, EchoPendingExecutionRecord>();
  private readonly filePath: string | null;

  constructor(options: { filePath?: string | null } = {}) {
    this.filePath = options.filePath ? path.resolve(options.filePath) : null;
    this.loadFromDisk();
  }

  public put(record: EchoPendingExecutionRecord): EchoPendingExecutionRecord {
    const normalized = this.cloneRecord(record);
    this.records.set(normalized.permissionId, normalized);
    this.persist();
    return this.cloneRecord(normalized);
  }

  public get(permissionId: string): EchoPendingExecutionRecord | null {
    const record = this.records.get(String(permissionId || '').trim());
    return record ? this.cloneRecord(record) : null;
  }

  public delete(permissionId: string): EchoPendingExecutionRecord | null {
    const key = String(permissionId || '').trim();
    const existing = this.records.get(key);
    if (!existing) {
      return null;
    }
    this.records.delete(key);
    this.persist();
    return this.cloneRecord(existing);
  }

  public list(): EchoPendingExecutionRecord[] {
    return Array.from(this.records.values()).map((record) => this.cloneRecord(record));
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value || {}));
  }

  private cloneRecord(record: EchoPendingExecutionRecord): EchoPendingExecutionRecord {
    return {
      ...record,
      toolName: record.toolName || null,
      args: this.clone(record.args || {}),
      sessionId: record.sessionId || null,
      correlation: record.correlation ? { ...record.correlation } : null,
      intent: record.intent
        ? {
            ...record.intent,
            metadata: this.clone(record.intent.metadata || {}),
            correlation: record.intent.correlation ? { ...record.intent.correlation } : null,
          }
        : null,
      metadata: this.clone(record.metadata || {}),
    };
  }

  private loadFromDisk(): void {
    if (!this.filePath || !fs.existsSync(this.filePath)) {
      return;
    }

    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      const records = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.records) ? parsed.records : [];
      for (const record of records) {
        if (!record || typeof record !== 'object') {
          continue;
        }
        const normalized = this.cloneRecord(record as EchoPendingExecutionRecord);
        if (normalized.permissionId) {
          this.records.set(normalized.permissionId, normalized);
        }
      }
    } catch (error: unknown) {this.records.clear();
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
        JSON.stringify({ records: this.list() }, null, 2),
        'utf8',
      );
    } catch (error: unknown) {// Persistence is best-effort; the in-memory boundary remains authoritative for this process.
      logger.warn('[Pending Execution Store] filesystem operation failed', error);
    }
  }
}

export { EchoPendingExecutionStoreService as PendingExecutionStoreService };
