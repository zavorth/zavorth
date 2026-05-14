import {
  createWave1PluginHttpRouteSurfaceFixtures,
  normalizeWave1PluginHttpRouteSurfaces,
} from '../../../src/runtime/external-agents/index.js';

describe('Wave 1 plugin HTTP route surfaces fixture parity', () => {
  it('normalizes HTTP route metadata while source route registration stays blocked', () => {
    const fixtures = createWave1PluginHttpRouteSurfaceFixtures();
    const normalization = normalizeWave1PluginHttpRouteSurfaces(fixtures);

    expect(fixtures.map((fixture) => fixture.fixtureCase)).toEqual([
      'http-route-metadata',
      'http-route-registration-blocked',
    ]);
    expect(JSON.stringify(fixtures)).toContain('ExternalExecutor');
    expect(JSON.stringify(fixtures)).toContain('/external-executor/api/sessions/:sessionId');
    expect(JSON.stringify(fixtures)).toContain('/external-executor/api/workspace/:workspaceId');
    expect(JSON.stringify(fixtures)).toContain('src/web/routes/workspace-delete.ts#handler');
    expect(normalization).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthPluginHttpRouteSurfaceParity/v1',
      sourceHttpRoutePathsStoredAsEvidenceOnly: true,
      sourceHttpMethodsStoredAsEvidenceOnly: true,
      sourceServiceRouteHintsStoredAsEvidenceOnly: true,
      sourceAuthScopeHintsStoredAsEvidenceOnly: true,
      sourceRouteHandlerReferencesStoredAsEvidenceOnly: true,
      sourceHttpRoutesRegistered: false,
      sourceHttpRouteAuthority: false,
      httpRouteRuntimeIntroduced: false,
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
    expect(normalization.httpRoutes).toEqual([
      expect.objectContaining({
        id: 'zavorth-http-route:wave1-http-route-surfaces-1-session-read-metadata',
        label: 'HTTP route surface 1',
        kind: 'read',
        httpMethod: 'GET',
        routePatternId: 'route-pattern-1',
        serviceRouteHintId: 'service-route-hint-1',
        risk: 'safe',
        requestedTools: ['sessions.read'],
        routePolicy: {
          registry: 'zavorth-route-registry',
          sourceHttpRouteRegistrationAllowed: false,
          sourceRoutePathStoredAsEvidenceOnly: true,
          sourceAuthScopeAuthority: false,
        },
        sourceRoutePathStoredAsEvidenceOnly: true,
        sourceHttpRouteRegistrationAllowed: false,
        sourceHttpRouteRegistered: false,
        nativeContract: 'ZavorthHttpRouteSurface/v1',
      }),
      expect.objectContaining({
        id: 'zavorth-http-route:wave1-http-route-surfaces-2-workspace-delete-registration-blocked',
        label: 'HTTP route surface 2 blocked',
        kind: 'mutation',
        httpMethod: 'DELETE',
        routePatternId: 'route-pattern-2',
        serviceRouteHintId: 'service-route-hint-2',
        risk: 'danger',
        requestedTools: ['workspace.delete'],
        sourceRouteHandlerReferenceStoredAsEvidenceOnly: true,
        sourceHttpRouteRegistrationAllowed: false,
        sourceHttpRouteRegistered: false,
        nativeContract: 'ZavorthHttpRouteSurface/v1',
      }),
    ]);
    expect(normalization.routeRegistry.routeRows).toEqual([
      expect.objectContaining({
        routeId: 'zavorth-http-route:wave1-http-route-surfaces-1-session-read-metadata',
        status: 'available',
        policy: 'metadata-only',
      }),
      expect.objectContaining({
        routeId: 'zavorth-http-route:wave1-http-route-surfaces-2-workspace-delete-registration-blocked',
        status: 'blocked',
        policy: 'blocked',
      }),
    ]);
    expect(normalization.toolExposurePolicyInput).toEqual({
      requestedTools: ['sessions.read', 'workspace.delete'],
      allowedTools: ['sessions.read'],
      blockedTools: ['workspace.delete'],
      blockedToolReason: 'source-http-route-registration-not-authorized',
    });
    expect(JSON.stringify(normalization)).not.toContain('ExternalExecutor');
    expect(JSON.stringify(normalization)).not.toContain('/external-executor');
    expect(JSON.stringify(normalization)).not.toContain('workspace-delete.ts#handler');
    expect(JSON.stringify(normalization)).not.toContain('http:admin');
  });
});
