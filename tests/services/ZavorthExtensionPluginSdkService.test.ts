import { ZavorthExtensionPluginSdkService } from '../../src/services/ZavorthExtensionPluginSdkService.js';

describe('ZavorthExtensionPluginSdkService', () => {
  const now = () => new Date('2026-05-24T12:00:00.000Z');

  it('exposes manifest schema, permissions, local marketplace, lifecycle and receipts', () => {
    const service = new ZavorthExtensionPluginSdkService({
      now,
      cwd: 'C:/workspace',
      env: {},
      pluginRegistryService: registryFixture(),
      pluginStateService: stateFixture(),
    });

    const snapshot = service.execute();

    expect(snapshot.contractVersion).toBe('2026-05-24.extension-plugin-sdk-phase-8');
    expect(snapshot.manifestSchema.schemaVersion).toBe('zavorth.plugin-sdk.v1');
    expect(snapshot.manifestSchema.permissionKinds).toContain('network.external');
    expect(snapshot.marketplaceLocal.entries).toHaveLength(2);
    expect(snapshot.hotReloadDev.constraints.reloadDoesNotBypassPermissions).toBe(true);
    expect(snapshot.safety.receiptsRequiredPerPluginAction).toBe(true);
    expect(snapshot.receipts.every((receipt) => receipt.rawSecretSerialized === false)).toBe(true);
  });

  it('blocks invalid manifests before install or enable', () => {
    const service = new ZavorthExtensionPluginSdkService({
      now,
      cwd: 'C:/workspace',
      pluginRegistryService: registryFixture(),
      pluginStateService: stateFixture(),
    });

    const snapshot = service.execute({
      action: 'manifest.validate',
      manifestJson: JSON.stringify({ id: 'bad' }),
      lifecycleAction: 'install',
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.validation.status).toBe('invalid');
    expect(snapshot.lifecycle.status).toBe('blocked');
  });

  it('requires approval for state-changing lifecycle actions and unsigned manifests', () => {
    const service = new ZavorthExtensionPluginSdkService({
      now,
      cwd: 'C:/workspace',
      pluginRegistryService: registryFixture(),
      pluginStateService: stateFixture(),
    });

    const snapshot = service.execute({
      action: 'lifecycle.apply',
      manifestJson: JSON.stringify(validManifest()),
      lifecycleAction: 'enable',
    });

    expect(snapshot.status).toBe('approval-required');
    expect(snapshot.lifecycle.status).toBe('approval-required');
    expect(snapshot.lifecycle.willMutateState).toBe(false);
  });

  it('applies lifecycle state only after approval and records source digest metadata', () => {
    const state = stateFixture();
    const service = new ZavorthExtensionPluginSdkService({
      now,
      cwd: 'C:/workspace',
      pluginRegistryService: registryFixture(),
      pluginStateService: state,
    });

    const snapshot = service.execute({
      action: 'lifecycle.apply',
      manifestJson: JSON.stringify(validManifest()),
      lifecycleAction: 'install',
      approvalId: 'approval-1',
    });

    expect(snapshot.lifecycle.status).toBe('applied');
    expect(snapshot.lifecycle.willMutateState).toBe(true);
    expect(state.upsertState).toHaveBeenCalledWith(expect.objectContaining({
      pluginId: 'plugin:test',
      installed: true,
      sourceDigest: expect.stringMatching(/^sha256:/),
    }));
  });

  it('marks system permission scope as blocked and secret/network/write as approval-required', () => {
    const manifest = validManifest({
      permissions: [
        { kind: 'filesystem.read', scope: 'workspace', reason: 'read', required: true },
        { kind: 'secret.read', scope: 'workspace', reason: 'secret', required: true },
        { kind: 'process.spawn', scope: 'system', reason: 'bad', required: true },
      ],
    });
    const service = new ZavorthExtensionPluginSdkService({
      now,
      cwd: 'C:/workspace',
      pluginRegistryService: registryFixture(),
      pluginStateService: stateFixture(),
    });

    const snapshot = service.execute({
      action: 'lifecycle.plan',
      manifestJson: JSON.stringify(manifest),
      lifecycleAction: 'install',
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.permissions.blockedCount).toBe(1);
    expect(snapshot.permissions.approvalRequiredCount).toBe(1);
  });

  it('enables dev hot reload only as a policy-bound validated local flow', () => {
    const service = new ZavorthExtensionPluginSdkService({
      now,
      cwd: 'C:/workspace',
      pluginRegistryService: registryFixture(),
      pluginStateService: stateFixture(),
    });

    const snapshot = service.execute({
      action: 'dev.hot-reload',
      manifestJson: JSON.stringify(validManifest()),
      dev: true,
    });

    expect(snapshot.hotReloadDev.status).toBe('ready');
    expect(snapshot.hotReloadDev.enabled).toBe(true);
    expect(snapshot.hotReloadDev.constraints.reloadRequiresManifestValidation).toBe(true);
    expect(snapshot.hotReloadDev.constraints.reloadDoesNotBypassPermissions).toBe(true);
  });
});

function validManifest(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 'zavorth.plugin-sdk.v1',
    id: 'plugin:test',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin.',
    entrypoint: {
      module: './plugin.js',
      exportName: 'activate',
      runtime: 'node',
    },
    permissions: [
      { kind: 'artifact.write', scope: 'workspace', reason: 'receipt', required: false },
    ],
    lifecycle: {
      actions: ['install', 'enable', 'disable', 'uninstall', 'invoke', 'doctor'],
      defaultAction: 'install',
    },
    integrity: {
      checksum: null,
      signature: null,
      publicKeyId: null,
    },
    ...overrides,
  };
}

function registryFixture() {
  return {
    buildSnapshot: jest.fn(() => ({
      entries: [
        {
          id: 'plugin:alpha',
          label: 'Alpha',
          version: '1.0.0',
          source: 'integration-hub',
          kind: 'integration',
          installState: 'available',
          trust: 'review',
          registrySource: 'local',
          capabilities: ['alpha.run'],
        },
        {
          id: 'workspace:repo',
          label: 'Workspace Repo',
          version: 'workspace',
          source: 'workspace-profile',
          kind: 'workspace-extension',
          installState: 'workspace',
          trust: 'trusted',
          registrySource: null,
          capabilities: ['workspace-guidance'],
        },
      ],
    })),
  };
}

function stateFixture() {
  return {
    upsertState: jest.fn(),
    clearState: jest.fn(),
  };
}
