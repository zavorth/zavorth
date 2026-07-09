import fs from 'node:fs';
import path from 'node:path';
import { ZAVORTH_MODULE_SDK_API_VERSION } from '../../src/sdk/version.js';

import {
  createZavorthCapabilityBinding,
  createZavorthModuleManifest,
  createZavorthPermission,
  defineZavorthModule,
  normalizeZavorthModuleId,
} from '../../src/sdk/module/index.js';

import { ModuleSdkExportClosureService } from '../../src/services/ModuleSdkExportClosureService.js';
import { PluginRegistryService } from '../../src/services/PluginRegistryService.js';

describe('ModuleSdkExportClosureService Worker 4', () => {
  it('closes Plugin SDK and package export consistency through a Zavorth-native SDK', () => {
    const snapshot = new ModuleSdkExportClosureService({
      now: () => new Date('2026-05-04T23:45:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-04.worker-4');
    expect(snapshot.status).toBe('closed');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        publicSubpaths: 8,
        exportedSurfaces: 8,
        missingSurfaces: 0,
        packageExports: 8,
        sourcePackageExportsApprox: 299,
        sourcePluginSdkEntrypointsApprox: 296,
        compatibilityShimProvided: false,
        sourceImportPathsSupported: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.compatibility).toEqual(
      expect.objectContaining({
        source: 'source',
        decision: 'zavorth-native-sdk',
        compatibilityShimProvided: false,
        sourceImportPathsSupported: false,
        zavorthPublicSubpaths: 8,
      }),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        noSourceImportPaths: true,
        noSourceSdkShim: true,
        stableZavorthSubpaths: true,
        contractFirstApi: true,
        artifactFirstRuntime: true,
        noSecretsSerialized: true,
      }),
    );
    expect(snapshot.surfaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'module-authoring', status: 'exported' }),
        expect.objectContaining({ id: 'codex-runtime', status: 'exported' }),
        expect.objectContaining({ id: 'openshell-sandbox', status: 'exported' }),
      ]),
    );
    expect(snapshot.packageExports.map((entry) => entry.subpath)).toEqual([
      './sdk',
      './sdk/module',
      './sdk/contracts',
      './sdk/plugin-os',
      './sdk/capabilities',
      './sdk/runtime/codex',
      './sdk/runtime/openshell',
      './sdk/version',
    ]);
  });

  it('exposes stable package exports for the Module SDK', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'),
    ) as {
      exports: Record<string, unknown>;
      scripts: Record<string, string>;
    };

    expect(packageJson.exports).toEqual(
      expect.objectContaining({
        '.': expect.objectContaining({ types: './dist/index.d.ts', default: './dist/index.js' }),
        './sdk': expect.objectContaining({ types: './dist/sdk/index.d.ts', default: './dist/sdk/index.js' }),
        './sdk/module': expect.objectContaining({
          types: './dist/sdk/module/index.d.ts',
          default: './dist/sdk/module/index.js',
        }),
        './sdk/contracts': expect.objectContaining({
          types: './dist/sdk/contracts.d.ts',
          default: './dist/sdk/contracts.js',
        }),
        './sdk/plugin-os': expect.objectContaining({
          types: './dist/sdk/plugin-os.d.ts',
          default: './dist/sdk/plugin-os.js',
        }),
        './sdk/capabilities': expect.objectContaining({
          types: './dist/sdk/capabilities.d.ts',
          default: './dist/sdk/capabilities.js',
        }),
        './sdk/runtime/codex': expect.objectContaining({
          types: './dist/sdk/runtime-codex.d.ts',
          default: './dist/sdk/runtime-codex.js',
        }),
        './sdk/runtime/openshell': expect.objectContaining({
          types: './dist/sdk/runtime-openshell.d.ts',
          default: './dist/sdk/runtime-openshell.js',
        }),
        './sdk/version': expect.objectContaining({
          types: './dist/sdk/version.d.ts',
          default: './dist/sdk/version.js',
        }),
      }),
    );
    expect(packageJson.scripts['module-sdk-export:check']).toBe('node scripts/module-sdk-export-check.mjs');
    expect(packageJson.scripts['qa:module-sdk-export']).toBe('node scripts/module-sdk-export-check.mjs');
  });

  it('creates native module manifests that register in Plugin OS', () => {
    const capability = createZavorthCapabilityBinding({
      id: 'worker4.echo',
      intent: 'worker4_echo',
      label: 'Worker 4 Echo',
      summary: 'Echoes a test payload as a governed module output.',
      artifactKinds: ['worker4.echo.artifact'],
      command: {
        name: 'worker4-echo',
        usage: '<text>',
      },
    });
    const permission = createZavorthPermission(
      'artifact.write',
      'workspace',
      'Echo module writes its output as a Zavorth artifact.',
      false,
    );
    const manifest = createZavorthModuleManifest({
      id: 'Worker 4 Native Echo',
      label: 'Worker 4 Native Echo',
      moduleKind: 'tool',
      summary: 'Native Module SDK smoke manifest.',
      capabilities: [capability],
      permissions: [permission],
      policy: {
        defaultTrust: 'trusted',
        requiresApproval: false,
      },
    });

    const registry = new PluginRegistryService({
      now: () => new Date('2026-05-04T23:45:00.000Z'),
      manifests: [manifest],
    });

    expect(normalizeZavorthModuleId('Worker 4 Native Echo')).toBe('worker-4-native-echo');
    expect(manifest.schemaVersion).toBe('zavorth.plugin-os.v1');
    expect(manifest.id).toBe('worker-4-native-echo');
    expect(manifest.artifactKinds).toEqual(['worker4.echo.artifact']);
    expect(registry.getEntry('worker-4-native-echo')).toEqual(
      expect.objectContaining({
        health: expect.objectContaining({
          ok: true,
          summary: 'manifest ready',
        }),
      }),
    );
  });

  it('defines module handlers without Source import-path compatibility', async () => {
    const manifest = createZavorthModuleManifest({
      id: 'worker4-handler',
      label: 'Worker 4 Handler',
      moduleKind: 'tool',
      summary: 'Native handler smoke module.',
      capabilities: [
        createZavorthCapabilityBinding({
          id: 'worker4.handler',
          intent: 'worker4_handler',
          label: 'Worker 4 Handler',
          summary: 'Returns SDK API version.',
        }),
      ],
      policy: {
        defaultTrust: 'trusted',
        requiresApproval: false,
      },
    });
    const module = defineZavorthModule(manifest, async (input) => ({
      output: {
        capabilityId: input.capabilityId,
        sdkApiVersion: ZAVORTH_MODULE_SDK_API_VERSION,
      },
      artifacts: ['worker4.handler.artifact'],
      receipts: ['worker4.handler.receipt'],
    }));

    await expect(
      module.handler({
        pluginId: manifest.id,
        capabilityId: 'worker4.handler',
        input: {},
        requestedBy: 'test',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        output: {
          capabilityId: 'worker4.handler',
          sdkApiVersion: 'zavorth.module-sdk.v1',
        },
        artifacts: ['worker4.handler.artifact'],
        receipts: ['worker4.handler.receipt'],
      }),
    );
    expect(module.manifest.entrypoint).toEqual(
      expect.objectContaining({
        module: './index.js',
        exportName: 'createZavorthModule',
        runtime: 'node',
      }),
    );
  });
});

