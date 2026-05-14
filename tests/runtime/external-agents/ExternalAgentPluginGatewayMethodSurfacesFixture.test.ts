import {
  createWave1PluginGatewayMethodSurfaceFixtures,
  normalizeWave1PluginGatewayMethodSurfaces,
} from '../../../src/runtime/external-agents/index.js';

describe('Wave 1 plugin gateway method surfaces fixture parity', () => {
  it('normalizes gateway method metadata while source method dispatch stays blocked', () => {
    const fixtures = createWave1PluginGatewayMethodSurfaceFixtures();
    const normalization = normalizeWave1PluginGatewayMethodSurfaces(fixtures);

    expect(fixtures.map((fixture) => fixture.fixtureCase)).toEqual([
      'gateway-method-metadata',
      'gateway-method-dispatch-blocked',
    ]);
    expect(JSON.stringify(fixtures)).toContain('ExternalExecutor');
    expect(JSON.stringify(fixtures)).toContain('external-executor.gateway.sessions.list');
    expect(JSON.stringify(fixtures)).toContain('external-executor.gateway.execApproval.resolve');
    expect(JSON.stringify(fixtures)).toContain('src/gateway/server-methods/exec-approval-resolve.ts#handle');
    expect(normalization).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthPluginGatewayMethodSurfaceParity/v1',
      sourceGatewayMethodNamesStoredAsEvidenceOnly: true,
      sourceRequestShapesStoredAsEvidenceOnly: true,
      sourceResponseShapesStoredAsEvidenceOnly: true,
      sourceAuthScopeHintsStoredAsEvidenceOnly: true,
      sourceDispatchReferencesStoredAsEvidenceOnly: true,
      sourceGatewayMethodsDispatched: false,
      sourceGatewayMethodAuthority: false,
      gatewayMethodRuntimeIntroduced: false,
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
    expect(normalization.gatewayMethods).toEqual([
      expect.objectContaining({
        id: 'zavorth-gateway-method:wave1-gateway-method-surfaces-1-session-list-metadata',
        label: 'Gateway method surface 1',
        kind: 'session',
        requestShape: [
          {
            id: 'request-field-1',
            required: false,
            sourceFieldStoredAsEvidenceOnly: true,
          },
          {
            id: 'request-field-2',
            required: false,
            sourceFieldStoredAsEvidenceOnly: true,
          },
        ],
        responseShape: [
          {
            id: 'response-field-1',
            sourceFieldStoredAsEvidenceOnly: true,
          },
          {
            id: 'response-field-2',
            sourceFieldStoredAsEvidenceOnly: true,
          },
        ],
        risk: 'safe',
        requestedTools: ['sessions.list'],
        requestPolicy: {
          gateway: 'zavorth-agent-gateway',
          sourceMethodDispatchAllowed: false,
          sourceMethodStoredAsEvidenceOnly: true,
          sourceAuthScopeAuthority: false,
        },
        sourceGatewayMethodDispatchAllowed: false,
        sourceGatewayMethodDispatched: false,
        nativeContract: 'ZavorthGatewayMethodSurface/v1',
      }),
      expect.objectContaining({
        id: 'zavorth-gateway-method:wave1-gateway-method-surfaces-2-approval-resolve-dispatch-blocked',
        label: 'Gateway method surface 2 blocked',
        kind: 'approval',
        requestShape: [
          {
            id: 'request-field-1',
            required: true,
            sourceFieldStoredAsEvidenceOnly: true,
          },
          {
            id: 'request-field-2',
            required: true,
            sourceFieldStoredAsEvidenceOnly: true,
          },
        ],
        risk: 'danger',
        requestedTools: ['approval.resolve'],
        sourceDispatchReferenceStoredAsEvidenceOnly: true,
        sourceGatewayMethodDispatchAllowed: false,
        sourceGatewayMethodDispatched: false,
        nativeContract: 'ZavorthGatewayMethodSurface/v1',
      }),
    ]);
    expect(normalization.gateway.methodRows).toEqual([
      expect.objectContaining({
        methodId: 'zavorth-gateway-method:wave1-gateway-method-surfaces-1-session-list-metadata',
        status: 'available',
        policy: 'metadata-only',
      }),
      expect.objectContaining({
        methodId: 'zavorth-gateway-method:wave1-gateway-method-surfaces-2-approval-resolve-dispatch-blocked',
        status: 'blocked',
        policy: 'blocked',
      }),
    ]);
    expect(normalization.toolExposurePolicyInput).toEqual({
      requestedTools: ['sessions.list', 'approval.resolve'],
      allowedTools: ['sessions.list'],
      blockedTools: ['approval.resolve'],
      blockedToolReason: 'source-gateway-method-dispatch-not-authorized',
    });
    expect(JSON.stringify(normalization)).not.toContain('ExternalExecutor');
    expect(JSON.stringify(normalization)).not.toContain('external-executor');
    expect(JSON.stringify(normalization)).not.toContain('exec-approval-resolve.ts#handle');
    expect(JSON.stringify(normalization)).not.toContain('gateway:admin');
  });
});
