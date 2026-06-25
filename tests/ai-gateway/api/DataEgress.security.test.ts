import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { redactExportedLogValue } from '../../../src/zavorth-control/lib/logExportRedaction';
import { sanitizeSqliteBackupFile } from '../../../src/zavorth-control/lib/db/backupSanitizer';

const PROVIDER_TOKEN = 'sk-testredactiontoken000000000000';
const JWT_TOKEN = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  'eyJzdWIiOiJwaGFzZTUifQ',
  'signature000000',
].join('.');

describe('phase 5 data egress hardening', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('redacts secrets inside exported log objects and serialized JSON strings', () => {
    const exported = redactExportedLogValue({
      apiKeyId: 'key-live-admin',
      message: `Authorization: Bearer ${JWT_TOKEN}`,
      request_body: JSON.stringify({
        prompt: `token=${PROVIDER_TOKEN}`,
        nested: {
          password: 'correct-horse-battery-staple',
        },
      }),
    }) as any;

    const serialized = JSON.stringify(exported);
    expect(serialized).not.toContain(PROVIDER_TOKEN);
    expect(serialized).not.toContain(JWT_TOKEN);
    expect(serialized).not.toContain('correct-horse-battery-staple');
    expect(serialized).toContain('[redacted-secret]');
  });

  it('sanitizes sqlite backup files before they leave the host', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-credential-vault-'));
    tempRoots.push(root);
    const dbPath = path.join(root, 'backup.sqlite');
    const db = new Database(dbPath);
    db.exec(`
      CREATE TABLE provider_connections (
        id TEXT PRIMARY KEY,
        access_token TEXT,
        refresh_token TEXT,
        api_key TEXT,
        id_token TEXT,
        provider_specific_data TEXT
      );
      CREATE TABLE api_keys (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE
      );
      CREATE TABLE key_value (
        namespace TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (namespace, key)
      );
      CREATE TABLE call_logs (
        id TEXT PRIMARY KEY,
        request_body TEXT,
        response_body TEXT,
        error TEXT
      );
      CREATE TABLE request_detail_logs (
        id TEXT PRIMARY KEY,
        client_request TEXT,
        translated_request TEXT,
        provider_response TEXT,
        client_response TEXT
      );
      CREATE TABLE semantic_cache (
        id TEXT PRIMARY KEY,
        response TEXT
      );
    `);
    db.prepare('INSERT INTO provider_connections VALUES (?, ?, ?, ?, ?, ?)').run(
      'provider-1',
      PROVIDER_TOKEN,
      'refresh-secret-value',
      PROVIDER_TOKEN,
      JWT_TOKEN,
      JSON.stringify({ clientSecret: 'client-secret-value', baseUrl: 'https://api.example.test' }),
    );
    db.prepare('INSERT INTO api_keys VALUES (?, ?)').run('api-key-1', PROVIDER_TOKEN);
    db.prepare('INSERT INTO key_value VALUES (?, ?, ?)').run('auth', 'client_secret', 'client-secret-value');
    db.prepare('INSERT INTO call_logs VALUES (?, ?, ?, ?)').run(
      'call-1',
      JSON.stringify({ authorization: `Bearer ${JWT_TOKEN}` }),
      JSON.stringify({ text: PROVIDER_TOKEN }),
      `failed with ${PROVIDER_TOKEN}`,
    );
    db.prepare('INSERT INTO request_detail_logs VALUES (?, ?, ?, ?, ?)').run(
      'detail-1',
      JSON.stringify({ apiKey: PROVIDER_TOKEN }),
      JSON.stringify({ token: PROVIDER_TOKEN }),
      JSON.stringify({ content: PROVIDER_TOKEN }),
      JSON.stringify({ content: PROVIDER_TOKEN }),
    );
    db.prepare('INSERT INTO semantic_cache VALUES (?, ?)').run('cache-1', PROVIDER_TOKEN);
    db.close();

    const report = sanitizeSqliteBackupFile(dbPath);
    const sanitized = new Database(dbPath, { readonly: true });
    const serialized = JSON.stringify({
      provider: sanitized.prepare('SELECT * FROM provider_connections').all(),
      apiKeys: sanitized.prepare('SELECT * FROM api_keys').all(),
      settings: sanitized.prepare('SELECT * FROM key_value').all(),
      callLogs: sanitized.prepare('SELECT * FROM call_logs').all(),
      detailLogs: sanitized.prepare('SELECT * FROM request_detail_logs').all(),
      cache: sanitized.prepare('SELECT * FROM semantic_cache').all(),
    });
    sanitized.close();

    expect(report.rawSecretsIncluded).toBe(false);
    expect(report.tablesTouched).toEqual(expect.arrayContaining([
      'api_keys',
      'call_logs',
      'key_value',
      'provider_connections',
      'request_detail_logs',
      'semantic_cache',
    ]));
    expect(serialized).not.toContain(PROVIDER_TOKEN);
    expect(serialized).not.toContain(JWT_TOKEN);
    expect(serialized).not.toContain('client-secret-value');
    expect(serialized).toContain('redacted');
  });
});
