import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ShellSafetyClassifier } from '../../src/services/ShellSafetyClassifier.js';
import { SourceMemoryDocumentTerminalPackService } from '../../src/services/SourceMemoryDocumentTerminalPackService.js';
import { ZavorthSemanticMemoryDocumentTerminalCertificationService } from '../../src/services/ZavorthSemanticMemoryDocumentTerminalCertificationService.js';

describe('ZavorthSemanticMemoryDocumentTerminalCertificationService S5', () => {
  const now = () => new Date('2026-05-05T18:00:00.000Z');
  let tempRoot: string;
  let sourceRoot: string;
  let zavorthRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-semantic-credential-vault-'));
    sourceRoot = path.join(tempRoot, 'source');
    zavorthRoot = path.join(tempRoot, 'zavorth');
    createFixtureSource(sourceRoot);
    createFixtureZavorth(zavorthRoot);
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('certifies S5 semantics without live network default process spawn or secret serialization', async () => {
    const snapshot = await buildSnapshot({
      now,
      sourceRoot,
      zavorthRoot,
      tempRoot,
    });

    expect(snapshot.status).toBe('passed');
    expect(snapshot.semanticPhase).toBe('S5');
    expect(snapshot.packStatus).toBe('passed');
    expect(snapshot.summary).toEqual(expect.objectContaining({
      semanticClaims: 34,
      gaps: 0,
      packagesCertified: 13,
      memoryClaimsCertified: 3,
      documentClaimsCertified: 2,
      searchClaimsCertified: 2,
      shellSafetyClaimsCertified: 2,
      terminalClaimsCertified: 4,
      scenariosPassed: 4,
      liveNetworkPerformed: false,
      liveProcessSpawnedByDefault: false,
      secretValuesSerialized: false,
      sourceCodeCopied: false,
    }));
    expect(snapshot.summary.receiptBackedClaims).toBe(snapshot.summary.semanticClaims);
    expect(snapshot.policy).toEqual(expect.objectContaining({
      artifactFirstReceipts: true,
      memoryWriteReadReplayable: true,
      documentExtractionProducesArtifacts: true,
      searchAndFetchLiveNetworkRequiresExplicitCommand: true,
      terminalDisabledUntilPolicyAllows: true,
      dangerousShellRequiresApproval: true,
      scopedCwdRootsRequired: true,
      rawSecretValuesRejected: true,
      unsafeShellBypassRejected: true,
    }));
  });

  it('keeps package decisions explicit by semantic status', async () => {
    const snapshot = await buildSnapshot({
      now,
      sourceRoot,
      zavorthRoot,
      tempRoot,
    });

    expect(packageClaim(snapshot, '@source/memory-host-sdk')).toEqual(expect.objectContaining({
      status: 'covered',
      priority: 'P0',
    }));
    expect(packageClaim(snapshot, 'pdfjs-dist')).toEqual(expect.objectContaining({
      status: 'covered',
      priority: 'P0',
    }));
    expect(packageClaim(snapshot, 'duck-duck-scrape')).toEqual(expect.objectContaining({
      status: 'replaced',
    }));
    expect(packageClaim(snapshot, 'node-pty')).toEqual(expect.objectContaining({
      status: 'owner-gated',
    }));
    expect(packageClaim(snapshot, 'tree-sitter-bash')).toEqual(expect.objectContaining({
      status: 'owner-gated',
    }));
  });

  it('certifies memory document search proxy and terminal claims', async () => {
    const snapshot = await buildSnapshot({
      now,
      sourceRoot,
      zavorthRoot,
      tempRoot,
    });

    expect(snapshot.claims.filter((claim) => claim.kind === 'memory-runtime')).toHaveLength(3);
    expect(snapshot.claims.filter((claim) => claim.kind === 'document-extraction')).toHaveLength(2);
    expect(snapshot.claims).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'search-fetch-policy',
        status: 'covered',
        expectedBehavior: 'Search/fetch behavior is represented by artifact-first receipts and no live network by default.',
      }),
      expect.objectContaining({
        kind: 'proxy-policy',
        status: 'covered',
      }),
      expect.objectContaining({
        kind: 'cwd-sandbox',
        status: 'covered',
      }),
      expect.objectContaining({
        kind: 'optional-runtime-policy',
        status: 'owner-gated',
      }),
    ]));
    expect(snapshot.claims.filter((claim) => claim.kind === 'terminal-runtime')).toHaveLength(4);
    expect(snapshot.claims.filter((claim) => claim.kind === 'shell-safety-policy')).toHaveLength(2);
  });

  it('certifies blocked live fetch terminal and dangerous command scenarios', async () => {
    const snapshot = await buildSnapshot({
      now,
      sourceRoot,
      zavorthRoot,
      tempRoot,
    });
    const scenarios = Object.fromEntries(snapshot.scenarios.map((scenario) => [scenario.id, scenario]));

    expect(scenarios['memory-write-query']).toEqual(expect.objectContaining({
      status: 'passed',
      liveNetworkPerformed: false,
      liveProcessSpawned: false,
    }));
    expect(scenarios['blocked-live-fetch-without-confirm']).toEqual(expect.objectContaining({
      status: 'passed',
      liveNetworkPerformed: false,
    }));
    expect(scenarios['blocked-terminal-without-policy']).toEqual(expect.objectContaining({
      status: 'passed',
      liveProcessSpawned: false,
    }));
    expect(scenarios['blocked-dangerous-command']).toEqual(expect.objectContaining({
      status: 'passed',
      liveProcessSpawned: false,
    }));
    expect(snapshot.claims.filter((claim) => claim.kind === 'unsafe-operation-policy')).toHaveLength(3);
    expect(snapshot.claims).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'unsafe-operation-policy',
        status: 'rejected',
        expectedBehavior: 'The architecture must reject implicit live network fetch/search.',
      }),
      expect.objectContaining({
        kind: 'unsafe-operation-policy',
        status: 'rejected',
        expectedBehavior: 'The architecture must reject dangerous shell execution without explicit approval.',
      }),
    ]));
  });

  it('formats a readable S5 operator summary', async () => {
    const service = buildService({
      now,
      sourceRoot,
      zavorthRoot,
      tempRoot,
    });
    const text = service.formatSnapshotText(await service.buildSnapshot());

    expect(text).toContain('Zavorth Semantic Memory Document Terminal Certification - S5');
    expect(text).toContain('Status: passed');
    expect(text).toContain('Next: S6 - Native Companion And Device Capability Semantics');
  });
});

