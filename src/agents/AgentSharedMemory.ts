import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger.js';export type SharedMemoryEntry = {
  id: string;
  key: string;
  value: string;
  sourceAgentId: string;
  targetAgentIds: string[];
  scope: 'private' | 'shared' | 'public';
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  approvalRequired: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
};

export type SharedMemoryConfig = {
  maxEntries?: number;
  maxEntrySize?: number;
  defaultScope?: SharedMemoryEntry['scope'];
  defaultExpirationMs?: number;
  requireApproval?: boolean;
};

export type SharedMemoryRuntime = {
  now?: () => Date;
  dataDir?: string;
  config?: SharedMemoryConfig;
  logger?: typeof logger;
};

const DEFAULT_CONFIG: Required<SharedMemoryConfig> = {
  maxEntries: 1000,
  maxEntrySize: 10000,
  defaultScope: 'shared',
  defaultExpirationMs: 24 * 60 * 60 * 1000,
  requireApproval: true,
};

export class AgentSharedMemory {
  private readonly now: () => Date;
  private readonly dataDir: string;
  private readonly configFile: string;
  private readonly memoryFile: string;
  private readonly config: Required<SharedMemoryConfig>;
  private readonly log: typeof logger;

  constructor(runtime: SharedMemoryRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.dataDir = runtime.dataDir || path.join(process.cwd(), 'data', 'runtime', 'shared-memory');
    this.configFile = path.join(this.dataDir, 'config.json');
    this.memoryFile = path.join(this.dataDir, 'memory.json');
    this.config = { ...DEFAULT_CONFIG, ...runtime.config };
    this.log = runtime.logger || logger;
  }

  public store(entry: Omit<SharedMemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'approvedBy' | 'approvedAt'>): SharedMemoryEntry {
    if (entry.value.length > this.config.maxEntrySize) {
      throw new Error(`Entry value exceeds max size of ${this.config.maxEntrySize} characters`);
    }

    const existing = this.readEntries();
    if (existing.length >= this.config.maxEntries) {
      this.cleanup();
      const afterCleanup = this.readEntries();
      if (afterCleanup.length >= this.config.maxEntries) {
        throw new Error(`Memory store is full (${this.config.maxEntries} entries)`);
      }
    }

    const fullEntry: SharedMemoryEntry = {
      ...entry,
      id: uuidv4(),
      createdAt: this.now().toISOString(),
      updatedAt: this.now().toISOString(),
      approvedBy: this.config.requireApproval ? null : 'system',
      approvedAt: this.config.requireApproval ? null : this.now().toISOString(),
    };

    const entries = this.readEntries();
    entries.push(fullEntry);
    this.writeEntries(entries);

    this.log.info(`[SharedMemory] Stored "${entry.key}" from ${entry.sourceAgentId} (scope: ${entry.scope})`);
    return fullEntry;
  }

  public retrieve(key: string, agentId: string): SharedMemoryEntry | null {
    const entries = this.readEntries();
    const entry = entries.find((e) => e.key === key);

    if (!entry) return null;

    if (entry.expiresAt && new Date(entry.expiresAt) < this.now()) {
      this.delete(entry.id);
      return null;
    }

    if (entry.scope === 'private' && entry.sourceAgentId !== agentId) {
      return null;
    }

    if (entry.scope === 'shared' && !entry.targetAgentIds.includes(agentId) && entry.sourceAgentId !== agentId) {
      return null;
    }

    if (entry.approvalRequired && !entry.approvedBy) {
      return null;
    }

    return entry;
  }

  public list(agentId: string, scope?: SharedMemoryEntry['scope']): SharedMemoryEntry[] {
    const entries = this.readEntries();
    return entries.filter((e) => {
      if (e.expiresAt && new Date(e.expiresAt) < this.now()) return false;
      if (scope && e.scope !== scope) return false;
      if (e.scope === 'private' && e.sourceAgentId !== agentId) return false;
      if (e.scope === 'shared' && !e.targetAgentIds.includes(agentId) && e.sourceAgentId !== agentId) return false;
      if (e.approvalRequired && !e.approvedBy) return false;
      return true;
    });
  }

  public approve(entryId: string, approvedBy: string): SharedMemoryEntry | null {
    const entries = this.readEntries();
    const entry = entries.find((e) => e.id === entryId);

    if (!entry) return null;
    if (entry.approvedBy) return entry;

    entry.approvedBy = approvedBy;
    entry.approvedAt = this.now().toISOString();
    entry.updatedAt = this.now().toISOString();

    this.writeEntries(entries);
    this.log.info(`[SharedMemory] Approved "${entry.key}" by ${approvedBy}`);
    return entry;
  }

  public delete(entryId: string): boolean {
    const entries = this.readEntries();
    const index = entries.findIndex((e) => e.id === entryId);

    if (index < 0) return false;

    entries.splice(index, 1);
    this.writeEntries(entries);
    return true;
  }

  public cleanup(): number {
    const entries = this.readEntries();
    const now = this.now();
    const valid = entries.filter((e) => {
      if (e.expiresAt && new Date(e.expiresAt) < now) return false;
      return true;
    });

    const removed = entries.length - valid.length;
    if (removed > 0) {
      this.writeEntries(valid);
      this.log.info(`[SharedMemory] Cleaned up ${removed} expired entries`);
    }

    return removed;
  }

  public getStats(): { total: number; approved: number; pending: number; expired: number } {
    const entries = this.readEntries();
    const now = this.now();
    let approved = 0;
    let pending = 0;
    let expired = 0;

    for (const entry of entries) {
      if (entry.expiresAt && new Date(entry.expiresAt) < now) {
        expired++;
      } else if (entry.approvedBy) {
        approved++;
      } else {
        pending++;
      }
    }

    return { total: entries.length, approved, pending, expired };
  }

  private readEntries(): SharedMemoryEntry[] {
    try {
      if (!fs.existsSync(this.memoryFile)) return [];
      return JSON.parse(fs.readFileSync(this.memoryFile, 'utf-8')) as SharedMemoryEntry[];
    } catch (error: unknown) {logger.warn('[Agent Shared Memory] JSON parse failed', error); return []; }
  }

  private writeEntries(entries: SharedMemoryEntry[]): void {
    fs.mkdirSync(path.dirname(this.memoryFile), { recursive: true });
    fs.writeFileSync(this.memoryFile, JSON.stringify(entries, null, 2), 'utf-8');
  }
}
