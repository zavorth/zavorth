import { logger } from '../logger.js';
import DatabaseLib, { Database as SQLiteDatabase } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'node:crypto';
import { config } from '../config/index.js';
import { asErrorLike } from '../utils/errorLike.js';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

interface SqliteDriver {
  new (filename: string): SQLiteDatabase;
}

function getDatabaseKey(): Buffer | null {
  const rawKey = String(config.dbEncryptionKey || '').trim();
  let baseKey: string | Buffer | null = rawKey;
  if (!rawKey) {
    baseKey = getOrCreateFileKey();
  }
  if (!baseKey) {
    return null;
  }
  const keyBuffer = crypto.createHash('sha256').update(baseKey).digest();
  return crypto.createHash('sha256').update(Buffer.concat([keyBuffer, Buffer.from(':zavorth-db-cipher')])).digest();
}

function getOrCreateFileKey(): string | null {
  const keyFile = String(config.dbEncryptionKeyFile || '').trim();
  if (!keyFile) {
    return null;
  }
  try {
    if (!fs.existsSync(keyFile)) {
      fs.mkdirSync(path.dirname(keyFile), { recursive: true });
      const generated = crypto.randomBytes(32).toString('base64');
      fs.writeFileSync(keyFile, generated, 'utf8');
      return generated;
    }
    return fs.readFileSync(keyFile, 'utf8').trim() || null;
  } catch (error: unknown) {logger.error(`Failed to read or create database key file: ${getErrorMessage(error)}`);
    return null;
  }
}

function resolveSqliteConstructor(mode: string, driverPackages: string[]): {
  constructorRef: SqliteDriver | null;
  driverPackage: string | null;
  reason: string;
} {
  if (mode === 'off') {
    return {
      constructorRef: DatabaseLib,
      driverPackage: 'better-sqlite3',
      reason: 'encryption disabled',
    };
  }
  for (const packageName of driverPackages) {
    try {
      const module = require(packageName);
      const constructorRef = (module.default || module.Database || module) as SqliteDriver | null;
      if (typeof constructorRef === 'function') {
        return {
          constructorRef,
          driverPackage: packageName,
          reason: `loaded ${packageName}`,
        };
      }
    } catch (error: unknown) {logger.debug(`Failed to load SQLite driver ${packageName}: ${getErrorMessage(error)}`);
    }
  }
  return {
    constructorRef: null,
    driverPackage: null,
    reason: `SQLCipher driver unavailable: ${driverPackages.join(', ')}`,
  };
}

function applySqlCipherPragmas(db: SQLiteDatabase, key: Buffer): void {
  const hex = key.toString('hex');
  db.exec(`
    PRAGMA key = "x'${hex}'";
    PRAGMA cipher_page_size = 4096;
    PRAGMA kdf_iter = 256000;
    PRAGMA cipher_memory_security = ON;
  `);
}

export class Database {
  private static instance: Database | null = null;
  private static initPromise: Promise<Database> | null = null;
  private db!: SQLiteDatabase;

  private constructor() {}

