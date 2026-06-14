import fs from 'fs';
import os from 'os';
import path from 'path';
import * as http from 'http';
import { Database } from '../../../src/storage/Database.js';
import { TemporaryDirectoryTrustService } from '../../../src/services/TemporaryDirectoryTrustService.js';
import { ZavorthControlCoreRouteService } from '../../../src/services/ZavorthControlCoreRouteService.js';
import { WorkspaceResolver } from '../../../src/security/WorkspaceResolver.js';
import { TrustedWorkspaceService } from '../../../src/services/TrustedWorkspaceService.js';
import { config } from '../../../src/config/index.js';

/**
 * Fase 21E-A — Integration tests for Temporary Directory Trust REST endpoints.
 * These tests exercise the route handler directly, following the same pattern
 * as WorkspaceTaskMandateModal.test.ts (HTTP integration, no JSX).
 */
describe('TemporaryDirectoryTrust Endpoint Integration Tests', () => {
  let tempDir: string;
  let tempTrustTargetDir: string;
  let db: Database;
  let routeService: ZavorthControlCoreRouteService;
  let service: TemporaryDirectoryTrustService;
  let workspaceId: string;

  beforeEach(async () => {
    tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-tmp-trust-test-ws-')));
    tempTrustTargetDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-tmp-trust-target-')));

    process.env.ZAVORTH_HOME = tempDir;
    process.env.ZAVORTH_AUDIT_HASH_KEY = 'test-hash-key-21e-a';
    process.env.ZAVORTH_WORKSPACE_ROOT = tempDir;
    config.dbPath = path.join(tempDir, 'data', 'zavorth.db');

    jest.spyOn(WorkspaceResolver, 'resolve').mockImplementation((wsId) => {
      if (!wsId || wsId === 'AUTO' || wsId === path.basename(tempDir)) {
        return tempDir;
      }
      return path.resolve(String(wsId));
    });

    db = await Database.getInstance();
    routeService = new ZavorthControlCoreRouteService();
    TemporaryDirectoryTrustService.resetInstance();
    service = TemporaryDirectoryTrustService.getInstance();

    db.run('DELETE FROM workspace_trust_entries');
    db.run('DELETE FROM system_logs');

    workspaceId = path.basename(tempDir);
  });

  afterEach(async () => {
    db.close();
    (TrustedWorkspaceService as any).instance = null;
    TemporaryDirectoryTrustService.resetInstance();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch { /* ignore */ }
    try {
      fs.rmSync(tempTrustTargetDir, { recursive: true, force: true });
    } catch { /* ignore */ }
    delete process.env.ZAVORTH_HOME;
    delete process.env.ZAVORTH_AUDIT_HASH_KEY;
    delete process.env.ZAVORTH_WORKSPACE_ROOT;
    jest.restoreAllMocks();
  });

  // ── Mock deps helper ─────────────────────────────────────────────────────

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
              ? { authenticated: true, source: 'zavorthControl-token', userId: 'desktop-user', profileId: 'default' }
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

  // ── Auth guard ────────────────────────────────────────────────────────────

  it('returns 401 for unauthorized GET pending', async () => {
    const { deps, jsonCalls } = buildMockDeps(async () => ({}), false);
    const req = { method: 'GET' } as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    const url = new URL(`http://localhost/api/v2/workspace/temporary-directory-trusts/pending?workspaceId=${workspaceId}`);

    const handled = await routeService.handleRequest(req, res, url, url.pathname, deps as any);
    expect(handled).toBe(true);
    expect(jsonCalls[0].status).toBe(401);
  });

  it('returns 401 for unauthorized POST resolve', async () => {
    const { deps, jsonCalls } = buildMockDeps(async () => ({ workspaceId, trustId: 'x', approved: true }), false);
    const req = { method: 'POST' } as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    const url = new URL('http://localhost/api/v2/workspace/temporary-directory-trusts/resolve');

    const handled = await routeService.handleRequest(req, res, url, url.pathname, deps as any);
    expect(handled).toBe(true);
    expect(jsonCalls[0].status).toBe(401);
  });

  // ── workspaceId validation ─────────────────────────────────────────────────

  it('rejects GET pending with mismatched workspaceId (403)', async () => {
    const { deps, jsonCalls } = buildMockDeps();
    const req = { method: 'GET' } as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    const url = new URL('http://localhost/api/v2/workspace/temporary-directory-trusts/pending?workspaceId=evil-workspace');

    const handled = await routeService.handleRequest(req, res, url, url.pathname, deps as any);
    expect(handled).toBe(true);
    expect(jsonCalls[0].status).toBe(403);
    expect(jsonCalls[0].body.error).toContain('workspaceId does not match');
  });

  it('rejects GET active with mismatched workspaceId (403)', async () => {
    const { deps, jsonCalls } = buildMockDeps();
    const req = { method: 'GET' } as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    const url = new URL('http://localhost/api/v2/workspace/temporary-directory-trusts/active?workspaceId=evil-workspace');

    const handled = await routeService.handleRequest(req, res, url, url.pathname, deps as any);
    expect(handled).toBe(true);
    expect(jsonCalls[0].status).toBe(403);
  });

  it('rejects POST resolve with mismatched workspaceId (403)', async () => {
    const { deps, jsonCalls } = buildMockDeps(async () => ({
      workspaceId: 'evil-workspace',
      trustId: 'tmp-trust-xyz',
      approved: true,
    }));
    const req = { method: 'POST' } as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    const url = new URL('http://localhost/api/v2/workspace/temporary-directory-trusts/resolve');

    const handled = await routeService.handleRequest(req, res, url, url.pathname, deps as any);
    expect(handled).toBe(true);
    expect(jsonCalls[0].status).toBe(403);
    expect(jsonCalls[0].body.error).toContain('workspaceId does not match');
  });

  it('rejects POST revoke with mismatched workspaceId (403)', async () => {
    const { deps, jsonCalls } = buildMockDeps(async () => ({
      workspaceId: 'evil-workspace',
      trustId: 'tmp-trust-xyz',
    }));
    const req = { method: 'POST' } as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    const url = new URL('http://localhost/api/v2/workspace/temporary-directory-trusts/revoke');

    const handled = await routeService.handleRequest(req, res, url, url.pathname, deps as any);
    expect(handled).toBe(true);
    expect(jsonCalls[0].status).toBe(403);
  });

  // ── GET pending — no proposed trust ────────────────────────────────────────

  it('returns proposed=null when no trust is pending', async () => {
    const { deps, jsonCalls } = buildMockDeps();
    const req = { method: 'GET' } as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    const url = new URL(`http://localhost/api/v2/workspace/temporary-directory-trusts/pending?workspaceId=${workspaceId}`);

    const handled = await routeService.handleRequest(req, res, url, url.pathname, deps as any);
    expect(handled).toBe(true);
    expect(jsonCalls[0].status).toBe(200);
    expect(jsonCalls[0].body.proposed).toBeNull();
  });

  // ── GET active — no active trusts ──────────────────────────────────────────

  it('returns empty trusts array when no active trusts exist', async () => {
    const { deps, jsonCalls } = buildMockDeps();
    const req = { method: 'GET' } as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    const url = new URL(`http://localhost/api/v2/workspace/temporary-directory-trusts/active?workspaceId=${workspaceId}`);

    const handled = await routeService.handleRequest(req, res, url, url.pathname, deps as any);
    expect(handled).toBe(true);
    expect(jsonCalls[0].status).toBe(200);
    expect(jsonCalls[0].body.trusts).toEqual([]);
  });

  // ── Full lifecycle: propose → pending → approve → active → revoke ──────────

  it('manages the full lifecycle: propose, GET pending, approve, GET active, revoke', async () => {
    // 1. Propose a trust via the service directly
    const trust = service.proposeTrust(workspaceId, tempTrustTargetDir, ['filesystem.read', 'filesystem.write']);
    expect(trust.trustId).toMatch(/^tmp-trust-/);

    // 2. GET pending: should return the proposed trust with only pathSuffix (not full path)
    const { deps: depsPending, jsonCalls: callsPending } = buildMockDeps();
    const urlPending = new URL(`http://localhost/api/v2/workspace/temporary-directory-trusts/pending?workspaceId=${workspaceId}`);
    await routeService.handleRequest({ method: 'GET' } as any, {} as any, urlPending, urlPending.pathname, depsPending as any);
    expect(callsPending[0].status).toBe(200);
    expect(callsPending[0].body.proposed).not.toBeNull();
    // rootSuffix is exposed (not full absolute path)
    expect(callsPending[0].body.proposed.rootSuffix).toBeDefined();
    expect(callsPending[0].body.proposed.rootSuffix).not.toContain('/');
    expect(callsPending[0].body.proposed.allowedOperations).toEqual(['filesystem.read', 'filesystem.write']);

    // 3. POST resolve with approved=true
    const { deps: depsResolve, jsonCalls: callsResolve } = buildMockDeps(async () => ({
      workspaceId,
      trustId: trust.trustId,
      approved: true,
    }));
    const urlResolve = new URL('http://localhost/api/v2/workspace/temporary-directory-trusts/resolve');
    await routeService.handleRequest({ method: 'POST' } as any, {} as any, urlResolve, urlResolve.pathname, depsResolve as any);
    expect(callsResolve[0].status).toBe(200);
    expect(callsResolve[0].body.resolved).not.toBeNull();
    expect(callsResolve[0].body.resolved.trustId).toBe(trust.trustId);
    expect(callsResolve[0].body.resolved.expiresAt).toBeTruthy();

    // 4. GET active: should list the approved trust
    const { deps: depsActive, jsonCalls: callsActive } = buildMockDeps();
    const urlActive = new URL(`http://localhost/api/v2/workspace/temporary-directory-trusts/active?workspaceId=${workspaceId}`);
    await routeService.handleRequest({ method: 'GET' } as any, {} as any, urlActive, urlActive.pathname, depsActive as any);
    expect(callsActive[0].status).toBe(200);
    expect(callsActive[0].body.trusts).toHaveLength(1);
    // Response must not expose absolute path
    const activeTrust = callsActive[0].body.trusts[0];
    expect(activeTrust.rootSuffix).toBeDefined();
    expect(activeTrust.allowedOperations).toEqual(['filesystem.read', 'filesystem.write']);

    // 5. POST revoke
    const { deps: depsRevoke, jsonCalls: callsRevoke } = buildMockDeps(async () => ({
      workspaceId,
      trustId: trust.trustId,
    }));
    const urlRevoke = new URL('http://localhost/api/v2/workspace/temporary-directory-trusts/revoke');
    await routeService.handleRequest({ method: 'POST' } as any, {} as any, urlRevoke, urlRevoke.pathname, depsRevoke as any);
    expect(callsRevoke[0].status).toBe(200);
    expect(callsRevoke[0].body.ok).toBe(true);

    // 6. GET active after revoke: should be empty
    const { deps: depsActiveAfter, jsonCalls: callsActiveAfter } = buildMockDeps();
    await routeService.handleRequest({ method: 'GET' } as any, {} as any, urlActive, urlActive.pathname, depsActiveAfter as any);
    expect(callsActiveAfter[0].body.trusts).toHaveLength(0);
  });

  // ── Deny flow ─────────────────────────────────────────────────────────────

  it('deny resolve clears pending and does not create active trust', async () => {
    const trust = service.proposeTrust(workspaceId, tempTrustTargetDir, ['filesystem.read']);

    const { deps, jsonCalls } = buildMockDeps(async () => ({
      workspaceId,
      trustId: trust.trustId,
      approved: false,
    }));
    const urlResolve = new URL('http://localhost/api/v2/workspace/temporary-directory-trusts/resolve');
    await routeService.handleRequest({ method: 'POST' } as any, {} as any, urlResolve, urlResolve.pathname, deps as any);
    expect(jsonCalls[0].status).toBe(200);
    expect(jsonCalls[0].body.resolved).toBeNull();

    // No active trusts
    expect(service.getActiveTrusts(workspaceId)).toHaveLength(0);
    // Proposed is cleared
    expect(service.getProposedTrust(workspaceId)).toBeNull();
  });

  // ── Absolute path must not be exposed in API responses ────────────────────

  it('does not expose absolute path in pending or active responses', async () => {
    const trust = service.proposeTrust(workspaceId, tempTrustTargetDir, ['filesystem.read']);

    // GET pending
    const { deps: depsPending, jsonCalls: callsPending } = buildMockDeps();
    const urlPending = new URL(`http://localhost/api/v2/workspace/temporary-directory-trusts/pending?workspaceId=${workspaceId}`);
    await routeService.handleRequest({ method: 'GET' } as any, {} as any, urlPending, urlPending.pathname, depsPending as any);
    const pendingBody = JSON.stringify(callsPending[0].body);
    expect(pendingBody).not.toContain(tempTrustTargetDir);

    // Approve and check active
    service.resolveTrust(workspaceId, trust.trustId, true);

    const { deps: depsActive, jsonCalls: callsActive } = buildMockDeps();
    const urlActive = new URL(`http://localhost/api/v2/workspace/temporary-directory-trusts/active?workspaceId=${workspaceId}`);
    await routeService.handleRequest({ method: 'GET' } as any, {} as any, urlActive, urlActive.pathname, depsActive as any);
    const activeBody = JSON.stringify(callsActive[0].body);
    expect(activeBody).not.toContain(tempTrustTargetDir);
  });

  // ── Validation: missing required fields ────────────────────────────────────

  it('returns 400 when trustId is missing in resolve body', async () => {
    const { deps, jsonCalls } = buildMockDeps(async () => ({ workspaceId, approved: true }));
    const req = { method: 'POST' } as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    const url = new URL('http://localhost/api/v2/workspace/temporary-directory-trusts/resolve');

    await routeService.handleRequest(req, res, url, url.pathname, deps as any);
    expect(jsonCalls[0].status).toBe(400);
    expect(jsonCalls[0].body.error).toContain('trustId');
  });

  it('returns 400 when trustId is missing in revoke body', async () => {
    const { deps, jsonCalls } = buildMockDeps(async () => ({ workspaceId }));
    const req = { method: 'POST' } as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    const url = new URL('http://localhost/api/v2/workspace/temporary-directory-trusts/revoke');

    await routeService.handleRequest(req, res, url, url.pathname, deps as any);
    expect(jsonCalls[0].status).toBe(400);
    expect(jsonCalls[0].body.error).toContain('trustId');
  });
});
