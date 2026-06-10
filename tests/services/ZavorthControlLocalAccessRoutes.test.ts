import * as http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthControlCoreRouteService } from '../../src/services/ZavorthControlCoreRouteService.js';
import { TrustedDeviceAccessService } from '../../src/services/TrustedDeviceAccessService.js';

describe('ZavorthControl local access routes', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('uses zavorthControl owner authentication for trusted-device pairing drafts', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-control-local-access-'));
    tempDirs.push(root);
    const localAccess = new TrustedDeviceAccessService({
      stateFilePath: path.join(root, 'trusted-devices.json'),
      now: () => new Date('2026-06-07T12:00:00.000Z'),
      randomBytes: (size) => Buffer.alloc(size, 13),
      idFactory: (() => {
        let next = 0;
        return (prefix: string) => `${prefix}-${++next}`;
      })(),
    });
    const route = new ZavorthControlCoreRouteService({ localAccess });
    const calls: Array<{ body: any; statusCode: number }> = [];
    const deps = {
      nodeHeartbeat: { claimPairing: jest.fn(), receiveHeartbeat: jest.fn() },
      nodeMesh: { buildSnapshot: jest.fn() },
      readJsonBody: jest.fn(async () => ({
        deviceName: 'Satellite',
        scopes: ['runtime:control'],
      })),
      readRawBody: jest.fn(async () => ''),
      authService: {
        validate: jest.fn(() => true),
        resolveAuthenticatedIdentity: jest.fn(() => ({
          authenticated: true,
          source: 'zavorthControl-token',
          userId: 'local-owner',
          profileId: 'default',
        })),
      },
      writeJson: (_res: http.ServerResponse, responseBody: unknown, statusCode = 200) => {
        calls.push({ body: responseBody, statusCode });
      },
      writeText: jest.fn(),
      writeRedirect: jest.fn(),
      a2ui: {},
      proactivePermissions: {},
    };

    const handled = await route.handleRequest(
      { method: 'POST', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/v2/local-access/pairing-draft'),
      '/api/v2/local-access/pairing-draft',
      deps,
    );

    expect(handled).toBe(true);
    expect(deps.authService.resolveAuthenticatedIdentity).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
    }));
    expect(calls[0]).toMatchObject({
      statusCode: 200,
      body: {
        ok: true,
        data: {
          deviceName: 'Satellite',
          scopes: ['runtime:control'],
        },
      },
    });
  });

  it('validates runtime state action type and keeps approval server-owned', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-control-runtime-action-'));
    tempDirs.push(root);
    const localAccess = new TrustedDeviceAccessService({
      stateFilePath: path.join(root, 'trusted-devices.json'),
      now: () => new Date('2026-06-07T12:00:00.000Z'),
      randomBytes: (size) => Buffer.alloc(size, 17),
    });
    const route = new ZavorthControlCoreRouteService({ localAccess });
    const calls: Array<{ body: any; statusCode: number }> = [];
    const dispatchRuntimeStateAction = jest.fn(() => ({ ok: true, receipt: { status: 'pending-approval' } }));
    const deps = {
      nodeHeartbeat: { claimPairing: jest.fn(), receiveHeartbeat: jest.fn() },
      nodeMesh: { buildSnapshot: jest.fn() },
      readJsonBody: jest.fn(async () => ({
        type: 'unknown-action',
        approved: true,
        userId: 'attacker',
      })),
      readRawBody: jest.fn(async () => ''),
      authService: {
        validate: jest.fn(() => true),
        resolveAuthenticatedIdentity: jest.fn(() => ({
          authenticated: true,
          source: 'zavorthControl-token',
          userId: 'control-owner',
          profileId: 'default',
        })),
      },
      experienceCore: { dispatchRuntimeStateAction },
      writeJson: (_res: http.ServerResponse, responseBody: unknown, statusCode = 200) => {
        calls.push({ body: responseBody, statusCode });
      },
      writeText: jest.fn(),
      writeRedirect: jest.fn(),
      a2ui: {},
      proactivePermissions: {},
    };

    await route.handleRequest(
      { method: 'POST', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/experience/runtime-state/action'),
      '/api/experience/runtime-state/action',
      deps,
    );

    await route.handleRequest(
      { method: 'POST', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/experience/runtime-state/action'),
      '/api/experience/runtime-state/action',
      {
        ...deps,
        readJsonBody: jest.fn(async () => ({
          type: 'set-mcp-trust',
          approved: true,
          userId: 'attacker',
          source: 'zavorth-desktop-bridge',
          payload: { serverId: 'external', decision: 'trusted' },
        })),
      },
    );

    expect(calls[0]).toMatchObject({
      statusCode: 400,
      body: { ok: false },
    });
    expect(dispatchRuntimeStateAction).toHaveBeenCalledTimes(1);
    expect(dispatchRuntimeStateAction).toHaveBeenCalledWith(expect.objectContaining({
      type: 'set-mcp-trust',
      userId: 'control-owner',
      source: 'runtime-api',
      approved: false,
    }));
  });
});
