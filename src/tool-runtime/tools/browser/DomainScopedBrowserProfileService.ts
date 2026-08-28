import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import DatabaseLib, { type Database as SQLiteDatabase } from 'better-sqlite3';
import { logger } from '../../../logger.js';
import type { BrowserProfileCandidate } from './BrowserProfileResolverContract.js';

export interface DomainScopedSnapshotResult {
  snapshotDir: string;
  profileDir: string;
  cookiesDbPath: string;
  loginDataDbPath: string;
  purgedCookiesCount: number;
  retainedCookiesCount: number;
  allowedDomains: string[];
}

export interface DomainScopedSnapshotOptions {
  allowedDomains?: string[];
  includeLoginData?: boolean;
  baseTempDir?: string;
}

export class DomainScopedBrowserProfileService {
  private static readonly VAULT_PREFIX = 'zavorth-vault-';

  public async createDomainScopedSnapshot(
    candidate: BrowserProfileCandidate,
    options?: DomainScopedSnapshotOptions,
  ): Promise<DomainScopedSnapshotResult> {
    if (!candidate.exists) {
      throw new Error(`Cannot create snapshot from non-existent browser profile: ${candidate.profileDir}`);
    }

    const baseTemp = options?.baseTempDir || os.tmpdir();
    const vaultId = `${DomainScopedBrowserProfileService.VAULT_PREFIX}${randomUUID()}`;
    const snapshotDir = path.join(baseTemp, vaultId);

    fs.mkdirSync(snapshotDir, { recursive: true, mode: 0o700 });

    const targetProfileDir = path.join(snapshotDir, candidate.profileName);
    const targetNetworkDir = path.join(targetProfileDir, 'Network');
    fs.mkdirSync(targetNetworkDir, { recursive: true, mode: 0o700 });

    if (candidate.localStatePath && fs.existsSync(candidate.localStatePath)) {
      const targetLocalState = path.join(snapshotDir, 'Local State');
      this.copyFileWithSharedRead(candidate.localStatePath, targetLocalState);
    }

    let targetCookiesPath = path.join(targetNetworkDir, 'Cookies');
    let sourceCookiesPath = candidate.cookiesDbPath;

    if (!sourceCookiesPath || !fs.existsSync(sourceCookiesPath)) {
      const altCookies = path.join(candidate.profileDir, 'Cookies');
      if (fs.existsSync(altCookies)) {
        sourceCookiesPath = altCookies;
        targetCookiesPath = path.join(targetProfileDir, 'Cookies');
      } else {
        const netCookies = path.join(candidate.profileDir, 'Network', 'Cookies');
        if (fs.existsSync(netCookies)) {
          sourceCookiesPath = netCookies;
          targetCookiesPath = path.join(targetNetworkDir, 'Cookies');
        }
      }
    }

    let purgedCookiesCount = 0;
    let retainedCookiesCount = 0;

    if (sourceCookiesPath && fs.existsSync(sourceCookiesPath)) {
      this.copySqliteDatabaseWithWal(sourceCookiesPath, targetCookiesPath);
      this.verifySqliteIntegrity(targetCookiesPath);

      const purgeStats = this.purgeCookiesOutsideDomains(targetCookiesPath, options?.allowedDomains || []);
      purgedCookiesCount = purgeStats.purged;
      retainedCookiesCount = purgeStats.retained;
    }

    const targetLoginDataPath = path.join(targetProfileDir, 'Login Data');
    if (options?.includeLoginData && candidate.loginDataDbPath && fs.existsSync(candidate.loginDataDbPath)) {
      this.copySqliteDatabaseWithWal(candidate.loginDataDbPath, targetLoginDataPath);
    }

    return {
      snapshotDir,
      profileDir: targetProfileDir,
      cookiesDbPath: targetCookiesPath,
      loginDataDbPath: targetLoginDataPath,
      purgedCookiesCount,
      retainedCookiesCount,
      allowedDomains: options?.allowedDomains || [],
    };
  }

