import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_RENAME_IMPLEMENTATION_PACK_RUNTIME_ID,
  createZavorthRenameImplementationPackFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/270-zavorth-rename-implementation-pack.md';
const DOC_269 = 'docs/269-zavorth-rename-planning-pack.md';
const NAMING_DECISION = 'NAMING_DECISION.md';
const ROOT_PACKAGE = 'package.json';
const ROOT_LOCK = 'package-lock.json';
const ROOT_ZAVORTH_BIN = 'bin/zavorth.js';
const ROOT_ZAVORTH_BIN = 'bin/zavorth.js';
const CREATE_PACKAGE = 'packages/create-zavorth/package.json';
const CREATE_BIN = 'packages/create-zavorth/bin/create-zavorth.js';
const LEGACY_CREATE_PACKAGE = 'packages/create-zavorth/package.json';
const LEGACY_CREATE_BIN = 'packages/create-zavorth/bin/create-zavorth.js';
const PUBLIC_DOCS = [
  'README.md',
  'docs/02-quickstart.md',
  'docs/09-operations.md',
  'docs/10-troubleshooting.md',
  'docs/34-zavorth-cli.md',
];

const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function exists(relativePath: string): boolean {
  return fs.existsSync(path.join(process.cwd(), relativePath));
}

function assertNoRawSecretOrContent(serialized: string): void {
  expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  expect(serialized).not.toMatch(/sk-(?:proj|svcacct)-[A-Za-z0-9_-]{20,}/);
  expect(serialized).not.toMatch(/sk-[A-Za-z0-9]{32,}/);
  expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{20,}/);
  expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{20,}/);
  expect(serialized).not.toContain('_auth' + 'Token');
  expect(serialized).not.toContain('raw user message body' + ' that must never migrate');
}

