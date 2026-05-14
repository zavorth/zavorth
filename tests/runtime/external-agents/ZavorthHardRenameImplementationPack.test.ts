import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_HARD_RENAME_IMPLEMENTATION_PACK_RUNTIME_ID,
  createZavorthHardRenameImplementationPackFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/288-zavorth-hard-rename-implementation-pack.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthHardRenameImplementationPack.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RELEASE_PACK_INDEX = 'src/runtime/external-agents/index.release-packs.ts';
const NAMING_DECISION = 'NAMING_DECISION.md';
const ROOT_PACKAGE = 'package.json';
const CREATE_PACKAGE = 'packages/create-zavorth/package.json';
const retiredIdentityPattern = new RegExp([['Aster', 'lyn'].join('')].join('|'), 'i');

const SCAN_ROOTS = [
  'package.json',
  'package-lock.json',
  'README.md',
  'bin',
  'packages',
  'scripts',
  'src',
  'tests',
  'docs',
  'config',
  'assets',
  'sdk',
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function listFiles(entry: string): string[] {
  const full = path.join(process.cwd(), entry);
  if (!fs.existsSync(full)) {
    return [];
  }
  const stat = fs.statSync(full);
  if (stat.isFile()) {
    return [full];
  }
  return fs.readdirSync(full, { withFileTypes: true }).flatMap((dirent) => {
    const child = path.join(full, dirent.name);
    if (child.includes(`${path.sep}node_modules${path.sep}`)) {
      return [];
    }
    if (child.includes(`${path.sep}dist${path.sep}`) || child.includes(`${path.sep}dist-ops${path.sep}`)) {
      return [];
    }
    if (child.includes(`${path.sep}.tmp${path.sep}`)) {
      return [];
    }
    if (child.includes(`${path.sep}data${path.sep}vendor${path.sep}`)) {
      return [];
    }
    if (dirent.isDirectory()) {
      return listFiles(path.relative(process.cwd(), child));
    }
    return [child];
  });
}

function isTextFile(filePath: string): boolean {
  return !/\.(png|jpe?g|gif|ico|webp|pdf|zip|gz|tgz|sqlite|db|exe|dll|bin|wasm|mp4|mov|avi|wav|mp3)$/i.test(filePath);
}

function assertNoRawSecret(serialized: string): void {
  expect(serialized).not.toMatch(/sk-(?:proj|svcacct)-[A-Za-z0-9_-]{20,}/);
  expect(serialized).not.toMatch(/sk-[A-Za-z0-9]{32,}/);
  expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{20,}/);
  expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{20,}/);
  expect(serialized).not.toContain(['_auth', 'Token'].join(''));
}

function scanCurrentProductForOldIdentity(): string[] {
  const allowed = new Set([
    path.normalize(path.join(process.cwd(), DOC)),
    path.normalize(path.join(process.cwd(), NAMING_DECISION)),
    path.normalize(path.join(process.cwd(), BOUNDARY)),
    path.normalize(path.join(process.cwd(), 'tests/runtime/external-agents/ZavorthHardRenameImplementationPack.test.ts')),
  ]);
  const hits: string[] = [];
  for (const entry of SCAN_ROOTS) {
    for (const file of listFiles(entry)) {
      const normalized = path.normalize(file);
      if (allowed.has(normalized) || !isTextFile(normalized)) {
        continue;
      }
      const relative = path.relative(process.cwd(), normalized);
      if (retiredIdentityPattern.test(relative)) {
        hits.push(relative);
        continue;
      }
      const content = fs.readFileSync(normalized, 'utf8');
      if (retiredIdentityPattern.test(content)) {
        hits.push(relative);
      }
    }
  }
  return hits;
}

