import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SqliteVecMemoryBackend } from '../../src/adapters/memory/SqliteVecMemoryBackend.js';
import { GovernedTerminalRuntime } from '../../src/services/GovernedTerminalRuntime.js';
import { SourceDocumentExtractionService } from '../../src/services/SourceDocumentExtractionService.js';
import { SourceMemoryDocumentTerminalPackService } from '../../src/services/SourceMemoryDocumentTerminalPackService.js';
import { ShellSafetyClassifier } from '../../src/services/ShellSafetyClassifier.js';

describe('SourceMemoryDocumentTerminalPackService Phase 5', () => {
  const now = () => new Date('2026-05-05T17:00:00.000Z');
  let tempRoot: string;
  let sourceRoot: string;
  let zavorthRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-source-phase5-'));
    sourceRoot = path.join(tempRoot, 'source');
    zavorthRoot = path.join(tempRoot, 'zavorth');
    createFixtureSource(sourceRoot);
    createFixtureZavorth(zavorthRoot);
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('writes and queries replayable sqlite-backed memory receipts', () => {
    const backend = new SqliteVecMemoryBackend({
      now,
      dbPath: path.join(tempRoot, 'memory.sqlite'),
    });
    const write = backend.write({
      namespace: 'phase5-test',
      text: 'Source memory host behavior is represented by sqlite vector recall.',
      metadata: {
        source: 'test',
        apiKey: 'secret-value',
      },
    });
    const query = backend.query({
      namespace: 'phase5-test',
      query: 'sqlite vector recall',
    });

    expect(write.receipt).toEqual(
      expect.objectContaining({
        status: 'applied',
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
    backend.close();
  });

  it('creates PDF and HTML extraction artifacts', () => {
    const service = new SourceDocumentExtractionService({ now });
    const smoke = service.runSmoke();

    expect(smoke.artifacts).toHaveLength(2);
    expect(smoke.receipts.map((receipt) => receipt.status)).toEqual(['artifact-created', 'artifact-created']);
    expect(smoke.artifacts[0].text).toContain('Phase 5 PDF extraction smoke artifact');
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
    expect(dangerous.hazards).toContain('recursive-force-delete');
    expect(terminal).toEqual(
      expect.objectContaining({
        status: 'blocked',
        liveProcessSpawned: false,
        secretValuesSerialized: false,
      }),
    );
  });

  it('emits a passing Phase 5 pack snapshot', async () => {
    const service = new SourceMemoryDocumentTerminalPackService({
      now,
      sourceRoot,
      zavorthRoot,
      memoryDbPath: path.join(tempRoot, 'phase5.sqlite'),
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
    expect(snapshot.commands.nextPhase).toBe('Phase 6 - Native Companion And Device Capability Pack');
    expect(text).toContain('Zavorth Source Memory Document Terminal Pack - Phase 5');
    expect(text).toContain('Next: Phase 6 - Native Companion And Device Capability Pack');
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
    'export const phase5 = { Readability, JSDOM };',
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
  fs.writeFileSync(path.join(root, 'src', 'phase5.ts'), [
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
