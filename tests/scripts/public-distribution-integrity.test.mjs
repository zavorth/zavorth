import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import * as distribution from '../../scripts/public-distribution-integrity.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dist-'));
  for (const platform of distribution.REQUIRED_PLATFORMS) fs.writeFileSync(path.join(root, `zavorth-${platform}.tar.gz`), platform);
  return root;
}

test('builds and verifies a complete cross-platform rehearsal', () => {
  const root = fixture();
  const manifest = distribution.buildPublicDistributionManifest({ artifactDir: root, version: '2.0.0', production: false });
  assert.deepEqual(distribution.validatePublicDistributionManifest(manifest), []);
  assert.deepEqual(distribution.verifyManifestFiles(manifest, root), []);
});

test('production fails closed without SBOM, provenance, and external signatures', () => {
  const manifest = distribution.buildPublicDistributionManifest({ artifactDir: fixture(), version: '2.0.0', production: true, signaturePlatforms: distribution.REQUIRED_PLATFORMS });
  const failures = distribution.validatePublicDistributionManifest(manifest, { production: true, requireExternalSignatures: true });
  assert.ok(failures.includes('production release requires an SBOM'));
  assert.ok(failures.includes('production release requires provenance evidence'));
  assert.ok(failures.includes('production release requires externally generated signatures'));
  assert.ok(failures.includes('production release requires signing evidence for windows-x64'));
});

test('rejects tampered platform inventory, aggregate, filenames, and orphan artifacts', () => {
  const root = fixture();
  const manifest = distribution.buildPublicDistributionManifest({ artifactDir: root, version: '2.0.0', production: false });
  manifest.artifacts.pop();
  manifest.artifacts.push({ ...manifest.artifacts[0] });
  manifest.auxiliary.push({ name: '../escape', bytes: 1, sha256: 'a'.repeat(64) });
  const failures = distribution.validatePublicDistributionManifest(manifest);
  assert.ok(failures.some((entry) => entry.includes('platform entry must appear exactly once')));
  assert.ok(failures.includes('aggregateSthere is256 does not match manifest contents'));
  assert.ok(failures.includes('unsafe manifest filename: ../escape'));
  const clean = distribution.buildPublicDistributionManifest({ artifactDir: root, version: '2.0.0', production: false });
  fs.writeFileSync(path.join(root, 'unexpected.tar.gz'), 'orphan');
  assert.ok(distribution.verifyManifestFiles(clean, root).includes('unreferenced artifact file: unexpected.tar.gz'));
});

test('release workflow produces exact five platform names before the integrity gate', () => {
  const workflow = fs.readFileSync(path.resolve('.github/workflows/release.yml'), 'utf8');
  for (const platform of distribution.REQUIRED_PLATFORMS) assert.ok(workflow.includes(`platform: ${platform}`));
  assert.ok(workflow.includes('ARCHIVE="zavorth-${{ matrix.platform }}.tar.gz"'));
  assert.ok(workflow.includes('merge-multiple: true'));
  assert.ok(workflow.indexOf('Download all binaries') < workflow.indexOf('Verify public distribution manifest'));
});

test('detects tampering and preserves user data in rollback policy', () => {
  const root = fixture();
  const manifest = distribution.buildPublicDistributionManifest({ artifactDir: root, version: '2.0.0', production: false });
  fs.appendFileSync(path.join(root, 'zavorth-linux-x64.tar.gz'), 'tamper');
  assert.ok(distribution.verifyManifestFiles(manifest, root).includes('artifact changed after manifest: zavorth-linux-x64.tar.gz'));
  assert.ok(manifest.rollback.preservePaths.includes('.zavorth'));
  assert.equal(manifest.rollback.destructiveUserDataRemovalAllowed, false);
});
