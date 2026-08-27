import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import DatabaseLib, { type Database as SQLiteDatabase } from 'better-sqlite3';
import { DomainScopedBrowserProfileService } from '../../../../src/tool-runtime/tools/browser/DomainScopedBrowserProfileService.js';
import type { BrowserProfileCandidate } from '../../../../src/tool-runtime/tools/browser/BrowserProfileResolverContract.js';

describe('DomainScopedBrowserProfileService', () => {
  const vaultService = new DomainScopedBrowserProfileService();
  const testWorkspace = path.join(os.tmpdir(), `zavorth-vault-test-${Date.now()}`);

  beforeAll(() => {
    fs.mkdirSync(testWorkspace, { recursive: true });
  });

  afterAll(() => {
    try {
      fs.rmSync(testWorkspace, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  function createChromiumCookieDatabase(dbPath: string): void {
    const db: SQLiteDatabase = new DatabaseLib(dbPath);
    db.exec(`
      CREATE TABLE cookies (
        creation_utc INTEGER NOT NULL,
        host_key TEXT NOT NULL,
        name TEXT NOT NULL,
        value TEXT NOT NULL,
        path TEXT NOT NULL,
        expires_utc INTEGER NOT NULL,
        is_secure INTEGER NOT NULL,
        is_httponly INTEGER NOT NULL,
        last_access_utc INTEGER NOT NULL,
        has_expires INTEGER NOT NULL,
        is_persistent INTEGER NOT NULL,
        priority INTEGER NOT NULL,
        encrypted_value BLOB DEFAULT '',
        samesite INTEGER NOT NULL,
        source_scheme INTEGER NOT NULL,
        source_port INTEGER NOT NULL,
        is_same_party INTEGER NOT NULL
      );
    `);

    const insert = db.prepare(`
      INSERT INTO cookies (creation_utc, host_key, name, value, path, expires_utc, is_secure, is_httponly, last_access_utc, has_expires, is_persistent, priority, samesite, source_scheme, source_port, is_same_party)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(1001, '.github.com', 'user_session', 'gh_session_123', '/', 9999, 1, 1, 1001, 1, 1, 1, 1, 1, 443, 0);
    insert.run(1002, 'api.github.com', 'api_token', 'gh_api_456', '/', 9999, 1, 1, 1002, 1, 1, 1, 1, 1, 443, 0);
    insert.run(1003, '.google.com', 'SID', 'google_sid_secret', '/', 9999, 1, 1, 1003, 1, 1, 1, 1, 1, 443, 0);
    insert.run(1004, '.bank.com', 'auth_cookie', 'bank_secret_789', '/', 9999, 1, 1, 1004, 1, 1, 1, 1, 1, 443, 0);
    insert.run(1005, '.aws.amazon.com', 'aws_creds', 'aws_session_999', '/', 9999, 1, 1, 1005, 1, 1, 1, 1, 1, 443, 0);

    db.close();
  }

  it('should copy files using shared-read stream without locking conflicts', () => {
    const src = path.join(testWorkspace, 'source.txt');
    const dst = path.join(testWorkspace, 'dest.txt');
    fs.writeFileSync(src, 'Hello Zavorth Shared Read Stream', 'utf8');

    vaultService.copyFileWithSharedRead(src, dst);

    expect(fs.existsSync(dst)).toBe(true);
    expect(fs.readFileSync(dst, 'utf8')).toBe('Hello Zavorth Shared Read Stream');
  });

  it('should purge cookies outside allowed domains and retain authorized domain cookies', () => {
    const testDbPath = path.join(testWorkspace, 'test_cookies.db');
    createChromiumCookieDatabase(testDbPath);

    const stats = vaultService.purgeCookiesOutsideDomains(testDbPath, ['*.github.com']);

    expect(stats.purged).toBe(3); // google, bank, aws purged
    expect(stats.retained).toBe(2); // .github.com, api.github.com retained

    const db: SQLiteDatabase = new DatabaseLib(testDbPath, { readonly: true });
    const rows = db.prepare('SELECT host_key FROM cookies').all() as { host_key: string }[];
    db.close();

    expect(rows.length).toBe(2);
    expect(rows.map((r) => r.host_key)).toEqual(expect.arrayContaining(['.github.com', 'api.github.com']));
    expect(rows.some((r) => r.host_key.includes('bank'))).toBe(false);
    expect(rows.some((r) => r.host_key.includes('google'))).toBe(false);
    expect(rows.some((r) => r.host_key.includes('aws'))).toBe(false);
  });

  it('should retain all cookies when allowedDomains is empty', () => {
    const testDbPath = path.join(testWorkspace, 'test_cookies_unfiltered.db');
    createChromiumCookieDatabase(testDbPath);

    const stats = vaultService.purgeCookiesOutsideDomains(testDbPath, []);

    expect(stats.purged).toBe(0);
    expect(stats.retained).toBe(5);
  });

  it('should create an ephemeral domain-scoped snapshot and then dispose it cleanly', async () => {
    const profileDir = path.join(testWorkspace, 'FakeProfile', 'Default');
    const networkDir = path.join(profileDir, 'Network');
    fs.mkdirSync(networkDir, { recursive: true });

    const sourceCookies = path.join(networkDir, 'Cookies');
    createChromiumCookieDatabase(sourceCookies);

    const candidate: BrowserProfileCandidate = {
      browserFamily: 'chrome',
      name: 'Fake Chrome',
      executablePath: null,
      userDataDir: path.join(testWorkspace, 'FakeProfile'),
      profileName: 'Default',
      profileDir,
      cookiesDbPath: sourceCookies,
      loginDataDbPath: path.join(profileDir, 'Login Data'),
      localStatePath: path.join(testWorkspace, 'FakeProfile', 'Local State'),
      isDefault: true,
      exists: true,
    };

    const snapshot = await vaultService.createDomainScopedSnapshot(candidate, {
      allowedDomains: ['github.com'],
    });

    expect(fs.existsSync(snapshot.snapshotDir)).toBe(true);
    expect(fs.existsSync(snapshot.cookiesDbPath)).toBe(true);
    expect(snapshot.purgedCookiesCount).toBe(3);
    expect(snapshot.retainedCookiesCount).toBe(2);

    const disposed = await vaultService.disposeSnapshot(snapshot.snapshotDir);
    expect(disposed).toBe(true);
    expect(fs.existsSync(snapshot.snapshotDir)).toBe(false);
  });

  it('should refuse to dispose directories outside the ephemeral vault boundary', async () => {
    const safeResult = await vaultService.disposeSnapshot('C:\\Windows\\System32');
    expect(safeResult).toBe(false);

    const safeRelative = await vaultService.disposeSnapshot('../../');
    expect(safeRelative).toBe(false);
  });
});
