import fs from 'fs';
import os from 'os';
import path from 'path';
import * as http from 'http';
import { Database } from '../../../src/storage/Database.js';
import { HostPowerModeService } from '../../../src/services/HostPowerModeService.js';
import { HostCommandApprovalService } from '../../../src/services/HostCommandApprovalService.js';
import { HostCommandPayloadCache } from '../../../src/services/HostCommandPayloadCache.js';
import { ZavorthControlCoreRouteService } from '../../../src/services/ZavorthControlCoreRouteService.js';
import { config } from '../../../src/config/index.js';

describe('HostCommandApproval Integration Tests', () => {
  let tempDir: string;
  let db: Database;
  let approvalService: HostCommandApprovalService;
  let routeService: ZavorthControlCoreRouteService;
  let origWorkspaceRoot: string;
  let origDefaultWorkspace: string;

  beforeAll(() => {
    origWorkspaceRoot = config.workspaceRoot;
    origDefaultWorkspace = config.defaultWorkspace;
  });

  beforeEach(async () => {
    tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-host-test-')));
    process.env.ZAVORTH_HOME = tempDir;
    process.env.ZAVORTH_AUDIT_HASH_KEY = 'test-hash-key-123';
    process.env.ZAVORTH_WORKSPACE_ROOT = tempDir;
    fs.mkdirSync(path.join(tempDir, 'data'), { recursive: true });
    config.dbPath = path.join(tempDir, 'data', 'zavorth.db');

    (config as any).workspaceRoot = tempDir;
    (config as any).defaultWorkspace = tempDir;

    db = await Database.getInstance();
    approvalService = new HostCommandApprovalService(db);
    routeService = new ZavorthControlCoreRouteService();

    db.run('DELETE FROM workspace_host_command_proposals');
    HostCommandPayloadCache.getInstance().clear();
  });

  afterEach(async () => {
    (config as any).workspaceRoot = origWorkspaceRoot;
    (config as any).defaultWorkspace = origDefaultWorkspace;

    db.close();
    HostPowerModeService.getInstance().destroy();
    HostCommandPayloadCache.getInstance().destroy();
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

  it('manages host power mode status, enable, and disable endpoints', async () => {
    const workspaceId = 'root';
    const res = {} as http.ServerResponse;

    // 1. Check status (default = disabled)
    const { deps: depsGet, jsonCalls: jsonCallsGet } = buildMockDeps();
    const reqGet = { method: 'GET' } as http.IncomingMessage;
    const urlGet = new URL(`http://localhost/api/v2/workspace/host-power/status-workspaceId=${workspaceId}`);
    let handled = await routeService.handleRequest(reqGet, res, urlGet, urlGet.pathname, depsGet as any);
    expect(handled).toBe(true);
    expect(jsonCallsGet[0].status).toBe(200);
    expect(jsonCallsGet[0].body.data.enabled).toBe(false);

    // 2. Enable Host Power Mode
    const { deps: depsEnable, jsonCalls: jsonCallsEnable } = buildMockDeps(async () => ({
      workspaceId,
      durationMinutes: 15
    }));
    const reqPost = { method: 'POST' } as http.IncomingMessage;
    const urlEnable = new URL('http://localhost/api/v2/workspace/host-power/enable');
    handled = await routeService.handleRequest(reqPost, res, urlEnable, urlEnable.pathname, depsEnable as any);
    expect(handled).toBe(true);
    expect(jsonCallsEnable[0].status).toBe(200);

    // 3. Status is now enabled
    const { deps: depsGet2, jsonCalls: jsonCallsGet2 } = buildMockDeps();
    handled = await routeService.handleRequest(reqGet, res, urlGet, urlGet.pathname, depsGet2 as any);
    expect(handled).toBe(true);
    expect(jsonCallsGet2[0].status).toBe(200);
    expect(jsonCallsGet2[0].body.data.enabled).toBe(true);

    // 4. Disable Host Power Mode
    const { deps: depsDisable, jsonCalls: jsonCallsDisable } = buildMockDeps(async () => ({
      workspaceId
    }));
    const urlDisable = new URL('http://localhost/api/v2/workspace/host-power/disable');
    handled = await routeService.handleRequest(reqPost, res, urlDisable, urlDisable.pathname, depsDisable as any);
    expect(handled).toBe(true);
    expect(jsonCallsDisable[0].status).toBe(200);

    // 5. Status is now disabled
    const { deps: depsGet3, jsonCalls: jsonCallsGet3 } = buildMockDeps();
    handled = await routeService.handleRequest(reqGet, res, urlGet, urlGet.pathname, depsGet3 as any);
    expect(handled).toBe(true);
    expect(jsonCallsGet3[0].status).toBe(200);
    expect(jsonCallsGet3[0].body.data.enabled).toBe(false);
  });

  it('manages pending proposals, resolve, and execute flow with guards', async () => {
    const workspaceId = 'root';
    const command = 'node';
    const args = ['-e', 'console.log("integration success")'];
    const cwd = tempDir;
    const shell = false;

    // Propose manually
    const { operationId } = await approvalService.propose(workspaceId, command, args, cwd, shell, 'test run');

    // 1. Fetch pending proposals
    const { deps: depsPending, jsonCalls: jsonCallsPending } = buildMockDeps();
    const reqGet = { method: 'GET' } as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    const urlPending = new URL(`http://localhost/api/v2/workspace/host-commands/pending-workspaceId=${workspaceId}`);
    let handled = await routeService.handleRequest(reqGet, res, urlPending, urlPending.pathname, depsPending as any);
    expect(handled).toBe(true);
    expect(jsonCallsPending[0].status).toBe(200);
    expect(jsonCallsPending[0].body.data.length).toBe(1);
    expect(jsonCallsPending[0].body.data[0].commandPreview).toBe('node');

    // 2. Try executing command before resolution -> fails
    const { deps: depsExec, jsonCalls: jsonCallsExec } = buildMockDeps(async () => ({
      operationId
    }));
    const reqPost = { method: 'POST' } as http.IncomingMessage;
    const urlExec = new URL('http://localhost/api/v2/workspace/host-commands/execute');
    handled = await routeService.handleRequest(reqPost, res, urlExec, urlExec.pathname, depsExec as any);
    expect(handled).toBe(true);
    expect(jsonCallsExec[0].status).toBe(404); // Not resolved yet (or not found under approved)

    // 3. Resolve command (approve)
    const { deps: depsResolve, jsonCalls: jsonCallsResolve } = buildMockDeps(async () => ({
      operationId,
      decision: 'approve'
    }));
    const urlResolve = new URL('http://localhost/api/v2/workspace/host-commands/resolve');
    handled = await routeService.handleRequest(reqPost, res, urlResolve, urlResolve.pathname, depsResolve as any);
    expect(handled).toBe(true);
    expect(jsonCallsResolve[0].status).toBe(200);

    // 4. Execute approved command -> succeeds
    const { deps: depsExec2, jsonCalls: jsonCallsExec2 } = buildMockDeps(async () => ({
      operationId
    }));
    handled = await routeService.handleRequest(reqPost, res, urlExec, urlExec.pathname, depsExec2 as any);
    expect(handled).toBe(true);
    expect(jsonCallsExec2[0].status).toBe(200);
    expect(jsonCallsExec2[0].body.data.exitCode).toBe(0);
    expect(jsonCallsExec2[0].body.data.stdout.trim()).toBe('integration success');

    // 5. Try replay execution (consumed/single-use check) -> fails
    const { deps: depsExec3, jsonCalls: jsonCallsExec3 } = buildMockDeps(async () => ({
      operationId
    }));
    handled = await routeService.handleRequest(reqPost, res, urlExec, urlExec.pathname, depsExec3 as any);
    expect(handled).toBe(true);
    expect(jsonCallsExec3[0].status).toBe(404); // Already consumed/deleted
  });
});
