import fs from 'fs';
import os from 'os';
import path from 'path';
import * as http from 'http';
import { Database } from '../../../src/storage/Database.js';
import { WorkspaceCommandApprovalService } from '../../../src/services/WorkspaceCommandApprovalService.js';
import { WorkspaceSessionGrantCache } from '../../../src/services/WorkspaceSessionGrantCache.js';
import { ZavorthControlCoreRouteService } from '../../../src/services/ZavorthControlCoreRouteService.js';
import { SecurityAuditLogger } from '../../../src/services/SecurityAuditLogger.js';
import { LogRepository } from '../../../src/storage/LogRepository.js';
import { config } from '../../../src/config/index.js';

describe('WorkspaceCommandApproval Integration Tests', () => {
  let tempDir: string;
  let db: Database;
  let auditLogger: SecurityAuditLogger;
  let service: WorkspaceCommandApprovalService;
  let routeService: ZavorthControlCoreRouteService;
  let cache: WorkspaceSessionGrantCache;

  beforeEach(async () => {
    tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-command-test-')));
    process.env.ZAVORTH_HOME = tempDir;
    process.env.ZAVORTH_AUDIT_HASH_KEY = 'test-hash-key-123';
    process.env.ZAVORTH_WORKSPACE_ROOT = tempDir;
    fs.mkdirSync(path.join(tempDir, 'data'), { recursive: true });
    config.dbPath = path.join(tempDir, 'data', 'zavorth.db');

    db = await Database.getInstance();
    auditLogger = new SecurityAuditLogger(new LogRepository());
    service = new WorkspaceCommandApprovalService(db, auditLogger);
    routeService = new ZavorthControlCoreRouteService();
    cache = WorkspaceSessionGrantCache.getInstance();
    cache.clearAll();
    db.run('DELETE FROM workspace_command_approvals');
  });

  afterEach(async () => {
    db.close();
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

  it('handles /session-grant activation and revocation endpoints correctly', async () => {
    const workspaceId = 'ws-cmd-test';
    const { deps, jsonCalls } = buildMockDeps(async () => ({
      workspaceId,
      active: true,
      durationMinutes: 30,
      allowRiskUpTo: 'MEDIUM',
      allowPackageInstall: true,
      allowNetwork: false
    }));

    const req = { method: 'POST' } as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    const url = new URL('http://localhost/api/v2/workspace/command-approvals/session-grant');

    // Enable Developer Mode Session Grant
    const handled = await routeService.handleRequest(req, res, url, url.pathname, deps as any);
    expect(handled).toBe(true);
    expect(jsonCalls[0].status).toBe(200);
    expect(jsonCalls[0].body.developerModeActive).toBe(true);
    expect(jsonCalls[0].body.grant).toBeDefined();

    expect(cache.isDeveloperModeActive(workspaceId)).toBe(true);
    expect(cache.getGrant(workspaceId)).not.toBeNull();

    // Query active grant status
    const { deps: depsGet, jsonCalls: jsonCallsGet } = buildMockDeps();
    const reqGet = { method: 'GET' } as http.IncomingMessage;
    const urlGet = new URL(`http://localhost/api/v2/workspace/command-approvals/session-grant-workspaceId=${workspaceId}`);
    const handledGet = await routeService.handleRequest(reqGet, res, urlGet, urlGet.pathname, depsGet as any);
    expect(handledGet).toBe(true);
    expect(jsonCallsGet[0].status).toBe(200);
    expect(jsonCallsGet[0].body.developerModeActive).toBe(true);

    // Disable / revoke grant
    const { deps: depsRevoke, jsonCalls: jsonCallsRevoke } = buildMockDeps(async () => ({
      workspaceId,
      active: false
    }));
    const handledRevoke = await routeService.handleRequest(req, res, url, url.pathname, depsRevoke as any);
    expect(handledRevoke).toBe(true);
    expect(jsonCallsRevoke[0].status).toBe(200);
    expect(jsonCallsRevoke[0].body.developerModeActive).toBe(false);
    expect(cache.isDeveloperModeActive(workspaceId)).toBe(false);
    expect(cache.getGrant(workspaceId)).toBeNull();
  });

  it('manages /pending and /resolve command approvals endpoints correctly', async () => {
    const workspaceId = 'ws-cmd-test';
    const command = 'npm install';

    // Register approval manually via service
    const operationId = await service.requestApproval(workspaceId, command, false);

    // Retrieve pending command approvals via API endpoint
    const { deps: depsPending, jsonCalls: jsonCallsPending } = buildMockDeps();
    const reqPending = { method: 'GET' } as http.IncomingMessage;
    const resPending = {} as http.ServerResponse;
    const urlPending = new URL(`http://localhost/api/v2/workspace/command-approvals/pending-workspaceId=${workspaceId}`);

    const handledPending = await routeService.handleRequest(reqPending, resPending, urlPending, urlPending.pathname, depsPending as any);
    expect(handledPending).toBe(true);
    expect(jsonCallsPending[0].status).toBe(200);
    expect(jsonCallsPending[0].body.data.length).toBe(1);
    expect(jsonCallsPending[0].body.data[0].operationId).toBe(operationId);
    expect(jsonCallsPending[0].body.data[0].command).toBe(command);

    // Fetch details of specific command payload
    const { deps: depsPayload, jsonCalls: jsonCallsPayload } = buildMockDeps();
    const urlPayload = new URL(`http://localhost/api/v2/workspace/command-approvals/payload-operationId=${operationId}`);
    const handledPayload = await routeService.handleRequest(reqPending, resPending, urlPayload, urlPayload.pathname, depsPayload as any);
    expect(handledPayload).toBe(true);
    expect(jsonCallsPayload[0].status).toBe(200);
    expect(jsonCallsPayload[0].body.data.command).toBe(command);

    // Approve the operation via API endpoint
    const { deps: depsResolve, jsonCalls: jsonCallsResolve } = buildMockDeps(async () => ({
      operationId,
      decision: 'approve'
    }));
    const reqResolve = { method: 'POST' } as http.IncomingMessage;
    const urlResolve = new URL('http://localhost/api/v2/workspace/command-approvals/resolve');
    const handledResolve = await routeService.handleRequest(reqResolve, resPending, urlResolve, urlResolve.pathname, depsResolve as any);
    expect(handledResolve).toBe(true);
    expect(jsonCallsResolve[0].status).toBe(200);

    // Check if approved in DB
    const row = db.get<{ approved: number }>(
      'SELECT approved FROM workspace_command_approvals WHERE operation_id = -',
      [operationId]
    );
    expect(row?.approved).toBe(1);
  });
});
