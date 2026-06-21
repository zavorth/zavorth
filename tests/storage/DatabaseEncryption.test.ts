import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Database } from '../../src/storage/Database.js';
import { config } from '../../src/config/index.js';
import DatabaseLib from 'better-sqlite3';

describe('DatabaseEncryption', () => {
  let tmpDirs: string[] = [];
  const originalDbPath = config.dbPath;
  const originalDbKey = config.dbEncryptionKey;
  const originalDbKeyFile = config.dbEncryptionKeyFile;
  const originalEnvMode = process.env.ZAVORTH_DB_SQLCIPHER_MODE;

  beforeEach(() => {
    Database.instance = null;
    (Database as any).initPromise = null;
  });

  afterEach(() => {
    // Reset instance and close
    try {
      Database.instance?.close();
    } catch {
      // Ignore
    }
    Database.instance = null;
    (Database as any).initPromise = null;

    // Restore original config
    config.dbPath = originalDbPath;
    config.dbEncryptionKey = originalDbKey;
    config.dbEncryptionKeyFile = originalDbKeyFile;
    if (originalEnvMode !== undefined) {
      process.env.ZAVORTH_DB_SQLCIPHER_MODE = originalEnvMode;
    } else {
      delete process.env.ZAVORTH_DB_SQLCIPHER_MODE;
    }

    // Clean temp directories
    for (const dir of tmpDirs) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // Ignore
      }
    }
    tmpDirs = [];
  });

  const getTempDbPath = () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-db-test-'));
    tmpDirs.push(root);
    return path.join(root, 'zavorth.db');
  };

  it('initializes a standard unencrypted SQLite database when mode is off', async () => {
    const testDbPath = getTempDbPath();
    config.dbPath = testDbPath;
    process.env.ZAVORTH_DB_SQLCIPHER_MODE = 'off';

    const db = await Database.getInstance();
    expect(db).toBeDefined();

    // Verify we can write and read
    db.run('INSERT INTO snippets (user_id, name, content) VALUES (?, ?, ?)', ['user1', 'snippet1', 'content1']);
    const record = db.get('SELECT * FROM snippets WHERE name = ?', ['snippet1']);
    expect(record).toEqual(expect.objectContaining({
      user_id: 'user1',
      name: 'snippet1',
      content: 'content1',
    }));

    db.close();

    // Verify it is unencrypted by reading it directly via standard better-sqlite3
    const directDb = new DatabaseLib(testDbPath);
    const directRecord = directDb.prepare('SELECT * FROM snippets WHERE name = ?').get('snippet1');
    expect(directRecord).toBeDefined();
    directDb.close();
  });

  it('initializes an encrypted database and blocks unkeyed access when mode is required/opportunistic', async () => {
    const testDbPath = getTempDbPath();
    config.dbPath = testDbPath;
    config.dbEncryptionKey = 'my-super-secret-encryption-key-for-database-testing';
    process.env.ZAVORTH_DB_SQLCIPHER_MODE = 'required';

    const db = await Database.getInstance();
    expect(db).toBeDefined();

    db.run('INSERT INTO snippets (user_id, name, content) VALUES (?, ?, ?)', ['user2', 'snippet2', 'content2']);
    const record = db.get('SELECT * FROM snippets WHERE name = ?', ['snippet2']);
    expect(record).toEqual(expect.objectContaining({
      user_id: 'user2',
      name: 'snippet2',
    }));

    db.close();

    // Try to open it directly without a key using standard better-sqlite3
    // It should throw an error because the file is encrypted
    expect(() => {
      const directDb = new DatabaseLib(testDbPath);
      directDb.prepare('SELECT * FROM snippets').all();
      directDb.close();
    }).toThrow();
  });

  it('transparently migrates an unencrypted database to encrypted on startup', async () => {
    const testDbPath = getTempDbPath();
    config.dbPath = testDbPath;

    // 1. Create a plaintext database first
    process.env.ZAVORTH_DB_SQLCIPHER_MODE = 'off';
    let db = await Database.getInstance();
    db.run('INSERT INTO snippets (user_id, name, content) VALUES (?, ?, ?)', ['user3', 'snippet3', 'content3']);
    db.close();

    // 2. Open it with encryption mode enabled
    Database.instance = null;
    (Database as any).initPromise = null;
    config.dbEncryptionKey = 'migration-test-key-1234';
    process.env.ZAVORTH_DB_SQLCIPHER_MODE = 'required';

    db = await Database.getInstance();
    expect(db).toBeDefined();

    // Verify existing data is preserved
    const record = db.get('SELECT * FROM snippets WHERE name = ?', ['snippet3']);
    expect(record).toEqual(expect.objectContaining({
      user_id: 'user3',
      name: 'snippet3',
      content: 'content3',
    }));

    db.close();

    // 3. Verify it is now fully encrypted (unkeyed access throws error)
    expect(() => {
      const directDb = new DatabaseLib(testDbPath);
      directDb.prepare('SELECT * FROM snippets').all();
      directDb.close();
    }).toThrow();
  });
});
