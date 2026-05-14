import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_HARD_RENAME_LEGACY_IDENTITY_PURGE_PACK_RUNTIME_ID,
  createZavorthHardRenameLegacyIdentityPurgePackFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/276-zavorth-hard-rename-and-legacy-identity-purge-pack.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthHardRenameLegacyIdentityPurgePack.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const ROOT_PACKAGE = 'package.json';
const ROOT_LOCK = 'package-lock.json';
const CREATE_PACKAGE = 'packages/create-zavorth/package.json';

const legacyLower = 'bas' + 'ilisk';
const legacyTitle = 'Bas' + 'ilisk';
const legacyUpper = 'BAS' + 'ILISK';
const legacyIdentityPattern = new RegExp(`${legacyTitle}|${legacyLower}|${legacyUpper}`);

const CURRENT_PRODUCT_SCAN_TARGETS = [
  'src',
  'tests',
  'docs',
  'bin',
  'packages',
  'scripts',
  'config',
  'apps',
  'assets',
  'sdk',
  'README.md',
  'NAMING_DECISION.md',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'jest.config.cjs',
  'AGENTS.md',
  'IDENTITY.md',
  'BOOTSTRAP.md',
  'ZAVORTH_EVOLUTION.md',
  'ZAVORTH_EVOLUTION_CHECKLIST.md',
  '.env.example',
];

const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-ops', 'coverage', '.git', '.tmp']);
const SKIP_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.pdf',
  '.zip',
  '.tgz',
  '.gz',
  '.sqlite',
  '.db',
  '.bin',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.mp4',
  '.mov',
  '.wav',
  '.mp3',
  '.woff',
  '.woff2',
  '.ttf',
]);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function exists(relativePath: string): boolean {
  return fs.existsSync(path.join(process.cwd(), relativePath));
}

function scanCurrentProductTargets(): string[] {
  const hits: string[] = [];

  function scanFile(filePath: string): void {
    if (SKIP_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
      return;
    }
    const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
    const text = fs.readFileSync(filePath, 'utf8');
    if (legacyIdentityPattern.test(relativePath) || legacyIdentityPattern.test(text)) {
      hits.push(relativePath);
    }
  }

  function walk(itemPath: string): void {
    if (!fs.existsSync(itemPath)) {
      return;
    }
    const stat = fs.statSync(itemPath);
    if (stat.isDirectory()) {
      if (SKIP_DIRS.has(path.basename(itemPath))) {
        return;
      }
      for (const entry of fs.readdirSync(itemPath)) {
        walk(path.join(itemPath, entry));
      }
      return;
    }
    if (stat.isFile()) {
      scanFile(itemPath);
    }
  }

  for (const target of CURRENT_PRODUCT_SCAN_TARGETS) {
    walk(path.join(process.cwd(), target));
  }

  return hits;
}

function assertNoRawSecret(serialized: string): void {
  expect(serialized).not.toMatch(/sk-(?:proj|svcacct)-[A-Za-z0-9_-]{20,}/);
  expect(serialized).not.toMatch(/sk-[A-Za-z0-9]{32,}/);
  expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{20,}/);
  expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{20,}/);
  expect(serialized).not.toContain('_auth' + 'Token');
}

