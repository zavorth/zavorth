import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_INSTALL_SMOKE_PACK_RUNTIME_ID,
  createZavorthInstallSmokePackFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/271-zavorth-install-smoke-pack.md';
const DOC_270 = 'docs/270-zavorth-rename-implementation-pack.md';
const NAMING_DECISION = 'NAMING_DECISION.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthInstallSmokePack.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const ROOT_PACKAGE = 'package.json';
const CREATE_PACKAGE = 'packages/create-zavorth/package.json';

const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function assertNoRawSecret(serialized: string): void {
  expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  expect(serialized).not.toMatch(/sk-(?:proj|svcacct)-[A-Za-z0-9_-]{20,}/);
  expect(serialized).not.toMatch(/sk-[A-Za-z0-9]{32,}/);
  expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{20,}/);
  expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{20,}/);
  expect(serialized).not.toContain('_auth' + 'Token');
}

describe('Zavorth install smoke pack', () => {
  const pack = createZavorthInstallSmokePackFixture();

  it('exports the 271 boundary and passed decision', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthInstallSmokePack/v1');
    expect(boundary).toContain('ZavorthInstallSmokeCommandResult/v1');
    expect(boundary).toContain('ZavorthInstallSmokePackage/v1');
    expect(boundary).toContain('ZavorthInstallSmokeCleanup/v1');
    expect(index).toContain("from './ZavorthInstallSmokePack.js'");
    expect(pack.normalization.runtimeId).toBe(ZAVORTH_INSTALL_SMOKE_PACK_RUNTIME_ID);
    expect(pack.normalization.packId).toBe('271');
    expect(pack.normalization.decision).toBe('zavorth-install-smoke-passed');
  });

  it('records root package smoke commands and installed package identity', () => {
    const rootPackage = JSON.parse(read(ROOT_PACKAGE)) as {
      name: string;
      version: string;
      bin: Record<string, string>;
    };

    expect(rootPackage.name).toBe('zavorth');
    expect(rootPackage.version).toBe('1.1.0-alpha.0');
    expect(rootPackage.bin).toEqual({
      zavorth: 'bin/zavorth.js',
      zavorth: 'bin/zavorth.js',
    });
    expect(pack.normalization.rootPackageSmoke).toEqual(expect.objectContaining({
      packageKind: 'root-package',
      packageName: 'zavorth',
      packageVersion: '1.1.0-alpha.0',
      tgzName: 'zavorth-1.1.0-alpha.0.tgz',
      packed: true,
      tempInstallPerformed: true,
      blocker: null,
    }));
    expect(pack.normalization.rootPackageSmoke.commands.map((command) => command.commandId)).toEqual([
      'npx-zavorth-help',
      'npx-zavorth-setup-help',
      'npx-zavorth-doctor-help',
      'npx-zavorth-go-dry-run',
      'npx-zavorth-help',
    ]);
  });

  it('records create package smoke commands or explicit blocker', () => {
    const createPackage = JSON.parse(read(CREATE_PACKAGE)) as {
      name: string;
      version: string;
      bin: Record<string, string>;
    };

    expect(createPackage.name).toBe('create-zavorth');
    expect(createPackage.version).toBe('1.1.0-alpha.0');
    expect(createPackage.bin['create-zavorth']).toBe('bin/create-zavorth.js');
    expect(createPackage.bin['create-zavorth']).toBe('bin/create-zavorth.js');
    expect(pack.normalization.createPackageSmoke).toEqual(expect.objectContaining({
      packageKind: 'create-package',
      packageName: 'create-zavorth',
      packageVersion: '1.1.0-alpha.0',
      tgzName: 'create-zavorth-1.1.0-alpha.0.tgz',
      packed: true,
      tempInstallPerformed: true,
      blocker: null,
    }));
    expect(pack.normalization.createPackageSmoke.commands.map((command) => command.commandId)).toEqual([
      'npx-create-zavorth-help',
      'npx-create-zavorth-dry-run',
      'npx-create-zavorth-help',
      'npx-create-zavorth-dry-run',
    ]);
  });

  it('tests or justifies legacy aliases', () => {
    expect(pack.normalization.legacyAliasSmoke).toEqual([
      expect.objectContaining({
        alias: 'zavorth',
        preferredCommand: 'zavorth',
        tested: true,
        deprecationMessagingObserved: true,
      }),
      expect.objectContaining({
        alias: 'create-zavorth',
        preferredCommand: 'create-zavorth',
        tested: true,
        deprecationMessagingObserved: true,
      }),
    ]);
  });

  it('requires cleanup and keeps publish/global/runtime actions blocked', () => {
    expect(pack.normalization.tempEnvironment).toEqual(expect.objectContaining({
      baseDirectory: '.tmp/install-smoke',
      rootInstallDirectory: '.tmp/install-smoke/271-root',
      createInstallDirectory: '.tmp/install-smoke/271-create',
      tempEnvironmentCleaned: true,
      tgzArtifactsCleaned: true,
    }));
    expect(pack.normalization.cleanup).toEqual(expect.objectContaining({
      tempEnvironmentCleaned: true,
      tgzArtifactsCleaned: true,
      residualNodeJestSourceProcesses: false,
      listener18789Clear: true,
    }));
    expect(pack.normalization.finalState).toEqual(expect.objectContaining({
      npmPublishActuallyPerformed: false,
      globalInstallPerformed: false,
      tempInstallPerformed: true,
      runtimePersistentStartPerformed: false,
      rootPackagePacked: true,
      createPackagePacked: true,
      tempEnvironmentCleaned: true,
      tgzArtifactsCleaned: true,
      rawSecretSerialized: false,
    }));
    expect(pack.blockedActionPerformed()).toBe(false);
  });

  it('documents the smoke and updates the rename handoff', () => {
    const doc = read(DOC);
    const doc270 = read(DOC_270);
    const namingDecision = read(NAMING_DECISION);

    expect(doc).toContain('Status: `zavorth-install-smoke-passed`');
    expect(doc).toContain('npx --no-install zavorth --help');
    expect(doc).toContain('npx --no-install zavorth go --dry-run --timeout-ms=1000 --poll-ms=250');
    expect(doc).toContain('npx --no-install create-zavorth --dry-run');
    expect(doc).toContain('tempEnvironmentCleaned=true');
    expect(doc).toContain('npmPublishActuallyPerformed=false');
    expect(doc270).toContain('271 install smoke note');
    expect(doc270).toContain('zavorth-install-smoke-passed');
    expect(namingDecision).toContain('271 - Zavorth Install Smoke Pack');
    assertNoRawSecret(doc);
    assertNoRawSecret(doc270);
    assertNoRawSecret(namingDecision);
  });

  it('serializes without raw secrets and without claiming dangerous execution', () => {
    const serialized = JSON.stringify(pack.normalization);

    expect(pack.allRequiredCommandsPassed()).toBe(true);
    expect(serialized).not.toContain('npmPublishActuallyPerformed":true');
    expect(serialized).not.toContain('globalInstallPerformed":true');
    expect(serialized).not.toContain('runtimePersistentStartPerformed":true');
    expect(serialized).not.toContain('rawSecretSerialized":true');
    expect(serialized).not.toContain('providerExecuted":true');
    expect(serialized).not.toContain('messageSent":true');
    assertNoRawSecret(serialized);
  });
});
