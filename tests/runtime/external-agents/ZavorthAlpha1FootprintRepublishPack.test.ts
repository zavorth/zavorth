import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_ALPHA1_FOOTPRINT_REPUBLISH_PACK_RUNTIME_ID,
  createZavorthAlpha1FootprintRepublishPackFixture,
  createZavorthAlpha1FootprintRepublishPartialFailureFixture,
  createZavorthAlpha1FootprintRepublishReadyFixture,
  createZavorthAlpha1FootprintRepublishRootFailureFixture,
  createZavorthAlpha1FootprintRepublishSuccessFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/275-zavorth-alpha1-footprint-republish-pack.md';
const DOC_273 = 'docs/273-zavorth-real-publish-pack.md';
const DOC_274 = 'docs/274-zavorth-npm-package-footprint-reduction-pack.md';
const NAMING_DECISION = 'NAMING_DECISION.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthAlpha1FootprintRepublishPack.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const ROOT_PACKAGE = 'package.json';
const ROOT_LOCK = 'package-lock.json';
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

describe('Zavorth alpha.1 footprint republish pack', () => {
  const actual = createZavorthAlpha1FootprintRepublishPackFixture();
  const published = createZavorthAlpha1FootprintRepublishSuccessFixture();
  const ready = createZavorthAlpha1FootprintRepublishReadyFixture();
  const rootFailure = createZavorthAlpha1FootprintRepublishRootFailureFixture();
  const partialFailure = createZavorthAlpha1FootprintRepublishPartialFailureFixture();

  it('exports the 275 boundary and contract', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthAlpha1FootprintRepublishPack/v1');
    expect(boundary).toContain('ZavorthAlpha1PublishResult/v1');
    expect(boundary).toContain('ZavorthAlpha1PostPublishVerification/v1');
    expect(index).toContain("from './ZavorthAlpha1FootprintRepublishPack.js'");
    expect(actual.normalization.packId).toBe('275');
    expect(actual.normalization.runtimeId).toBe(ZAVORTH_ALPHA1_FOOTPRINT_REPUBLISH_PACK_RUNTIME_ID);
  });

  it('aligns root and create package versions to alpha.1', () => {
    const rootPackage = JSON.parse(read(ROOT_PACKAGE)) as { name: string; version: string };
    const lock = JSON.parse(read(ROOT_LOCK)) as { name: string; version: string; packages: Record<string, { name?: string; version?: string }> };
    const createPackage = JSON.parse(read(CREATE_PACKAGE)) as { name: string; version: string };

    expect(rootPackage).toEqual(expect.objectContaining({
      name: 'zavorth',
      version: '1.1.0-alpha.1',
    }));
    expect(lock).toEqual(expect.objectContaining({
      name: 'zavorth',
      version: '1.1.0-alpha.1',
    }));
    expect(lock.packages['']).toEqual(expect.objectContaining({
      name: 'zavorth',
      version: '1.1.0-alpha.1',
    }));
    expect(createPackage).toEqual(expect.objectContaining({
      name: 'create-zavorth',
      version: '1.1.0-alpha.1',
    }));
    expect(published.normalization.versionBefore).toEqual(expect.objectContaining({
      rootPackage: '1.1.0-alpha.0',
      createPackage: '1.1.0-alpha.0',
    }));
    expect(published.normalization.versionAfter).toEqual(expect.objectContaining({
      rootPackage: '1.1.0-alpha.1',
      createPackage: '1.1.0-alpha.1',
    }));
  });

  it('keeps public alpha policy and blocks manual latest promotion', () => {
    expect(published.normalization.publicAlphaPolicy).toEqual(expect.objectContaining({
      productStage: 'public-alpha',
      publishTag: 'alpha',
      stableRelease: false,
      latestTagManuallyChanged: false,
      latestTagMayRemainAlpha: true,
      latestTagManualChangeBlocked: true,
    }));
    expect(published.preservesAlphaPolicy()).toBe(true);
    expect(published.normalization.finalState).toEqual(expect.objectContaining({
      publishedVersion: '1.1.0-alpha.1',
      publishTag: 'alpha',
      stableRelease: false,
      latestTagManuallyChanged: false,
    }));
  });

  it('records pack 274 footprint and alpha.1 pack dry-run state', () => {
    expect(published.normalization.footprintBaselineFrom274).toEqual(expect.objectContaining({
      baselinePackageSizeBytes: 8506586,
      baselineUnpackedSizeBytes: 60047405,
      baselineFileCount: 13898,
      optimizedPackageSizeBytes: 5086394,
      optimizedUnpackedSizeBytes: 35026354,
      optimizedFileCount: 6995,
      sourcemapsRemoved: 6905,
    }));
    expect(published.normalization.rootPackage).toEqual(expect.objectContaining({
      packageName: 'zavorth',
      version: '1.1.0-alpha.1',
      packageSizeBytes: 5089434,
      fileCount: 6997,
      sourcemapCount: 0,
      dryRunReady: true,
    }));
    expect(published.normalization.createPackage).toEqual(expect.objectContaining({
      packageName: 'create-zavorth',
      version: '1.1.0-alpha.1',
      fileCount: 4,
      dryRunReady: true,
    }));
  });

  it('models publish order, full success, root failure, and partial failure', () => {
    expect(published.normalization.publishOrder).toEqual(['zavorth', 'create-zavorth']);
    expect(ready.normalization.decision).toBe('zavorth-alpha1-publish-ready');
    expect(published.normalization.decision).toBe('zavorth-alpha1-published');
    expect(actual.normalization.decision).toBe('zavorth-alpha1-root-publish-failed');
    expect(rootFailure.normalization.decision).toBe('zavorth-alpha1-root-publish-failed');
    expect(partialFailure.normalization.decision).toBe('zavorth-alpha1-root-published-create-failed');

    expect(rootFailure.normalization.publishResults[0]).toEqual(expect.objectContaining({
      packageName: 'zavorth',
      attempted: true,
      success: false,
      stderrSummary: expect.stringContaining('EOTP'),
    }));
    expect(rootFailure.normalization.publishResults[1]).toEqual(expect.objectContaining({
      packageName: 'create-zavorth',
      attempted: false,
      success: false,
    }));
    expect(rootFailure.rootFailureBlocksCreatePublish()).toBe(true);
  });

  it('requires post-publish npm view checks and npx alpha smoke', () => {
    expect(published.normalization.postPublishVerification).toEqual([
      expect.objectContaining({
        packageName: 'zavorth',
        command: 'npm view zavorth name version dist-tags --json',
        observedVersion: '1.1.0-alpha.1',
        observedAlphaTag: '1.1.0-alpha.1',
        latestTagManuallyChanged: false,
      }),
      expect.objectContaining({
        packageName: 'create-zavorth',
        command: 'npm view create-zavorth name version dist-tags --json',
        observedVersion: '1.1.0-alpha.1',
        observedAlphaTag: '1.1.0-alpha.1',
        latestTagManuallyChanged: false,
      }),
    ]);
    expect(published.normalization.npxSmoke).toEqual([
      expect.objectContaining({
        command: 'npx --yes zavorth@latest --help',
        success: true,
        runtimePersistentStartPerformed: false,
      }),
      expect.objectContaining({
        command: 'npx --yes create-zavorth@latest --help',
        success: true,
        runtimePersistentStartPerformed: false,
      }),
    ]);
  });

  it('keeps blocked actions blocked and avoids raw secret serialization', () => {
    expect(published.normalization.finalState).toEqual(expect.objectContaining({
      globalInstallPerformed: false,
      runtimePersistentStartPerformed: false,
      domainPurchased: false,
      githubOrgCreatedByThisPack: false,
      trademarkFiled: false,
      rawSecretSerialized: false,
      externalExecutorPublicIdentityReintroduced: false,
    }));
    expect(published.blockedActionPerformed()).toBe(false);
    assertNoRawSecret(JSON.stringify(published.normalization));
  });

  it('documents the alpha.1 republish handoff', () => {
    const doc = read(DOC);
    const doc273 = read(DOC_273);
    const doc274 = read(DOC_274);
    const namingDecision = read(NAMING_DECISION);

    expect(doc).toContain('Zavorth Alpha.1 Footprint Republish Pack');
    expect(doc).toContain('Status: `zavorth-alpha1-root-publish-failed`');
    expect(doc).toContain('1.1.0-alpha.1');
    expect(doc).toContain('npm publish --access public --tag alpha');
    expect(doc).toContain('npx --yes zavorth@latest --help');
    expect(doc).toContain('EOTP');
    expect(doc).toContain('latestTagManuallyChanged=false');
    expect(doc273).toContain('275 alpha.1 footprint republish note');
    expect(doc274).toContain('275 alpha.1 republish note');
    expect(namingDecision).toContain('275 - Zavorth Alpha.1 Footprint Republish Pack');
    assertNoRawSecret(doc);
    assertNoRawSecret(doc273);
    assertNoRawSecret(doc274);
    assertNoRawSecret(namingDecision);
  });
});