describe('Zavorth rename implementation pack', () => {
  const pack = createZavorthRenameImplementationPackFixture();

  it('exports the 270 boundary and final Zavorth state', () => {
    expect(pack.normalization.nativeContract).toBe('ZavorthRenameImplementationPack/v1');
    expect(pack.normalization.packId).toBe('270');
    expect(pack.normalization.runtimeId).toBe(ZAVORTH_RENAME_IMPLEMENTATION_PACK_RUNTIME_ID);
    expect(pack.normalization.decision).toBe('zavorth-public-rename-implemented');
    expect(pack.normalization.publicProductName).toBe('Zavorth');
    expect(pack.normalization.internalCodenamePolicy).toBe('zavorth-internal-codename-retained');
    expect(pack.normalization.finalState).toEqual(expect.objectContaining({
      decision: 'zavorth-public-rename-implemented',
      publicProductName: 'Zavorth',
      rootPackageName: 'zavorth',
      primaryCliBin: 'zavorth',
      legacyCliBin: 'zavorth',
      createPackageName: 'create-zavorth',
      legacyCreatePackageName: 'create-zavorth',
      githubOrgUrl: 'https://github.com/zavorth',
      primaryDomainCandidate: 'zavorth.dev',
      dotComUnavailable: true,
      scopedFallbackReserved: false,
    }));
  });

  it('renames root package and exposes zavorth with zavorth alias', () => {
    const rootPackage = JSON.parse(read(ROOT_PACKAGE)) as {
      name: string;
      description: string;
      bin: Record<string, string>;
      files: string[];
    };
    const rootLock = JSON.parse(read(ROOT_LOCK)) as {
      name: string;
      packages: Record<string, { name?: string; bin?: Record<string, string> }>;
    };

    expect(rootPackage.name).toBe('zavorth');
    expect(rootPackage.description).toContain('Zavorth');
    expect(rootPackage.bin.zavorth).toBe('bin/zavorth.js');
    expect(rootPackage.bin.zavorth).toBe('bin/zavorth.js');
    expect(rootPackage.bin['create-zavorth']).toBeUndefined();
    expect(rootPackage.bin['create-zavorth']).toBeUndefined();
    expect(rootPackage.files).toEqual(expect.arrayContaining(['bin/zavorth.js', 'bin/zavorth.js']));
    expect(rootPackage.files).not.toContain('bin/');
    expect(rootLock.name).toBe('zavorth');
    expect(rootLock.packages[''].name).toBe('zavorth');
    expect(rootLock.packages[''].bin).toEqual({
      zavorth: 'bin/zavorth.js',
      zavorth: 'bin/zavorth.js',
    });
  });

  it('creates primary CLI launcher while preserving legacy alias', () => {
    const zavorthBin = read(ROOT_ZAVORTH_BIN);
    const zavorthBin = read(ROOT_ZAVORTH_BIN);

    expect(zavorthBin).toContain('Zavorth CLI build not found.');
    expect(zavorthBin).toContain("dist', 'zavorth-cli.js'");
    expect(zavorthBin).toContain("ZAVORTH_PUBLIC_CLI: '1'");
    expect(zavorthBin).toContain('zavorth is now Zavorth');
    expect(zavorthBin).toContain('prefer zavorth <command>');
    expect(zavorthBin).toContain('ZAVORTH_SUPPRESS_LEGACY_ALIAS_WARNING');
  });

  it('creates create-zavorth package and keeps create-zavorth compatibility', () => {
    const createPackage = JSON.parse(read(CREATE_PACKAGE)) as {
      name: string;
      description: string;
      bin: Record<string, string>;
    };
    const legacyCreatePackage = JSON.parse(read(LEGACY_CREATE_PACKAGE)) as {
      name: string;
      description: string;
      bin: Record<string, string>;
    };
    const createBin = read(CREATE_BIN);
    const legacyCreateBin = read(LEGACY_CREATE_BIN);

    expect(createPackage.name).toBe('create-zavorth');
    expect(createPackage.description).toContain('Zavorth');
    expect(createPackage.bin['create-zavorth']).toBe('bin/create-zavorth.js');
    expect(createPackage.bin['create-zavorth']).toBe('bin/create-zavorth.js');
    expect(createBin).toContain('npm create zavorth');
    expect(createBin).toContain("command: 'create-zavorth'");
    expect(createBin).toContain("packageName: 'create-zavorth'");
    expect(createBin).toContain('my-zavorth-app');

    expect(legacyCreatePackage.name).toBe('create-zavorth');
    expect(legacyCreatePackage.description).toContain('Legacy');
    expect(legacyCreateBin).toContain("preferredCommand: 'create-zavorth'");
    expect(legacyCreateBin).toContain('legacy create-zavorth alias');
  });

  it('keeps public docs Zavorth-first without promoting bat files or source identity', () => {
    for (const docPath of PUBLIC_DOCS) {
      const content = read(docPath);

      expect(content).toContain('Zavorth');
      expect(content).toContain('zavorth');
      expect(content).not.toMatch(/\.bat\b/i);
      expect(content).not.toMatch(/ExternalExecutor|external-executor/);
      assertNoRawSecretOrContent(content);
    }

    const readme = read('README.md');
    const quickstart = read('docs/02-quickstart.md');
    const cliDoc = read('docs/34-zavorth-cli.md');

    expect(readme).toContain('zavorth setup');
    expect(readme).toContain('zavorth go');
    expect(readme).toContain('zavorth doctor');
    expect(readme).toContain('docs/34-zavorth-cli.md');
    expect(quickstart).toContain('npm install -g zavorth');
    expect(quickstart).toContain('npm create zavorth');
    expect(cliDoc).toContain('# Zavorth CLI');
    expect(cliDoc).toContain('Legacy Alias');
    expect(cliDoc).toContain('`zavorth` is now Zavorth');
  });

  it('documents 270 and updates naming/planning history', () => {
    const doc = read(DOC);
    const doc269 = read(DOC_269);
    const namingDecision = read(NAMING_DECISION);

    expect(doc).toContain('Status: `zavorth-public-rename-implemented`');
    expect(doc).toContain('rootPackageName=zavorth');
    expect(doc).toContain('npmPublishActuallyPerformed=false');
    expect(doc).toContain('githubOrgCreatedByThisPack=false');
    expect(doc).toContain('domainPurchased=false');
    expect(doc).toContain('externalExecutorPublicIdentityReintroduced=false');
    expect(doc269).toContain('270 implementation note');
    expect(doc269).toContain('zavorth-public-rename-implemented');
    expect(namingDecision).toContain('270 - Zavorth Rename Implementation Pack');
    assertNoRawSecretOrContent(doc);
    assertNoRawSecretOrContent(doc269);
    assertNoRawSecretOrContent(namingDecision);
  });

  it('records dangerous actions as blocked and unperformed', () => {
    expect(pack.dangerousActionPerformed()).toBe(false);
    expect(pack.normalization.finalState).toEqual(expect.objectContaining({
      npmPublishActuallyPerformed: false,
      createPackagePublishActuallyPerformed: false,
      githubOrgCreatedByThisPack: false,
      domainPurchased: false,
      trademarkFiled: false,
      runtimeDangerousBehaviorChanged: false,
      externalExecutorPublicIdentityReintroduced: false,
      adapterGlobalRemoval: false,
      rawSecretSerialized: false,
      rawHistoryImported: false,
    }));
    expect(pack.normalization.blockedActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'npm-publish', performed: false }),
      expect.objectContaining({ action: 'create-package-publish', performed: false }),
      expect.objectContaining({ action: 'domain-purchase', performed: false }),
      expect.objectContaining({ action: 'github-org-create', performed: false }),
      expect.objectContaining({ action: 'trademark-file', performed: false }),
      expect.objectContaining({ action: 'adapter-global-removal', performed: false }),
      expect.objectContaining({ action: 'raw-history-import', performed: false }),
      expect.objectContaining({ action: 'real-message-send', performed: false }),
      expect.objectContaining({ action: 'provider-tool-command-execution', performed: false }),
    ]));
  });

  it('keeps required files present and serializes without raw secrets', () => {
    [
      DOC,
      ROOT_ZAVORTH_BIN,
      ROOT_ZAVORTH_BIN,
      CREATE_PACKAGE,
      CREATE_BIN,
    ].forEach((relativePath) => expect(exists(relativePath)).toBe(true));

    expect(pack.checkPassed('package-root-renamed')).toBe(true);
    expect(pack.checkPassed('zavorth-bin-created')).toBe(true);
    expect(pack.checkPassed('zavorth-legacy-bin-preserved')).toBe(true);
    expect(pack.checkPassed('create-zavorth-package-prepared')).toBe(true);
    assertNoRawSecretOrContent(JSON.stringify(pack.normalization));
  });
});
