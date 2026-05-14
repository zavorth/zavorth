import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_REAL_PUBLISH_PACK_RUNTIME_ID,
  createZavorthRealPublishPackFixture,
  createZavorthRealPublishPartialFailureFixture,
  createZavorthRealPublishRootFailureFixture,
  createZavorthRealPublishSuccessFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/273-zavorth-real-publish-pack.md';
const DOC_272 = 'docs/272-zavorth-publish-approval-gate.md';
const NAMING_DECISION = 'NAMING_DECISION.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthRealPublishPack.ts';
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

describe('Zavorth real publish pack', () => {
  const actual = createZavorthRealPublishPackFixture();
  const success = createZavorthRealPublishSuccessFixture();
  const rootFailure = createZavorthRealPublishRootFailureFixture();
  const partialFailure = createZavorthRealPublishPartialFailureFixture();

  it('exports the 273 boundary and contract', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthRealPublishPack/v1');
    expect(boundary).toContain('ZavorthRealPublishReceipt/v1');
    expect(boundary).toContain('ZavorthRealPublishVerification/v1');
    expect(boundary).toContain('ZavorthRealPublishOrder/v1');
    expect(index).toContain("from './ZavorthRealPublishPack.js'");
    expect(actual.normalization.packId).toBe('273');
    expect(actual.normalization.runtimeId).toBe(ZAVORTH_REAL_PUBLISH_PACK_RUNTIME_ID);
  });

  it('knows the expected packages and alpha publish order', () => {
    const rootPackage = JSON.parse(read(ROOT_PACKAGE)) as { name: string; version: string };
    const createPackage = JSON.parse(read(CREATE_PACKAGE)) as { name: string; version: string };

    expect(rootPackage).toEqual(expect.objectContaining({
      name: 'zavorth',
      version: '1.1.0-alpha.0',
    }));
    expect(createPackage).toEqual(expect.objectContaining({
      name: 'create-zavorth',
      version: '1.1.0-alpha.0',
    }));
    expect(actual.normalization.publishOrder.publishOrder).toEqual(['zavorth', 'create-zavorth']);
    expect(actual.normalization.publishOrder.createPackageRequiresRootSuccess).toBe(true);
    expect(actual.normalization.publishTag).toBe('alpha');
  });

  it('models pending, success, root failure, and partial failure decisions', () => {
    expect(actual.normalization.decision).toBe('zavorth-root-publish-failed');
    expect(success.normalization.decision).toBe('zavorth-published-alpha');
    expect(rootFailure.normalization.decision).toBe('zavorth-root-publish-failed');
    expect(partialFailure.normalization.decision).toBe('zavorth-root-published-create-package-failed');
  });

  it('requires root success before attempting create package publish', () => {
    expect(rootFailure.normalization.rootPublish).toEqual(expect.objectContaining({
      packageName: 'zavorth',
      attempted: true,
      success: false,
    }));
    expect(rootFailure.normalization.createPackagePublish).toEqual(expect.objectContaining({
      packageName: 'create-zavorth',
      attempted: false,
      success: false,
    }));
    expect(rootFailure.rootFailureBlocksCreatePackagePublish()).toBe(true);
  });

  it('records successful receipts and post-publish verification requirements', () => {
    expect(success.normalization.rootPublish).toEqual(expect.objectContaining({
      packageName: 'zavorth',
      command: 'npm publish --access public --tag alpha',
      attempted: true,
      success: true,
      tag: 'alpha',
      rawSecretSerialized: false,
    }));
    expect(success.normalization.createPackagePublish).toEqual(expect.objectContaining({
      packageName: 'create-zavorth',
      command: 'npm publish --access public --tag alpha',
      attempted: true,
      success: true,
      tag: 'alpha',
      rawSecretSerialized: false,
    }));
    expect(success.normalization.postPublishVerification).toEqual([
      expect.objectContaining({
        packageName: 'zavorth',
        command: 'npm view zavorth name version dist-tags --json',
        required: true,
        performed: true,
        success: true,
        observedVersion: '1.1.0-alpha.0',
        observedDistTagAlpha: '1.1.0-alpha.0',
      }),
      expect.objectContaining({
        packageName: 'create-zavorth',
        command: 'npm view create-zavorth name version dist-tags --json',
        required: true,
        performed: true,
        success: true,
        observedVersion: '1.1.0-alpha.0',
        observedDistTagAlpha: '1.1.0-alpha.0',
      }),
    ]);
  });

  it('keeps non-publish external actions blocked', () => {
    expect(success.normalization.finalState).toEqual(expect.objectContaining({
      globalInstallPerformed: false,
      domainPurchased: false,
      githubOrgCreatedByThisPack: false,
      trademarkFiled: false,
      runtimePersistentStartPerformed: false,
      rawSecretSerialized: false,
      externalExecutorPublicIdentityReintroduced: false,
    }));
    expect(success.blockedActionPerformed()).toBe(false);
    expect(success.normalization.partialFailureHandling).toEqual(expect.objectContaining({
      rootFailureBlocksCreatePackagePublish: true,
      createFailureAfterRootPublishRecordedAsPartial: true,
      rollbackInvented: false,
      scopedFallbackAllowedAutomatically: false,
      versionChangeAllowedMidPack: false,
    }));
  });

  it('documents the pending action-time confirmation and updates handoff files', () => {
    const doc = read(DOC);
    const doc272 = read(DOC_272);
    const namingDecision = read(NAMING_DECISION);

    expect(doc).toContain('Status: `zavorth-root-publish-failed`');
    expect(doc).toContain('npm publish --access public --tag alpha');
    expect(doc).toContain('npm view zavorth name version dist-tags --json');
    expect(doc).toContain('npm view create-zavorth name version dist-tags --json');
    expect(doc).toContain('root failure blocks create package publish');
    expect(doc).toContain('E403 Forbidden');
    expect(doc).toContain('createPackagePublish.attempted=false');
    expect(doc272).toContain('273 real publish note');
    expect(doc272).toContain('decision=zavorth-root-publish-failed');
    expect(namingDecision).toContain('273 - Zavorth Real Publish Pack');
    expect(namingDecision).toContain('Status: `zavorth-root-publish-failed`');
    assertNoRawSecret(doc);
    assertNoRawSecret(doc272);
    assertNoRawSecret(namingDecision);
  });

  it('serializes without raw secrets', () => {
    for (const fixture of [actual, success, rootFailure, partialFailure]) {
      assertNoRawSecret(JSON.stringify(fixture.normalization));
    }
  });
});
