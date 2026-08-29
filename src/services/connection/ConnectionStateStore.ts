/**
 * Connection State Store.
 * Manages persistence for active connections and encrypted credentials in SQLite with in-memory fallback.
 *
 * Strict Clean Code: English-first, zero `any`, no rigid heuristics, fully typed.
 */

import * as crypto from 'node:crypto';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Database } from '../../storage/Database.js';
import { logger } from '../../logger.js';

export type ConnectionHealthStatus = 'healthy' | 'degraded' | 'expiring' | 'error' | 'unknown';

export interface StoredConnection {
  userId: string;
  targetId: string;
  displayName: string;
  authType: string;
  status: 'connected' | 'disconnected' | 'error' | 'expired';
  secretRef?: string;
  refreshTokenRef?: string;
  localPath?: string;
  expiresAt?: string;
  healthStatus?: ConnectionHealthStatus;
  connectedAt: string;
  updatedAt: string;
}

export class ConnectionStateStore {
  private static instance: ConnectionStateStore;
  private initialized = false;
  private inMemoryConnections = new Map<string, StoredConnection>();
  private inMemorySecrets = new Map<string, string>();

  public static getInstance(): ConnectionStateStore {
    if (!ConnectionStateStore.instance) {
      ConnectionStateStore.instance = new ConnectionStateStore();
    }
    return ConnectionStateStore.instance;
  }

