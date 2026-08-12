import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SourcePluginOsAbsorptionService } from '../../src/services/SourcePluginOsAbsorptionService.js';
import { ZavorthSemanticPluginPackageCertificationService } from '../../src/services/ZavorthSemanticPluginPackageCertificationService.js';

describe('ZavorthSemanticPluginPackageCertificationService S1', () => {
  const now = () => new Date('2026-05-05T16:00:00.000Z');
  let tempRoot: string;
  let sourceRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-semantic-s1-'));
    sourceRoot = path.join(tempRoot, 'source');
    createFixtureSourcePackages(sourceRoot);
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('certifies plugin/package behavior as semantic claims backed by receipts', () => {
    const snapshot = new ZavorthSemanticPluginPackageCertificationService({
      now,
      sourceRoot,
    }).buildSnapshot();

    expect(snapshot.status).toBe('passed');
    expect(snapshot.semanticPhase).toBe('S1');
    expect(snapshot.contractVersion).toBe('2026-05-05.semantic-s1');
    expect(snapshot.summary).toEqual(expect.objectContaining({
      semanticClaims: expect.any(Number),
      gaps: 0,
      runtimeExecutionPerformed: false,
      sourceCodeCopied: false,
      secretValuesSerialized: false,
    }));
    expect(snapshot.summary.semanticClaims).toBeGreaterThan(12);
    expect(snapshot.summary.receiptBackedClaims).toBe(snapshot.summary.semanticClaims);
    expect(snapshot.claims).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'package-presence',
        packageName: '@source/plugin-sdk',
        status: 'covered',
        priority: 'P0',
      }),
      expect.objectContaining({
        kind: 'sdk-replacement',
        packageName: '@source/sdk',
        status: 'replaced',
      }),
      expect.objectContaining({
        kind: 'export-family',
        packageName: '@source/plugin-sdk',
        exportFamily: 'provider',
        status: 'covered',
      }),
      expect.objectContaining({
        kind: 'manifest-conversion',
        status: 'covered',
        priority: 'P0',
      }),
      expect.objectContaining({
        kind: 'lifecycle-policy',
        status: 'covered',
        priority: 'P0',
      }),
    ]));
    expect(snapshot.policy).toEqual(expect.objectContaining({
      semanticClaimRequiredForEveryPackage: true,
      exportFamiliesMustMapToZavorthCapability: true,
      gapsBlockRelease: true,
    }));
    expect(snapshot.commands.nextStage).toBe('S2 - Agent Runtime Semantics');
  });

  it('fails S1 when package semantics cannot be extracted', () => {
    const emptySourceRoot = path.join(tempRoot, 'empty-source');
    fs.mkdirSync(emptySourceRoot, { recursive: true });

    const snapshot = new ZavorthSemanticPluginPackageCertificationService({
      now,
      sourceRoot: emptySourceRoot,
    }).buildSnapshot();

    expect(snapshot.status).toBe('failed');
    expect(snapshot.absorptionStatus).toBe('failed');
    expect(snapshot.summary.gaps).toBeGreaterThan(0);
    expect(snapshot.claims).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'package-presence',
        packageName: '@source/plugin-sdk',
        status: 'gap',
      }),
    ]));
  });

  it('can consume an injected Intent model absorption service', () => {
    const absorptionService = new SourcePluginOsAbsorptionService({
      now,
      sourceRoot,
    });
    const service = new ZavorthSemanticPluginPackageCertificationService({
      now,
      absorptionService,
    });

    const snapshot = service.buildSnapshot();
    const text = service.formatSnapshotText(snapshot);

    expect(snapshot.status).toBe('passed');
    expect(text).toContain('Zavorth Semantic Plugin Package Certification - S1');
    expect(text).toContain('Next: S2 - Agent Runtime Semantics');
  });
});

function createFixtureSourcePackages(sourceRoot: string): void {
  createPackage(sourceRoot, 'plugin-sdk', '@source/plugin-sdk', {
    './plugin-entry': './src/plugin-entry.ts',
    './provider-entry': './src/provider-entry.ts',
    './provider-tools': './src/provider-tools.ts',
    './runtime-doctor': './src/runtime-doctor.ts',
    './security-runtime': './src/security-runtime.ts',
    './secret-ref-runtime': './src/secret-ref-runtime.ts',
    './channel-streaming': './src/channel-streaming.ts',
    './config-runtime': './src/config-runtime.ts',
  });
  createPackage(sourceRoot, 'plugin-package-contract', '@source/plugin-package-contract', {
    '.': './src/index.ts',
  });
  createPackage(sourceRoot, 'sdk', '@source/sdk', {
    '.': './dist/index.mjs',
  });
  createPackage(sourceRoot, 'memory-host-sdk', '@source/memory-host-sdk', {
    './runtime': './src/runtime.ts',
    './query': './src/query.ts',
    './secret': './src/secret.ts',
    './engine-storage': './src/engine-storage.ts',
  });
}

function createPackage(
  sourceRoot: string,
  directoryName: string,
  packageName: string,
  exportsField: Record<string, unknown>,
): void {
  const packageRoot = path.join(sourceRoot, 'packages', directoryName);
  fs.mkdirSync(packageRoot, { recursive: true });
  fs.writeFileSync(path.join(packageRoot, 'package.json'), JSON.stringify({
    name: packageName,
    version: '0.0.0-private',
    type: 'module',
    exports: exportsField,
  }, null, 2));
}
