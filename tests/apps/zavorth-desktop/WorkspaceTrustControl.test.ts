import fs from 'fs';
import os from 'os';
import path from 'path';
import * as http from 'http';
import { Database } from '../../../src/storage/Database.js';
import { WorkspaceSessionGrantCache } from '../../../src/services/WorkspaceSessionGrantCache.js';
import { ZavorthControlCoreRouteService } from '../../../src/services/ZavorthControlCoreRouteService.js';
import { WorkspaceResolver } from '../../../src/security/WorkspaceResolver.js';
import { TrustedWorkspaceService } from '../../../src/services/TrustedWorkspaceService.js';
import { config } from '../../../src/config/index.js';

describe('WorkspaceTrustControl Endpoint Integration Tests', () => {
  let tempDir: string;
  let db: Database;
  let routeService: ZavorthControlCoreRouteService;
  let cache: WorkspaceSessionGrantCache;
  let workspaceId: string;

  beforeEach(async () => {
    tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-trust-test-')));
    process.env.ZAVORTH_HOME = tempDir;
    process.env.ZAVORTH_AUDIT_HASH_KEY = 'test-hash-key-123';
    process.env.ZAVORTH_WORKSPACE_ROOT = tempDir;
    config.dbPath = path.join(tempDir, 'data', 'zavorth.db');

    // WorkspaceResolver uses defaultWorkspace from config. Mock resolve to return tempDir
    jest.spyOn(WorkspaceResolver, 'resolve').mockReturnValue(tempDir);

    db = await Database.getInstance();
    routeService = new ZavorthControlCoreRouteService();
    cache = WorkspaceSessionGrantCache.getInstance();
    cache.clearAll();
    db.run('DELETE FROM workspace_trust_entries');
    db.run('DELETE FROM workspace_command_approvals');
    db.run('DELETE FROM system_logs');

    workspaceId = path.basename(tempDir);
  });

  afterEach(async () => {
    db.close();
    (TrustedWorkspaceService as any).instance = null;
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    delete process.env.ZAVORTH_HOME;
    delete process.env.ZAVORTH_AUDIT_HASH_KEY;
    delete process.env.ZAVORTH_WORKSPACE_ROOT;
    jest.restoreAllMocks();
  });

  function buildMockDeps(readJson = async () => ({}), authVal = true) {
    const jsonCalls: any[] = [];
    return {
      deps: {
        nodeHeartbeat: { claimPairing: jest.fn(), receiveHeartbeat: jest.fn() },
        nodeMesh: { buildSnapshot: jest.fn() },
        readJsonBody: jest.fn(readJson),
        readRawBody: jest.fn(async () => ''),
        authService: {
          validate: jest.fn(() => authVal),
          resolveAuthenticatedIdentity: jest.fn(() =>
            authVal
              ? {
                  authenticated: true,
                  source: 'zavorthControl-token',
                  userId: 'desktop-user',
                  profileId: 'default',
                }
              : null
          ),
        },
        writeJson: (res: http.ServerResponse, body: any, status = 200) => {
          jsonCalls.push({ body, status });
        },
        writeText: jest.fn(),
        writeRedirect: jest.fn(),
        a2ui: {},
        proactivePermissions: {},
      },
      jsonCalls,
    };
  }

  it('unauthorized requests receive a 401 response', async () => {
    const { deps, jsonCalls } = buildMockDeps(async () => ({}), false);
    const req = { method: 'GET' } as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    const url = new URL(`http://localhost/api/v2/workspace/trust/status?workspaceId=${workspaceId}`);

    const handled = await routeService.handleRequest(req, res, url, url.pathname, deps as any);
    expect(handled).toBe(true);
    expect(jsonCalls[0].status).toBe(401);
  });

  it('rejects GET status if workspaceId does not match active session workspace root', async () => {
    const { deps, jsonCalls } = buildMockDeps();
    const req = { method: 'GET' } as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    const url = new URL(`http://localhost/api/v2/workspace/trust/status?workspaceId=different-workspace`);

    const handled = await routeService.handleRequest(req, res, url, url.pathname, deps as any);
    expect(handled).toBe(true);
    expect(jsonCalls[0].status).toBe(403);
    expect(jsonCalls[0].body.error).toContain('workspaceId does not match');
  });

  it('handles granting and checking trust status correctly via POST and GET', async () => {
    const { deps, jsonCalls } = buildMockDeps(async () => ({
      workspaceId,
      rootPath: tempDir,
      trusted: true,
      allowRiskUpTo: 'MEDIUM',
      allowPackageInstall: true,
      allowNetwork: false,
    }));

    const req = { method: 'POST' } as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    const url = new URL('http://localhost/api/v2/workspace/trust/resolve');

    // Grant trust via POST
    const handled = await routeService.handleRequest(req, res, url, url.pathname, deps as any);
    expect(handled).toBe(true);
    expect(jsonCalls[0].status).toBe(200);
    expect(jsonCalls[0].body.ok).toBe(true);
    expect(jsonCalls[0].body.trusted).toBe(true);

    // Verify in session cache
    expect(cache.isDeveloperModeActive(workspaceId)).toBe(true);
    expect(cache.getGrant(workspaceId)?.allowRiskUpTo).toBe('MEDIUM');

    // Verify GET status returns trusted
    const { deps: depsGet, jsonCalls: jsonCallsGet } = buildMockDeps();
    const reqGet = { method: 'GET' } as http.IncomingMessage;
    const urlGet = new URL(`http://localhost/api/v2/workspace/trust/status?workspaceId=${workspaceId}`);
    const handledGet = await routeService.handleRequest(reqGet, res, urlGet, urlGet.pathname, depsGet as any);
    expect(handledGet).toBe(true);
    expect(jsonCallsGet[0].status).toBe(200);
    expect(jsonCallsGet[0].body.trusted).toBe(true);
    expect(jsonCallsGet[0].body.entry.allowRiskUpTo).toBe('MEDIUM');
  });

  it('rejects POST resolve if rootPath does not match active session workspace root', async () => {
    const spoofedPath = path.resolve(tempDir, '../spoofed-dir');
    const { deps, jsonCalls } = buildMockDeps(async () => ({
      workspaceId,
      rootPath: spoofedPath,
      trusted: true,
    }));

    const req = { method: 'POST' } as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    const url = new URL('http://localhost/api/v2/workspace/trust/resolve');

    const handled = await routeService.handleRequest(req, res, url, url.pathname, deps as any);
    expect(handled).toBe(true);
    expect(jsonCalls[0].status).toBe(403);
    expect(jsonCalls[0].body.error).toContain('rootPath does not match');
  });

  it('handles revoking trust correctly via POST', async () => {
    // Grant trust first directly via cache & DB to set up revocation state
    db.run(
      `INSERT INTO workspace_trust_entries (workspace_id, root_hash, root_suffix, trusted, allow_risk_up_to, allow_package_install, allow_network, created_at, updated_at)
       VALUES (?, 'hash', 'suffix', 1, 'LOW', 0, 0, '2026-06-13', '2026-06-13')`,
      [workspaceId]
    );
    cache.setDeveloperMode(workspaceId, true);

    const { deps, jsonCalls } = buildMockDeps(async () => ({
      workspaceId,
      rootPath: tempDir,
      trusted: false,
    }));

    const req = { method: 'POST' } as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    const url = new URL('http://localhost/api/v2/workspace/trust/resolve');

    const handled = await routeService.handleRequest(req, res, url, url.pathname, deps as any);
    expect(handled).toBe(true);
    expect(jsonCalls[0].status).toBe(200);
    expect(jsonCalls[0].body.trusted).toBe(false);

    // Verify cache is cleared
    expect(cache.isDeveloperModeActive(workspaceId)).toBe(false);
    // Verify DB entry is deleted
    const row = db.get('SELECT * FROM workspace_trust_entries WHERE workspace_id = ?', [workspaceId]);
    expect(row).toBeUndefined();
  });
});