  private getMasterSeed(): string {
    const keyPath = path.join(os.homedir(), '.zavorth', 'provider_master_key');
    try {
      if (!fs.existsSync(path.dirname(keyPath))) {
        fs.mkdirSync(path.dirname(keyPath), { recursive: true });
      }
      if (fs.existsSync(keyPath)) {
        return fs.readFileSync(keyPath, 'utf8').trim();
      }
      const newSeed = crypto.randomBytes(32).toString('hex');
      fs.writeFileSync(keyPath, newSeed, { mode: 0o600 });
      return newSeed;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[ConnectionStateStore] Failed to access master key at ${keyPath}: ${msg}`);
      throw new Error(`Master encryption key could not be accessed at ${keyPath}: ${msg}`);
    }
  }

  private deriveKey(salt: Buffer): Buffer {
    const seed = this.getMasterSeed();
    return crypto.pbkdf2Sync(seed, salt, 100000, 32, 'sha256');
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    try {
      const db = await Database.getInstance();
      db.run(`
        CREATE TABLE IF NOT EXISTS active_connections (
          user_id TEXT NOT NULL,
          target_id TEXT NOT NULL,
          display_name TEXT NOT NULL,
          auth_type TEXT NOT NULL,
          status TEXT NOT NULL,
          secret_ref TEXT,
          refresh_token_ref TEXT,
          local_path TEXT,
          expires_at TEXT,
          health_status TEXT,
          connected_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (user_id, target_id)
        );
      `);

      // Migration: guarantee columns exist if table was initialized previously
      try {
        const columns = db.all<{ name: string }>('PRAGMA table_info(active_connections)').map(c => c.name);
        if (!columns.includes('refresh_token_ref')) {
          db.run('ALTER TABLE active_connections ADD COLUMN refresh_token_ref TEXT;');
        }
        if (!columns.includes('expires_at')) {
          db.run('ALTER TABLE active_connections ADD COLUMN expires_at TEXT;');
        }
        if (!columns.includes('health_status')) {
          db.run('ALTER TABLE active_connections ADD COLUMN health_status TEXT;');
        }
      } catch {
        // Migration complete
      }

      db.run(`
        CREATE TABLE IF NOT EXISTS connection_secret_ciphertexts (
          secret_ref TEXT PRIMARY KEY,
          target_id TEXT NOT NULL,
          ciphertext TEXT NOT NULL,
          iv TEXT NOT NULL,
          auth_tag TEXT NOT NULL,
          salt TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);

      this.initialized = true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[ConnectionStateStore] SQLite table initialization fallback: ${msg}`);
      this.initialized = true;
    }
  }

  private makeKey(userId: string, targetId: string): string {
    return `${userId}:${targetId.toLowerCase()}`;
  }

  public async saveConnection(connection: StoredConnection): Promise<void> {
    await this.ensureInitialized();
    const key = this.makeKey(connection.userId, connection.targetId);
    this.inMemoryConnections.set(key, connection);

    try {
      const db = await Database.getInstance();
      db.run(
        `INSERT INTO active_connections (
           user_id, target_id, display_name, auth_type, status,
           secret_ref, refresh_token_ref, local_path, expires_at, health_status,
           connected_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, target_id) DO UPDATE SET
           display_name = excluded.display_name,
           auth_type = excluded.auth_type,
           status = excluded.status,
           secret_ref = excluded.secret_ref,
           refresh_token_ref = excluded.refresh_token_ref,
           local_path = excluded.local_path,
           expires_at = excluded.expires_at,
           health_status = excluded.health_status,
           updated_at = excluded.updated_at`,
        [
          connection.userId,
          connection.targetId.toLowerCase(),
          connection.displayName,
          connection.authType,
          connection.status,
          connection.secretRef || null,
          connection.refreshTokenRef || null,
          connection.localPath || null,
          connection.expiresAt || null,
          connection.healthStatus || 'healthy',
          connection.connectedAt,
          connection.updatedAt,
        ]
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.debug(`[ConnectionStateStore] SQLite write fallback: ${msg}`);
    }
  }

  public async getConnection(userId: string, targetId: string): Promise<StoredConnection | null> {
    await this.ensureInitialized();
    const key = this.makeKey(userId, targetId);

    try {
      const db = await Database.getInstance();
      const row = db.get<{
        user_id: string;
        target_id: string;
        display_name: string;
        auth_type: string;
        status: string;
        secret_ref: string | null;
        refresh_token_ref: string | null;
        local_path: string | null;
        expires_at: string | null;
        health_status: string | null;
        connected_at: string;
        updated_at: string;
      }>(
        `SELECT user_id, target_id, display_name, auth_type, status, secret_ref, refresh_token_ref, local_path, expires_at, health_status, connected_at, updated_at
         FROM active_connections WHERE user_id = ? AND target_id = ?`,
        [userId, targetId.toLowerCase()]
      );

      if (row) {
        return {
          userId: row.user_id,
          targetId: row.target_id,
          displayName: row.display_name,
          authType: row.auth_type,
          status: row.status as StoredConnection['status'],
          secretRef: row.secret_ref || undefined,
          refreshTokenRef: row.refresh_token_ref || undefined,
          localPath: row.local_path || undefined,
          expiresAt: row.expires_at || undefined,
          healthStatus: (row.health_status as ConnectionHealthStatus) || 'healthy',
          connectedAt: row.connected_at,
          updatedAt: row.updated_at,
        };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.debug(`[ConnectionStateStore] SQLite read fallback: ${msg}`);
    }

    return this.inMemoryConnections.get(key) || null;
  }

  public async listConnections(userId?: string): Promise<StoredConnection[]> {
    await this.ensureInitialized();

    try {
      const db = await Database.getInstance();
      const query = userId
        ? `SELECT user_id, target_id, display_name, auth_type, status, secret_ref, refresh_token_ref, local_path, expires_at, health_status, connected_at, updated_at
           FROM active_connections WHERE user_id = ?`
        : `SELECT user_id, target_id, display_name, auth_type, status, secret_ref, refresh_token_ref, local_path, expires_at, health_status, connected_at, updated_at
           FROM active_connections`;

      const params = userId ? [userId] : [];
      const rows = db.all<{
        user_id: string;
        target_id: string;
        display_name: string;
        auth_type: string;
        status: string;
        secret_ref: string | null;
        refresh_token_ref: string | null;
        local_path: string | null;
        expires_at: string | null;
        health_status: string | null;
        connected_at: string;
        updated_at: string;
      }>(query, params);

      if (rows && rows.length > 0) {
        return rows.map((row) => ({
          userId: row.user_id,
          targetId: row.target_id,
          displayName: row.display_name,
          authType: row.auth_type,
          status: row.status as StoredConnection['status'],
          secretRef: row.secret_ref || undefined,
          refreshTokenRef: row.refresh_token_ref || undefined,
          localPath: row.local_path || undefined,
          expiresAt: row.expires_at || undefined,
          healthStatus: (row.health_status as ConnectionHealthStatus) || 'healthy',
          connectedAt: row.connected_at,
          updatedAt: row.updated_at,
        }));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.debug(`[ConnectionStateStore] SQLite list fallback: ${msg}`);
    }

    if (!userId) {
      return Array.from(this.inMemoryConnections.values());
    }

    return Array.from(this.inMemoryConnections.values()).filter(c => c.userId === userId);
  }

  public async deleteConnection(userId: string, targetId: string): Promise<boolean> {
    await this.ensureInitialized();
    const key = this.makeKey(userId, targetId);
    const hadInMemory = this.inMemoryConnections.delete(key);

    try {
      const db = await Database.getInstance();
      db.run(
        `DELETE FROM active_connections WHERE user_id = ? AND target_id = ?`,
        [userId, targetId.toLowerCase()]
      );
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.debug(`[ConnectionStateStore] SQLite delete fallback: ${msg}`);
      return hadInMemory;
    }
  }

  /**
   * Encrypts and securely stores an integration secret (API key or OAuth token).
   */
  public async saveSecret(targetId: string, rawSecret: string): Promise<string> {
    await this.ensureInitialized();
    const secretRef = crypto.randomUUID();
    this.inMemorySecrets.set(secretRef, rawSecret);

    try {
      const salt = crypto.randomBytes(16);
      const iv = crypto.randomBytes(12);
      const key = this.deriveKey(salt);

      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      let ciphertext = cipher.update(rawSecret, 'utf8', 'hex');
      ciphertext += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');

      const db = await Database.getInstance();
      db.run(
        `INSERT INTO connection_secret_ciphertexts (secret_ref, target_id, ciphertext, iv, auth_tag, salt, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [secretRef, targetId.toLowerCase(), ciphertext, iv.toString('hex'), authTag, salt.toString('hex')]
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.debug(`[ConnectionStateStore] SQLite secret save fallback: ${msg}`);
    }

    return secretRef;
  }

  /**
   * Decrypts and retrieves an integration secret.
   */
  public async getSecret(secretRef: string): Promise<string | null> {
    await this.ensureInitialized();

    try {
      const db = await Database.getInstance();
      const row = db.get<{
        ciphertext: string;
        iv: string;
        auth_tag: string;
        salt: string;
      }>(
        `SELECT ciphertext, iv, auth_tag, salt FROM connection_secret_ciphertexts WHERE secret_ref = ?`,
        [secretRef]
      );

      if (row) {
        const salt = Buffer.from(row.salt, 'hex');
        const iv = Buffer.from(row.iv, 'hex');
        const authTag = Buffer.from(row.auth_tag, 'hex');
        const key = this.deriveKey(salt);

        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(row.ciphertext, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.debug(`[ConnectionStateStore] SQLite secret read fallback: ${msg}`);
    }

    return this.inMemorySecrets.get(secretRef) || null;
  }

  /**
   * Securely purges an integration secret.
   */
  public async deleteSecret(secretRef: string): Promise<boolean> {
    await this.ensureInitialized();
    const hadInMemory = this.inMemorySecrets.delete(secretRef);

    try {
      const db = await Database.getInstance();
      db.run(`DELETE FROM connection_secret_ciphertexts WHERE secret_ref = ?`, [secretRef]);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.debug(`[ConnectionStateStore] SQLite secret delete fallback: ${msg}`);
      return hadInMemory;
    }
  }
}
