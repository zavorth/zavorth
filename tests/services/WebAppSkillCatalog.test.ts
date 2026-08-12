import * as http from 'http';
import {
  WebAppSurfaceRouteService,
  type WebAppSurfaceRouteDeps,
} from '../../src/services/WebAppSurfaceRouteService.js';

describe('WebApp skill catalog routes', () => {
  function createDeps(
    overrides: Partial<WebAppSurfaceRouteDeps> = {},
  ): WebAppSurfaceRouteDeps {
    return {
      operatorBrief: null,
      productObservability: null,
      capabilityCatalog: null,
      runtimeGateway: null,
      gateway: null,
      gatewayChannelRegistry: null,
      gatewayChannelRouter: null,
      runtime: null,
      realtime: null,
      buildMemoryPlaneSnapshot: jest.fn(async () => null),
      resolveSessionId: jest.fn(() => 'session-web-1'),
      channelMesh: null,
      channelActions: null,
      remoteTransports: null,
      remoteTransportActions: null,
      remoteTransportDoctor: null,
      runtimeToolSurface: null,
      toolSurface: null,
      pluginRegistry: null,
      pluginActions: null,
      platformRegistry: null,
      platformActions: null,
      platformCatalogSync: null,
      platformPublisher: null,
      hookPipeline: null,
      hookPlane: null,
      workspaceExtensions: null,
      runtimeModes: null,
      securityMesh: null,
      teamCatalog: null,
      tenantGovernance: null,
      tenantGovernanceActions: null,
      codexRemote: null,
      codexRemoteActions: null,
      operationsActions: null,
      zavorthBridgeMobileAccess: null,
      integrationHub: null,
      skillCatalogApi: null,
      skillMcpSidecar: null,
      skillLibraryPresentation: null,
      skillInstallPlanPresentation: null,
      providerControlPlane: null,
      agentOperatingSystem: null,
      agentOperatingSystemActions: null,
      writeJson: jest.fn(),
      readJsonBody: jest.fn(async () => ({})),
      workspaceRoot: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      AIGatewayGateway: null,
      AIGatewayGatewayLauncher: null,
      AIGatewayCompatibilityDoctor: null,
      AIGatewayUpstreamSync: null,
      ...overrides,
    };
  }

  it('exposes the shared skill catalog on the protected web surface', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'GET' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const deps = createDeps({
      writeJson,
      skillCatalogApi: {
        buildSnapshot: jest.fn(() => ({
          summary: { total: 7, visible: 2, imported: 7, local: 0, recipes: 3, readyRecipes: 3, recommendations: 1 },
          entries: [{ id: 'skill:chrome-devtools', name: 'chrome-devtools' }],
          recipes: [{ id: 'security-hardening', label: 'Hardening e auditoria de seguranca' }],
          selected: null,
          selectedRecipe: null,
          recommendations: [{ id: 'security-hardening', kind: 'recipe', label: 'Hardening e auditoria de seguranca' }],
        })),
      } as any,
    });

    const handled = await routeService.handleRequest(
      req,
      res,
      new URL('http://localhost/api/web/skills?q=security'),
      '/api/web/skills',
      deps,
    );

    expect(handled).toBe(true);
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        skills: expect.objectContaining({
          summary: expect.objectContaining({
            total: 7,
          }),
        }),
      }),
      200,
    );
  });

  it('exposes the MCP view of the skill plane', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'GET' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const deps = createDeps({
      writeJson,
      skillMcpSidecar: {
        buildSnapshot: jest.fn(() => ({
          capability: 'skill-catalog',
          summary: { tools: 4, resources: 10 },
        })),
      } as any,
    });

    const handled = await routeService.handleRequest(
      req,
      res,
      new URL('http://localhost/api/web/skills/mcp'),
      '/api/web/skills/mcp',
      deps,
    );

    expect(handled).toBe(true);
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        mcp: expect.objectContaining({
          capability: 'skill-catalog',
        }),
      }),
      200,
    );
  });

  it('exposes the presentation library view of the skill plane', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'GET' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const deps = createDeps({
      writeJson,
      skillLibraryPresentation: {
        buildSnapshot: jest.fn(() => ({
          catalog: {
            selected: null,
            selectedRecipe: null,
          },
          actions: [{ command: '/skills library' }],
        })),
      } as any,
    });

    const handled = await routeService.handleRequest(
      req,
      res,
      new URL('http://localhost/api/web/skills/library?q=security'),
      '/api/web/skills/library',
      deps,
    );

    expect(handled).toBe(true);
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        library: expect.any(Object),
        actions: expect.arrayContaining([expect.objectContaining({ command: '/skills library' })]),
      }),
      200,
    );
  });

  it('exposes the install plan view of the skill plane', async () => {
    const routeService = new WebAppSurfaceRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'GET' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const deps = createDeps({
      writeJson,
      skillInstallPlanPresentation: {
        buildSnapshot: jest.fn(() => ({
          focus: { kind: 'recipe', id: 'security-hardening' },
          steps: [{ label: 'Abrir recipe', command: '/skills recipe security-hardening' }],
          actions: [{ command: '/skills plan recipe security-hardening' }],
        })),
      } as any,
    });

    const handled = await routeService.handleRequest(
      req,
      res,
      new URL('http://localhost/api/web/skills/install-plan?recipe=security-hardening'),
      '/api/web/skills/install-plan',
      deps,
    );

    expect(handled).toBe(true);
    expect(writeJson).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        ok: true,
        plan: expect.any(Object),
        focus: expect.objectContaining({ kind: 'recipe' }),
      }),
      200,
    );
  });
});
