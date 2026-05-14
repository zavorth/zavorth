import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import {
  ZAVORTH_POST_RENAME_RECONCILIATION_PACK_RUNTIME_ID,
  createZavorthHardRenameImplementationPackFixture,
  createZavorthNpmReservationPackFixture,
  createZavorthPostRenameReconciliationPackFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC_287 = 'docs/287-zavorth-npm-reservation-pack.md';
const DOC_289 = 'docs/289-zavorth-post-rename-reconciliation-pack.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthPostRenameReconciliationPack.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const ROOT_PACKAGE = 'package.json';
const CREATE_PACKAGE = 'packages/create-zavorth/package.json';
const ROOT_PLACEHOLDER = 'packages/zavorth-reservation/package.json';
const CREATE_PLACEHOLDER = 'packages/create-zavorth-reservation/package.json';
const ROOT_PLACEHOLDER_BIN = 'packages/zavorth-reservation/bin/zavorth.js';
const CREATE_PLACEHOLDER_BIN = 'packages/create-zavorth-reservation/bin/create-zavorth.js';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(read(relativePath)) as T;
}

function assertNoRawSecret(serialized: string): void {
  expect(serialized).not.toMatch(/sk-(?:proj|svcacct)-[A-Za-z0-9_-]{20,}/);
  expect(serialized).not.toMatch(/sk-[A-Za-z0-9]{32,}/);
  expect(serialized).not.toMatch(/AKIA[0-9A-Z]{16}/);
  expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{20,}/);
  expect(serialized).not.toContain(['_auth', 'Token'].join(''));
}

function oldIdentityPath(...parts: string[]): string {
  return path.join(process.cwd(), parts.join('').replaceAll('/', path.sep));
}

function scanOldIdentityInCurrentProductSurface(): string[] {
  const oldCapitalized = ['Ast', 'erlyn'].join('');
  const oldLower = oldCapitalized.toLowerCase();
  const oldUpper = oldCapitalized.toUpperCase();
  const pattern = new RegExp(`${oldCapitalized}|${oldLower}|${oldUpper}`);
  const roots = [
    'src',
    'tests',
    'docs',
    'bin',
    'packages/create-zavorth',
    'scripts',
    'config',
    'assets',
    'sdk',
    'README.md',
    'package.json',
    '.env.example',
  ];
  const allowedFiles = new Set([
    'NAMING_DECISION.md',
    'docs/288-zavorth-hard-rename-implementation-pack.md',
    DOC_289,
    'src/runtime/external-agents/ZavorthHardRenameImplementationPack.ts',
    'tests/runtime/external-agents/ZavorthHardRenameImplementationPack.test.ts',
  ]);
  const skipDirs = new Set(['node_modules', '.tmp', 'dist', 'dist-ops']);
  const hits: string[] = [];

  function scanFile(fullPath: string): void {
    const relativePath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
    if (allowedFiles.has(relativePath)) {
      return;
    }
    if (pattern.test(relativePath)) {
      hits.push(relativePath);
      return;
    }
    let content = '';
    try {
      content = fs.readFileSync(fullPath, 'utf8');
    } catch {
      return;
    }
    if (pattern.test(content)) {
      hits.push(relativePath);
    }
  }

  function walk(fullPath: string): void {
    if (!fs.existsSync(fullPath)) {
      return;
    }
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(fullPath, { withFileTypes: true })) {
        if (entry.isDirectory() && skipDirs.has(entry.name)) {
          continue;
        }
        walk(path.join(fullPath, entry.name));
      }
      return;
    }
    if (stat.isFile()) {
      scanFile(fullPath);
    }
  }

  for (const root of roots) {
    walk(path.join(process.cwd(), root));
  }

  return hits;
}

