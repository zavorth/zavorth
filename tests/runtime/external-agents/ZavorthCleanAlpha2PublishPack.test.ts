import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_CLEAN_ALPHA2_PUBLISH_PACK_RUNTIME_ID,
  createZavorthCleanAlpha2PublishFixture,
  createZavorthCleanAlpha2PublishMissing276Fixture,
  createZavorthCleanAlpha2PublishPartialFailureFixture,
  createZavorthCleanAlpha2PublishReadyFixture,
  createZavorthCleanAlpha2PublishRootFailureFixture,
  createZavorthCleanAlpha2PublishSuccessFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC_276 = 'docs/276-zavorth-hard-rename-and-legacy-identity-purge-pack.md';
const DOC_277 = 'docs/277-zavorth-clean-alpha2-publish-pack.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthCleanAlpha2PublishPack.ts';
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

describe('Zavorth clean alpha.2 publish pack', () => {
  const actual = createZavorthCleanAlpha2PublishFixture();
  const ready = createZavorthCleanAlpha2PublishReadyFixture();
  const success = createZavorthCleanAlpha2PublishSuccessFixture();
  const missing276 = createZavorthCleanAlpha2PublishMissing276Fixture();
  const rootFailure = createZavorthCleanAlpha2PublishRootFailureFixture();
  const partialFailure = createZavorthCleanAlpha2PublishPartialFailureFixture();

  it('exports the 277 boundary and requires the completed 276 purge', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);
    const doc276 = read(DOC_276);

    expect(boundary).toContain('ZavorthCleanAlpha2PublishPack/v1');
    expect(boundary).toContain('ZavorthCleanAlpha2Pack276Requirement/v1');
    expect(index).toContain("from './ZavorthCleanAlpha2PublishPack.js'");
    expect(doc276).toContain('Status: `zavorth-hard-rename-purge-ready`');
    expect(actual.normalization.packId).toBe('277');
    expect(actual.normalization.runtimeId).toBe(ZAVORTH_CLEAN_ALPHA2_PUBLISH_PACK_RUNTIME_ID);
    expect(actual.normalization.decision).toBe('zavorth-alpha2-root-publish-failed');
    expect(actual.normalization.requiresPack276).toEqual(expect.objectContaining({
      required: true,
      observedDecision: 'zavorth-hard-rename-purge-ready',
      satisfied: true,
    }));
    expect(missing276.normalization.decision).toBe('zavorth-alpha2-blocked-by-missing-276');
    expect(missing276.normalization.requiresPack276.satisfied).toBe(false);
  });

  it('targets alpha.2 and keeps package names and bins aligned', () => {
    const rootPackage = JSON.parse(read(ROOT_PACKAGE)) as { name: string; version: string; bin: Record<string, string> };
    const createPackage = JSON.parse(read(CREATE_PACKAGE)) as { name: string; version: string; bin: Record<string, string> };

    expect(rootPackage).toEqual(expect.objectContaining({
      name: 'zavorth',
      version: '1.1.0-alpha.2',
      bin: { zavorth: 'bin/zavorth.js' },
    }));
    expect(createPackage).toEqual(expect.objectContaining({
      name: 'create-zavorth',
      version: '1.1.0-alpha.2',
      bin: { 'create-zavorth': 'bin/create-zavorth.js' },
    }));
    expect(success.normalization.versionBefore).toEqual(expect.objectContaining({
      registryBefore: '1.1.0-alpha.1',
      target: '1.1.0-alpha.2',
      publishTag: 'alpha',
      stableRelease: false,
    }));
    expect(success.normalization.versionAfter.target).toBe('1.1.0-alpha.2');
  });

  it('records dry-run readiness and publish order', () => {
    expect(success.normalization.rootPackage).toEqual(expect.objectContaining({
      packageName: 'zavorth',
      version: '1.1.0-alpha.2',
      bin: ['zavorth'],
      dryRunReady: true,
      oldIdentityPackageLeak: false,
    }));
    expect(success.normalization.createPackage).toEqual(expect.objectContaining({
      packageName: 'create-zavorth',
      version: '1.1.0-alpha.2',
      bin: ['create-zavorth'],
      dryRunReady: true,
      oldIdentityPackageLeak: false,
    }));
    expect(success.normalization.publishOrder).toEqual(['zavorth', 'create-zavorth']);
  });

  it('models success, root failure, and partial failure safely', () => {
    expect(ready.normalization.decision).toBe('zavorth-alpha2-publish-ready');
    expect(success.normalization.decision).toBe('zavorth-clean-alpha2-published');
    expect(rootFailure.normalization.decision).toBe('zavorth-alpha2-root-publish-failed');
    expect(partialFailure.normalization.decision).toBe('zavorth-alpha2-root-published-create-failed');

    expect(rootFailure.normalization.publishResults[0]).toEqual(expect.objectContaining({
      packageName: 'zavorth',
      attempted: true,
      success: false,
    }));
    expect(rootFailure.normalization.publishResults[1]).toEqual(expect.objectContaining({
      packageName: 'create-zavorth',
      attempted: false,
      success: false,
    }));
    expect(rootFailure.rootFailureBlocksCreatePublish()).toBe(true);
    expect(partialFailure.normalization.publishResults[1]).toEqual(expect.objectContaining({
      attempted: true,
      success: false,
    }));
  });

  it('requires registry verification, public smoke, and old identity scan', () => {
    expect(success.normalization.postPublishVerification).toEqual([
      expect.objectContaining({
        packageName: 'zavorth',
        command: 'npm view zavorth versions dist-tags --json',
        versionsIncludeAlpha2: true,
        alphaTag: '1.1.0-alpha.2',
        latestTagManuallyChanged: false,
      }),
      expect.objectContaining({
        packageName: 'create-zavorth',
        command: 'npm view create-zavorth versions dist-tags --json',
        versionsIncludeAlpha2: true,
        alphaTag: '1.1.0-alpha.2',
        latestTagManuallyChanged: false,
      }),
    ]);
    expect(success.normalization.publicSmoke).toEqual([
      expect.objectContaining({
        command: 'npx --yes zavorth@latest --help',
        success: true,
        outputOldIdentityLeak: false,
      }),
      expect.objectContaining({
        command: 'npx --yes create-zavorth@latest --help',
        success: true,
        outputOldIdentityLeak: false,
      }),
    ]);
    expect(success.normalization.legacyIdentityScan.every((scan) => scan.oldIdentityPublicLeak === false)).toBe(true);
  });

  it('does not promote stable/latest manually or perform blocked actions', () => {
    expect(success.normalization.distTagState).toEqual(expect.objectContaining({
      latestTagManuallyChanged: false,
    }));
    expect(success.normalization.distTagState.after).toEqual(expect.objectContaining({
      zavorthAlpha: '1.1.0-alpha.2',
      zavorthLatest: '1.1.0-alpha.0',
      createZavorthAlpha: '1.1.0-alpha.2',
      createZavorthLatest: '1.1.0-alpha.0',
    }));
    expect(success.normalization.finalState).toEqual(expect.objectContaining({
      publishedVersion: '1.1.0-alpha.2',
      rootPublished: true,
      createPackagePublished: true,
      publicSmokePassed: true,
      legacyIdentityPublicLeak: false,
      stableRelease: false,
      latestTagManuallyChanged: false,
      globalInstallPerformed: false,
      runtimePersistentStartPerformed: false,
      domainPurchased: false,
      githubOrgCreatedByThisPack: false,
      trademarkFiled: false,
      rawSecretSerialized: false,
    }));
    expect(success.latestWasNotManuallyChanged()).toBe(true);
    expect(success.blockedActionPerformed()).toBe(false);
    assertNoRawSecret(JSON.stringify(success.normalization));
  });

  it('documents the alpha.2 publish handoff without old identity leakage', () => {
    const doc = read(DOC_277);

    expect(doc).toContain('Zavorth Clean Alpha.2 Publish Pack');
    expect(doc).toContain('1.1.0-alpha.2');
    expect(doc).toContain('npm publish --access public --tag alpha');
    expect(doc).toContain('npx --yes zavorth@latest --help');
    expect(doc).not.toMatch(legacyIdentityPattern);
    assertNoRawSecret(doc);
  });
});
