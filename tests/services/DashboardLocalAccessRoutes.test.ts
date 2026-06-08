import * as http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { DashboardCoreRouteService } from '../../src/services/DashboardCoreRouteService.js';
import { TrustedDeviceAccessService } from '../../src/services/TrustedDeviceAccessService.js';

type WriteCall = {
  body: any;
  statusCode: number;
};

describe('Dashboard local access routes', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('creates, approves, lists and revokes trusted devices through owner-gated routes', async () => {
    const localAccess = createTrustedDeviceService();
    const { route, deps, calls } = createRoute(localAccess, {
      authenticated: true,
      source: 'dashboard-token',
      userId: 'local-owner',
      profileId: 'default',
    });

    await route.handleRequest(
      { method: 'POST', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/v2/local-access/pairing-draft'),
      '/api/v2/local-access/pairing-draft',
      { ...deps, readJsonBody: jest.fn(async () => ({
        deviceName: 'Ana phone',
        scopes: ['chat:send', 'approval:respond'],
      })) },
    );
    const requestId = calls[0].body.data.requestId;

    await route.handleRequest(
      { method: 'POST', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/v2/local-access/pairing-approve'),
      '/api/v2/local-access/pairing-approve',
      { ...deps, readJsonBody: jest.fn(async () => ({ requestId })) },
    );
    const deviceToken = calls[1].body.data.deviceToken;
    const deviceId = calls[1].body.data.device.deviceId;

    await route.handleRequest(
      { method: 'GET', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/v2/local-access/devices'),
      '/api/v2/local-access/devices',
      deps,
    );

    expect(calls[0]).toMatchObject({
      statusCode: 200,
      body: {
        ok: true,
        data: {
          deviceName: 'Ana phone',
          scopes: ['chat:send', 'approval:respond'],
        },
      },
    });
    expect(deviceToken).toMatch(/^zv_ld_/);
    expect(JSON.stringify(calls[2].body)).not.toContain(deviceToken);
    expect(calls[2].body.devices[0]).toMatchObject({
      deviceId,
      name: 'Ana phone',
      status: 'active',
    });

    await route.handleRequest(
      { method: 'POST', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/v2/local-access/devices/revoke'),
      '/api/v2/local-access/devices/revoke',
      { ...deps, readJsonBody: jest.fn(async () => ({ deviceId, reason: 'lost' })) },
    );

    expect(calls[3]).toMatchObject({
      statusCode: 200,
      body: {
        ok: true,
        receipt: {
          action: 'trusted-device.revoked',
          secretRedacted: true,
        },
      },
    });
  });

  it('blocks trusted devices from approving new devices', async () => {
    const localAccess = createTrustedDeviceService();
    const { route, deps, calls } = createRoute(localAccess, {
      authenticated: true,
      source: 'trusted-device',
      userId: 'local-owner',
      profileId: 'default',
      deviceId: 'device-1',
      scopes: ['runtime:control'],
    });

    await route.handleRequest(
      { method: 'POST', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/v2/local-access/pairing-approve'),
      '/api/v2/local-access/pairing-approve',
      { ...deps, readJsonBody: jest.fn(async () => ({ requestId: 'pairing-1' })) },
    );

    expect(calls[0]).toEqual({
      statusCode: 403,
      body: { ok: false, error: 'Owner authentication required' },
    });
  });

  it('rejects malformed local access route inputs as bad requests', async () => {
    const localAccess = createTrustedDeviceService();
    const { route, deps, calls } = createRoute(localAccess, {
      authenticated: true,
      source: 'dashboard-token',
      userId: 'local-owner',
      profileId: 'default',
    });

    await route.handleRequest(
      { method: 'POST', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/v2/local-access/pairing-draft'),
      '/api/v2/local-access/pairing-draft',
      { ...deps, readJsonBody: jest.fn(async () => ({
        deviceName: 'Bad TTL',
        deviceTtlMs: -1,
      })) },
    );
    await route.handleRequest(
      { method: 'POST', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/v2/local-access/pairing-approve'),
      '/api/v2/local-access/pairing-approve',
      { ...deps, readJsonBody: jest.fn(async () => ({})) },
    );
    await route.handleRequest(
      { method: 'POST', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/v2/local-access/devices/revoke'),
      '/api/v2/local-access/devices/revoke',
      { ...deps, readJsonBody: jest.fn(async () => ({})) },
    );

    expect(calls).toEqual([
      {
        statusCode: 400,
        body: { ok: false, error: 'deviceTtlMs must be a positive number or null' },
      },
      {
        statusCode: 400,
        body: { ok: false, error: 'bad-request' },
      },
      {
        statusCode: 400,
        body: { ok: false, error: 'bad-request' },
      },
    ]);
  });

  function createTrustedDeviceService(): TrustedDeviceAccessService {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-local-access-routes-'));
    tempDirs.push(root);
    return new TrustedDeviceAccessService({
      stateFilePath: path.join(root, 'trusted-devices.json'),
      now: () => new Date('2026-06-07T12:00:00.000Z'),
      randomBytes: (size) => Buffer.alloc(size, 5),
      idFactory: (() => {
        let next = 0;
        return (prefix: string) => `${prefix}-${++next}`;
      })(),
    });
  }

  function createRoute(localAccess: TrustedDeviceAccessService, authenticatedIdentity: Record<string, unknown>) {
    const calls: WriteCall[] = [];
    const route = new DashboardCoreRouteService({ localAccess });
    const deps = {
      nodeHeartbeat: { claimPairing: jest.fn(), receiveHeartbeat: jest.fn() },
      nodeMesh: { buildSnapshot: jest.fn() },
      readJsonBody: jest.fn(async () => ({})),
      readRawBody: jest.fn(async () => ''),
      authService: {
        validate: jest.fn(() => true),
        resolveAuthenticatedIdentity: jest.fn(() => authenticatedIdentity),
      },
      writeJson: (_res: http.ServerResponse, responseBody: unknown, statusCode = 200) => {
        calls.push({ body: responseBody, statusCode });
      },
      writeText: jest.fn(),
      writeRedirect: jest.fn(),
      a2ui: {},
      proactivePermissions: {},
    };
    return { route, deps, calls };
  }
});
