import fs from 'fs';
import os from 'os';
import path from 'path';
import * as http from 'http';
import { Database } from '../../../src/storage/Database.js';
import { WorkspaceTaskMandateService } from '../../../src/services/WorkspaceTaskMandateService.js';
import { ZavorthControlCoreRouteService } from '../../../src/services/ZavorthControlCoreRouteService.js';
import { WorkspaceResolver } from '../../../src/security/WorkspaceResolver.js';
import { TrustedWorkspaceService } from '../../../src/services/TrustedWorkspaceService.js';
import { config } from '../../../src/config/index.js';

describe('WorkspaceTaskMandate Endpoint Integration Tests', () => {
  let tempDir: string;
  let db: Database;
  let routeService: ZavorthControlCoreRouteService;
  let service: WorkspaceTaskMandateService;
  let workspaceId: string;

  beforeEach(async () => {
    tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mandate-modal-test-')));
    process.env.ZAVORTH_HOME = tempDir;
    process.env.ZAVORTH_AUDIT_HASH_KEY = 'test-hash-key-123';
    process.env.ZAVORTH_WORKSPACE_ROOT = tempDir;
    config.dbPath = path.join(tempDir, 'data', 'zavorth.db');

    // The active workspace resolves to tempDir; arbitrary workspace IDs must not.
    jest.spyOn(WorkspaceResolver, 'resolve').mockImplementation((workspaceHint) => {
      const activeWorkspaceId = path.basename(tempDir);
      return !workspaceHint || workspaceHint === activeWorkspaceId
        ? tempDir
        : path.resolve(tempDir, '..', workspaceHint);
    });

    db = await Database.getInstance();
    routeService = new ZavorthControlCoreRouteService();
    service = WorkspaceTaskMandateService.getInstance();
    service.revokeMandate(path.basename(tempDir));

    db.run('DELETE FROM workspace_trust_entries');
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
    const url = new URL(`http://localhost/api/v2/workspace/task-mandates/pending?workspaceId=${workspaceId}`);

    const handled = await routeService.handleRequest(req, res, url, url.pathname, deps as any);
    expect(handled).toBe(true);
    expect(jsonCalls[0].status).toBe(401);
  });

  it('rejects GET pending if workspaceId does not match active session workspace root', async () => {
    const { deps, jsonCalls } = buildMockDeps();
    const req = { method: 'GET' } as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    const url = new URL(`http://localhost/api/v2/workspace/task-mandates/pending?workspaceId=different-workspace`);

    const handled = await routeService.handleRequest(req, res, url, url.pathname, deps as any);
    expect(handled).toBe(true);
    expect(jsonCalls[0].status).toBe(403);
    expect(jsonCalls[0].body.error).toContain('workspaceId does not match');
  });

  it('manages proposing, resolving and querying mandates through endpoints correctly', async () => {
    // Propose a mandate directly via service first
    const absPath = path.join(tempDir, 'src/components');
    service.proposeMandate(workspaceId, {
      description: 'Refactor components',
      targetDirectories: [absPath],
      allowedOperations: ['command.run', 'filesystem.write'],
      allowedBinaries: ['npm'],
      maxRiskLevel: 'MEDIUM',
      allowPackageInstall: true,
      allowNetwork: false
    });

    // Query pending mandate: targetDirectories must be relativized
    const { deps: depsPending, jsonCalls: jsonCallsPending } = buildMockDeps();
    const reqPending = { method: 'GET' } as http.IncomingMessage;
    const resPending = {} as http.ServerResponse;
    const urlPending = new URL(`http://localhost/api/v2/workspace/task-mandates/pending?workspaceId=${workspaceId}`);

    const handledPending = await routeService.handleRequest(reqPending, resPending, urlPending, urlPending.pathname, depsPending as any);
    expect(handledPending).toBe(true);
    expect(jsonCallsPending[0].status).toBe(200);
    expect(jsonCallsPending[0].body.proposed).not.toBeNull();
    expect(jsonCallsPending[0].body.proposed.targetDirectories).toEqual(['src/components']);

    // Resolve - Approve mandate
    const { deps: depsResolve, jsonCalls: jsonCallsResolve } = buildMockDeps(async () => ({
      workspaceId,
      approved: true
    }));
    const reqResolve = { method: 'POST' } as http.IncomingMessage;
    const urlResolve = new URL('http://localhost/api/v2/workspace/task-mandates/resolve');
    const handledResolve = await routeService.handleRequest(reqResolve, resPending, urlResolve, urlResolve.pathname, depsResolve as any);
    expect(handledResolve).toBe(true);
    expect(jsonCallsResolve[0].status).toBe(200);
    expect(jsonCallsResolve[0].body.resolved).not.toBeNull();

    // Query active mandate: targetDirectories must be relativized
    const { deps: depsActive, jsonCalls: jsonCallsActive } = buildMockDeps();
    const urlActive = new URL(`http://localhost/api/v2/workspace/task-mandates/active?workspaceId=${workspaceId}`);
    const handledActive = await routeService.handleRequest(reqPending, resPending, urlActive, urlActive.pathname, depsActive as any);
    expect(handledActive).toBe(true);
    expect(jsonCallsActive[0].status).toBe(200);
    expect(jsonCallsActive[0].body.active).not.toBeNull();
    expect(jsonCallsActive[0].body.active.targetDirectories).toEqual(['src/components']);

    // Revoke mandate
    const { deps: depsRevoke, jsonCalls: jsonCallsRevoke } = buildMockDeps(async () => ({
      workspaceId
    }));
    const urlRevoke = new URL('http://localhost/api/v2/workspace/task-mandates/revoke');
    const handledRevoke = await routeService.handleRequest(reqResolve, resPending, urlRevoke, urlRevoke.pathname, depsRevoke as any);
    expect(handledRevoke).toBe(true);
    expect(jsonCallsRevoke[0].status).toBe(200);

    // Verify no longer active
    expect(service.getActiveMandate(workspaceId)).toBeNull();
  });
});