  private async init(): Promise<void> {
    const dataDir = path.dirname(config.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const mode = (process.env.ZAVORTH_DB_SQLCIPHER_MODE || process.env.ZAVORTH_MEMORY_SQLCIPHER_MODE || 'off').trim().toLowerCase();
    const driverPackages = (process.env.ZAVORTH_MEMORY_SQLCIPHER_DRIVER_PACKAGES || 'better-sqlite3-multiple-ciphers').split(',').map(s => s.trim()).filter(Boolean);
    const key = getDatabaseKey();

    const sqlite = resolveSqliteConstructor(mode, driverPackages);
    const existedBefore = config.dbPath !== ':memory:' && fs.existsSync(config.dbPath);

    if (mode === 'required' && (!sqlite.constructorRef || !key)) {
      const reason = !key ? 'Encryption key missing' : sqlite.reason;
      throw new Error(`SQLite database could not be initialized securely: ${reason}`);
    }

    let dbInstance: SQLiteDatabase | null = null;
    let openedWithKey = false;

    if (mode !== 'off' && sqlite.constructorRef && key) {
      try {
        const DatabaseConstructor = sqlite.constructorRef;
        dbInstance = new DatabaseConstructor(config.dbPath);
        applySqlCipherPragmas(dbInstance, key);
        // Test query to verify key is correct and DB can be read
        dbInstance.prepare("PRAGMA user_version").get();
        openedWithKey = true;
      } catch (error: unknown) {
        if (existedBefore && dbInstance) {
          try {
            dbInstance.close();
          } catch (closeError: unknown) {
            logger.error(`Failed to close database during migration failure: ${getErrorMessage(closeError)}`);
          }
        }
        dbInstance = null;

        if (existedBefore) {
          try {
            const DatabaseConstructor = sqlite.constructorRef;
            const plainDb = new DatabaseConstructor(config.dbPath);
            plainDb.prepare("PRAGMA user_version").get(); // Verify plaintext open works

            // Rekey to encrypt the database (disable WAL first since rekeying is not supported in WAL mode)
            plainDb.pragma('journal_mode = DELETE');
            const hex = key.toString('hex');
            plainDb.exec(`PRAGMA rekey = "x'${hex}'";`);
            plainDb.close();

            // Re-open with key
            dbInstance = new DatabaseConstructor(config.dbPath);
            applySqlCipherPragmas(dbInstance, key);
            dbInstance.prepare("PRAGMA user_version").get();
            openedWithKey = true;
          } catch (migrationError: unknown) {
            if (dbInstance) {
              try {
                dbInstance.close();
              } catch (closeError: unknown) {
                logger.error(`Failed to close database during migration failure: ${getErrorMessage(closeError)}`);
              }
              dbInstance = null;
            }
            throw new Error(`SQLite database exists but key is invalid and plaintext migration failed: ${getErrorMessage(migrationError)}`);
          }
        } else {
          throw error;
        }
      }
    }

    if (!dbInstance) {
      const DatabaseConstructor = DatabaseLib;
      dbInstance = new DatabaseConstructor(config.dbPath);
    }

    this.db = dbInstance;

    // Configurações de performance nativas do SQLite
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('temp_store = MEMORY');

    this.createTables();
    logger.warn(`💾 [V3] Database SQLite inicializado com \`${sqlite.driverPackage || 'better-sqlite3'}\` (WAL mode ativo) at: ${config.dbPath}. Encryption: ${openedWithKey ? 'active' : 'off'}`);
  }

  public static async getInstance(): Promise<Database> {
    if (Database.instance) {
      return Database.instance;
    }
    if (!Database.initPromise) {
      Database.initPromise = (async () => {
        const db = new Database();
        await db.init();
        Database.instance = db;
        return db;
      })();
    }
    return Database.initPromise;
  }

  public static getActiveInstance(): Database | null {
    return Database.instance;
  }

  public getRawDb(): SQLiteDatabase {
    return this.db;
  }

  public run(sql: string, params: unknown[] = []): void {
    try {
      this.db.prepare(sql).run(...params);
    } catch (error: unknown) { const err = asErrorLike(error); logger.error('SQL Error (RUN):', err, '\\nSQL:', sql);
      throw error;
    }
  }

  public get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
    try {
      return this.db.prepare(sql).get(...params) as T | undefined;
    } catch (error: unknown) { const err = asErrorLike(error); logger.error('SQL Error (GET):', err, '\\nSQL:', sql);
      throw error;
    }
  }

