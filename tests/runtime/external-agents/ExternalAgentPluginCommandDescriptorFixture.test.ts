import {
  createWave1PluginCommandDescriptorFixtures,
  normalizeWave1PluginCommandDescriptors,
} from '../../../src/runtime/external-agents/index.js';

describe('Wave 1 plugin command descriptor fixture parity', () => {
  it('normalizes source command descriptors into Zavorth metadata while handlers stay blocked', () => {
    const fixtures = createWave1PluginCommandDescriptorFixtures();
    const normalization = normalizeWave1PluginCommandDescriptors(fixtures);

    expect(fixtures.map((fixture) => fixture.fixtureCase)).toEqual([
      'command-descriptor-safe-action',
      'command-descriptor-handler-blocked',
    ]);
    expect(JSON.stringify(fixtures)).toContain('ExternalExecutor');
    expect(JSON.stringify(fixtures)).toContain('external-executor.sessions.list');
    expect(JSON.stringify(fixtures)).toContain('extensions/workspace/delete.ts#run');
    expect(normalization).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthPluginCommandDescriptorParity/v1',
      sourceCommandNamesStoredAsEvidenceOnly: true,
      sourceAliasesStoredAsEvidenceOnly: true,
      sourceHandlerReferencesStoredAsEvidenceOnly: true,
      sourceCommandHandlersLoaded: false,
      sourceCommandExecutionAuthority: false,
      commandRuntimeIntroduced: false,
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
    expect(normalization.descriptors).toEqual([
      expect.objectContaining({
        id: 'zavorth-command:wave1-command-descriptors-1-safe-action',
        label: 'Command descriptor 1',
        category: 'session',
        arguments: [
          {
            id: 'argument-1',
            required: false,
            sourceArgumentStoredAsEvidenceOnly: true,
          },
        ],
        risk: 'safe',
        requestedTools: ['sessions.list'],
        handlerAvailable: false,
        sourceCommandHandlerLoaded: false,
        sourceCommandExecutionAllowed: false,
        nativeContract: 'ZavorthCommandDescriptor/v1',
      }),
      expect.objectContaining({
        id: 'zavorth-command:wave1-command-descriptors-2-handler-blocked',
        label: 'Command descriptor 2 blocked',
        category: 'workspace',
        arguments: [
          {
            id: 'argument-1',
            required: true,
            sourceArgumentStoredAsEvidenceOnly: true,
          },
        ],
        risk: 'danger',
        requestedTools: ['workspace.delete'],
        handlerAvailable: false,
        sourceCommandHandlerLoaded: false,
        sourceCommandExecutionAllowed: false,
        nativeContract: 'ZavorthCommandDescriptor/v1',
      }),
    ]);
    expect(normalization.commandCenter.catalogRows).toEqual([
      expect.objectContaining({
        commandId: 'zavorth-command:wave1-command-descriptors-1-safe-action',
        status: 'available',
        policy: 'metadata-only',
      }),
      expect.objectContaining({
        commandId: 'zavorth-command:wave1-command-descriptors-2-handler-blocked',
        status: 'blocked',
        policy: 'blocked',
      }),
    ]);
    expect(normalization.toolExposurePolicyInput).toEqual({
      requestedTools: ['sessions.list', 'workspace.delete'],
      allowedTools: ['sessions.list'],
      blockedTools: ['workspace.delete'],
      blockedToolReason: 'source-command-handler-not-authorized',
    });
    expect(JSON.stringify(normalization)).not.toContain('ExternalExecutor');
    expect(JSON.stringify(normalization)).not.toContain('external-executor');
    expect(JSON.stringify(normalization)).not.toContain('extensions/workspace/delete.ts#run');
  });
});
