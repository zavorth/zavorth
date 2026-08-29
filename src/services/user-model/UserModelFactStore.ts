import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import {
  type UserModelFact,
  type UserModelFactStatus,
  type UserModelLifecycleEvent,
  userModelFactSchema,
  userModelLifecycleEventSchema,
} from '../../contracts/user-model/UserModelFactContract.js';
import { logger } from '../../logger.js';

const snapshotSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string(),
  lastProcessedTurnId: z.string().nullable().optional(),
  processedTurnIds: z.array(z.string()).default([]),
  facts: z.array(userModelFactSchema),
});

export type UserModelFactStoreSnapshot = z.infer<typeof snapshotSchema>;

export type FactStoreFilter = {
  status?: UserModelFactStatus;
  surface?: string;
  category?: string;
};

export type FactStoreDeps = {
  dataDir?: string;
  now?: () => Date;
  lockTimeoutMs?: number;
};

export class UserModelFactStore {
  private readonly dataDir: string;
  private readonly now: () => Date;
  private readonly lockTimeoutMs: number;
  private readonly factsLogPath: string;
  private readonly snapshotPath: string;
  private readonly eventsLogPath: string;
  private readonly lockPath: string;

  private factsById = new Map<string, UserModelFact>();
  private processedTurnIds = new Set<string>();
  private lastProcessedTurnId: string | null = null;
  private isInitialized = false;

