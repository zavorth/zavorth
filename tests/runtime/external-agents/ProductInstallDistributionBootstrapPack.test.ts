import fs from 'node:fs';
import path from 'node:path';

import {
  createProductInstallDistributionBootstrapPackFixture,
  createProductInstallDistributionSource,
  normalizeProductInstallDistributionBootstrapPack,
  PRODUCT_INSTALL_DISTRIBUTION_BOOTSTRAP_PACK_RUNTIME_ID,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ProductInstallDistributionSource,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/260-product-install-distribution-bootstrap-pack.md';
const BOUNDARY = 'src/runtime/external-agents/ProductInstallDistributionBootstrapPack.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const PACKAGE_JSON = 'package.json';
const BIN_SHIM = 'bin/zavorth.js';

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

function assertNoRawSecret(serialized: string): void {
  expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  expect(serialized).not.toMatch(/(?<![A-Za-z])sk-[A-Za-z0-9_-]{20,}/);
  expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{20,}/);
  expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{20,}/);
  expect(serialized).not.toContain('synthetic-raw-credential-sentinel-that-must-not-appear');
  expect(serialized).not.toContain('<redacted-local-secret>');
}

describe('Product install distribution bootstrap pack', () => {
  it('documents 260 with distribution bootstrap guarantees and no publish', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `product-install-distribution-bootstrap-ready`');
    expect(content).toContain('ProductInstallDistributionBootstrapPack.ts');
    expect(content).toContain('ProductInstallDistributionBootstrapPack/v1');
    expect(content).toContain('ProductInstallDistributionPath/v1');
    expect(content).toContain('ProductInstallPackageReadiness/v1');
    expect(content).toContain('ProductInstallFutureCreateZavorthDesign/v1');
    expect(content).toContain('npm install -g zavorth');
    expect(content).toContain('npx zavorth setup');
    expect(content).toContain('npm create zavorth');
    expect(content).toContain('npm pack --dry-run');
    expect(content).toContain('npmPublishActuallyPerformed=false');
    expect(content).toContain('Do not advance beyond `260`');
    assertNoRawSecret(content);
  });

  it('exports the boundary and keeps the fixture ready', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);
    const pack = createProductInstallDistributionBootstrapPackFixture();

    expect(boundary).toContain('ProductInstallDistributionBootstrapPack/v1');
    expect(index).toContain("from './ProductInstallDistributionBootstrapPack.js'");
    expect(index).toContain('PRODUCT_INSTALL_DISTRIBUTION_BOOTSTRAP_PACK_RUNTIME_ID');
    expect(pack.normalization.decision).toBe('product-install-distribution-bootstrap-ready');
    expect(pack.path('global-npm-install').commands).toEqual([
      'npm install -g zavorth',
      'zavorth setup',
      'zavorth go',
      'zavorth doctor',
    ]);
    expect(pack.path('npx-setup')).toMatchObject({
      status: 'designed-experimental',
      commands: ['npx zavorth setup'],
    });
    expect(pack.path('future-npm-create-zavorth')).toMatchObject({
      status: 'designed-experimental',
      commands: ['npm create zavorth'],
    });
    expect(pack.path('repo-local').commands).toEqual([
      'npm install',
      'npm run setup',
      'npm run go',
      'npm run doctor',
    ]);
  });

  it('prepares package metadata for global install without publishing', () => {
    const pkg = JSON.parse(read(PACKAGE_JSON)) as {
      name: string;
      version: string;
      main: string;
      bin: Record<string, string>;
      files: string[];
      scripts: Record<string, string>;
    };
    const pack = createProductInstallDistributionBootstrapPackFixture();

    expect(pkg.name).toBe('zavorth');
    expect(pkg.version).toBe(pack.normalization.packageReadiness.version);
    expect(pkg.main).toBe('dist/index.js');
    expect(pkg.bin.zavorth).toBe('./bin/zavorth.js');
    expect(pkg.files).toEqual(expect.arrayContaining([
      'bin/',
      'dist/',
      'dist-ops/',
      'README.md',
      'docs/02-quickstart.md',
      'docs/09-operations.md',
      'docs/10-troubleshooting.md',
      'docs/34-zavorth-cli.md',
    ]));
    expect(pkg.scripts.prepack).toBe('npm run build --silent');
    expect(pkg.scripts.build).toContain('product:launchers:build');
    expect(pack.normalization.packageReadiness.npmPublishActuallyPerformed).toBe(false);
  });

  it('keeps the missing dist message human for repo clone, global install, and npx cases', () => {
    const shim = read(BIN_SHIM);

    expect(shim).toContain('Zavorth CLI build not found.');
    expect(shim).toContain('npm install');
    expect(shim).toContain('npm run build');
    expect(shim).toContain('npm run setup');
    expect(shim).toContain('npm run go');
    expect(shim).toContain('npm run doctor');
    expect(shim).toContain('npx or a global install');
    expect(shim).toContain('package integrity issue');
    expect(shim).not.toContain('Cannot find module');
    expect(shim).not.toContain('at Module.');
    assertNoRawSecret(shim);
  });

  it('documents global install, npx setup, future create, and repo-local paths in public docs', () => {
    const readme = read('README.md');
    const quickstart = read('docs/02-quickstart.md');
    const operations = read('docs/09-operations.md');
    const troubleshooting = read('docs/10-troubleshooting.md');
    const cliDocs = read('docs/34-zavorth-cli.md');

    [readme, quickstart, operations, troubleshooting, cliDocs].forEach((content) => {
      expect(content).toContain('npm install -g zavorth');
      expect(content).toContain('npx zavorth setup');
      expect(content).toContain('zavorth setup');
      expect(content).toContain('zavorth go');
      expect(content).toContain('zavorth doctor');
      assertNoRawSecret(content);
    });

    [readme, quickstart, operations, cliDocs].forEach((content) => {
      expect(content).toContain('npm create zavorth');
      expect(content).toContain('experimental');
    });

    [readme, quickstart, operations, cliDocs].forEach((content) => {
      expect(content).toContain('npm install');
      expect(content).toContain('npm run setup');
      expect(content).toContain('npm run go');
      expect(content).toContain('npm run doctor');
    });
  });

  it('keeps public docs from promoting bat files or requiring source runtime identity', () => {
    PUBLIC_DOCS.forEach((relativePath) => {
      const content = read(relativePath);
      expect(content).not.toMatch(/\.bat\b/i);
      expect(content).not.toMatch(/ExternalExecutor|external-executor/);
      expect(content).not.toMatch(/node dist\/zavorth-cli\.js/);
      assertNoRawSecret(content);
    });
  });

  it('records future create design and publish checklist without real release commands', () => {
    const pack = createProductInstallDistributionBootstrapPackFixture();

    expect(pack.normalization.futureCreateZavorth).toMatchObject({
      command: 'npm create zavorth',
      status: 'future-design-only',
      templateProjectInitDesigned: true,
      implementedInThisPack: false,
      rawSecretSerialized: false,
    });
    expect(pack.normalization.publishChecklist.map((item) => item.checklistId)).toEqual([
      'build',
      'runtime-check',
      'redaction-scan',
      'public-surface-scan',
      'npm-pack-dry-run',
      'temporary-install-smoke',
    ]);
    pack.normalization.publishChecklist.forEach((item) => {
      expect(item.publishesPackage).toBe(false);
      expect(item.commandOrCheck).not.toMatch(/\bnpm publish\b/);
    });
  });

  it('keeps no-publish/no-execution/no-migration guarantees closed', () => {
    const pack = createProductInstallDistributionBootstrapPackFixture();

    expect(pack.normalization.executionGate).toEqual({
      productInstallDistributionBootstrapPackCreated: true,
      globalNpmInstallPathDocumented: true,
      npxSetupPathDesigned: true,
      npmCreateZavorthPathDesigned: true,
      npmPublishActuallyPerformed: false,
      defaultInstallExternalExecutorRequired: false,
      batFilesNotProductPath: true,
      defaultRuntimeZavorthOwned: true,
      publicExternalExecutorIdentityLeak: false,
      rawSecretSerialized: false,
    });
    expect(pack.normalization.prohibited).toEqual({
      npmPublishActuallyPerformed: false,
      releaseActuallyExecuted: false,
      batAsProductPath: false,
      externalExecutorInstallRequirement: false,
      rawSecretSerialized: false,
      providerActuallyExecuted: false,
      toolCommandActuallyExecuted: false,
      messageActuallySent: false,
      stateMigrated: false,
    });
  });

  it('blocks readiness if distribution preparation tries to publish or regresses public install safety', () => {
    const blockedCases: Array<keyof ProductInstallDistributionSource> = [
      'npmPublishAttempted',
      'releaseAttempted',
      'docsPromoteBatFiles',
      'docsRequireExternalExecutor',
      'publicExternalExecutorIdentityLeak',
      'rawSecretSerialized',
      'providerExecutionAttempted',
      'toolCommandExecutionAttempted',
      'messageSendAttempted',
      'migrationAttempted',
      'onboardCompatibilityRemoved',
    ];

    blockedCases.forEach((key) => {
      const normalization = normalizeProductInstallDistributionBootstrapPack({
        generatedAt: '2026-05-02T00:11:00.000Z',
        runtimeId: PRODUCT_INSTALL_DISTRIBUTION_BOOTSTRAP_PACK_RUNTIME_ID,
        source: { ...createProductInstallDistributionSource(), [key]: true } as ProductInstallDistributionSource,
      });

      expect(normalization.decision).toBe('blocked');
      expect(normalization.executionGate.npmPublishActuallyPerformed).toBe(false);
      expect(normalization.executionGate.defaultInstallExternalExecutorRequired).toBe(false);
      expect(normalization.executionGate.rawSecretSerialized).toBe(false);
      expect(normalization.prohibited.providerActuallyExecuted).toBe(false);
      expect(normalization.prohibited.toolCommandActuallyExecuted).toBe(false);
      expect(normalization.prohibited.messageActuallySent).toBe(false);
      expect(normalization.prohibited.stateMigrated).toBe(false);
    });
  });
});