describe('Zavorth post-rename reconciliation pack', () => {
  const pack = createZavorthPostRenameReconciliationPackFixture();

  it('exports the pack 289 boundary', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthPostRenameReconciliationPack/v1');
    expect(boundary).toContain('ZavorthRegistryReservationObservation/v1');
    expect(boundary).toContain('ZavorthInstallSmokeReport/v1');
    expect(index).toContain("from './ZavorthPostRenameReconciliationPack.js'");
    expect(pack.normalization.packId).toBe('289');
    expect(pack.normalization.runtimeId).toBe(ZAVORTH_POST_RENAME_RECONCILIATION_PACK_RUNTIME_ID);
  });

  it('records the reconciled registry reservation state', () => {
    expect(pack.normalization.decision).toBe('zavorth-post-rename-reconciliation-ready');
    expect(pack.normalization.finalState).toEqual(expect.objectContaining({
      rootPackageName: 'zavorth',
      rootBinName: 'zavorth',
      createPackageName: 'create-zavorth',
      createBinName: 'create-zavorth',
      npmReservationPublished: true,
      zavorthReservedVersion: '0.0.0-reserved.0',
      createZavorthReservedVersion: '0.0.0-reserved.0',
      placeholderLatestTagObserved: true,
      placeholderReservedTagObserved: true,
      realProductPublishPerformed: false,
      distTagChanged: false,
      installSmokePassed: true,
      placeholderPackagesRetainedAsHistoricalArtifacts: true,
      runtimePersistentStartPerformed: false,
    }));
    expect(pack.normalization.registryObservations).toEqual([
      expect.objectContaining({
        packageName: 'zavorth',
        latestTag: '0.0.0-reserved.0',
        reservedTag: '0.0.0-reserved.0',
        latestIsStableRelease: false,
        manuallyPublishedByOperator: true,
      }),
      expect.objectContaining({
        packageName: 'create-zavorth',
        latestTag: '0.0.0-reserved.0',
        reservedTag: '0.0.0-reserved.0',
        latestIsStableRelease: false,
        manuallyPublishedByOperator: true,
      }),
    ]);
  });

  it('validates current package, create package, bins and installers', () => {
    const rootPackage = readJson<any>(ROOT_PACKAGE);
    const createPackage = readJson<any>(CREATE_PACKAGE);

    expect(rootPackage.name).toBe('zavorth');
    expect(rootPackage.bin).toEqual({ zavorth: 'bin/zavorth.js' });
    expect(createPackage.name).toBe('create-zavorth');
    expect(createPackage.bin).toEqual({ 'create-zavorth': 'bin/create-zavorth.js' });
    expect(fs.existsSync(path.join(process.cwd(), 'bin/zavorth.js'))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), 'packages/create-zavorth/bin/create-zavorth.js'))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), 'scripts/install-zavorth.ps1'))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), 'scripts/install-zavorth.sh'))).toBe(true);
    expect(fs.existsSync(oldIdentityPath('bin/', 'ast', 'erlyn', '.js'))).toBe(false);
    expect(fs.existsSync(oldIdentityPath('packages/create-', 'ast', 'erlyn'))).toBe(false);
    expect(fs.existsSync(oldIdentityPath('scripts/install-', 'ast', 'erlyn', '.ps1'))).toBe(false);
    expect(fs.existsSync(oldIdentityPath('scripts/install-', 'ast', 'erlyn', '.sh'))).toBe(false);
  });

  it('keeps reservation placeholders as historical no-op artifacts outside root package files', () => {
    const rootPackage = readJson<any>(ROOT_PACKAGE);
    const rootPlaceholder = readJson<any>(ROOT_PLACEHOLDER);
    const createPlaceholder = readJson<any>(CREATE_PLACEHOLDER);

    expect(rootPlaceholder).toEqual(expect.objectContaining({
      name: 'zavorth',
      version: '0.0.0-reserved.0',
    }));
    expect(createPlaceholder).toEqual(expect.objectContaining({
      name: 'create-zavorth',
      version: '0.0.0-reserved.0',
    }));
    expect(JSON.stringify(rootPackage.files)).not.toContain('zavorth-reservation');
    expect(JSON.stringify(rootPackage.files)).not.toContain('create-zavorth-reservation');
    expect(pack.placeholderPackagesAreHistoricalOnly()).toBe(true);

    const rootOutput = execFileSync(process.execPath, [ROOT_PLACEHOLDER_BIN], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    const createOutput = execFileSync(process.execPath, [CREATE_PLACEHOLDER_BIN], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    expect(rootOutput).toContain('No runtime was started.');
    expect(createOutput).toContain('No runtime was started.');
    expect(rootOutput).not.toMatch(/\bnpm install\b/i);
    expect(createOutput).not.toMatch(/\bnpm install\b/i);
    assertNoRawSecret(`${rootOutput}\n${createOutput}`);
  });

  it('records install smoke and cleanup requirements', () => {
    expect(pack.allInstallSmokeCommandsPassed()).toBe(true);
    expect(pack.normalization.installSmoke.rootTarballPacked).toBe(true);
    expect(pack.normalization.installSmoke.createTarballPacked).toBe(true);
    expect(pack.normalization.installSmoke.tempRootInstallPerformed).toBe(true);
    expect(pack.normalization.installSmoke.tempCreateInstallPerformed).toBe(true);
    expect(pack.normalization.installSmoke.tempEnvironmentCleaned).toBe(true);
    expect(pack.normalization.installSmoke.tgzArtifactsCleaned).toBe(true);
    expect(pack.normalization.installSmoke.runtimePersistentStartPerformed).toBe(false);
    expect(pack.normalization.installSmoke.rootCommands.map((command) => command.command)).toEqual([
      'npx --no-install zavorth --help',
      'npx --no-install zavorth setup --help',
      'npx --no-install zavorth setup --dry-run',
      'npx --no-install zavorth doctor --help',
      'npx --no-install zavorth go --dry-run --timeout-ms=1000 --poll-ms=250',
    ]);
    expect(pack.normalization.installSmoke.createCommands.map((command) => command.command)).toEqual([
      'npx --no-install create-zavorth --help',
      'npx --no-install create-zavorth --dry-run',
    ]);
  });

  it('updates docs 287 and 289 with manual reservation publication and no product publish', () => {
    const doc287 = read(DOC_287);
    const doc289 = read(DOC_289);
    const namingReservationPack = createZavorthNpmReservationPackFixture();
    const hardRenamePack = createZavorthHardRenameImplementationPackFixture();

    expect(doc287).toContain('Publicacao Manual Observada');
    expect(doc287).toContain('latest -> 0.0.0-reserved.0');
    expect(doc287).toContain('Nao publique novamente `0.0.0-reserved.0`');
    expect(doc289).toContain('zavorth-post-rename-reconciliation-ready');
    expect(doc289).toContain('placeholderPackagesRetainedAsHistoricalArtifacts');
    expect(doc289).toContain('realProductPublishPerformed=false');
    expect(namingReservationPack.normalization.decision).toBe('zavorth-npm-reservation-published');
    expect(hardRenamePack.normalization.rootPackageName).toBe('zavorth');
    assertNoRawSecret(`${doc287}\n${doc289}\n${JSON.stringify(pack.normalization)}`);
  });

  it('keeps blocked actions blocked and identity scan layers explicit', () => {
    expect(pack.blockedActionPerformed()).toBe(false);
    expect(pack.normalization.blockedActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'npm-publish', performed: false }),
      expect.objectContaining({ action: 'dist-tag-change', performed: false }),
      expect.objectContaining({ action: 'runtime-persistent-start', performed: false }),
      expect.objectContaining({ action: 'provider-tool-command-message-execution', performed: false }),
      expect.objectContaining({ action: 'read-or-serialize-npm-token', performed: false }),
    ]));
    expect(pack.normalization.identityScanLayers.map((layer) => layer.layer)).toEqual([
      'current-product-surface',
      'broader-repo-areas',
      'historical-exclusions',
    ]);
    expect(scanOldIdentityInCurrentProductSurface()).toEqual([]);
  });
});
