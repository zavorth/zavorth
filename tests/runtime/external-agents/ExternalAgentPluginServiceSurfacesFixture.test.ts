import {
  createWave1PluginServiceSurfaceFixtures,
  normalizeWave1PluginServiceSurfaces,
} from '../../../src/runtime/external-agents/index.js';

describe('Wave 1 plugin service surfaces fixture parity', () => {
  it('normalizes service descriptors while source service launch stays blocked', () => {
    const fixtures = createWave1PluginServiceSurfaceFixtures();
    const normalization = normalizeWave1PluginServiceSurfaces(fixtures);

    expect(fixtures.map((fixture) => fixture.fixtureCase)).toEqual([
      'service-surface-descriptor',
      'service-launch-blocked',
    ]);
    expect(JSON.stringify(fixtures)).toContain('ExternalExecutor');
    expect(JSON.stringify(fixtures)).toContain('external-executor.service.notifications');
    expect(JSON.stringify(fixtures)).toContain('external-executor.service.workspace-indexer');
    expect(JSON.stringify(fixtures)).toContain('extensions/workspace-indexer/service.ts#start');
    expect(normalization).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthPluginServiceSurfaceParity/v1',
      sourceServiceIdsStoredAsEvidenceOnly: true,
      sourceHooksStoredAsEvidenceOnly: true,
      sourceLifecycleHintsStoredAsEvidenceOnly: true,
      sourceActivationHintsStoredAsEvidenceOnly: true,
      sourceLifecycleReferencesStoredAsEvidenceOnly: true,
      sourceServicesLaunched: false,
      sourceServiceAuthority: false,
      serviceRuntimeIntroduced: false,
      executionGate: expect.objectContaining({
        sourceCommandsExecuted: false,
        sourceCliProcessesSpawned: false,
        sourceHttpRoutesRegistered: false,
        sourceGatewayMethodsDispatched: false,
        sourceServicesLaunched: false,
        sourceSetupCommandsExecuted: false,
        sourceQaRunnersExecuted: false,
        sourceModulesCopied: false,
        sourceStateMigrated: false,
        sourceCredentialsMigrated: false,
        liveSourceRuntimeConnected: false,
        realAdapterCreated: false,
      }),
    }));
    expect(normalization.services).toEqual([
      expect.objectContaining({
        id: 'zavorth-service:wave1-service-surfaces-1-notification-hook-descriptor',
        label: 'Service surface 1',
        kind: 'hook',
        hooks: [
          {
            id: 'hook-1',
            sourceHookStoredAsEvidenceOnly: true,
          },
          {
            id: 'hook-2',
            sourceHookStoredAsEvidenceOnly: true,
          },
        ],
        lifecycleHints: [
          {
            id: 'lifecycle-hint-1',
            sourceLifecycleHintStoredAsEvidenceOnly: true,
          },
          {
            id: 'lifecycle-hint-2',
            sourceLifecycleHintStoredAsEvidenceOnly: true,
          },
        ],
        activationHintId: 'activation-hint-1',
        risk: 'safe',
        requestedTools: ['notifications.describe'],
        workerPolicy: {
          worker: 'zavorth-worker-policy',
          sourceServiceLaunchAllowed: false,
          sourceLifecycleMutationAllowed: false,
          sourceServiceStoredAsEvidenceOnly: true,
        },
        sourceServiceLaunchAllowed: false,
        sourceServiceLaunched: false,
        sourceLifecycleMutated: false,
        nativeContract: 'ZavorthServiceSurface/v1',
      }),
      expect.objectContaining({
        id: 'zavorth-service:wave1-service-surfaces-2-workspace-indexer-launch-blocked',
        label: 'Service surface 2 blocked',
        kind: 'background',
        hooks: [
          {
            id: 'hook-1',
            sourceHookStoredAsEvidenceOnly: true,
          },
        ],
        lifecycleHints: [
          {
            id: 'lifecycle-hint-1',
            sourceLifecycleHintStoredAsEvidenceOnly: true,
          },
          {
            id: 'lifecycle-hint-2',
            sourceLifecycleHintStoredAsEvidenceOnly: true,
          },
        ],
        activationHintId: 'activation-hint-2',
        risk: 'danger',
        requestedTools: ['workspace.index.write'],
        sourceLifecycleReferenceStoredAsEvidenceOnly: true,
        sourceServiceLaunchAllowed: false,
        sourceServiceLaunched: false,
        sourceLifecycleMutated: false,
        nativeContract: 'ZavorthServiceSurface/v1',
      }),
    ]);
    expect(normalization.serviceRegistry.serviceRows).toEqual([
      expect.objectContaining({
        serviceId: 'zavorth-service:wave1-service-surfaces-1-notification-hook-descriptor',
        status: 'available',
        policy: 'metadata-only',
      }),
      expect.objectContaining({
        serviceId: 'zavorth-service:wave1-service-surfaces-2-workspace-indexer-launch-blocked',
        status: 'blocked',
        policy: 'blocked',
      }),
    ]);
    expect(normalization.toolExposurePolicyInput).toEqual({
      requestedTools: ['notifications.describe', 'workspace.index.write'],
      allowedTools: ['notifications.describe'],
      blockedTools: ['workspace.index.write'],
      blockedToolReason: 'source-service-launch-not-authorized',
    });
    expect(JSON.stringify(normalization)).not.toContain('ExternalExecutor');
    expect(JSON.stringify(normalization)).not.toContain('external-executor');
    expect(JSON.stringify(normalization)).not.toContain('workspace-indexer/service.ts#start');
    expect(JSON.stringify(normalization)).not.toContain('activate-on-workspace-open');
  });
});
