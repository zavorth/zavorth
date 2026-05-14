import fs from 'node:fs';
import path from 'node:path';

import {
  createProductInstallSmokeSource,
  createProductInstallSmokeTempEnvironmentPackFixture,
  normalizeProductInstallSmokeTempEnvironmentPack,
  PRODUCT_INSTALL_SMOKE_TEMP_ENVIRONMENT_PACK_RUNTIME_ID,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ProductInstallSmokeSource,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/261-product-install-smoke-temp-environment-pack.md';
const BOUNDARY = 'src/runtime/external-agents/ProductInstallSmokeTempEnvironmentPack.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const TEMP_ENV = '.tmp/install-smoke/261-temp-env';
const GENERATED_PACKAGE = 'zavorth-1.1.0-alpha.0.tgz';

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

function assertNoRawSecret(serialized: string): void {
  expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  expect(serialized).not.toMatch(/(?<![A-Za-z])sk-[A-Za-z0-9_-]{20,}/);
  expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{20,}/);
  expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{20,}/);
  expect(serialized).not.toContain('synthetic-raw-credential-sentinel-that-must-not-appear');
  expect(serialized).not.toContain('<redacted-local-secret>');
}

describe('Product install smoke temp environment pack', () => {
  it('documents 261 with temp install smoke evidence and cleanup', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `install-smoke-passed`');
    expect(content).toContain('ProductInstallSmokeTempEnvironmentPack.ts');
    expect(content).toContain('ProductInstallSmokeTempEnvironmentPack/v1');
    expect(content).toContain('ProductInstallSmokePackageInspection/v1');
    expect(content).toContain('ProductInstallSmokeCommandResult/v1');
    expect(content).toContain('zavorth-1.1.0-alpha.0.tgz');
    expect(content).toContain('.tmp/install-smoke/261-temp-env');
    expect(content).toContain('npx --no-install zavorth --help');
    expect(content).toContain('npx --no-install zavorth setup --help');
    expect(content).toContain('npx --no-install zavorth doctor --help');
    expect(content).toContain('npx --no-install zavorth go --dry-run --timeout-ms=1000 --poll-ms=250');
    expect(content).toContain('Skipped:');
    expect(content).toContain('- none.');
    expect(content).toContain('tempEnvironmentCleaned=true');
    expect(content).toContain('Do not advance beyond `261`');
    assertNoRawSecret(content);
  });

  it('exports the boundary and keeps the fixture passed', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);
    const pack = createProductInstallSmokeTempEnvironmentPackFixture();

    expect(boundary).toContain('ProductInstallSmokeTempEnvironmentPack/v1');
    expect(index).toContain("from './ProductInstallSmokeTempEnvironmentPack.js'");
    expect(index).toContain('PRODUCT_INSTALL_SMOKE_TEMP_ENVIRONMENT_PACK_RUNTIME_ID');
    expect(pack.normalization.decision).toBe('install-smoke-passed');
    expect(pack.normalization.packageInspection.generatedPackage).toBe(GENERATED_PACKAGE);
    expect(pack.normalization.tempEnvironment.tempPath).toBe(TEMP_ENV);
    expect(pack.normalization.tempEnvironment.cleanedAfterSmoke).toBe(true);
  });

  it('records required package entries and forbidden local-state exclusions', () => {
    const pack = createProductInstallSmokeTempEnvironmentPackFixture();

    expect(pack.normalization.packageInspection.requiredEntriesPresent).toEqual(expect.arrayContaining([
      'package/bin/zavorth.js',
      'package/dist/zavorth-cli.js',
      'package/dist-ops/scripts/setup-v3.js',
      'package/dist-ops/scripts/ops-go.js',
      'package/dist-ops/scripts/ops-doctor.js',
      'package/docs/02-quickstart.md',
      'package/docs/09-operations.md',
      'package/docs/10-troubleshooting.md',
      'package/docs/34-zavorth-cli.md',
    ]));
    expect(pack.normalization.packageInspection.forbiddenEntriesAbsent).toEqual(expect.arrayContaining([
      'package/.env',
      'package/.tmp/',
      'package/node_modules/',
      'package/data/runtime/',
      'package/logs/',
    ]));
    expect(pack.normalization.packageInspection.npmPublishActuallyPerformed).toBe(false);
    expect(pack.normalization.packageInspection.packageRemovedAfterSmoke).toBe(true);
  });

  it('records safe command results without provider keys, ExternalExecutor, or persistent runtime', () => {
    const pack = createProductInstallSmokeTempEnvironmentPackFixture();

    expect(pack.normalization.commandResults.map((command) => command.commandId)).toEqual([
      'npx-zavorth-help',
      'node-bin-zavorth-help',
      'npx-zavorth-setup-help',
      'npx-zavorth-doctor-help',
      'npx-zavorth-go-dry-run',
    ]);

    pack.normalization.commandResults.forEach((command) => {
      expect(command.status).toBe('passed');
      expect(command.exitCode).toBe(0);
      expect(command.safeHelpOrDryRunOnly).toBe(true);
      expect(command.providerKeyRequired).toBe(false);
      expect(command.externalExecutorRequired).toBe(false);
      expect(command.runtimePersisted).toBe(false);
      expect(command.uglyStackTraceObserved).toBe(false);
      expect(command.rawSecretSerialized).toBe(false);
    });

    expect(pack.command('npx-zavorth-go-dry-run').command).toContain('--dry-run');
  });

  it('keeps temp artifacts cleaned after the smoke', () => {
    expect(exists(TEMP_ENV)).toBe(false);
    expect(exists(GENERATED_PACKAGE)).toBe(false);
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

  it('keeps no-publish/no-global-install/no-execution guarantees closed', () => {
    const pack = createProductInstallSmokeTempEnvironmentPackFixture();

    expect(pack.normalization.executionGate).toEqual({
      productInstallSmokeTempEnvironmentPackCreated: true,
      npmPackLocalOnly: true,
      npmPublishActuallyPerformed: false,
      tempInstallSmokeExecuted: true,
      installedZavorthBinAvailable: true,
      defaultInstallExternalExecutorRequired: false,
      providerKeyRequiredForHelpCommands: false,
      batFilesNotProductPath: true,
      rawSecretSerialized: false,
      tempEnvironmentCleaned: true,
    });
    expect(pack.normalization.prohibited).toEqual({
      npmPublishActuallyPerformed: false,
      globalInstallPerformed: false,
      externalExecutorInstallRequirement: false,
      providerKeyRequiredForHelpCommands: false,
      batAsProductPath: false,
      rawSecretSerialized: false,
      providerActuallyExecuted: false,
      toolCommandActuallyExecuted: false,
      messageActuallySent: false,
      stateMigrated: false,
      persistentRuntimeStarted: false,
    });
  });

  it('blocks readiness if smoke evidence regresses or prohibited effects appear', () => {
    const blockedCases: Array<keyof ProductInstallSmokeSource> = [
      'npmPublishAttempted',
      'globalInstallAttempted',
      'externalExecutorRequired',
      'providerKeyRequiredForHelpCommands',
      'batFilesDocumentedAsProductPath',
      'rawSecretSerialized',
      'providerExecutionAttempted',
      'toolCommandExecutionAttempted',
      'messageSendAttempted',
      'migrationAttempted',
      'persistentRuntimeStarted',
    ];

    blockedCases.forEach((key) => {
      const normalization = normalizeProductInstallSmokeTempEnvironmentPack({
        generatedAt: '2026-05-02T00:31:00.000Z',
        runtimeId: PRODUCT_INSTALL_SMOKE_TEMP_ENVIRONMENT_PACK_RUNTIME_ID,
        source: { ...createProductInstallSmokeSource(), [key]: true } as ProductInstallSmokeSource,
      });

      expect(normalization.decision).toBe('blocked');
      expect(normalization.executionGate.npmPublishActuallyPerformed).toBe(false);
      expect(normalization.executionGate.defaultInstallExternalExecutorRequired).toBe(false);
      expect(normalization.executionGate.providerKeyRequiredForHelpCommands).toBe(false);
      expect(normalization.prohibited.globalInstallPerformed).toBe(false);
      expect(normalization.prohibited.providerActuallyExecuted).toBe(false);
      expect(normalization.prohibited.toolCommandActuallyExecuted).toBe(false);
      expect(normalization.prohibited.messageActuallySent).toBe(false);
      expect(normalization.prohibited.stateMigrated).toBe(false);
      expect(normalization.prohibited.persistentRuntimeStarted).toBe(false);
    });
  });
});