  public async disposeSnapshot(snapshotDir: string): Promise<boolean> {
    if (!snapshotDir || typeof snapshotDir !== 'string') {
      return false;
    }

    const resolved = path.resolve(snapshotDir);
    const baseTemp = path.resolve(os.tmpdir());

    if (!resolved.startsWith(baseTemp) || !path.basename(resolved).startsWith(DomainScopedBrowserProfileService.VAULT_PREFIX)) {
      logger.warn(`Refusing to dispose directory outside vault boundaries: ${resolved}`);
      return false;
    }

    try {
      if (fs.existsSync(resolved)) {
        fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      }
      return !fs.existsSync(resolved);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`Failed to cleanly dispose ephemeral browser vault: ${resolved}: ${message}`);
      return false;
    }
  }

  public purgeCookiesOutsideDomains(
    sqlitePath: string,
    allowedDomains: string[],
  ): { purged: number; retained: number } {
    if (!sqlitePath || !fs.existsSync(sqlitePath)) {
      return { purged: 0, retained: 0 };
    }

    if (!allowedDomains || allowedDomains.length === 0) {
      const db = new DatabaseLib(sqlitePath);
      try {
        const countRow = db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='cookies'").get() as { count: number } | undefined;
        if (!countRow || countRow.count === 0) {
          return { purged: 0, retained: 0 };
        }
        const totalRow = db.prepare('SELECT count(*) as count FROM cookies').get() as { count: number } | undefined;
        return { purged: 0, retained: totalRow?.count || 0 };
      } finally {
        db.close();
      }
    }

    const normalizedPatterns: string[] = [];
    for (const domain of allowedDomains) {
      let clean = domain.trim().toLowerCase();
      if (clean.startsWith('*.')) {
        clean = clean.slice(2);
      } else if (clean.startsWith('.')) {
        clean = clean.slice(1);
      }
      if (clean) {
        normalizedPatterns.push(`%${clean}%`);
      }
    }

    if (normalizedPatterns.length === 0) {
      return { purged: 0, retained: 0 };
    }

    const db: SQLiteDatabase = new DatabaseLib(sqlitePath);
    try {
      const countTable = db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='cookies'").get() as { count: number } | undefined;
      if (!countTable || countTable.count === 0) {
        return { purged: 0, retained: 0 };
      }

      const beforeRow = db.prepare('SELECT count(*) as count FROM cookies').get() as { count: number } | undefined;
      const initialCount = beforeRow?.count || 0;

      const placeholders = normalizedPatterns.map(() => 'host_key NOT LIKE ?').join(' AND ');
      const deleteStmt = db.prepare(`DELETE FROM cookies WHERE ${placeholders}`);
      const info = deleteStmt.run(...normalizedPatterns);

      db.exec('VACUUM;');

      const afterRow = db.prepare('SELECT count(*) as count FROM cookies').get() as { count: number } | undefined;
      const finalCount = afterRow?.count || 0;

      return {
        purged: info.changes || (initialCount - finalCount),
        retained: finalCount,
      };
    } finally {
      db.close();
    }
  }

  public copySqliteDatabaseWithWal(sourceDbPath: string, targetDbPath: string): void {
    this.copyFileWithSharedRead(sourceDbPath, targetDbPath);

    const walSource = `${sourceDbPath}-wal`;
    const shmSource = `${sourceDbPath}-shm`;
    const walTarget = `${targetDbPath}-wal`;
    const shmTarget = `${targetDbPath}-shm`;

    if (fs.existsSync(walSource)) {
      this.copyFileWithSharedRead(walSource, walTarget);
    }
    if (fs.existsSync(shmSource)) {
      this.copyFileWithSharedRead(shmSource, shmTarget);
    }
  }

  public copyFileWithSharedRead(sourcePath: string, targetPath: string): void {
    let sourceFd: number | null = null;
    let targetFd: number | null = null;

    try {
      sourceFd = fs.openSync(sourcePath, 'r');
      targetFd = fs.openSync(targetPath, 'w');

      const bufferSize = 64 * 1024;
      const buffer = Buffer.alloc(bufferSize);
      let bytesRead = 0;

      while ((bytesRead = fs.readSync(sourceFd, buffer, 0, bufferSize, null)) > 0) {
        fs.writeSync(targetFd, buffer, 0, bytesRead);
      }
    } finally {
      if (sourceFd !== null) {
        try { fs.closeSync(sourceFd); } catch { /* ignore close error */ }
      }
      if (targetFd !== null) {
        try { fs.closeSync(targetFd); } catch { /* ignore close error */ }
      }
    }
  }

  private verifySqliteIntegrity(sqlitePath: string): void {
    try {
      const db = new DatabaseLib(sqlitePath, { readonly: true });
      try {
        const check = db.prepare('PRAGMA integrity_check').get() as { integrity_check?: string } | undefined;
        if (check?.integrity_check && check.integrity_check.toLowerCase() !== 'ok') {
          logger.warn(`Integrity check warning on copied database ${sqlitePath}: ${check.integrity_check}`);
        }
      } finally {
        db.close();
      }
    } catch (err) {
      logger.warn(`Could not verify SQLite integrity for ${sqlitePath}`, err);
    }
  }
}