  public all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    try {
      return this.db.prepare(sql).all(...params) as T[];
    } catch (error: unknown) { const err = asErrorLike(error); logger.error('SQL Error (ALL):', err, '\\nSQL:', sql);
      throw error;
    }
  }

  private createTables(): void {
    this.run(`
      CREATE TABLE IF NOT EXISTS system_tasks (
        task_id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        source TEXT,
        chat_id TEXT,
        user_id TEXT,
        raw_message TEXT,
        normalized_message TEXT,
        command_type TEXT,
        intent TEXT,
        target TEXT,
        workspace TEXT,
        risk_level INTEGER,
        status TEXT,
        requires_planning INTEGER,
        requires_approval INTEGER,
        approval_status TEXT,
        planner_used TEXT,
        executor_used TEXT,
        fallback_used INTEGER,
        parent_task_id TEXT,
        actions_planned TEXT,
        actions_executed TEXT,
        target_files TEXT,
        artifacts TEXT,
        stdout_summary TEXT,
        stderr_summary TEXT,
        diff_summary TEXT,
        result_summary TEXT,
        error_summary TEXT,
        rollback_available INTEGER,
        metadata TEXT
      )
    `);

    this.run(`
      CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        level TEXT,
        category TEXT,
        message TEXT,
        metadata TEXT
      )
    `);

    this.run(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        event_type TEXT NOT NULL,
        task_id TEXT NOT NULL,
        user_id TEXT DEFAULT '',
        user_input TEXT DEFAULT '',
        intent TEXT,
        plan_id TEXT,
        risk_level INTEGER DEFAULT 0,
        policy_decision TEXT DEFAULT 'ALLOWED',
        policy_violations TEXT,
        operational_mode TEXT DEFAULT 'WORKSPACE',
        executor TEXT,
        execution_success INTEGER,
        execution_summary TEXT,
        metadata TEXT DEFAULT '{}'
      )
    `);
    this.run(`CREATE INDEX IF NOT EXISTS idx_audit_task_id ON audit_log(task_id)`);
    this.run(`CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp)`);

    this.run(`
      CREATE TABLE IF NOT EXISTS permission_requests (
        permission_id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        task_id TEXT,
        executor TEXT NOT NULL,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        scope TEXT NOT NULL,
        workspace TEXT,
        requested_value TEXT,
        resolved_value TEXT,
        reason TEXT NOT NULL,
        requested_by TEXT,
        decided_by TEXT,
        decision_note TEXT,
        metadata TEXT DEFAULT '{}'
      )
    `);
    this.run(`CREATE INDEX IF NOT EXISTS idx_permission_requests_status ON permission_requests(status)`);
    this.run(`CREATE INDEX IF NOT EXISTS idx_permission_requests_executor_kind ON permission_requests(executor, kind)`);

    this.run(`
      CREATE TABLE IF NOT EXISTS scheduled_tasks (
        id TEXT PRIMARY KEY,
        command TEXT NOT NULL,
        schedule TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_run TEXT,
        next_run TEXT,
        created_by TEXT,
        status TEXT DEFAULT 'active'
      )
    `);
    this.ensureColumn('scheduled_tasks', 'intent_text', 'TEXT');
    this.ensureColumn('scheduled_tasks', 'delivery', "TEXT DEFAULT 'telegram'");
    this.ensureColumn('scheduled_tasks', 'delivery_target', 'TEXT');
    this.ensureColumn('scheduled_tasks', 'last_status', "TEXT DEFAULT 'idle'");
    this.ensureColumn('scheduled_tasks', 'last_error', 'TEXT');
    this.ensureColumn('scheduled_tasks', 'last_result', 'TEXT');
    this.ensureColumn('scheduled_tasks', 'run_count', 'INTEGER DEFAULT 0');
    this.ensureColumn('scheduled_tasks', 'failure_count', 'INTEGER DEFAULT 0');
    this.ensureColumn('scheduled_tasks', 'budget_json', 'TEXT');
    this.ensureColumn('scheduled_tasks', 'guardrail_json', 'TEXT');
    this.ensureColumn('scheduled_tasks', 'paused_reason', 'TEXT');
    this.ensureColumn('scheduled_tasks', 'last_failure_at', 'TEXT');
    this.ensureColumn('scheduled_tasks', 'consecutive_failures', 'INTEGER DEFAULT 0');

    this.run(`
      CREATE TABLE IF NOT EXISTS snippets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    this.run(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_snippets_user_name
      ON snippets(user_id, name)
    `);

    this.run(`
      CREATE TABLE IF NOT EXISTS user_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general',
        embedding TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_id, key)
      )
    `);

    this.run(`
      CREATE TABLE IF NOT EXISTS zavorth_skills_telemetry (
        skill_id TEXT PRIMARY KEY,
        use_count INTEGER DEFAULT 0,
        last_executed_at TEXT,
        status TEXT CHECK(status IN ('active', 'archived')) DEFAULT 'active',
        pinned INTEGER DEFAULT 0
      )
    `);

    this.run(`
      CREATE TABLE IF NOT EXISTS workspace_write_approvals (
        operation_id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        path_hash TEXT NOT NULL,
        path_suffix TEXT NOT NULL,
        request_hash TEXT NOT NULL,
        approved INTEGER DEFAULT 0,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);
    this.run(`CREATE INDEX IF NOT EXISTS idx_workspace_write_approvals_lookup ON workspace_write_approvals(workspace_id, tool_name, operation_id, path_hash, request_hash)`);

    this.run(`
      CREATE TABLE IF NOT EXISTS workspace_command_approvals (
        operation_id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        command TEXT NOT NULL,
        args_hash TEXT NOT NULL,
        approved INTEGER DEFAULT 0,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);
    this.run(`CREATE INDEX IF NOT EXISTS idx_workspace_command_approvals_lookup ON workspace_command_approvals(workspace_id, operation_id)`);

    this.run(`
      CREATE TABLE IF NOT EXISTS workspace_host_command_proposals (
        operation_id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        command_hash TEXT NOT NULL,
        command_preview_redacted TEXT NOT NULL,
        args_hash TEXT NOT NULL,
        args_preview_redacted TEXT NOT NULL,
        cwd_hash TEXT NOT NULL,
        cwd_suffix TEXT NOT NULL,
        shell INTEGER DEFAULT 0,
        risk_level TEXT NOT NULL,
        reason_redacted TEXT NOT NULL,
        approved INTEGER DEFAULT 0,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        requires_strong_confirmation INTEGER DEFAULT 0,
        strong_confirmation_phrase TEXT
      )
    `);
    this.run(`CREATE INDEX IF NOT EXISTS idx_workspace_host_command_proposals_lookup ON workspace_host_command_proposals(workspace_id, operation_id)`);

    this.run(`
      CREATE TABLE IF NOT EXISTS workspace_pty_sessions (
        session_id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        shell TEXT NOT NULL,
        cwd_hash TEXT NOT NULL,
        cwd_suffix TEXT NOT NULL,
        risk_level TEXT NOT NULL,
        status TEXT NOT NULL,
        reason_redacted TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      )
    `);
    this.run(`CREATE INDEX IF NOT EXISTS idx_workspace_pty_sessions_lookup ON workspace_pty_sessions(workspace_id, session_id)`);

    this.run(`
      CREATE TABLE IF NOT EXISTS workspace_pty_input_approvals (
        operation_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        input_hash TEXT NOT NULL,
        input_preview_redacted TEXT NOT NULL,
        risk_level TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        requires_strong_confirmation INTEGER DEFAULT 0,
        strong_confirmation_phrase TEXT
      )
    `);
    this.run(`CREATE INDEX IF NOT EXISTS idx_workspace_pty_input_approvals_lookup ON workspace_pty_input_approvals(workspace_id, session_id, operation_id)`);

    this.run(`
      CREATE TABLE IF NOT EXISTS workspace_trust_entries (
        workspace_id TEXT PRIMARY KEY,
        root_hash TEXT NOT NULL,
        root_suffix TEXT NOT NULL,
        trusted INTEGER DEFAULT 0,
        allow_risk_up_to TEXT DEFAULT 'LOW',
        allow_package_install INTEGER DEFAULT 0,
        allow_network INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    this.run(`
      CREATE TABLE IF NOT EXISTS provider_config (
        provider_id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        display_name TEXT NOT NULL,
        base_url TEXT,
        default_model TEXT,
        enabled INTEGER DEFAULT 1,
        requires_api_key INTEGER DEFAULT 1,
        secret_ref TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    this.run(`
      CREATE TABLE IF NOT EXISTS provider_secret_refs (
        secret_ref TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        key_fingerprint TEXT NOT NULL,
        key_suffix TEXT NOT NULL,
        secret_store_type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(provider_id) REFERENCES provider_config(provider_id) ON DELETE CASCADE
      )
    `);

    this.run(`
      CREATE TABLE IF NOT EXISTS provider_secret_ciphertexts (
        secret_ref TEXT PRIMARY KEY,
        ciphertext TEXT NOT NULL,
        iv TEXT NOT NULL,
        auth_tag TEXT NOT NULL,
        salt TEXT NOT NULL,
        FOREIGN KEY(secret_ref) REFERENCES provider_secret_refs(secret_ref) ON DELETE CASCADE
      )
    `);

    this.run(`
      CREATE TABLE IF NOT EXISTS agent_workspace_config (
        workspace_id TEXT PRIMARY KEY,
        default_provider_id TEXT,
        default_model_id TEXT,
        allowed_capabilities TEXT NOT NULL,
        default_autonomy_profile TEXT NOT NULL,
        allow_developer_mode INTEGER NOT NULL,
        allow_host_power_mode INTEGER NOT NULL,
        allow_pty INTEGER NOT NULL,
        allow_task_mandates INTEGER NOT NULL,
        allow_temporary_directory_trust INTEGER NOT NULL,
        allow_provider_fallback INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    this.run(`
      CREATE TABLE IF NOT EXISTS git_file_locks (
        filepath TEXT PRIMARY KEY,
        subagent_id TEXT,
        locked_at INTEGER,
        expires_at INTEGER
      )
    `);
    // Legacy DBs created the table without TTL support; CREATE IF NOT EXISTS will not alter them.
    this.ensureColumn('git_file_locks', 'expires_at', 'INTEGER');
  }

  private ensureColumn(tableName: string, columnName: string, definition: string): void {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName) || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(columnName)) {
      throw new Error(`Invalid identifier in ensureColumn: ${tableName}.${columnName}`);
    }
    const columns = this.all<{ name: string }>(`PRAGMA table_info(${tableName})`);
    if (columns.some((entry) => String(entry?.name || '').trim() === columnName)) {
      return;
    }
    try {
      this.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    } catch (error: unknown) {const message = getErrorMessage(error).toLowerCase();
      if (message.includes('duplicate column name')) {
        return;
      }
      throw error;
    }
  }

  public rotateKey(newKey: string): void {
    const mode = (process.env.ZAVORTH_DB_SQLCIPHER_MODE || process.env.ZAVORTH_MEMORY_SQLCIPHER_MODE || 'off').trim().toLowerCase();
    if (mode === 'off') {
      throw new Error('Database encryption is disabled. Key rotation is not supported.');
    }

    if (!newKey || typeof newKey !== 'string') {
      throw new Error('Invalid new encryption key provided.');
    }

    // 1. Derive the new encryption key buffer (matching getDatabaseKey logic)
    const keyBuffer = crypto.createHash('sha256').update(newKey).digest();
    const newDerivedKey = crypto.createHash('sha256').update(
      Buffer.concat([keyBuffer, Buffer.from(':zavorth-db-cipher')])
    ).digest();
    const newHex = newDerivedKey.toString('hex');

    // 2. Temporarily switch journal mode away from WAL (rekeying is not supported in WAL mode)
    const currentJournalMode = this.db.pragma('journal_mode', { simple: true }) as string;
    this.db.pragma('journal_mode = DELETE');

    try {
      // 3. Execute PRAGMA rekey using SQLCipher
      this.db.exec(`PRAGMA rekey = "x'${newHex}'";`);

      // 4. Test integrity/access with the new key (the connection is already rekeyed)
      this.db.prepare('PRAGMA user_version').get();
      this.db.prepare('SELECT count(*) FROM snippets').get();
    } catch (error: unknown) {
      // If rekey failed, restore journal mode and throw
      try {
        this.db.pragma(`journal_mode = ${currentJournalMode || 'WAL'}`);
      } catch (restoreError: unknown) {
        logger.error(`Failed to restore journal mode after rekey failure: ${getErrorMessage(restoreError)}`);
      }
      throw new Error(`Failed to rotate database encryption key: ${getErrorMessage(error)}`);
    }

    // 5. Restore the journal mode (typically WAL)
    try {
      this.db.pragma(`journal_mode = ${currentJournalMode || 'WAL'}`);
    } catch (restoreError: unknown) {
      logger.error(`Failed to restore journal mode after rekey: ${getErrorMessage(restoreError)}`);
    }

    // 6. Update configuration and/or key file to persist the new key
    config.dbEncryptionKey = newKey;
    const keyFile = String(config.dbEncryptionKeyFile || '').trim();
    if (keyFile) {
      try {
        fs.mkdirSync(path.dirname(keyFile), { recursive: true });
        fs.writeFileSync(keyFile, newKey, 'utf8');
      } catch (fileError: unknown) {
        logger.error(`Warning: Key rotated in database but failed to write to dbEncryptionKeyFile: ${getErrorMessage(fileError)}`);
      }
    }
  }

  public close(): void {
    if (this.db) {
      this.db.close();
    }
    Database.instance = null;
    Database.initPromise = null;
  }
}
