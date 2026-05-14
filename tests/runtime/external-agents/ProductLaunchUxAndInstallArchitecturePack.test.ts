import fs from 'node:fs';
import path from 'node:path';

import {
  createProductLaunchUxAndInstallArchitecturePackFixture,
  createProductLaunchUxSource,
  normalizeProductLaunchUxAndInstallArchitecturePack,
  PRODUCT_LAUNCH_UX_AND_INSTALL_ARCHITECTURE_PACK_RUNTIME_ID,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ProductLaunchUxSource,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/258-product-launch-ux-and-install-architecture-pack.md';
const BOUNDARY = 'src/runtime/external-agents/ProductLaunchUxAndInstallArchitecturePack.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const PACKAGE_JSON = 'package.json';
const BIN_SHIM = 'bin/zavorth.js';
const CLI_ENTRYPOINT = 'src/zavorth-cli.ts';
const CLI_HELP = 'src/cli/ZavorthCliSurfaceHelpers.ts';
const GO_RENDERER = 'src/cli/ZavorthCliGoRenderer.ts';
const SETUP_SCRIPT = 'scripts/setup-v3.ts';
const OPS_DOCTOR = 'scripts/ops-doctor.ts';

const PUBLIC_DOCS = [
  'README.md',
  'docs/00-overview.md',
  'docs/02-quickstart.md',
  'docs/09-operations.md',
  'docs/10-troubleshooting.md',
  'docs/33-channel-mesh.md',
  'docs/34-zavorth-cli.md',
  'docs/35-official-remote-access.md',
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

describe('Product launch UX and install architecture pack', () => {
  it('documents 258 with the product launch UX guarantees', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `product-launch-ux-ready`');
    expect(content).toContain('ProductLaunchUxAndInstallArchitecturePack.ts');
    expect(content).toContain('ProductLaunchUxAndInstallArchitecturePack/v1');
    expect(content).toContain('ProductLaunchUxCommandSurface/v1');
    expect(content).toContain('ProductLaunchUxCommandCenterLaunch/v1');
    expect(content).toContain('productLaunchUxPackCreated=true');
    expect(content).toContain('batFilesNotProductPath=true');
    expect(content).toContain('defaultInstallExternalExecutorRequired=false');
    expect(content).toContain('quickstartCommandCountSmall=true');
    expect(content).toContain('cliSetupGoDoctorDocumented=true');
    expect(content).toContain('repoLocalSetupGoDocumented=true');
    expect(content).toContain('commandCenterControlDocumented=true');
    expect(content).toContain('Do not advance beyond `258`');
    assertNoRawSecret(content);
  });

  it('exports the product launch boundary and keeps the fixture ready', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);
    const pack = createProductLaunchUxAndInstallArchitecturePackFixture();

    expect(boundary).toContain('ProductLaunchUxAndInstallArchitecturePack/v1');
    expect(index).toContain("from './ProductLaunchUxAndInstallArchitecturePack.js'");
    expect(index).toContain('PRODUCT_LAUNCH_UX_AND_INSTALL_ARCHITECTURE_PACK_RUNTIME_ID');
    expect(pack.normalization.decision).toBe('product-launch-ux-ready');
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
  });

  it('keeps package entrypoints aligned with CLI and repo-local product paths', () => {
    const pkg = JSON.parse(read(PACKAGE_JSON)) as {
      bin: Record<string, string>;
      scripts: Record<string, string>;
    };

    expect(pkg.bin.zavorth).toBe('./bin/zavorth.js');
    expect(pkg.scripts.setup).toBe('npx tsx scripts/setup-v3.ts');
    expect(pkg.scripts.go).toBe('npx tsx scripts/ops-go.ts');
    expect(pkg.scripts.doctor).toBe('npm run cli -- doctor');
    expect(pkg.scripts.status).toBe('npm run cli -- status');
    expect(pkg.scripts.chat).toBe('npm run cli -- chat');
    expect(pkg.scripts['product:launchers:build']).toContain('scripts/ops-doctor.ts');
    expect(pkg.scripts['ops:journey']).toBe('npx tsx scripts/install-journey.ts');
    expect(pkg.scripts['ops:manifest']).toBe('npx tsx scripts/access-manifest.ts');
    expect(pkg.scripts['ops:remote:go']).toBe('npm run ops:remote:official');
    expect(pkg.scripts['launcher:install']).toContain('install-windows-launcher.ps1');
    expect(pkg.scripts['launcher:startup:install']).toContain('install-windows-startup.ps1 -AllowInstall');
    expect(read(BIN_SHIM)).toContain('Zavorth CLI build not found.');
    expect(read(BIN_SHIM)).toContain('npm run setup');
    expect(read(BIN_SHIM)).toContain('npm run go');
  });

  it('promotes setup/go/doctor in CLI help while preserving aliases and human setup help', () => {
    const cli = read(CLI_ENTRYPOINT);
    const help = read(CLI_HELP);
    const setup = read(SETUP_SCRIPT);
    const goRenderer = read(GO_RENDERER);

    expect(cli).toContain("command === 'onboard' || command === 'setup' || command === 'init'");
    expect(cli).toContain("configurar: 'setup'");
    expect(cli).toContain("iniciar: 'go'");
    expect(cli).toContain("diagnostico: 'doctor'");
    expect(help).toContain("title: 'zavorth setup'");
    expect(help).toContain("command: 'zavorth setup'");
    expect(help).not.toContain("command: 'zavorth onboard'");
    expect(setup).toContain('Zavorth setup');
    expect(setup).toContain('npm run setup');
    expect(setup).toContain('npm run go');
    expect(setup).toContain('Use uma porta entre 1 e 65535.');
    expect(goRenderer).toContain('zavorth setup');
  });

  it('documents short public quickstart paths and Command Center /control as destination', () => {
    const readme = read('README.md');
    const quickstart = read('docs/02-quickstart.md');
    const operations = read('docs/09-operations.md');
    const cliDocs = read('docs/34-zavorth-cli.md');

    [readme, quickstart, operations, cliDocs].forEach((content) => {
      expect(content).toContain('zavorth setup');
      expect(content).toContain('zavorth go');
      expect(content).toContain('/control');
    });
    expect(readme).toContain('zavorth doctor');
    expect(readme).toContain('npm install');
    expect(readme).toContain('npm run setup');
    expect(readme).toContain('npm run go');
    expect(quickstart).toContain('npm run setup');
    expect(quickstart).toContain('npm run go');
    expect(operations).toContain('Caminho Publico Simples');
    expect(operations).toContain('Scripts avancados de `ops:*` continuam disponiveis');
  });

  it('keeps public docs from promoting .bat files or requiring external source runtime identity', () => {
    PUBLIC_DOCS.forEach((relativePath) => {
      const content = read(relativePath);
      expect(content).not.toMatch(/\.bat\b/i);
      expect(content).not.toMatch(/ExternalExecutor|external-executor/);
      expect(content).not.toMatch(/node dist\/zavorth-cli\.js/);
      assertNoRawSecret(content);
    });
    expect(read('docs/35-official-remote-access.md')).toContain('/control');
    expect(read('docs/33-channel-mesh.md')).toContain('Command Center');
    expect(read('docs/00-overview.md')).toContain('Command Center oficial');
  });

  it('keeps ops doctor import and no-send/no-execution/no-migration guarantees closed', () => {
    const pack = createProductLaunchUxAndInstallArchitecturePackFixture();

    expect(read(OPS_DOCTOR)).toContain("../src/runtime/access/RuntimeAccessReadinessService.js");
    expect(pack.normalization.commandCenterLaunch).toEqual({
      nativeContract: 'ProductLaunchUxCommandCenterLaunch/v1',
      canonicalPath: '/control',
      openedOrUrlDisplayed: true,
      headlessFallbackDocumented: true,
      healthOrStatusAfterStartDocumented: true,
      externalExecutorRequired: false,
      batFileRequired: false,
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
    });
  });

  it('blocks launch UX readiness if docs promote bat files, require external runtime, or attempt side effects', () => {
    const blockedCases: Array<keyof ProductLaunchUxSource> = [
      'docsPromoteBatFiles',
      'docsRequireExternalExecutor',
      'externalExecutorDefaultRuntimeRequired',
      'rawSecretSerialized',
      'runtimeBehaviorChangeAttemptedOutsideUxEntrypoint',
      'messageSendAttempted',
      'providerExecutionAttempted',
      'toolCommandExecutionAttempted',
      'migrationAttempted',
    ];

    blockedCases.forEach((key) => {
      const normalization = normalizeProductLaunchUxAndInstallArchitecturePack({
        generatedAt: '2026-05-01T23:11:00.000Z',
        runtimeId: PRODUCT_LAUNCH_UX_AND_INSTALL_ARCHITECTURE_PACK_RUNTIME_ID,
        source: { ...createProductLaunchUxSource(), [key]: true } as ProductLaunchUxSource,
      });

      expect(normalization.decision).toBe('blocked');
      expect(normalization.executionGate.batFilesNotProductPath).toBe(true);
      expect(normalization.executionGate.defaultInstallExternalExecutorRequired).toBe(false);
      expect(normalization.executionGate.rawSecretSerialized).toBe(false);
      expect(normalization.prohibited.messageActuallySent).toBe(false);
      expect(normalization.prohibited.providerActuallyExecuted).toBe(false);
      expect(normalization.prohibited.toolCommandActuallyExecuted).toBe(false);
      expect(normalization.prohibited.stateMigrated).toBe(false);
    });
  });
});
