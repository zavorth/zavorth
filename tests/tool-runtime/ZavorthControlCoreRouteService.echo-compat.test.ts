import * as http from 'http';
import { ZavorthControlCoreRouteService } from '../../src/services/ZavorthControlCoreRouteService.js';

type WriteCall = {
  body: any;
  statusCode: number;
};

function createDeps(body: Record<string, unknown>) {
  const calls: WriteCall[] = [];
  const echo = {
    getPendingPermissions: jest.fn(() => [{ id: 'perm-1' }]),
    resolvePermission: jest.fn(async (id: string, approved: boolean) => ({ ok: true, id, approved })),
  };

  return {
    calls,
    echo,
    deps: {
      nodeHeartbeat: { claimPairing: jest.fn(), receiveHeartbeat: jest.fn() },
      nodeMesh: { buildSnapshot: jest.fn() },
      readJsonBody: jest.fn(async () => body),
      readRawBody: jest.fn(async () => ''),
      writeJson: (_res: http.ServerResponse, responseBody: unknown, statusCode = 200) => {
        calls.push({ body: responseBody, statusCode });
      },
      writeText: jest.fn(),
      writeRedirect: jest.fn(),
      a2ui: {
        listSurfaces: jest.fn(() => [{ surfaceId: 'cockpit' }]),
        getSurfaceState: jest.fn(() => ({ surfaceId: 'cockpit' })),
        readSnapshot: jest.fn(() => ({ protocolVersion: 'a2ui.v1', surfaces: [{ surfaceId: 'cockpit' }] })),
        listEvents: jest.fn(() => [{ id: 'evt-1' }]),
        listAssets: jest.fn(() => [{ id: 'asset-1' }]),
        readStream: jest.fn(() => ({ items: [{ id: 'evt-1' }] })),
        dispatchAction: jest.fn(async () => ({ ok: true, status: 'accepted' })),
      },
      proactivePermissions: { listPending: jest.fn(), resolve: jest.fn() },
      echo,
    },
  };
}

describe('ZavorthControlCoreRouteService Echo compatibility routes', () => {
  it('delegates legacy pending permissions to the Echo source', async () => {
    const route = new ZavorthControlCoreRouteService();
    const { calls, deps, echo } = createDeps({});

    const handled = await route.handleRequest(
      { method: 'GET', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/v2/permissions/pending'),
      '/api/v2/permissions/pending',
      deps,
    );

    expect(handled).toBe(true);
    expect(echo.getPendingPermissions).toHaveBeenCalledTimes(1);
    expect(calls[0]).toEqual({
      statusCode: 200,
      body: {
        ok: true,
        deprecated: true,
        canonical: '/api/v2/echo/permissions',
        data: [{ id: 'perm-1' }],
      },
    });
  });

  it('parses string false as denial on the legacy resolve route', async () => {
    const route = new ZavorthControlCoreRouteService();
    const { calls, deps, echo } = createDeps({ id: 'perm-1', approved: 'false' });

    const handled = await route.handleRequest(
      { method: 'POST', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/v2/permissions/resolve'),
      '/api/v2/permissions/resolve',
      deps,
    );

    expect(handled).toBe(true);
    expect(echo.resolvePermission).toHaveBeenCalledWith('perm-1', false);
    expect(calls[0]).toEqual({
      statusCode: 200,
      body: {
        deprecated: true,
        canonical: '/api/v2/echo/permissions/resolve',
        ok: true,
        id: 'perm-1',
        approved: false,
      },
    });
  });

  it('passes resolver context through the legacy resolve alias when present', async () => {
    const route = new ZavorthControlCoreRouteService();
    const resolverContext = {
      sessionId: 'telegram-session',
      surface: 'telegram',
      requestedBy: 'telegram:chat-1',
      channel: 'telegram',
      chatId: 'chat-1',
      threadId: 'thread-1',
      userId: 'user-1',
    };
    const { deps, echo } = createDeps({ id: 'perm-1', approved: 'true', ...resolverContext });

    const handled = await route.handleRequest(
      { method: 'POST', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/v2/permissions/resolve'),
      '/api/v2/permissions/resolve',
      deps,
    );

    expect(handled).toBe(true);
    expect(echo.resolvePermission).toHaveBeenCalledWith('perm-1', true, resolverContext);
  });

  it('rejects invalid legacy resolve payloads instead of guessing approval', async () => {
    const route = new ZavorthControlCoreRouteService();
    const { calls, deps, echo } = createDeps({ id: 'perm-1', approved: 'maybe' });

    const handled = await route.handleRequest(
      { method: 'POST', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/v2/permissions/resolve'),
      '/api/v2/permissions/resolve',
      deps,
    );

    expect(handled).toBe(true);
    expect(echo.resolvePermission).not.toHaveBeenCalled();
    expect(calls[0].statusCode).toBe(400);
    expect(calls[0].body).toEqual(expect.objectContaining({
      ok: false,
      deprecated: true,
      canonical: '/api/v2/echo/permissions/resolve',
    }));
    expect(String(calls[0].body.error || '')).toMatch(/Validation failed|approved|obrigator/i);
  });

  it('serves canonical A2UI routes alongside the legacy aliases', async () => {
    const route = new ZavorthControlCoreRouteService();
    const { calls, deps } = createDeps({ surfaceId: 'cockpit', actionId: 'refresh', payload: { tab: 'live' } });

    await route.handleRequest(
      { method: 'GET', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/v2/a2ui/snapshot?surfaceId=cockpit'),
      '/api/v2/a2ui/snapshot',
      deps,
    );
    await route.handleRequest(
      { method: 'GET', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/v2/a2ui/events?surfaceId=cockpit&limit=5'),
      '/api/v2/a2ui/events',
      deps,
    );
    await route.handleRequest(
      { method: 'GET', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/v2/a2ui/assets?surfaceId=cockpit'),
      '/api/v2/a2ui/assets',
      deps,
    );
    await route.handleRequest(
      { method: 'GET', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/v2/a2ui/stream?surfaceId=cockpit'),
      '/api/v2/a2ui/stream',
      deps,
    );
    await route.handleRequest(
      { method: 'POST', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/v2/a2ui/action'),
      '/api/v2/a2ui/action',
      deps,
    );
    await route.handleRequest(
      { method: 'GET', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/v2/a2ui/surfaces'),
      '/api/v2/a2ui/surfaces',
      deps,
    );

    expect(deps.a2ui.readSnapshot).toHaveBeenCalledWith('cockpit');
    expect(deps.a2ui.listEvents).toHaveBeenCalledWith('cockpit', 5);
    expect(deps.a2ui.listAssets).toHaveBeenCalledWith('cockpit');
    expect(deps.a2ui.readStream).toHaveBeenCalledWith('cockpit', 20);
    expect(deps.a2ui.dispatchAction).toHaveBeenCalledWith({
      surfaceId: 'cockpit',
      actionId: 'refresh',
      requestedBy: 'zavorthControl',
      payload: { tab: 'live' },
      correlation: null,
    });
    expect(calls[0]).toEqual({
      statusCode: 200,
      body: {
        ok: true,
        data: { protocolVersion: 'a2ui.v1', surfaces: [{ surfaceId: 'cockpit' }] },
      },
    });
    expect(calls[5]).toEqual({
      statusCode: 200,
      body: {
        ok: true,
        deprecated: true,
        canonical: '/api/v2/a2ui/snapshot',
        data: [{ surfaceId: 'cockpit' }],
      },
    });
  });
});
