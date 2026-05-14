import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_ALPHA3_PRODUCT_INSTALL_RELEASE_PACK_RUNTIME_ID,
  createZavorthAlpha3ProductInstallReleasePackFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC_281 = 'docs/281-zavorth-alpha3-product-install-release-pack.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthAlpha3ProductInstallReleasePack.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const ROOT_PACKAGE = 'package.json';
const CREATE_PACKAGE = 'packages/create-zavorth/package.json';

const legacyLower = 'bas' + 'ilisk';
const legacyTitle = 'Bas' + 'ilisk';
const legacyUpper = 'BAS' + 'ILISK';
const legacyIdentityPattern = new RegExp(`${legacyTitle}|${legacyLower}|${legacyUpper}`);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function assertNoRawSecret(serialized: string): void {
  expect(serialized).not.toMatch(/sk-(?:proj|svcacct)-[A-Za-z0-9_-]{20,}/);
  expect(serialized).not.toMatch(/sk-[A-Za-z0-9]{32,}/);
  expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{20,}/);
  expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{20,}/);
  expect(serialized).not.toContain('_auth' + 'Token');
}

describe('Zavorth alpha.3 product install release pack', () => {
  const ready = createZavorthAlpha3ProductInstallReleasePackFixture('prepublish-ready');
  const success = createZavorthAlpha3ProductInstallReleasePackFixture('full-success');
  const rootFailure = createZavorthAlpha3ProductInstallReleasePackFixture('root-failed');
  const partialFailure = createZavorthAlpha3ProductInstallReleasePackFixture('root-success-create-failed');

  it('exports the pack 281 boundary and targets alpha.3', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);
    const rootPackage = JSON.parse(read(ROOT_PACKAGE)) as {
      name: string;
      version: string;
      bin: Record<string, string>;
      files: string[];
    };
    const createPackage = JSON.parse(read(CREATE_PACKAGE)) as { name: string; version: string; bin: Record<string, string> };

    expect(boundary).toContain('ZavorthAlpha3ProductInstallReleasePack/v1');
    expect(index).toContain("from './ZavorthAlpha3ProductInstallReleasePack.js'");
    expect(ready.normalization.packId).toBe('281');
    expect(ready.normalization.runtimeId).toBe(ZAVORTH_ALPHA3_PRODUCT_INSTALL_RELEASE_PACK_RUNTIME_ID);
    expect(ready.normalization.versionAfter.target).toBe('1.1.0');
    expect(rootPackage).toEqual(expect.objectContaining({
      name: 'zavorth',
      version: '1.1.0',
      bin: { zavorth: 'bin/zavorth.js' },
    }));
    expect(rootPackage.files).toEqual(expect.arrayContaining([
      'scripts/install-zavorth.ps1',
      'scripts/install-zavorth.sh',
    ]));
    expect(createPackage).toEqual(expect.objectContaining({
      name: 'create-zavorth',
      version: '1.1.0',
      bin: { 'create-zavorth': 'bin/create-zavorth.js' },
    }));
  });

  it('includes the purge, terminal polish, and installer work', () => {
    expect(success.normalization.includedProductWork.map((work) => work.packId)).toEqual(['276', '278', '280']);
    expect(success.normalization.includedProductWork.every((work) => work.requiredForAlpha3)).toBe(true);
    expect(success.normalization.rootPackage).toEqual(expect.objectContaining({
      packageName: 'zavorth',
      version: '1.1.0',
      bin: ['zavorth'],
      installerScriptsIncluded: true,
      oldIdentityPackageLeak: false,
    }));
    expect(success.normalization.createPackage).toEqual(expect.objectContaining({
      packageName: 'create-zavorth',
      version: '1.1.0',
      bin: ['create-zavorth'],
      oldIdentityPackageLeak: false,
    }));
  });

  it('records alpha publish order and failure handling', () => {
    expect(success.normalization.publishOrder).toEqual(['zavorth', 'create-zavorth']);
    expect(success.normalization.publishResults.map((result) => result.command)).toEqual([
      'npm publish --access public --tag alpha',
      'npm publish --access public --tag alpha',
    ]);
    expect(rootFailure.normalization.decision).toBe('zavorth-alpha3-root-publish-failed');
    expect(rootFailure.rootFailureBlocksCreatePublish()).toBe(true);
    expect(rootFailure.normalization.publishResults[1]).toEqual(expect.objectContaining({
      packageName: 'create-zavorth',
      attempted: false,
      success: false,
    }));
    expect(partialFailure.normalization.decision).toBe('zavorth-alpha3-root-published-create-failed');
    expect(partialFailure.normalization.publishResults[0].success).toBe(true);
    expect(partialFailure.normalization.publishResults[1]).toEqual(expect.objectContaining({
      attempted: true,
      success: false,
    }));
  });

  it('requires npm view, npx smoke, installer dry-run, and identity scan', () => {
    expect(success.normalization.postPublishVerification).toEqual([
      expect.objectContaining({
        packageName: 'zavorth',
        command: 'npm view zavorth versions dist-tags --json',
        versionsIncludeAlpha3: true,
        alphaTag: '1.1.0',
      }),
      expect.objectContaining({
        packageName: 'create-zavorth',
        command: 'npm view create-zavorth versions dist-tags --json',
        versionsIncludeAlpha3: true,
        alphaTag: '1.1.0',
      }),
    ]);
    expect(success.normalization.npxSmoke).toEqual([
      expect.objectContaining({ command: 'npx --yes zavorth@latest --help', required: true, success: true }),
      expect.objectContaining({ command: 'npx --yes create-zavorth@latest --help', required: true, success: true }),
    ]);
    expect(success.normalization.installerDryRun).toEqual([
      expect.objectContaining({ command: 'powershell -ExecutionPolicy Bypass -File scripts/install-zavorth.ps1 -DryRun', success: true }),
      expect.objectContaining({ command: 'bash scripts/install-zavorth.sh --dry-run', success: true }),
    ]);
    expect(success.normalization.publicOutputIdentityScan.every((scan) => scan.publicOutputZavorthOnly)).toBe(true);
    expect(success.normalization.publicOutputIdentityScan.every((scan) => scan.oldIdentityPublicLeak === false)).toBe(true);
  });

  it('keeps stable/latest/manual global install and dangerous work blocked', () => {
    expect(success.normalization.distTagState).toEqual(expect.objectContaining({
      publishTag: 'alpha',
      stableRelease: false,
      latestTagManuallyChanged: false,
    }));
    expect(success.normalization.finalState).toEqual(expect.objectContaining({
      decision: 'zavorth-alpha3-product-install-release-published',
      publishedVersion: '1.1.0',
      rootPublished: true,
      createPackagePublished: true,
      npxSmokePassed: true,
      installerDryRunPassed: true,
      publicOutputZavorthOnly: true,
      stableRelease: false,
      latestTagManuallyChanged: false,
      globalInstallPerformed: false,
      runtimePersistentStartPerformed: false,
      domainPurchased: false,
      githubOrgCreatedByThisPack: false,
      trademarkFiled: false,
      rawSecretSerialized: false,
      oldIdentityPublicLeak: false,
    }));
    expect(success.blockedActionPerformed()).toBe(false);
    assertNoRawSecret(JSON.stringify(success.normalization));
  });

  it('documents the alpha.3 release pack without old identity leakage', () => {
    const doc = read(DOC_281);

    expect(doc).toContain('Zavorth Alpha.3 Product Install Release Pack');
    expect(doc).toContain('1.1.0');
    expect(doc).toContain('npm publish --access public --tag alpha');
    expect(doc).toContain('npx --yes zavorth@latest --help');
    expect(doc).toContain('powershell -ExecutionPolicy Bypass -File scripts/install-zavorth.ps1 -DryRun');
    expect(doc).not.toMatch(legacyIdentityPattern);
    assertNoRawSecret(doc);
  });
});
