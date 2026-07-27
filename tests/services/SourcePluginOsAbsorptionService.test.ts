import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SourcePluginOsAbsorptionService } from '../../src/services/SourcePluginOsAbsorptionService.js';
import { SourcePluginPackageAdapterService } from '../../src/services/SourcePluginPackageAdapterService.js';
import { SourcePluginRuntimeDoctorService } from '../../src/services/SourcePluginRuntimeDoctorService.js';
import { SourcePluginSdkCompatibilityMatrixService } from '../../src/services/SourcePluginSdkCompatibilityMatrixService.js';

describe('SourcePluginOsAbsorptionService Intent model', () => {
  const now = () => new Date('2026-05-05T13:00:00.000Z');
  let tempRoot: string;
  let sourceRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-source-plugin-os-'));
    sourceRoot = path.join(tempRoot, 'source');
    createFixtureSourcePackages(sourceRoot);
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('converts Source-like package metadata into a Zavorth Plugin OS manifest', () => {
    const snapshot = new SourcePluginPackageAdapterService({
      now,
    }).convertPackageJson({
      packageJson: sampleExternalPluginPackage(),
      packagePath: 'fixture://provider',
      digest: 'sha256:test',
    });

    expect(snapshot.contractVersion).toBe('2026-05-05.checkpoint-1');
    expect(snapshot.status).toBe('converted');
    expect(snapshot.manifest).toEqual(
      expect.objectContaining({
        schemaVersion: 'zavorth.plugin-os.v1',
        id: 'fixture-provider',
        moduleKind: 'provider',
        entrypoint: expect.objectContaining({
          module: './dist/index.js',
          exportName: 'createFixtureProvider',
          runtime: 'node',
        }),
      }),
    );
    expect(snapshot.manifest.permissions.map((permission) => permission.kind)).toEqual(expect.arrayContaining([
      'network.external',
      'secret.read',
      'artifact.write',
    ]));
    expect(snapshot.receipt.policy).toEqual(
      expect.objectContaining({
        noSourceImportPathShim: true,
        noRuntimeExecution: true,
        manifestDisabledByDefault: true,
      }),
    );
  });

  it('keeps incomplete Source-like packages in review instead of pretending they are ready', () => {
    const snapshot = new SourcePluginPackageAdapterService({
      now,
    }).convertPackageJson({
      packageJson: {
        name: '@example/incomplete-plugin',
        version: '0.1.0',
      },
      packagePath: 'fixture://incomplete',
    });

    expect(snapshot.status).toBe('needs_review');
    expect(snapshot.receipt.compatibility.missingRequiredFieldPaths).toEqual([
      'source.compat.pluginApi',
      'source.build.sourceVersion',
    ]);
    expect(snapshot.receipt.issues.map((issue) => issue.fieldPath)).toEqual([
      'source.compat.pluginApi',
      'source.build.sourceVersion',
    ]);
  });

  it('builds a package SDK compatibility matrix from Source internal packages', () => {
    const matrix = new SourcePluginSdkCompatibilityMatrixService({
      now,
    }).buildSnapshot(sourceRoot);

    expect(matrix.status).toBe('passed');
    expect(matrix.summary).toEqual(
      expect.objectContaining({
        packagesExpected: 4,
        packagesFound: 4,
        packagesMissing: 0,
        declaredExports: 7,
        pluginSdkExports: 3,
        memoryHostExports: 2,
        packageContractExports: 1,
        sdkRootExports: 1,
        mappedToPluginOs: 3,
        mappedToNativeSdk: 1,
      }),
    );
    expect(matrix.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          packageName: '@source/plugin-sdk',
          decision: 'mapped-to-plugin-os',
          targetPhase: 1,
        }),
        expect.objectContaining({
          packageName: '@source/memory-host-sdk',
          targetPhase: 5,
        }),
      ]),
    );
  });

  it('runs a runtime doctor with policy and receipts without executing external plugin code', () => {
    const doctor = new SourcePluginRuntimeDoctorService({
      now,
    }).doctorPackageJson({
      packageJson: sampleExternalPluginPackage(),
      packagePath: 'fixture://provider',
    });

    expect(doctor.status).toBe('passed');
    expect(doctor.summary).toEqual(
      expect.objectContaining({
        receipts: 4,
        approvalsRequired: 2,
        blocked: 0,
        executionPerformed: false,
        noSecretsSerialized: true,
      }),
    );
    expect(doctor.lifecycle.installWithoutApproval.status).toBe('approval_required');
    expect(doctor.lifecycle.installWithApproval.status).toBe('applied');
    expect(doctor.lifecycle.enableWithApproval.status).toBe('applied');
    expect(doctor.lifecycle.invokeWithoutApproval.status).toBe('approval_required');
    expect(doctor.policy.noExternalPluginCodeExecution).toBe(true);
  });

  it('emits a Intent model absorption snapshot and next-phase handoff', () => {
    const service = new SourcePluginOsAbsorptionService({
      now,
      sourceRoot,
    });
    const snapshot = service.buildSnapshot();
    const text = service.formatSnapshotText(snapshot);

    expect(snapshot.status).toBe('passed');
    expect(snapshot.phase).toBe(1);
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        packagesFound: 4,
        declaredExports: 7,
        manifestsConverted: 1,
        lifecycleReceipts: 4,
        runtimeExecutionPerformed: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        noSourceSourceCopy: true,
        noSourceImportPathShim: true,
        disabledByDefault: true,
        artifactFirstReceipts: true,
      }),
    );
    expect(snapshot.commands.nextAction).toBe('Preview engine - Agent Runtime Bridge Pack');
    expect(text).toContain('Zavorth Source Plugin OS Absorption - Intent model');
    expect(text).toContain('Next: Preview engine - Agent Runtime Bridge Pack');
  });
});

function createFixtureSourcePackages(sourceRoot: string): void {
  createPackage(sourceRoot, 'plugin-sdk', '@source/plugin-sdk', {
    './plugin-entry': './src/plugin-entry.ts',
    './provider-entry': './src/provider-entry.ts',
    './runtime-doctor': './src/runtime-doctor.ts',
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

function sampleExternalPluginPackage(): unknown {
  return {
    name: '@example/fixture-provider',
    version: '1.2.3',
    description: 'Fixture provider plugin.',
    keywords: ['provider', 'auth'],
    main: './dist/index.js',
    source: {
      compat: {
        pluginApi: '^1.0.0',
        minGatewayVersion: '>=1.1.0',
      },
      build: {
        sourceVersion: '0.0.0-private',
        pluginSdkVersion: '0.0.0-private',
      },
      plugin: {
        id: 'fixture-provider',
        label: 'Fixture Provider',
        kind: 'provider',
      },
      entrypoint: {
        module: './dist/index.js',
        exportName: 'createFixtureProvider',
      },
      capabilities: [
        {
          id: 'fixture.query',
          intent: 'fixture_query',
          label: 'Fixture Query',
          summary: 'Queries a fixture provider.',
          artifactKinds: ['fixture.query.artifact'],
        },
      ],
      permissions: [
        {
          kind: 'network.external',
          scope: 'external',
          reason: 'External provider call.',
          required: true,
        },
        {
          kind: 'secret.read',
          scope: 'workspace',
          reason: 'Provider key SecretRef.',
          required: true,
        },
        {
          kind: 'artifact.write',
          scope: 'workspace',
          reason: 'Artifact-first receipt.',
          required: false,
        },
      ],
    },
  };
}
