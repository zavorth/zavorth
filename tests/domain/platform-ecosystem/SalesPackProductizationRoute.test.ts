import * as http from 'http';
import path from 'path';
import { DashboardCoreRouteService } from '../../../src/services/DashboardCoreRouteService.js';
import { SalesPackMvpService } from '../../../src/domain/platform-ecosystem/application/sales-pack/index.js';
import { SalesPackBusinessModeService } from '../../../src/services/SalesPackBusinessModeService.js';


type WriteCall = {
  body: any;
  statusCode: number;
};

function deterministicIdFactory(): (prefix: string) => string {
  let next = 0;
  return (prefix: string) => `${prefix}-${++next}`;
}

function createRoute(
  body: Record<string, unknown> = {},
  authenticatedIdentity: Record<string, unknown> | null = {
    authenticated: true,
    source: 'dashboard-token',
    userId: 'local-owner',
    profileId: 'chat',
  },
) {
  const calls: WriteCall[] = [];
  const salesPack = new SalesPackMvpService({
    mode: 'demo',
    now: () => new Date('2026-05-08T12:00:00.000Z'),
    idFactory: deterministicIdFactory(),
  });
  const salesPackBusinessMode = new SalesPackBusinessModeService({
    stateFilePath: path.resolve(
      __dirname,
      'tmp',
      `sales-pack-business-mode-route-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`,
    ),
    now: () => new Date('2026-05-08T12:00:00.000Z'),
  });
  const routed = new DashboardCoreRouteService({ salesPack, salesPackBusinessMode });

  return {
    calls,
    route: routed,
    salesPack,
    deps: {
      nodeHeartbeat: { claimPairing: jest.fn(), receiveHeartbeat: jest.fn() },
      nodeMesh: { buildSnapshot: jest.fn() },
      readJsonBody: jest.fn(async () => body),
      readRawBody: jest.fn(async () => JSON.stringify(body)),
      authService: {
        validate: jest.fn(() => Boolean(authenticatedIdentity)),
        resolveAuthenticatedIdentity: jest.fn(() => authenticatedIdentity),
      },
      writeJson: (_res: http.ServerResponse, responseBody: unknown, statusCode = 200) => {
        calls.push({ body: responseBody, statusCode });
      },
      writeText: jest.fn(),
      writeRedirect: jest.fn(),
      a2ui: {},
      proactivePermissions: {},
    },
  };
}

