import {
  buildZavorthCommandCenterAssimilationSnapshot,
} from '../../../src/ai-gateway/app/(dashboard)/control/command-center/projections/index.js';
import {
  EXTERNAL_AGENT_WAVE1_FIXTURE_NOW,
  EXTERNAL_AGENT_WAVE1_SOURCE_RUNTIME_NAME,
  buildWave1PluginRuntimeRegistryImport,
} from '../../../src/runtime/external-agents/index.js';

describe('Wave 1 plugin runtime registry fixture parity', () => {
  it('maps runtime registry tool records into Zavorth policy while keeping routes metadata-only', async () => {
    const registryImport = await buildWave1PluginRuntimeRegistryImport();
    const dangerousTool = registryImport.inventory.items.find((item) => item.id === 'external-capability:runtime-dangerous-tool');
    const [routeMetadata] = registryImport.metadataOnlyRecords;
    const commandCenter = buildZavorthCommandCenterAssimilationSnapshot({
      capabilityInventory: registryImport.inventory,
      identityLeakTerms: [EXTERNAL_AGENT_WAVE1_SOURCE_RUNTIME_NAME],
      now: () => new Date(EXTERNAL_AGENT_WAVE1_FIXTURE_NOW),
    });

    expect(registryImport).toEqual(expect.objectContaining({
      nativeContract: 'ExternalAgentCapabilityInventorySnapshot',
      capabilityRecordIds: ['runtime-dangerous-tool'],
      blockedToolNames: ['workspace.delete'],
      sourceRuntimeRegistryIntroduced: false,
      sourceRuntimeImplementationsLoaded: false,
      sourceRuntimeExecutionAuthority: false,
    }));
    expect(dangerousTool).toEqual(expect.objectContaining({
      label: 'Runtime dangerous tool',
      status: 'available',
      risk: 'danger',
      trustState: 'quarantined',
      requiresApproval: true,
      policy: {
        exposure: 'blocked',
        blockedReason: 'blocked-by-external-capability-quarantine',
      },
      toolNames: ['workspace.delete'],
    }));
    expect(registryImport.inventory.toolExposurePolicyInput).toEqual(expect.objectContaining({
      requestedTools: ['workspace.delete'],
      allowedTools: [],
      blockedTools: ['workspace.delete'],
    }));
    expect(routeMetadata).toEqual({
      id: 'runtime-http-route-metadata',
      label: 'Runtime HTTP route metadata',
      kind: 'http-route',
      canonicalMetadataId: 'external-registry-metadata:runtime-http-route-metadata',
      executionAuthorized: false,
      exposedToToolPolicy: false,
      route: '/plugins/source/diagnostics',
    });
    expect(registryImport.inventory.toolExposurePolicyInput.requestedTools).not.toContain('/plugins/source/diagnostics');
    expect(commandCenter.capabilities).toEqual([
      expect.objectContaining({
        id: 'external-capability:runtime-dangerous-tool',
        kind: 'tool',
        status: 'blocked',
        policy: 'blocked',
      }),
    ]);
    expect(commandCenter.identityLeakScan).toEqual(expect.objectContaining({
      checked: true,
      passed: true,
      leakCount: 0,
    }));
    expect(JSON.stringify(commandCenter)).not.toContain('ExternalExecutor');
  });
});