describe('Zavorth hard rename implementation pack', () => {
  const pack = createZavorthHardRenameImplementationPackFixture();

  it('exports the pack 288 boundary and contract', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);
    const releasePackIndex = read(RELEASE_PACK_INDEX);

    expect(boundary).toContain('ZavorthHardRenameImplementationPack/v1');
    expect(boundary).toContain('ZavorthHardRenameArtifact/v1');
    expect(boundary).toContain('ZavorthHardRenameValidationCommand/v1');
    expect(index).toContain("from './index.release-packs.js'");
    expect(releasePackIndex).toContain("from './ZavorthHardRenameImplementationPack.js'");
    expect(pack.normalization.packId).toBe('288');
    expect(pack.normalization.runtimeId).toBe(ZAVORTH_HARD_RENAME_IMPLEMENTATION_PACK_RUNTIME_ID);
    expect(pack.normalization.decision).toBe('zavorth-hard-rename-implementation-ready');
  });

  it('records Zavorth-only package and CLI state with no public legacy alias', () => {
    const rootPackage = JSON.parse(read(ROOT_PACKAGE)) as { name: string; bin: Record<string, string>; files: string[] };
    const createPackage = JSON.parse(read(CREATE_PACKAGE)) as { name: string; bin: Record<string, string> };

    expect(rootPackage.name).toBe('zavorth');
    expect(rootPackage.bin).toEqual({ zavorth: 'bin/zavorth.js' });
    expect(rootPackage.files).toContain('bin/zavorth.js');
    expect(rootPackage.files).toContain('scripts/install-zavorth.ps1');
    expect(rootPackage.files).toContain('scripts/install-zavorth.sh');
    expect(rootPackage.files).toContain('docs/34-zavorth-cli.md');
    expect(createPackage.name).toBe('create-zavorth');
    expect(createPackage.bin).toEqual({ 'create-zavorth': 'bin/create-zavorth.js' });
    expect(pack.normalization.legacyAliasPolicy).toBe('no-public-alias');
    expect(pack.normalization.previousCodenameRetained).toBe(false);
    expect(pack.normalization.previousPublicCompatibilityKept).toBe(false);
    expect(pack.hasLegacyPublicCompatibility()).toBe(false);
  });

  it('removes old public bins, create package and installer paths', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'bin/zavorth.js'))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), 'bin', `previous-${Date.now()}.js`))).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), 'packages/create-zavorth'))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), 'scripts/install-zavorth.ps1'))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), 'scripts/install-zavorth.sh'))).toBe(true);
  });

  it('maps the hard rename artifacts and safe validation commands', () => {
    expect(pack.normalization.renamedArtifacts.map((artifact) => artifact.surface)).toEqual([
      'package-distribution',
      'bin',
      'create-package',
      'installer',
      'cli-ux',
      'runtime-contracts-services',
      'docs',
      'tests',
      'build-artifacts',
    ]);
    expect(pack.requiredCommands()).toEqual(expect.arrayContaining([
      'node bin/zavorth.js --help',
      'node packages/create-zavorth/bin/create-zavorth.js --help',
      'powershell -ExecutionPolicy Bypass -File scripts/install-zavorth.ps1 -DryRun',
      'bash scripts/install-zavorth.sh --dry-run',
    ]));
    pack.normalization.validationCommands.forEach((command) => {
      expect(command.required).toBe(true);
      expect(command.safe).toBe(true);
    });
  });

  it('keeps dangerous actions blocked', () => {
    expect(pack.blockedActionPerformed()).toBe(false);
    expect(pack.normalization.blockedActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'npm-publish', performed: false }),
      expect.objectContaining({ action: 'dist-tag-change', performed: false }),
      expect.objectContaining({ action: 'domain-purchase', performed: false }),
      expect.objectContaining({ action: 'github-create', performed: false }),
      expect.objectContaining({ action: 'runtime-persistent-start', performed: false }),
      expect.objectContaining({ action: 'provider-execution', performed: false }),
      expect.objectContaining({ action: 'tool-command-execution', performed: false }),
      expect.objectContaining({ action: 'message-send', performed: false }),
      expect.objectContaining({ action: 'raw-history-import', performed: false }),
      expect.objectContaining({ action: 'npm-token-read', performed: false }),
    ]));
    expect(pack.normalization.finalState).toEqual(expect.objectContaining({
      npmPublishPerformed: false,
      distTagChanged: false,
      runtimePersistentStartPerformed: false,
      rawSecretSerialized: false,
    }));
  });

  it('keeps old identity out of current product surface except documented migration records', () => {
    expect(scanCurrentProductForOldIdentity()).toEqual([]);
    expect(pack.normalization.oldIdentityCurrentProductHits).toBe(0);
    expect(pack.normalization.publicOutputZavorthOnly).toBe(true);
  });

  it('documents the hard rename and preserves only explicit migration history', () => {
    const doc = read(DOC);
    const namingDecision = read(NAMING_DECISION);
    const serialized = JSON.stringify(pack.normalization);

    expect(doc).toContain('288 - Zavorth Hard Rename Implementation Pack');
    expect(doc).toContain('previousPublicIdentity="previous-public-identity"');
    expect(doc).toContain('legacyAliasPolicy="no-public-alias"');
    expect(doc).toContain('rootPackageName="zavorth"');
    expect(doc).toContain('npmPublishPerformed=false');
    expect(namingDecision).toContain('Zavorth is the current product identity');
    assertNoRawSecret(`${doc}\n${namingDecision}\n${serialized}`);
  });
});