describe('SalesPack productization routes', () => {
  it('serves a control-plane snapshot through the dashboard core API', async () => {
    const { route, deps, calls } = createRoute();

    const handled = await route.handleRequest(
      { method: 'GET', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/v2/sales-pack/snapshot'),
      '/api/v2/sales-pack/snapshot',
      deps,
    );

    expect(handled).toBe(true);
    expect(calls[0].statusCode).toBe(200);
    expect(calls[0].body).toMatchObject({
      ok: true,
      data: {
        summary: {
          mode: 'demo',
          conversations: 0,
          pendingApprovals: 0,
        },
      },
    });
  });

  it('processes inbound sales messages without bypassing policy or receipts', async () => {
    const { route, deps, calls } = createRoute({
      tenantId: 'demo-org',
      customerId: 'lead-ana',
      text: 'Achei caro, mas ainda tenho interesse. Ainda tem vaga?',
      traceId: 'trace-sales-route',
      metadata: { source: 'route-test' },
    });

    const handled = await route.handleRequest(
      { method: 'POST', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/v2/sales-pack/inbound'),
      '/api/v2/sales-pack/inbound',
      deps,
    );

    expect(handled).toBe(true);
    expect(calls[0].statusCode).toBe(200);
    expect(calls[0].body.data).toMatchObject({
      ok: true,
      traceId: 'trace-sales-route',
      selectedAgent: { role: 'sales' },
      preview: {
        actionKind: 'send_message',
        decision: 'allowed',
        dryRun: true,
      },
      deliveryReceipt: {
        status: 'sent',
      },
    });
    expect(calls[0].body.snapshot.summary).toMatchObject({
      conversations: 1,
      leads: 1,
      deliveryReceipts: 1,
    });
  });

  it('rejects malformed inbound payloads instead of guessing customer context', async () => {
    const { route, deps, calls } = createRoute({
      customerId: 'lead-empty',
      text: '   ',
    });

    const handled = await route.handleRequest(
      { method: 'POST', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/v2/sales-pack/inbound'),
      '/api/v2/sales-pack/inbound',
      deps,
    );

    expect(handled).toBe(true);
    expect(calls[0]).toEqual({
      statusCode: 400,
      body: {
        ok: false,
        error: 'Campos "text" e "customerId" precisam ser strings nao vazias.',
      },
    });
  });

  it('accepts Channel I/O inbound and exposes its operational snapshot', async () => {
    const { route, deps, calls } = createRoute({
      tenantId: 'demo-org',
      platform: 'whatsapp',
      provider: 'local-stub',
      providerMessageId: 'route-msg-1',
      customerId: 'lead-route-channel',
      text: 'meu pedido chegou?',
      traceId: 'trace-route-channel-io',
    });

    const postHandled = await route.handleRequest(
      { method: 'POST', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/v2/sales-pack/channel-io/inbound'),
      '/api/v2/sales-pack/channel-io/inbound',
      deps,
    );
    const getHandled = await route.handleRequest(
      { method: 'GET', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/v2/sales-pack/channel-io/snapshot'),
      '/api/v2/sales-pack/channel-io/snapshot',
      deps,
    );

    expect(postHandled).toBe(true);
    expect(getHandled).toBe(true);
    expect(calls[0].statusCode).toBe(200);
    expect(calls[0].body.data).toMatchObject({
      ok: true,
      status: 'processed',
      conversationResult: {
        signal: { intent: 'order_status' },
      },
    });
    expect(calls[1].body.data.summary).toMatchObject({
      processed: 1,
      knownMessageIds: 1,
    });
  });

  it('normalizes WhatsApp Cloud API payloads through the Channel I/O route', async () => {
    const { route, deps, calls } = createRoute({
      entry: [{
        id: 'business-route',
        changes: [{
          value: {
            metadata: { phone_number_id: 'phone-route' },
            messages: [{
              id: 'wamid-route-1',
              from: '5511888888888',
              timestamp: '1778241600',
              text: { body: 'Ainda tem vaga?' },
            }],
          },
        }],
      }],
    });

    const handled = await route.handleRequest(
      { method: 'POST', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/v2/sales-pack/channel-io/whatsapp-cloud'),
      '/api/v2/sales-pack/channel-io/whatsapp-cloud',
      deps,
    );

    expect(handled).toBe(true);
    expect(calls[0].statusCode).toBe(200);
    expect(calls[0].body.data).toMatchObject({
      status: 'processed',
      message: {
        tenantId: 'business-route',
        channelAccountId: 'phone-route',
        customerId: '5511888888888',
      },
      conversationResult: {
        signal: { intent: 'availability' },
      },
    });
  });

  it('persists Business Mode preference through the dashboard core API', async () => {
    const { route, deps, calls } = createRoute({
      enabled: true,
      updatedBy: 'route-test',
    }, {
      authenticated: true,
      source: 'jwt',
      userId: 'maria',
      profileId: 'home',
    });

    const postHandled = await route.handleRequest(
      { method: 'POST', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/v2/sales-pack/business-mode'),
      '/api/v2/sales-pack/business-mode',
      deps,
    );
    const getHandled = await route.handleRequest(
      { method: 'GET', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/v2/sales-pack/business-mode?userId=maria&profileId=home'),
      '/api/v2/sales-pack/business-mode',
      deps,
    );

    expect(postHandled).toBe(true);
    expect(getHandled).toBe(true);
    expect(calls[0].body.data).toMatchObject({
      profileKey: 'maria::home',
      enabled: true,
      updatedBy: 'route-test',
    });
    expect(calls[1].body.data).toMatchObject({
      profileKey: 'maria::home',
      enabled: true,
      source: 'backend',
    });
  });

  it('uses server-authenticated dashboard identity when query/body identity is absent', async () => {
    const { route, deps, calls } = createRoute({
      enabled: true,
      updatedBy: 'route-header-test',
    }, {
      authenticated: true,
      source: 'jwt',
      userId: 'header-maria',
      profileId: 'business',
    });
    const headers = {
      'x-zavorth-user-id': 'ignored-client-header',
      'x-zavorth-profile-id': 'ignored-profile',
    };

    const postHandled = await route.handleRequest(
      { method: 'POST', headers } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/v2/sales-pack/business-mode'),
      '/api/v2/sales-pack/business-mode',
      deps,
    );
    const getHandled = await route.handleRequest(
      { method: 'GET', headers } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/v2/sales-pack/business-mode'),
      '/api/v2/sales-pack/business-mode',
      deps,
    );

    expect(postHandled).toBe(true);
    expect(getHandled).toBe(true);
    expect(calls[0].body.data).toMatchObject({
      profileKey: 'header-maria::business',
      enabled: true,
      updatedBy: 'route-header-test',
    });
    expect(calls[1].body.data).toMatchObject({
      profileKey: 'header-maria::business',
      enabled: true,
      source: 'backend',
    });
  });

  it('does not trust client-supplied user headers when only owner token auth is present', async () => {
    const { route, deps, calls } = createRoute({
      enabled: true,
      updatedBy: 'route-owner-token-test',
    }, {
      authenticated: true,
      source: 'dashboard-token',
      userId: 'local-owner',
      profileId: 'chat',
    });
    const headers = {
      'x-zavorth-user-id': 'spoofed-maria',
      'x-zavorth-profile-id': 'spoofed-business',
    };

    const handled = await route.handleRequest(
      { method: 'POST', headers } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/v2/sales-pack/business-mode'),
      '/api/v2/sales-pack/business-mode',
      deps,
    );

    expect(handled).toBe(true);
    expect(calls[0].body.data).toMatchObject({
      profileKey: 'local-owner::chat',
      enabled: true,
      updatedBy: 'route-owner-token-test',
    });
  });

  it('seeds the demo scenario and returns the updated snapshot', async () => {
    const { route, deps, calls } = createRoute();

    const handled = await route.handleRequest(
      { method: 'POST', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/v2/sales-pack/demo'),
      '/api/v2/sales-pack/demo',
      deps,
    );

    expect(handled).toBe(true);
    expect(calls[0].statusCode).toBe(200);
    expect(calls[0].body.data).toMatchObject({
      ok: true,
      selectedAgent: { role: 'sales' },
      signal: { intent: 'price_objection' },
    });
    expect(calls[0].body.snapshot.summary.conversations).toBe(1);
    expect(calls[0].body.snapshot.actions.map((action: { id: string }) => action.id)).toContain(
      'sales-pack:configure-whatsapp',
    );
  });
});