type Snapshot = Awaited<ReturnType<ZavorthSemanticMemoryDocumentTerminalCertificationService['buildSnapshot']>>;

function buildService(input: {
  now: () => Date;
  sourceRoot: string;
  zavorthRoot: string;
  tempRoot: string;
}): ZavorthSemanticMemoryDocumentTerminalCertificationService {
  return new ZavorthSemanticMemoryDocumentTerminalCertificationService({
    now: input.now,
    sourceRoot: input.sourceRoot,
    zavorthRoot: input.zavorthRoot,
    packService: new SourceMemoryDocumentTerminalPackService({
      now: input.now,
      sourceRoot: input.sourceRoot,
      zavorthRoot: input.zavorthRoot,
      memoryDbPath: path.join(input.tempRoot, 'semantic-credential-vault.sqlite'),
      shellSafetyClassifier: new ShellSafetyClassifier({
        now: input.now,
        allowedRoots: [input.zavorthRoot],
        treeSitterAvailable: false,
      }),
    }),
  });
}

async function buildSnapshot(input: {
  now: () => Date;
  sourceRoot: string;
  zavorthRoot: string;
  tempRoot: string;
}): Promise<Snapshot> {
  return await buildService(input).buildSnapshot();
}

function packageClaim(snapshot: Snapshot, packageName: string) {
  const claim = snapshot.claims.find((entry) =>
    entry.kind === 'package-coverage' && entry.packageName === packageName,
  );
  if (!claim) {
    throw new Error(`missing package claim ${packageName}`);
  }
  return claim;
}

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
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
