import {
  buildWave1PluginManifestRegistryImport,
} from '../../../src/runtime/external-agents/index.js';

describe('Wave 1 plugin manifest registry fixture parity', () => {
  it('imports safe and disabled manifest fixtures as Zavorth capability inventory metadata only', async () => {
    const manifestImport = await buildWave1PluginManifestRegistryImport();
    const inventory = manifestImport.inventory;
    const safeProvider = inventory.items.find((item) => item.id === 'external-capability:safe-provider-manifest');
    const disabledProvider = inventory.items.find((item) => item.id === 'external-capability:disabled-provider-manifest');

    expect(manifestImport).toEqual(expect.objectContaining({
      nativeContract: 'ExternalAgentCapabilityInventorySnapshot',
      disabledManifestIds: ['external-capability:disabled-provider-manifest'],
      exposedToolNames: ['provider.search'],
      sourceManifestRegistryIntroduced: false,
      sourceManifestImplementationsLoaded: false,
    }));
    expect(manifestImport.manifestEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'safe-provider-manifest',
        sourceManifestPath: 'extensions/search/manifest.json',
        publicContractStored: false,
        implementationLoaded: false,
      }),
    ]));
    expect(inventory.summary).toEqual({
      total: 2,
      available: 1,
      degraded: 0,
      unavailable: 1,
      approvalRequired: 1,
      blocked: 0,
      dangerous: 0,
    });
    expect(safeProvider).toEqual(expect.objectContaining({
      label: 'Safe provider manifest',
      status: 'available',
      policy: {
        exposure: 'allowed',
      },
      toolNames: ['provider.search'],
      nativeContract: 'ExternalAgentCapabilityInventoryItem/v1',
    }));
    expect(disabledProvider).toEqual(expect.objectContaining({
      label: 'Disabled provider manifest',
      status: 'unavailable',
      policy: {
        exposure: 'unavailable',
        blockedReason: 'external-capability-unavailable',
      },
      toolNames: ['provider.disabled'],
    }));
    expect(inventory.toolExposurePolicyInput.requestedTools).toEqual(['provider.search']);
    expect(inventory.toolExposurePolicyInput.requestedTools).not.toContain('provider.disabled');
    expect(inventory.toolExposureProfile.tools.map((tool) => tool.id)).toEqual(['provider.search']);
    expect(inventory.failures).toEqual([
      expect.objectContaining({
        capabilityId: 'external-capability:disabled-provider-manifest',
        reason: 'unavailable',
      }),
    ]);
    expect(JSON.stringify(inventory)).not.toContain('ExternalExecutor');
    expect(JSON.stringify(inventory.commandCenter)).not.toContain('ExternalExecutor');
  });
});
