import * as http from 'http';
import {
  ZavorthControlLegacyRouteService,
  type ZavorthControlLegacyRouteDeps,
} from '../../src/services/ZavorthControlLegacyRouteService.js';

describe('ZavorthControl skill catalog routes', () => {
  function createDeps(overrides: Partial<ZavorthControlLegacyRouteDeps> = {}): ZavorthControlLegacyRouteDeps {
    return {
      host: '127.0.0.1',
      port: 33333,
      snippetUserId: '1',
      getPublicBaseUrl: jest.fn(() => 'http://127.0.0.1:33333'),
      getClassicZavorthControlHtml: jest.fn(() => '<html></html>'),
      getStats: jest.fn(() => ({})),
      getSidecars: jest.fn(() => ({})),
      getRecentLogs: jest.fn(() => []),
      getAuditLogs: jest.fn(async () => ({})),
      getAuditStats: jest.fn(async () => ({})),
      getSkillCatalogSnapshot: jest.fn(() => ({
        summary: { total: 7, visible: 7, imported: 7, local: 0, recipes: 3, readyRecipes: 3, recommendations: 2 },
        entries: [{ id: 'skill:chrome-devtools', name: 'chrome-devtools' }],
        recipes: [{ id: 'security-hardening', label: 'Hardening e audit de security', skillIds: ['chrome-devtools'] }],
        selected: { id: 'skill:chrome-devtools', name: 'chrome-devtools' },
        selectedRecipe: null,
        recommendations: [],
      })),
      getSkillMcpSnapshot: jest.fn(() => ({
        capability: 'skill-catalog',
        summary: { tools: 4, resources: 10 },
      })),
      writeHtml: jest.fn(),
      writeJson: jest.fn(),
      readJsonBody: jest.fn(async () => ({})),
      ...overrides,
    };
  }

  it('serves the shared skill catalog in the legacy zavorthControl API', async () => {
    const routeService = new ZavorthControlLegacyRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'GET' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const deps = createDeps({ writeJson });

    const handled = await routeService.handleRequest(
      req,
      res,
      new URL('http://localhost/api/skills'),
      '/api/skills',
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

  it('serves the MCP sidecar snapshot for skills in the legacy zavorthControl API', async () => {
    const routeService = new ZavorthControlLegacyRouteService();
    const res = {} as http.ServerResponse;
    const req = { method: 'GET' } as http.IncomingMessage;
    const writeJson = jest.fn();
    const deps = createDeps({ writeJson });

    const handled = await routeService.handleRequest(
      req,
      res,
      new URL('http://localhost/api/skills/mcp'),
      '/api/skills/mcp',
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
});
