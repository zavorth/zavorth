import fs from 'node:fs';
import path from 'node:path';

import {
  createProductLaunchUxFinalPolishPackFixture,
  createProductLaunchUxFinalPolishSource,
  normalizeProductLaunchUxFinalPolishPack,
  PRODUCT_LAUNCH_UX_FINAL_POLISH_PACK_RUNTIME_ID,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ProductLaunchUxFinalPolishSource,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/259-product-launch-ux-final-polish-pack.md';
const BOUNDARY = 'src/runtime/external-agents/ProductLaunchUxFinalPolishPack.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const PACKAGE_JSON = 'package.json';
const BIN_SHIM = 'bin/zavorth.js';
const CLI_ENTRYPOINT = 'src/zavorth-cli.ts';
const ONBOARD_RENDERER = 'src/cli/ZavorthCliOnboardRenderer.ts';
const GO_RENDERER = 'src/cli/ZavorthCliGoRenderer.ts';
const SETUP_SCRIPT = 'scripts/setup-v3.ts';

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

describe('Product launch UX final polish pack', () => {
  it('documents 259 with the final product launch UX guarantees', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `product-launch-ux-final-polish-ready`');
    expect(content).toContain('ProductLaunchUxFinalPolishPack.ts');
    expect(content).toContain('ProductLaunchUxFinalPolishPack/v1');
    expect(content).toContain('ProductLaunchUxFinalInstallPath/v1');
    expect(content).toContain('ProductLaunchUxFirstRunCheck/v1');
    expect(content).toContain('ProductLaunchUxMissingBuildMessage/v1');
    expect(content).toContain('ProductLaunchUxGoDoctorClarity/v1');
    expect(content).toContain('productLaunchUxFinalPolishPackCreated=true');
    expect(content).toContain('installedCliPathSimple=true');
    expect(content).toContain('repoLocalPathSimple=true');
    expect(content).toContain('npmRunDoctorAvailable=true');
    expect(content).toContain('missingBuildMessageHuman=true');
    expect(content).toContain('commandCenterControlDocumented=true');
    expect(content).toContain('goShowsOrOpensControlUrl=true');
    expect(content).toContain('Do not advance beyond `259`');
    assertNoRawSecret(content);
  });

  it('exports the final polish boundary and keeps the fixture ready', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);
    const pack = createProductLaunchUxFinalPolishPackFixture();

    expect(boundary).toContain('ProductLaunchUxFinalPolishPack/v1');
    expect(index).toContain("from './ProductLaunchUxFinalPolishPack.js'");
    expect(index).toContain('PRODUCT_LAUNCH_UX_FINAL_POLISH_PACK_RUNTIME_ID');
    expect(pack.normalization.decision).toBe('product-launch-ux-final-polish-ready');
    expect(pack.commandsFor('installed-cli-user')).toEqual([
      'zavorth setup',
      'zavorth go',
      'zavorth doctor',
      'zavorth status',
      'zavorth chat',
    ]);
    expect(pack.commandsFor('repo-clone-user')).toEqual([
      'npm install',
      'npm run setup',
      'npm run go',
      'npm run doctor',
    ]);
    expect(pack.normalization.firstRunChecks.map((check) => check.checkId)).toEqual([
      'node-npm-version',
      'dependencies-installed',
      'build-dist-present',
      'env-file-present',
      'provider-model-config',
      'port-availability',
      'local-permissions',
      'secretref-config-pending',
    ]);
  });

  it('keeps package entrypoints and repo-local scripts simple', () => {
    const pkg = JSON.parse(read(PACKAGE_JSON)) as {
      bin: Record<string, string>;
      scripts: Record<string, string>;
    };

    expect(pkg.bin.zavorth).toBe('bin/zavorth.js');
    expect(pkg.scripts.setup).toBe('npx tsx scripts/setup-v3.ts');
    expect(pkg.scripts.go).toBe('npx tsx scripts/ops-go.ts');
    expect(pkg.scripts.doctor).toContain('ops-doctor.ts');
    expect(pkg.scripts.status).toContain('access-readiness.ts');
    expect(pkg.scripts.setup).toBe('npx tsx scripts/setup-v3.ts');
  });

  it('keeps missing build/dist UX human and actionable', () => {
    const shim = read(BIN_SHIM);

    expect(shim).toContain('Zavorth could not start.');
    expect(shim).toContain('Cause: dist/zavorth-cli.js was not found.');
    expect(shim).toContain('npm install');
    expect(shim).toContain('npm run build');
    expect(shim).toContain('npm run setup');
    expect(shim).toContain('npm run go');
    expect(shim).toContain('npm run doctor');
    expect(shim).toContain('If setup or go still fail');
    expect(shim).not.toContain('Cannot find module');
    expect(shim).not.toContain('at Module.');
    assertNoRawSecret(shim);
  });

  it('keeps setup/go/doctor local clarity while preserving onboard compatibility', () => {
    const cli = read(CLI_ENTRYPOINT);
    const setup = read(SETUP_SCRIPT);
    const onboardRenderer = read(ONBOARD_RENDERER);
    const goRenderer = read(GO_RENDERER);

    expect(cli).toContain('PUBLIC_COMMAND_ALIASES');
    expect(cli).toContain("configurar: 'setup'");
    expect(cli).toContain("iniciar: 'go'");
    expect(cli).toContain("diagnostico: 'doctor'");
    expect(setup).toContain('Zavorth setup');
    expect(setup).toContain('npm run setup');
    expect(setup).toContain('zavorth go');
    expect(setup).toContain('zavorth doctor');
    expect(setup).not.toContain('zavorth onboard');
    expect(onboardRenderer).toContain('setup guiado');
    expect(onboardRenderer).toContain('npm run setup');
    expect(onboardRenderer).toContain('npm run go');
    expect(onboardRenderer).toContain('npm run doctor');
    expect(goRenderer).toContain('/dashboard');
    expect(goRenderer).toContain('zavorth doctor');
    expect(goRenderer).toContain('zavorth setup');
  });

  it('keeps public docs short, Zavorth-native, and pointed at /dashboard', () => {
    const readme = read('README.md');
    const quickstart = read('docs/02-quickstart.md');
    const operations = read('docs/09-operations.md');
    const troubleshooting = read('docs/10-troubleshooting.md');
    const cliDocs = read('docs/34-zavorth-cli.md');

    [readme, quickstart, operations, troubleshooting, cliDocs].forEach((content) => {
      assertNoRawSecret(content);
    });

    expect(readme).toContain('npm install');
    expect(readme).toContain('npm run zavorth:start');
    expect(readme).toContain('npm run go');
    expect(quickstart).toContain('npm install');
    expect(quickstart).toContain('npm run zavorth:start');
    expect(quickstart).toContain('npm run go');
    expect(operations).toContain('Daily Operator Loop');
    expect(cliDocs).toContain('If a command is not available');
  });

  it('does not promote .bat files or require source runtime identity in public docs', () => {
    PUBLIC_DOCS.forEach((relativePath) => {
      const content = read(relativePath);
      expect(content).not.toMatch(/\.bat\b/i);
      expect(content).not.toMatch(/ExternalExecutor|external-executor/);
      expect(content).not.toMatch(/node dist\/zavorth-cli\.js/);
      assertNoRawSecret(content);
    });
  });

  it('keeps no-send/no-execution/no-migration guarantees closed', () => {
    const pack = createProductLaunchUxFinalPolishPackFixture();

    expect(pack.normalization.executionGate).toEqual({
      productLaunchUxFinalPolishPackCreated: true,
      installedCliPathSimple: true,
      repoLocalPathSimple: true,
      npmRunDoctorAvailable: true,
      missingBuildMessageHuman: true,
      commandCenterControlDocumented: true,
      goShowsOrOpensControlUrl: true,
      batFilesNotProductPath: true,
      defaultInstallExternalExecutorRequired: false,
      defaultRuntimeZavorthOwned: true,
      publicExternalExecutorIdentityLeak: false,
      rawSecretSerialized: false,
    });
    expect(pack.normalization.prohibited).toEqual({
      batAsProductPath: false,
      externalExecutorInstallRequirement: false,
      rawSecretSerialized: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      toolCommandActuallyExecuted: false,
      stateMigrated: false,
      adapterGlobalRemoved: false,
    });
    expect(pack.normalization.goDoctorClarity.externalExecutorRequired).toBe(false);
    expect(pack.normalization.goDoctorClarity.batFileRequired).toBe(false);
  });

  it('blocks readiness if launch UX regresses or attempts prohibited effects', () => {
    const blockedCases: Array<keyof ProductLaunchUxFinalPolishSource> = [
      'docsPromoteBatFiles',
      'docsRequireExternalExecutor',
      'externalExecutorDefaultRuntimeRequired',
      'rawSecretSerialized',
      'messageSendAttempted',
      'providerExecutionAttempted',
      'toolCommandExecutionAttempted',
      'migrationAttempted',
      'adapterGlobalRemovalAttempted',
    ];

    blockedCases.forEach((key) => {
      const normalization = normalizeProductLaunchUxFinalPolishPack({
        generatedAt: '2026-05-02T00:00:00.000Z',
        runtimeId: PRODUCT_LAUNCH_UX_FINAL_POLISH_PACK_RUNTIME_ID,
        source: { ...createProductLaunchUxFinalPolishSource(), [key]: true } as ProductLaunchUxFinalPolishSource,
      });

      expect(normalization.decision).toBe('blocked');
      expect(normalization.executionGate.batFilesNotProductPath).toBe(true);
      expect(normalization.executionGate.defaultInstallExternalExecutorRequired).toBe(false);
      expect(normalization.executionGate.rawSecretSerialized).toBe(false);
      expect(normalization.prohibited.messageActuallySent).toBe(false);
      expect(normalization.prohibited.providerActuallyExecuted).toBe(false);
      expect(normalization.prohibited.toolCommandActuallyExecuted).toBe(false);
      expect(normalization.prohibited.stateMigrated).toBe(false);
      expect(normalization.prohibited.adapterGlobalRemoved).toBe(false);
    });
  });
});
