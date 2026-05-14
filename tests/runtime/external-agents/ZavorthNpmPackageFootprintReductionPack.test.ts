import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_NPM_PACKAGE_FOOTPRINT_REDUCTION_PACK_RUNTIME_ID,
  createZavorthNpmPackageFootprintReductionPackFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/274-zavorth-npm-package-footprint-reduction-pack.md';
const DOC_273 = 'docs/273-zavorth-real-publish-pack.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthNpmPackageFootprintReductionPack.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const ROOT_PACKAGE = 'package.json';

const PUBLIC_PACKAGE_DOCS = [
  'README.md',
  'docs/02-quickstart.md',
  'docs/05-security.md',
  'docs/07-web.md',
  'docs/09-operations.md',
  'docs/10-troubleshooting.md',
  'docs/34-zavorth-cli.md',
  'docs/self-modification.md',
];

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

describe('Zavorth npm package footprint reduction pack', () => {
  const pack = createZavorthNpmPackageFootprintReductionPackFixture();

  it('exports the 274 boundary and contract', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthNpmPackageFootprintReductionPack/v1');
    expect(boundary).toContain('ZavorthNpmPackageFootprintSnapshot/v1');
    expect(boundary).toContain('ZavorthNpmPackageRemovedCategory/v1');
    expect(index).toContain("from './ZavorthNpmPackageFootprintReductionPack.js'");
    expect(pack.normalization.packId).toBe('274');
    expect(pack.normalization.runtimeId).toBe(ZAVORTH_NPM_PACKAGE_FOOTPRINT_REDUCTION_PACK_RUNTIME_ID);
  });

  it('records baseline and optimized footprints with a real reduction', () => {
    expect(pack.normalization.decision).toBe('zavorth-package-footprint-reduced');
    expect(pack.normalization.baselineFootprint).toEqual(expect.objectContaining({
      packageName: 'zavorth',
      packageSizeBytes: 8506586,
      unpackedSizeBytes: 60047405,
      fileCount: 13898,
      mapFileCount: 6905,
    }));
    expect(pack.normalization.optimizedFootprint).toEqual(expect.objectContaining({
      packageName: 'zavorth',
      packageSizeBytes: 5086394,
      unpackedSizeBytes: 35026354,
      fileCount: 6995,
      mapFileCount: 0,
    }));
    expect(pack.footprintReduced()).toBe(true);
  });

  it('keeps the runtime distribution and bins in the package policy', () => {
    const rootPackage = JSON.parse(read(ROOT_PACKAGE)) as {
      name: string;
      main: string;
      types: string;
      bin: Record<string, string>;
      files: string[];
    };

    expect(rootPackage).toEqual(expect.objectContaining({
      name: 'zavorth',
      main: 'dist/index.js',
      types: 'dist/index.d.ts',
      bin: {
        zavorth: 'bin/zavorth.js',
        zavorth: 'bin/zavorth.js',
      },
    }));
    expect(rootPackage.files).toEqual(expect.arrayContaining([
      'bin/zavorth.js',
      'bin/zavorth.js',
      'dist/',
      'dist-ops/',
      '!dist/**/*.js.map',
      '!dist/**/*.d.ts.map',
      '!dist-ops/**/*.js.map',
      '!dist-ops/**/*.d.ts.map',
    ]));
    expect(pack.retainedRuntimeDistribution()).toBe(true);
  });

  it('excludes generated maps and internal release docs without deleting repo docs', () => {
    const rootPackage = JSON.parse(read(ROOT_PACKAGE)) as { files: string[] };

    expect(pack.normalization.removedCategories).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'generated-sourcemaps',
        disposition: 'excluded-from-tarball',
        fileCountDelta: 6905,
      }),
      expect.objectContaining({
        category: 'internal-release-docs',
        disposition: 'excluded-from-tarball',
        fileCountDelta: 3,
      }),
    ]));
    expect(rootPackage.files).not.toContain('docs/248-post-absorption-release-docs-install-cleanup.md');
    expect(rootPackage.files).not.toContain('docs/249-post-absorption-release-candidate-report.md');
    expect(rootPackage.files).not.toContain('docs/250-post-absorption-final-release-notes-and-handoff.md');
    expect(fs.existsSync(path.join(process.cwd(), 'docs/248-post-absorption-release-docs-install-cleanup.md'))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), 'docs/249-post-absorption-release-candidate-report.md'))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), 'docs/250-post-absorption-final-release-notes-and-handoff.md'))).toBe(true);
  });

  it('keeps public package docs coherent and Zavorth-native', () => {
    const rootPackage = JSON.parse(read(ROOT_PACKAGE)) as { files: string[] };
    const publicSurface = PUBLIC_PACKAGE_DOCS.map(read).join('\n');

    expect(rootPackage.files).toEqual(expect.arrayContaining([
      'README.md',
      'docs/02-quickstart.md',
      'docs/05-security.md',
      'docs/07-web.md',
      'docs/09-operations.md',
      'docs/10-troubleshooting.md',
      'docs/34-zavorth-cli.md',
      'docs/self-modification.md',
    ]));
    expect(read('README.md')).not.toContain('docs/248-post-absorption-release-docs-install-cleanup.md');
    expect(read('README.md')).not.toContain('docs/71-dashboard-command-center-architecture.md');
    expect(publicSurface).not.toMatch(/ExternalExecutor|external-executor/);
    expect(publicSurface).not.toMatch(/\.bat\b/i);
    assertNoRawSecret(publicSurface);
  });

  it('keeps publish and dangerous runtime actions blocked', () => {
    expect(pack.normalization.finalState).toEqual(expect.objectContaining({
      npmPublishActuallyPerformed: false,
      createPackagePublishActuallyPerformed: false,
      runtimeBehaviorChanged: false,
      cliBehaviorPreserved: true,
      globalInstallPerformed: false,
      rawSecretSerialized: false,
      externalExecutorPublicIdentityReintroduced: false,
    }));
    expect(pack.blockedActionPerformed()).toBe(false);
  });

  it('documents the footprint reduction and validation gates', () => {
    const doc = read(DOC);
    const doc273 = read(DOC_273);

    expect(doc).toContain('decision=zavorth-package-footprint-reduced');
    expect(doc).toContain('baselineFootprint');
    expect(doc).toContain('optimizedFootprint');
    expect(doc).toContain('13,898');
    expect(doc).toContain('6,995');
    expect(doc).toContain('sourcemaps');
    expect(doc).toContain('npmPublishActuallyPerformed=false');
    expect(doc273).toContain('274 footprint note');
    assertNoRawSecret(doc);
    assertNoRawSecret(doc273);
  });

  it('serializes without raw secrets', () => {
    assertNoRawSecret(JSON.stringify(pack.normalization));
  });
});