describe('Zavorth hard rename legacy identity purge pack', () => {
  const pack = createZavorthHardRenameLegacyIdentityPurgePackFixture();

  it('exports the 276 boundary and final state contract', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthHardRenameLegacyIdentityPurgePack/v1');
    expect(boundary).toContain('ZavorthLegacyOccurrenceScan/v1');
    expect(index).toContain("from './ZavorthHardRenameLegacyIdentityPurgePack.js'");
    expect(pack.normalization.packId).toBe('276');
    expect(pack.normalization.runtimeId).toBe(ZAVORTH_HARD_RENAME_LEGACY_IDENTITY_PURGE_PACK_RUNTIME_ID);
    expect(pack.normalization.decision).toBe('zavorth-hard-rename-purge-ready');
  });

  it('prepares alpha.2 package metadata and removes old public aliases', () => {
    const rootPackage = JSON.parse(read(ROOT_PACKAGE)) as {
      name: string;
      version: string;
      bin: Record<string, string>;
      files: string[];
    };
    const rootLock = JSON.parse(read(ROOT_LOCK)) as {
      name: string;
      version: string;
      packages: Record<string, { name?: string; version?: string; bin?: Record<string, string> }>;
    };
    const createPackage = JSON.parse(read(CREATE_PACKAGE)) as {
      name: string;
      version: string;
      bin: Record<string, string>;
    };

    expect(rootPackage).toEqual(expect.objectContaining({
      name: 'zavorth',
      version: '1.1.0-alpha.2',
    }));
    expect(rootPackage.bin).toEqual({ zavorth: 'bin/zavorth.js' });
    expect(rootPackage.files).toContain('bin/zavorth.js');
    expect(rootPackage.files).not.toContain(`bin/${legacyLower}.js`);
    expect(rootLock).toEqual(expect.objectContaining({
      name: 'zavorth',
      version: '1.1.0-alpha.2',
    }));
    expect(rootLock.packages['']).toEqual(expect.objectContaining({
      name: 'zavorth',
      version: '1.1.0-alpha.2',
      bin: { zavorth: 'bin/zavorth.js' },
    }));
    expect(createPackage).toEqual(expect.objectContaining({
      name: 'create-zavorth',
      version: '1.1.0-alpha.2',
      bin: { 'create-zavorth': 'bin/create-zavorth.js' },
    }));
    expect(exists(path.join('bin', `${legacyLower}.js`))).toBe(false);
    expect(exists(path.join('bin', `create-${legacyLower}.js`))).toBe(false);
    expect(exists(path.join('packages', `create-${legacyLower}`))).toBe(false);
    expect(exists(path.join('packages', 'create-zavorth', 'bin', `create-${legacyLower}.js`))).toBe(false);
    expect(pack.legacyAliasesRemoved()).toBe(true);
  });

  it('has a clean current product scan while quarantining historical external artifacts', () => {
    expect(pack.currentProductScanIsClean()).toBe(true);
    expect(scanCurrentProductTargets()).toEqual([]);
    expect(pack.normalization.occurrenceScans).toEqual(expect.arrayContaining([
      expect.objectContaining({
        scope: 'current-product-targets',
        beforeOccurrences: 264,
        afterOccurrences: 0,
        category: 'current-product',
      }),
      expect.objectContaining({
        scope: 'initial-mechanical-targets',
        beforeOccurrences: 36582,
        afterOccurrences: 0,
      }),
      expect.objectContaining({
        scope: 'root-shortcut-files',
        beforeOccurrences: 6,
        afterOccurrences: 0,
      }),
      expect.objectContaining({
        scope: 'excluded-local-state-and-generated-artifacts',
        category: 'local-state-cache',
      }),
    ]));
  });

  it('documents renamed artifacts, validations, and blocked actions', () => {
    expect(pack.normalization.renamedArtifacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ to: 'src/zavorth-cli.ts' }),
      expect.objectContaining({ to: 'bin/zavorth.js' }),
      expect.objectContaining({ to: 'bin/create-zavorth.js' }),
      expect.objectContaining({ to: 'docs/34-zavorth-cli.md' }),
      expect.objectContaining({ to: 'packages/create-zavorth' }),
    ]));
    expect(pack.normalization.validationCommands.map((command) => command.command)).toEqual(expect.arrayContaining([
      'npm run runtime:check --silent',
      'npm run build --silent',
      'node bin/zavorth.js --help',
      'node packages/create-zavorth/bin/create-zavorth.js --help',
      'npm pack --dry-run --json',
    ]));
    expect(pack.blockedActionPerformed()).toBe(false);
  });

  it('records the public Zavorth-only final state without publishing or dangerous runtime work', () => {
    expect(pack.normalization.finalState).toEqual(expect.objectContaining({
      decision: 'zavorth-hard-rename-purge-ready',
      legacyPublicIdentityRemoved: true,
      legacyCliAliasRemoved: true,
      legacyCreateAliasRemoved: true,
      publicSurfaceZavorthOnly: true,
      packageJsonRenamedToZavorth: true,
      futureVersionPrepared: '1.1.0-alpha.2',
      npmPublishActuallyPerformed: false,
      gitHistoryRewritten: false,
      runtimeDangerousBehaviorChanged: false,
      adapterGlobalRemoval: false,
      rawHistoryImported: false,
      rawSecretSerialized: false,
    }));
    assertNoRawSecret(JSON.stringify(pack.normalization));
  });

  it('documents the hard rename handoff without leaking old identity into the product scan', () => {
    const doc = read(DOC);

    expect(doc).toContain('Zavorth Hard Rename And Legacy Identity Purge Pack');
    expect(doc).toContain('Status: `zavorth-hard-rename-purge-ready`');
    expect(doc).toContain('1.1.0-alpha.2');
    expect(doc).toContain('legacyCliAliasRemoved=true');
    expect(doc).toContain('legacyCreateAliasRemoved=true');
    expect(doc).not.toMatch(legacyIdentityPattern);
    assertNoRawSecret(doc);
  });
});