  public constructor(deps: FactStoreDeps = {}) {
    this.now = deps.now || (() => new Date());
    this.lockTimeoutMs = deps.lockTimeoutMs || 3000;
    this.dataDir = deps.dataDir || path.join(process.cwd(), 'data', 'runtime', 'user-model');
    this.factsLogPath = path.join(this.dataDir, 'facts.log');
    this.snapshotPath = path.join(this.dataDir, 'facts.snapshot.json');
    this.eventsLogPath = path.join(this.dataDir, 'events.log');
    this.lockPath = path.join(this.dataDir, 'facts.lock');
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    if (fs.existsSync(this.snapshotPath)) {
      try {
        const raw = fs.readFileSync(this.snapshotPath, 'utf8');
        const parsed = JSON.parse(raw) as unknown;
        const validated = snapshotSchema.parse(parsed);

        this.factsById.clear();
        for (const fact of validated.facts) {
          this.factsById.set(fact.id, fact);
        }
        this.processedTurnIds = new Set(validated.processedTurnIds);
        this.lastProcessedTurnId = validated.lastProcessedTurnId ?? null;
        this.isInitialized = true;
        return;
      } catch (err: unknown) {
        logger.warn('Corrupted or invalid snapshot detected, rebuilding from facts.log', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await this.rebuildSnapshotFromLog();
    this.isInitialized = true;
  }

  public async saveFact(fact: UserModelFact): Promise<UserModelFact> {
    await this.ensureInitialized();
    const validated = userModelFactSchema.parse(fact);

    return this.withFileLock(async () => {
      const line = JSON.stringify(validated) + '\n';
      fs.appendFileSync(this.factsLogPath, line, 'utf8');

      this.factsById.set(validated.id, validated);
      await this.persistSnapshotUnderLock();
      return validated;
    });
  }

  public async getFactById(id: string): Promise<UserModelFact | null> {
    await this.ensureInitialized();
    return this.factsById.get(id) || null;
  }

  public async listFactsByUserId(userId: string, filter?: FactStoreFilter): Promise<UserModelFact[]> {
    await this.ensureInitialized();
    const results: UserModelFact[] = [];

    for (const fact of this.factsById.values()) {
      if (fact.userId !== userId) continue;
      if (filter?.status && fact.status !== filter.status) continue;
      if (filter?.category && fact.category !== filter.category) continue;
      if (filter?.surface && fact.surface !== null && fact.surface !== filter.surface) continue;
      results.push(fact);
    }

    return results;
  }

  public listFactsByUserIdSync(userId: string, filter?: FactStoreFilter): UserModelFact[] {
    if (!this.isInitialized && fs.existsSync(this.snapshotPath)) {
      try {
        const raw = fs.readFileSync(this.snapshotPath, 'utf8');
        const parsed = JSON.parse(raw) as unknown;
        const validated = snapshotSchema.parse(parsed);
        this.factsById.clear();
        for (const fact of validated.facts) {
          this.factsById.set(fact.id, fact);
        }
        this.processedTurnIds = new Set(validated.processedTurnIds);
        this.isInitialized = true;
      } catch {
        // Safe fallback
      }
    }

    const results: UserModelFact[] = [];
    for (const fact of this.factsById.values()) {
      if (fact.userId !== userId) continue;
      if (filter?.status && fact.status !== filter.status) continue;
      if (filter?.category && fact.category !== filter.category) continue;
      if (filter?.surface && fact.surface !== null && fact.surface !== filter.surface) continue;
      results.push(fact);
    }

    return results;
  }

  public async recordLifecycleEvent(event: UserModelLifecycleEvent): Promise<void> {
    await this.ensureInitialized();
    const validated = userModelLifecycleEventSchema.parse(event);
    const line = JSON.stringify(validated) + '\n';
    fs.appendFileSync(this.eventsLogPath, line, 'utf8');
  }

  public isTurnProcessed(turnId: string): boolean {
    return this.processedTurnIds.has(turnId);
  }

  public async markTurnProcessed(turnId: string): Promise<void> {
    await this.ensureInitialized();
    if (this.processedTurnIds.has(turnId)) return;

    await this.withFileLock(async () => {
      this.processedTurnIds.add(turnId);
      this.lastProcessedTurnId = turnId;

      if (this.processedTurnIds.size > 2000) {
        const turnList = Array.from(this.processedTurnIds);
        this.processedTurnIds = new Set(turnList.slice(turnList.length - 1000));
      }

      await this.persistSnapshotUnderLock();
    });
  }

  public async rebuildSnapshotFromLog(): Promise<void> {
    await this.withFileLock(async () => {
      const reconstructed = new Map<string, UserModelFact>();

      if (fs.existsSync(this.factsLogPath)) {
        const content = fs.readFileSync(this.factsLogPath, 'utf8');
        const lines = content.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const parsed = JSON.parse(trimmed) as unknown;
            const fact = userModelFactSchema.parse(parsed);
            const existing = reconstructed.get(fact.id);

            if (!existing || fact.version >= existing.version) {
              reconstructed.set(fact.id, fact);
            }
          } catch (err: unknown) {
            logger.warn('Skipping corrupted line during rebuildSnapshotFromLog', {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }

      this.factsById = reconstructed;
      await this.persistSnapshotUnderLock();
    });
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  private async persistSnapshotUnderLock(): Promise<void> {
    const snapshot: UserModelFactStoreSnapshot = {
      version: 1,
      updatedAt: this.now().toISOString(),
      lastProcessedTurnId: this.lastProcessedTurnId,
      processedTurnIds: Array.from(this.processedTurnIds),
      facts: Array.from(this.factsById.values()),
    };

    const validated = snapshotSchema.parse(snapshot);
    const serialized = JSON.stringify(validated, null, 2);
    const tempPath = path.join(this.dataDir, `facts.snapshot.json.tmp.${crypto.randomUUID()}`);

    fs.writeFileSync(tempPath, serialized, 'utf8');
    fs.renameSync(tempPath, this.snapshotPath);
  }

  private async withFileLock<T>(action: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    let lockFd: number | null = null;

    while (Date.now() - startTime < this.lockTimeoutMs) {
      try {
        lockFd = fs.openSync(this.lockPath, 'wx');
        fs.writeFileSync(lockFd, JSON.stringify({ pid: process.pid, lockedAt: Date.now() }));
        break;
      } catch (err: unknown) {
        const error = err as { code?: string };
        if (error.code === 'EEXIST') {
          try {
            const stat = fs.statSync(this.lockPath);
            if (Date.now() - stat.mtimeMs > 10000) {
              fs.unlinkSync(this.lockPath);
              continue;
            }
          } catch {
            // Stat or unlink collision, will retry
          }
          await this.sleep(30);
          continue;
        }
        throw err;
      }
    }

    if (lockFd === null) {
      throw new Error(`UserModelFactStore lock timeout exceeded (${this.lockTimeoutMs}ms)`);
    }

    try {
      return await action();
    } finally {
      try {
        fs.closeSync(lockFd);
      } catch {
        // Safe to ignore if closed
      }
      try {
        if (fs.existsSync(this.lockPath)) {
          fs.unlinkSync(this.lockPath);
        }
      } catch {
        // Safe to ignore if already cleaned
      }
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
