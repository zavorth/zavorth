/**
 * Connection Handshake Lock Manager.
 * Manages concurrency limits, idempotency locks, and in-flight handshake aborts
 * across all Zavorth surfaces and execution contexts.
 *
 * Strict Clean Code: English-first, zero `any`, no rigid heuristics, fully typed.
 */

import * as crypto from 'node:crypto';
import { Database } from '../../storage/Database.js';
import { logger } from '../../logger.js';

export interface HandshakeLockRecord {
  userId: string;
  target: string;
  sessionId: string;
  createdAt: number;
  expiresAt: number;
  status: 'active' | 'completed' | 'aborted' | 'expired';
}

export interface LockAcquireResult {
  acquired: boolean;
  sessionId?: string;
  error?: string;
}

export class ConnectionLockManager {
  private static instance: ConnectionLockManager;
  private initialized = false;
  private readonly maxGlobalConcurrent = 5;
  private readonly defaultTtlMs = 120000; // 2 minutes

  // In-memory registry of active abort controllers for immediate cancellation
  private readonly activeAbortControllers = new Map<string, AbortController>();
  private readonly inMemoryLocks = new Map<string, HandshakeLockRecord>();

  public static getInstance(): ConnectionLockManager {
    if (!ConnectionLockManager.instance) {
      ConnectionLockManager.instance = new ConnectionLockManager();
    }
    return ConnectionLockManager.instance;
  }

  private makeKey(userId: string, target: string): string {
    return `${userId}:${target.toLowerCase()}`;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    try {
      const db = await Database.getInstance();
      db.run(`
        CREATE TABLE IF NOT EXISTS connection_handshake_locks (
          user_id TEXT NOT NULL,
          target TEXT NOT NULL,
          session_id TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'aborted', 'expired')),
          PRIMARY KEY (user_id, target)
        );
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_conn_locks_expires 
        ON connection_handshake_locks (expires_at);
      `);

      this.initialized = true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[ConnectionLockManager] SQLite lock table initialization fallback: ${msg}`);
      this.initialized = true;
    }
  }

  /**
   * Cleans up expired locks from storage.
   */
  private async purgeExpiredLocks(): Promise<void> {
    const now = Date.now();

    // Clean in-memory locks
    for (const [key, lock] of this.inMemoryLocks.entries()) {
      if (lock.expiresAt <= now || lock.status !== 'active') {
        this.inMemoryLocks.delete(key);
        this.activeAbortControllers.delete(key);
      }
    }

    try {
      const db = await Database.getInstance();
      db.run(`DELETE FROM connection_handshake_locks WHERE expires_at <= ? OR status != 'active'`, [now]);
    } catch (err: unknown) {
      logger.debug(`[ConnectionLockManager] SQLite purge fallback: ${String(err)}`);
    }
  }

  /**
   * Attempts to acquire a concurrency lock for a user and target.
   */
  public async acquireLock(
    userId: string,
    target: string,
    ttlMs: number = this.defaultTtlMs
  ): Promise<LockAcquireResult> {
    await this.ensureInitialized();
    await this.purgeExpiredLocks();

    const normalizedTarget = target.toLowerCase();
    const key = this.makeKey(userId, normalizedTarget);
    const now = Date.now();

    // Check global concurrency ceiling
    let activeGlobalCount = 0;
    for (const lock of this.inMemoryLocks.values()) {
      if (lock.status === 'active' && lock.expiresAt > now) {
        activeGlobalCount++;
      }
    }

    if (activeGlobalCount >= this.maxGlobalConcurrent) {
      return {
        acquired: false,
        error: `Global connection handshake limit reached (${this.maxGlobalConcurrent}). Please wait a few seconds and try again.`,
      };
    }

    // Check existing lock for this user and target
    const existing = this.inMemoryLocks.get(key);
    if (existing && existing.status === 'active' && existing.expiresAt > now) {
      return {
        acquired: false,
        error: `A connection handshake is already in progress for '${target}'. Use '/disconnect ${target}' to abort.`,
      };
    }

    try {
      const db = await Database.getInstance();
      const row = db.get<{ status: string; expires_at: number }>(
        `SELECT status, expires_at FROM connection_handshake_locks WHERE user_id = ? AND target = ?`,
        [userId, normalizedTarget]
      );

      if (row && row.status === 'active' && row.expires_at > now) {
        return {
          acquired: false,
          error: `A connection handshake is already in progress for '${target}'. Use '/disconnect ${target}' to abort.`,
        };
      }
    } catch (err: unknown) {
      logger.debug(`[ConnectionLockManager] SQLite query fallback: ${String(err)}`);
    }

    const sessionId = crypto.randomUUID();
    const expiresAt = now + ttlMs;
    const record: HandshakeLockRecord = {
      userId,
      target: normalizedTarget,
      sessionId,
      createdAt: now,
      expiresAt,
      status: 'active',
    };

    this.inMemoryLocks.set(key, record);
    this.activeAbortControllers.set(key, new AbortController());

    try {
      const db = await Database.getInstance();
      db.run(
        `INSERT INTO connection_handshake_locks (user_id, target, session_id, created_at, expires_at, status)
         VALUES (?, ?, ?, ?, ?, 'active')
         ON CONFLICT(user_id, target) DO UPDATE SET
           session_id = excluded.session_id,
           created_at = excluded.created_at,
           expires_at = excluded.expires_at,
           status = 'active'`,
        [userId, normalizedTarget, sessionId, now, expiresAt]
      );
    } catch (err: unknown) {
      logger.debug(`[ConnectionLockManager] SQLite persist fallback: ${String(err)}`);
    }

    return {
      acquired: true,
      sessionId,
    };
  }

  /**
   * Retrieves the AbortSignal associated with an active lock for cancellation propagation.
   */
  public getAbortSignal(userId: string, target: string): AbortSignal | null {
    const key = this.makeKey(userId, target);
    return this.activeAbortControllers.get(key)?.signal || null;
  }

  /**
   * Releases an active lock upon successful completion.
   */
  public async releaseLock(
    userId: string,
    target: string,
    finalStatus: 'completed' | 'aborted' = 'completed'
  ): Promise<void> {
    await this.ensureInitialized();
    const normalizedTarget = target.toLowerCase();
    const key = this.makeKey(userId, normalizedTarget);

    this.inMemoryLocks.delete(key);
    this.activeAbortControllers.delete(key);

    try {
      const db = await Database.getInstance();
      db.run(`DELETE FROM connection_handshake_locks WHERE user_id = ? AND target = ?`, [userId, normalizedTarget]);
    } catch (err: unknown) {
      logger.debug(`[ConnectionLockManager] SQLite release fallback: ${String(err)}`);
    }
  }

  /**
   * Aborts an in-flight handshake immediately (invoked when /disconnect is called).
   */
  public async abortInFlight(userId: string, target: string): Promise<boolean> {
    await this.ensureInitialized();
    const normalizedTarget = target.toLowerCase();
    const key = this.makeKey(userId, normalizedTarget);

    const controller = this.activeAbortControllers.get(key);
    if (controller) {
      controller.abort();
      this.activeAbortControllers.delete(key);
    }

    const hadLock = this.inMemoryLocks.has(key);
    this.inMemoryLocks.delete(key);

    try {
      const db = await Database.getInstance();
      db.run(
        `DELETE FROM connection_handshake_locks WHERE user_id = ? AND target = ?`,
        [userId, normalizedTarget]
      );
      return hadLock;
    } catch (err: unknown) {
      logger.debug(`[ConnectionLockManager] SQLite abort fallback: ${String(err)}`);
      return hadLock;
    }
  }
}
