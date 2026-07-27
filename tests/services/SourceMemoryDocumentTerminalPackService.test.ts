import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { SqliteVecMemoryBackend } from '../../src/adapters/memory/SqliteVecMemoryBackend.js';
import { GovernedTerminalRuntime } from '../../src/services/GovernedTerminalRuntime.js';
import { SourceDocumentExtractionService } from '../../src/services/SourceDocumentExtractionService.js';
import { SourceMemoryDocumentTerminalPackService } from '../../src/services/SourceMemoryDocumentTerminalPackService.js';
import { ShellSafetyClassifier } from '../../src/services/ShellSafetyClassifier.js';

describe('SourceMemoryDocumentTerminalPackService Credential vault', () => {
  const now = () => new Date('2026-05-05T17:00:00.000Z');
  let tempRoot: string;
  let sourceRoot: string;
  let zavorthRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-source-credential-vault-'));
    sourceRoot = path.join(tempRoot, 'source');
    zavorthRoot = path.join(tempRoot, 'zavorth');
    createFixtureSource(sourceRoot);
    createFixtureZavorth(zavorthRoot);
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('writes and queries replayable sqlite-backed memory receipts', () => {
    const dbPath = path.join(tempRoot, 'memory.sqlite');
    const backend = new SqliteVecMemoryBackend({
      now,
      dbPath,
    });
    const write = backend.write({
      namespace: 'credential-vault-test',
      text: 'Source memory host behavior is represented by sqlite vector recall.',
      metadata: {
        source: 'test',
        apiKey: 'secret-value',
      },
    });
    const query = backend.query({
      namespace: 'credential-vault-test',
      query: 'sqlite vector recall',
    });

    expect(write.receipt).toEqual(
      expect.objectContaining({
        status: 'applied',
        backendId: 'sqlite-vector-concept-backend',
        atRestEncrypted: true,
        artifactFirst: true,
        replayable: true,
        liveIoPerformed: false,
        secretValuesSerialized: false,
      }),
    );
    expect(write.record.metadata.apiKey).toBe('[redacted]');
    expect(query.results).toHaveLength(1);
    expect(query.receipt.resultRecordIds).toContain(write.record.id);
    expect(query.receipt.topScore).toBeGreaterThan(0);
    expect(backend.buildReplaySnapshot('credential-vault-test')).toEqual(
      expect.objectContaining({
        backendId: 'sqlite-vector-concept-backend',
        records: 1,
        sqliteVecExtensionLoaded: false,
        atRestEncrypted: true,
      }),
    );
    backend.close();

    const db = new Database(dbPath, { readonly: true });
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as Array<{ name: string }>;
    const rows = db.prepare('SELECT text, metadata_json, keywords_json, vector_json FROM zavorth_memory_records').all() as Array<{
      text: string;
      metadata_json: string;
      keywords_json: string;
      vector_json: string;
    }>;
    db.close();
    expect(tables.map((row) => row.name)).toContain('zavorth_memory_records');
    expect(rows).toHaveLength(1);
    expect(rows[0].text).toMatch(/^enc:v1:/);
    expect(rows[0].metadata_json).toMatch(/^enc:v1:/);
    expect(rows[0].keywords_json).toMatch(/^enc:v1:/);
    expect(rows[0].vector_json).toMatch(/^enc:v1:/);

    const sqliteBytes = fs.readFileSync(dbPath);
    const sqliteAtRest = sqliteBytes.toString('utf8');
    expect(sqliteAtRest).not.toContain('Source memory host behavior');
    expect(sqliteAtRest).not.toContain('sqlite vector recall');
    expect(sqliteAtRest).not.toContain('secret-value');
  });

  it('encrypts json fallback memory records at rest', () => {
    const dbPath = path.join(tempRoot, 'fallback-memory.sqlite');
    const fallbackPath = path.join(tempRoot, 'fallback-memory.json');
    const backend = new SqliteVecMemoryBackend({
      now,
      dbPath,
      forceJsonFallback: true,
    });
    const write = backend.write({
      namespace: 'credential-vault-test',
      text: 'Fallback memory should not be readable on disk.',
      metadata: {
        source: 'test',
        token: 'fallback-token-value',
      },
    });
    const query = backend.query({
      namespace: 'credential-vault-test',
      query: 'readable disk',
    });

    expect(write.receipt).toEqual(
      expect.objectContaining({
        status: 'applied',
        backendId: 'json-fallback-memory-backend',
        atRestEncrypted: true,
        secretValuesSerialized: false,
      }),
    );
    expect(query.results).toHaveLength(1);
    const fallbackAtRest = fs.readFileSync(fallbackPath, 'utf8');
    expect(fallbackAtRest).toMatch(/^enc:v1:/);
    expect(fallbackAtRest).not.toContain('Fallback memory should not be readable');
    expect(fallbackAtRest).not.toContain('fallback-token-value');
    backend.close();
  });

  it('migrates legacy plaintext sqlite memory rows into encrypted storage', () => {
    const dbPath = path.join(tempRoot, 'legacy-memory.sqlite');
    const legacy = new Database(dbPath);
    legacy.exec(`
      CREATE TABLE zavorth_memory_records (
        id TEXT PRIMARY KEY,
        namespace TEXT NOT NULL,
        text TEXT NOT NULL,
        metadata_json TEXT NOT NULL,
        keywords_json TEXT NOT NULL,
        vector_json TEXT NOT NULL,
        vector_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    legacy.prepare(`
      INSERT INTO zavorth_memory_records
        (id, namespace, text, metadata_json, keywords_json, vector_json, vector_hash, created_at)
      VALUES (-, -, -, -, -, -, -, -)
    `).run(
      'legacy-row',
      'credential-vault-test',
      'Legacy memory text must be sealed during migration.',
      JSON.stringify({ source: 'legacy' }),
      JSON.stringify(['legacy', 'migration']),
      JSON.stringify(Array.from({ length: 32 }, (_, index) => (index === 0 ? 1 : 0))),
      'legacy-vector-hash',
      '2026-05-05T17:00:00.000Z',
    );
    legacy.close();

    const backend = new SqliteVecMemoryBackend({
      now,
      dbPath,
    });
    const query = backend.query({
      namespace: 'credential-vault-test',
      query: 'legacy migration',
    });
    backend.close();

    expect(query.results).toHaveLength(1);
    expect(query.results[0].text).toContain('Legacy memory text');
    const migratedAtRest = fs.readFileSync(dbPath).toString('utf8');
    expect(migratedAtRest).not.toContain('Legacy memory text must be sealed');
    expect(migratedAtRest).not.toContain('legacy migration');
  });

  it('falls back safely when optional full-file sqlite encryption is unavailable', () => {
    const dbPath = path.join(tempRoot, 'optional-full-file-memory.sqlite');
    const backend = new SqliteVecMemoryBackend({
      now,
      dbPath,
      fullFileEncryption: {
        mode: 'opportunistic',
        key: 'optional-full-file-key',
        driverPackages: ['zavorth-missing-sqlcipher-driver'],
      },
    });
    const write = backend.write({
      namespace: 'credential-vault-test',
      text: 'Optional full file encryption fallback keeps learned text sealed.',
      metadata: { source: 'optional-full-file' },
    });
    const query = backend.query({
      namespace: 'credential-vault-test',
      query: 'fallback learned text',
    });
    const snapshot = backend.buildReplaySnapshot('credential-vault-test');
    backend.close();

    expect(write.receipt).toEqual(
      expect.objectContaining({
        backendId: 'sqlite-vector-concept-backend',
        atRestEncrypted: true,
        fullFileEncrypted: false,
        atRestEncryptionMode: 'field',
      }),
    );
    expect(query.results).toHaveLength(1);
    expect(snapshot).toEqual(
      expect.objectContaining({
        fullFileEncrypted: false,
        fullFileEncryptionStatus: 'unavailable',
        fullFileEncryptionRequired: false,
      }),
    );
    const sqliteAtRest = fs.readFileSync(dbPath, 'utf8');
    expect(sqliteAtRest).not.toContain('Optional full file encryption fallback');
  });

  it('uses encrypted json fallback when full-file sqlite encryption is required but unavailable', () => {
    const dbPath = path.join(tempRoot, 'required-full-file-memory.sqlite');
    const fallbackPath = path.join(tempRoot, 'required-full-file-memory.json');
    const backend = new SqliteVecMemoryBackend({
      now,
      dbPath,
      fullFileEncryption: {
        mode: 'required',
        key: 'required-full-file-key',
        driverPackages: ['zavorth-missing-sqlcipher-driver'],
      },
    });
    const write = backend.write({
      namespace: 'credential-vault-test',
      text: 'Required full file encryption must not create a readable sqlite database.',
      metadata: { source: 'required-full-file' },
    });
    const snapshot = backend.buildReplaySnapshot('credential-vault-test');
    backend.close();

    expect(write.receipt).toEqual(
      expect.objectContaining({
        backendId: 'json-fallback-memory-backend',
        atRestEncrypted: true,
        fullFileEncrypted: false,
        atRestEncryptionMode: 'json-field',
      }),
    );
    expect(snapshot).toEqual(
      expect.objectContaining({
        backendId: 'json-fallback-memory-backend',
        fullFileEncryptionStatus: 'required-unavailable',
        fullFileEncryptionRequired: true,
      }),
    );
    expect(fs.existsSync(dbPath)).toBe(false);
    expect(fs.readFileSync(fallbackPath, 'utf8')).toMatch(/^enc:v1:/);
    expect(fs.readFileSync(fallbackPath, 'utf8')).not.toContain('Required full file encryption');
  });

  it('does not overwrite an unreadable encrypted json fallback', () => {
    const dbPath = path.join(tempRoot, 'corrupt-json-fallback-memory.sqlite');
    const fallbackPath = path.join(tempRoot, 'corrupt-json-fallback-memory.json');
    fs.writeFileSync(fallbackPath, 'not-json', 'utf8');

    expect(() => new SqliteVecMemoryBackend({
      now,
      dbPath,
      forceJsonFallback: true,
    })).toThrow(/Unable to read encrypted JSON memory fallback/);
    expect(fs.readFileSync(fallbackPath, 'utf8')).toBe('not-json');
  });

  it('does not claim full-file encryption when sqlite key pragmas are ignored', () => {
    const dbPath = path.join(tempRoot, 'unverified-full-file-memory.sqlite');
    const backend = new SqliteVecMemoryBackend({
      now,
      dbPath,
      fullFileEncryption: {
        mode: 'opportunistic',
        key: 'noop-sqlite-key',
        driverPackages: ['better-sqlite3'],
      },
    });
    backend.write({
      namespace: 'credential-vault-test',
      text: 'No-op sqlite key pragma should still rely on field encryption.',
      metadata: { source: 'noop-sqlite-key' },
    });
    const snapshot = backend.buildReplaySnapshot('credential-vault-test');
    backend.close();

    expect(snapshot).toEqual(
      expect.objectContaining({
        fullFileEncrypted: false,
        fullFileEncryptionStatus: 'unverified',
        fullFileEncryptionProof: expect.objectContaining({
          unkeyedOpenBlocked: false,
        }),
      }),
    );
    const unkeyed = new Database(dbPath, { readonly: true });
    expect(unkeyed.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'zavorth_memory_records' })]),
    );
    unkeyed.close();
  });

  it('creates PDF and HTML extraction artifacts', () => {
    const service = new SourceDocumentExtractionService({ now });
    const smoke = service.runSmoke();

    expect(smoke.artifacts).toHaveLength(2);
    expect(smoke.receipts.map((receipt) => receipt.status)).toEqual(['artifact-created', 'artifact-created']);
    expect(smoke.artifacts[0].text).toContain('Credential vault PDF extraction smoke artifact');
    expect(smoke.artifacts[1].text).toContain('Readability extraction creates an artifact-first receipt');
    expect(smoke.receipts.every((receipt) => receipt.liveIoPerformed === false)).toBe(true);
  });

  it('blocks terminal execution until policy allows and blocks dangerous shell patterns', async () => {
    const classifier = new ShellSafetyClassifier({
      now,
      allowedRoots: [zavorthRoot],
      treeSitterAvailable: false,
    });
    const safe = classifier.classify({
      command: 'node --version',
      cwd: zavorthRoot,
    });
    const dangerous = classifier.classify({
      command: 'rm -rf .',
      cwd: zavorthRoot,
    });
    const runtime = new GovernedTerminalRuntime({
      now,
      classifier,
      allowedRoots: [zavorthRoot],
      enabledByDefault: false,
      ptyAvailable: false,
      runner: async () => ({
        exitCode: 0,
        stdout: 'should-not-run',
        stderr: null,
      }),
    });
    const terminal = await runtime.run({
      command: 'node --version',
      cwd: zavorthRoot,
      allowExecution: false,
    });

    expect(safe.level).toBe('safe');
    expect(dangerous.blocked).toBe(true);
    expect(dangerous.there iszards).toContain('recursive-force-delete');
    expect(terminal).toEqual(
      expect.objectContaining({
        status: 'blocked',
        liveProcessSpawned: false,
        secretValuesSerialized: false,
      }),
    );
  });

  it('emits a passing Credential vault pack snapshot', async () => {
    const service = new SourceMemoryDocumentTerminalPackService({
      now,
      sourceRoot,
      zavorthRoot,
      memoryDbPath: path.join(tempRoot, 'credential-vault.sqlite'),
      shellSafetyClassifier: new ShellSafetyClassifier({
        now,
        allowedRoots: [zavorthRoot],
        treeSitterAvailable: false,
      }),
    });
    const snapshot = await service.buildSnapshot();
    const text = service.formatSnapshotText(snapshot);

    expect(snapshot.status).toBe('passed');
    expect(snapshot.phase).toBe(5);
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        packagesTracked: 13,
        packagesPresentInSource: 13,
        packagesImplementedInZavorth: 11,
        memoryReceipts: 2,
        documentArtifacts: 2,
        searchReceipts: 1,
        terminalReceipts: 2,
        liveNetworkPerformed: false,
        liveProcessSpawnedByDefault: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.memory.writeReceipt.status).toBe('applied');
    expect(snapshot.memory.queryReceipt.resultRecordIds.length).toBeGreaterThan(0);
    expect(snapshot.documents.receipts.every((receipt) => receipt.status === 'artifact-created')).toBe(true);
    expect(snapshot.terminal.terminalReceipts.every((receipt) => receipt.liveProcessSpawned === false)).toBe(true);
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        artifactFirstReceipts: true,
        terminalDisabledUntilPolicyAllows: true,
        dangerousShellRequiresApproval: true,
        scopedCwdRootsRequired: true,
      }),
    );
    expect(snapshot.commands.nextAction).toBe('Runtime gateway - Native Companion And Device Capability Pack');
    expect(text).toContain('Zavorth Source Memory Document Terminal Pack - Credential vault');
    expect(text).toContain('Next: Runtime gateway - Native Companion And Device Capability Pack');
  });
});

function createFixtureSource(root: string): void {
  fs.mkdirSync(path.join(root, 'packages', 'memory-host-sdk'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src', 'tools'), { recursive: true });
  writeJson(path.join(root, 'package.json'), {
    name: 'source-fixture',
    dependencies: {
      '@source/memory-host-sdk': 'workspace:*',
      'sqlite-vec': '^0.1.6',
      'pdfjs-dist': '^4.10.38',
      '@mozilla/readability': '^0.6.0',
      jsdom: '^26.0.0',
      'duck-duck-scrape': '^2.2.7',
      'proxy-agent': '^6.5.0',
      'https-proxy-agent': '^7.0.6',
      undici: '^7.13.0',
    },
    optionalDependencies: {
      'node-pty': '^1.0.0',
      '@lydell/node-pty': '^1.0.0',
      'tree-sitter-bash': '^0.25.0',
      'web-tree-sitter': '^0.25.0',
    },
  });
  fs.writeFileSync(path.join(root, 'src', 'tools', 'memory-doc-terminal.ts'), [
    "import '@source/memory-host-sdk';",
    "import 'sqlite-vec';",
    "import 'pdfjs-dist';",
    "import { Readability } from '@mozilla/readability';",
    "import { JSDOM } from 'jsdom';",
    "import 'node-pty';",
    "import '@lydell/node-pty';",
    "import 'tree-sitter-bash';",
    "import 'web-tree-sitter';",
    "import 'duck-duck-scrape';",
    "import 'proxy-agent';",
    "import 'https-proxy-agent';",
    "import 'undici';",
    'export const credential-vault = { Readability, JSDOM };',
  ].join('\n'));
}

function createFixtureZavorth(root: string): void {
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  writeJson(path.join(root, 'package.json'), {
    name: 'zavorth-fixture',
    dependencies: {
      'better-sqlite3': '^12.8.0',
      'pdfjs-dist': '^5.4.394',
      '@mozilla/readability': '^0.6.0',
      jsdom: '^27.2.0',
      'duck-duck-scrape': '^2.2.7',
      'proxy-agent': '^8.0.1',
      'https-proxy-agent': '^9.0.0',
      undici: '^8.2.0',
    },
    optionalDependencies: {
      'node-pty': '^1.0.0',
    },
  });
  fs.writeFileSync(path.join(root, 'src', 'credential-vault.ts'), [
    "import 'pdfjs-dist';",
    "import '@mozilla/readability';",
    "import 'jsdom';",
    "import 'duck-duck-scrape';",
    "import 'proxy-agent';",
    "import 'https-proxy-agent';",
    "import 'undici';",
    'export {};',
  ].join('\n'));
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}
