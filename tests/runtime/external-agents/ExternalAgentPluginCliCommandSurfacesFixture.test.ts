import {
  createWave1PluginCliCommandSurfaceFixtures,
  normalizeWave1PluginCliCommandSurfaces,
} from '../../../src/runtime/external-agents/index.js';

describe('Wave 1 plugin CLI command surfaces fixture parity', () => {
  it('classifies CLI command surfaces while source process spawn stays blocked', () => {
    const fixtures = createWave1PluginCliCommandSurfaceFixtures();
    const normalization = normalizeWave1PluginCliCommandSurfaces(fixtures);

    expect(fixtures.map((fixture) => fixture.fixtureCase)).toEqual([
      'cli-command-classification',
      'cli-process-spawn-blocked',
    ]);
    expect(JSON.stringify(fixtures)).toContain('ExternalExecutor');
    expect(JSON.stringify(fixtures)).toContain('external-executor status --json');
    expect(JSON.stringify(fixtures)).toContain('external-executor.mjs');
    expect(JSON.stringify(fixtures)).toContain('src/commands/daemon-start.ts#run');
    expect(normalization).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthPluginCliCommandSurfaceParity/v1',
      sourceCliBinariesStoredAsEvidenceOnly: true,
      sourceCliAliasesStoredAsEvidenceOnly: true,
      sourceProcessEntrypointsStoredAsEvidenceOnly: true,
      sourceCliProcessesSpawned: false,
      sourceCliProcessAuthority: false,
      cliCommandRuntimeIntroduced: false,
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
    expect(normalization.cliCommands).toEqual([
      expect.objectContaining({
        id: 'zavorth-cli:wave1-cli-surfaces-1-status-map',
        label: 'CLI command surface 1',
        kind: 'status',
        classification: 'map',
        arguments: [
          {
            id: 'argument-1',
            required: false,
            sourceArgumentStoredAsEvidenceOnly: true,
          },
        ],
        risk: 'safe',
        requestedTools: ['workspace.read'],
        routingPolicy: {
          router: 'zavorth-command-router',
          sourceBinaryAllowed: false,
          sourceCliProcessSpawnAllowed: false,
          sourceCommandStoredAsEvidenceOnly: true,
        },
        sourceCliBinaryStoredAsEvidenceOnly: true,
        processSpawnAllowed: false,
        sourceCliProcessSpawned: false,
        nativeContract: 'ZavorthCliCommandSurface/v1',
      }),
      expect.objectContaining({
        id: 'zavorth-cli:wave1-cli-surfaces-2-daemon-spawn-blocked',
        label: 'CLI command surface 2 blocked',
        kind: 'workspace',
        classification: 'reject',
        arguments: [
          {
            id: 'argument-1',
            required: false,
            sourceArgumentStoredAsEvidenceOnly: true,
          },
        ],
        risk: 'danger',
        requestedTools: ['shell.exec'],
        sourceProcessEntrypointStoredAsEvidenceOnly: true,
        processSpawnAllowed: false,
        sourceCliProcessSpawned: false,
        nativeContract: 'ZavorthCliCommandSurface/v1',
      }),
    ]);
    expect(normalization.commandCenter.catalogRows).toEqual([
      expect.objectContaining({
        commandId: 'zavorth-cli:wave1-cli-surfaces-1-status-map',
        status: 'available',
        policy: 'metadata-only',
      }),
      expect.objectContaining({
        commandId: 'zavorth-cli:wave1-cli-surfaces-2-daemon-spawn-blocked',
        status: 'blocked',
        policy: 'blocked',
      }),
    ]);
    expect(normalization.toolExposurePolicyInput).toEqual({
      requestedTools: ['workspace.read', 'shell.exec'],
      allowedTools: ['workspace.read'],
      blockedTools: ['shell.exec'],
      blockedToolReason: 'source-cli-process-spawn-not-authorized',
    });
    expect(JSON.stringify(normalization)).not.toContain('ExternalExecutor');
    expect(JSON.stringify(normalization)).not.toContain('external-executor');
    expect(JSON.stringify(normalization)).not.toContain('external-executor.mjs');
    expect(JSON.stringify(normalization)).not.toContain('daemon-start.ts#run');
  });
});
