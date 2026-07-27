import fs from 'fs';
import os from 'os';
import path from 'path';
import * as http from 'http';
import { Database } from '../../../src/storage/Database.js';
import { WorkspaceWriteApprovalService } from '../../../src/services/WorkspaceWriteApprovalService.js';
import { WorkspaceWriteApprovalPayloadCache } from '../../../src/services/WorkspaceWriteApprovalPayloadCache.js';
import { ZavorthControlCoreRouteService } from '../../../src/services/ZavorthControlCoreRouteService.js';
import { SecurityAuditLogger } from '../../../src/services/SecurityAuditLogger.js';
import { LogRepository } from '../../../src/storage/LogRepository.js';
import { McpToolWrapper } from '../../../src/tools/McpToolWrapper.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { config } from '../../../src/config/index.js';

describe('WorkspaceWriteApproval Integration Tests', () => {
  let tempDir: string;
  let db: Database;
  let auditLogger: SecurityAuditLogger;
  let service: WorkspaceWriteApprovalService;
  let routeService: ZavorthControlCoreRouteService;
  let cache: WorkspaceWriteApprovalPayloadCache;

  beforeEach(async () => {
    tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-approval-modal-test-')));
    process.env.ZAVORTH_HOME = tempDir;
    process.env.ZAVORTH_AUDIT_HASH_KEY = 'test-hash-key-123';
    process.env.ZAVORTH_WORKSPACE_ROOT = tempDir;
    fs.mkdirSync(path.join(tempDir, 'data'), { recursive: true });
    config.dbPath = path.join(tempDir, 'data', 'zavorth.db');

    db = await Database.getInstance();
    auditLogger = new SecurityAuditLogger(new LogRepository());
    service = new WorkspaceWriteApprovalService(db, auditLogger);
    routeService = new ZavorthControlCoreRouteService();
    cache = WorkspaceWriteApprovalPayloadCache.getInstance();
    cache.clearAll();
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

  // Helper to build mocked route dependencies
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

  // 1. Isolate payload cache
  it('verifies that WorkspaceWriteApprovalService and MCP server do not import the payload cache', () => {
    const serviceSrcPath = path.resolve('src/services/WorkspaceWriteApprovalService.ts');
    const mcpServerSrcPath = path.resolve('src/mcp/workspace/WorkspaceMcpServer.ts');

    const serviceSrc = fs.readFileSync(serviceSrcPath, 'utf8');
    const mcpServerSrc = fs.readFileSync(mcpServerSrcPath, 'utf8');

    expect(serviceSrc).not.toContain('WorkspaceWriteApprovalPayloadCache');
    expect(mcpServerSrc).not.toContain('WorkspaceWriteApprovalPayloadCache');
  });

  // 2. No content in /pending
  it('verifies that the /pending endpoint returns metadata only and no proposed content', async () => {
    const workspaceId = 'ws-test-1';
    const toolName = 'workspace.filesystem.write';
    const resolvedPath = path.join(tempDir, 'file.txt');
    const args = { file: 'file.txt', content: 'confidential code content' };

    const opId = await service.requestApproval(workspaceId, toolName, resolvedPath, args);
    cache.cachePayload(opId, { file: 'file.txt', content: args.content });

    const { deps, jsonCalls } = buildMockDeps();
    const url = new URL(`http://localhost/api/v2/workspace/approvals/pending-sessionId=${workspaceId}`);
    const handled = await routeService.handleRequest(
      { method: 'GET', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      url,
      '/api/v2/workspace/approvals/pending',
      deps
    );

    expect(handled).toBe(true);
    expect(jsonCalls[0].status).toBe(200);
    expect(jsonCalls[0].body.ok).toBe(true);

    const items = jsonCalls[0].body.data;
    expect(items.length).toBe(1);
    expect(items[0].operationId).toBe(opId);
    expect(items[0].path).toBe('file.txt');
    // Ensure content parameters are omitted
    expect(items[0].content).toBeUndefined();
    expect(items[0].proposedContent).toBeUndefined();
  });

  // 3. Validate /payload expiry
  it('verifies that /payload query fails if operationId has expired', async () => {
    const workspaceId = 'ws-test-1';
    const toolName = 'workspace.filesystem.write';
    const resolvedPath = path.join(tempDir, 'file.txt');
    const args = { file: 'file.txt', content: 'some new text' };

    const opId = await service.requestApproval(workspaceId, toolName, resolvedPath, args);
    cache.cachePayload(opId, { file: 'file.txt', content: args.content });

    // Manually force expiry in DB
    const rawDb = db.getRawDb();
    const expiredTime = new Date(Date.now() - 1000).toISOString();
    rawDb.prepare('UPDATE workspace_write_approvals SET expires_at = - WHERE operation_id = -').run(expiredTime, opId);

    const { deps, jsonCalls } = buildMockDeps();
    const url = new URL(`http://localhost/api/v2/workspace/approvals/payload-operationId=${opId}&sessionId=${workspaceId}`);
    const handled = await routeService.handleRequest(
      { method: 'GET', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      url,
      '/api/v2/workspace/approvals/payload',
      deps
    );

    expect(handled).toBe(true);
    expect(jsonCalls[0].status).toBe(410); // Gone
    expect(jsonCalls[0].body.ok).toBe(false);
    expect(jsonCalls[0].body.error).toContain('expired');
  });

  // 4. Validate /payload presence
  it('verifies that /payload fails if payload has been cleared from transient memory cache', async () => {
    const workspaceId = 'ws-test-1';
    const toolName = 'workspace.filesystem.write';
    const resolvedPath = path.join(tempDir, 'file.txt');
    const args = { file: 'file.txt', content: 'some new text' };

    const opId = await service.requestApproval(workspaceId, toolName, resolvedPath, args);
    // Specifically NOT caching the payload (or caching and clearing it)
    cache.cachePayload(opId, { file: 'file.txt', content: args.content });
    cache.clearPayload(opId);

    const { deps, jsonCalls } = buildMockDeps();
    const url = new URL(`http://localhost/api/v2/workspace/approvals/payload-operationId=${opId}&sessionId=${workspaceId}`);
    const handled = await routeService.handleRequest(
      { method: 'GET', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      url,
      '/api/v2/workspace/approvals/payload',
      deps
    );

    expect(handled).toBe(true);
    expect(jsonCalls[0].status).toBe(404);
    expect(jsonCalls[0].body.ok).toBe(false);
    expect(jsonCalls[0].body.error).toContain('not found in transient cache');
  });

  // 5. Cleanup on Deny
  it('verifies that deny resolve action clears the cache payload immediately', async () => {
    const workspaceId = 'ws-test-1';
    const toolName = 'workspace.filesystem.write';
    const resolvedPath = path.join(tempDir, 'file.txt');
    const args = { file: 'file.txt', content: 'to be denied' };

    const opId = await service.requestApproval(workspaceId, toolName, resolvedPath, args);
    cache.cachePayload(opId, { file: 'file.txt', content: args.content });

    // Send deny resolution
    const { deps, jsonCalls } = buildMockDeps(async () => ({
      operationId: opId,
      decision: 'deny',
    }));
    const url = new URL('http://localhost/api/v2/workspace/approvals/resolve');
    const handled = await routeService.handleRequest(
      { method: 'POST', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      url,
      '/api/v2/workspace/approvals/resolve',
      deps
    );

    expect(handled).toBe(true);
    expect(jsonCalls[0].status).toBe(200);
    expect(jsonCalls[0].body.ok).toBe(true);

    // Verify cache is cleared
    expect(cache.getPayload(opId)).toBeUndefined();
  });

  // 6. Cleanup on Success (McpToolWrapper retry completes)
  it('verifies that completion of write retry clears the cache payload', async () => {
    const opId = 'write-test-retry-uuid';
    cache.cachePayload(opId, { file: 'file.txt', content: 'retry text' });

    // Mock MCP Client callTool
    const mockMcpClient = {
      callTool: jest.fn(async () => ({
        content: [{ type: 'text', text: 'Success' }],
        isError: false,
      })),
    } as unknown as Client;

    const wrapper = new McpToolWrapper(
      mockMcpClient,
      'workspace.filesystem.write',
      'workspace.filesystem.write',
      'test',
      { type: 'object', properties: {} }
    );

    // Run retry execution
    await wrapper.execute({
      file: 'file.txt',
      content: 'retry text',
      operationId: opId,
    });

    // Verification cache payload got cleared automatically in finally block
    expect(cache.getPayload(opId)).toBeUndefined();
  });

  // 7. Authentication/IPC security
  it('verifies that core route requests without secure authorization are rejected', async () => {
    const { deps, jsonCalls } = buildMockDeps(async () => ({}), false); // authVal = false
    const url = new URL('http://localhost/api/v2/workspace/approvals/pending');
    const handled = await routeService.handleRequest(
      { method: 'GET', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      url,
      '/api/v2/workspace/approvals/pending',
      deps
    );

    expect(handled).toBe(true);
    expect(jsonCalls[0].status).toBe(401);
    expect(jsonCalls[0].body.ok).toBe(false);
    expect(jsonCalls[0].body.error).toContain('Unauthorized');
  });

  // 8. Backend Truncation
  it('verifies that the payload returns content truncated to max 100KB and 1000 lines', async () => {
    const workspaceId = 'ws-test-1';
    const toolName = 'workspace.filesystem.write';
    const resolvedPath = path.join(tempDir, 'file.txt');

    // Create huge content (e.g. 1200 lines and > 100KB)
    const largeLine = 'a'.repeat(150) + '\n';
    const largeContent = largeLine.repeat(1200);

    const opId = await service.requestApproval(workspaceId, toolName, resolvedPath, { file: 'file.txt', content: largeContent });
    cache.cachePayload(opId, { file: 'file.txt', content: largeContent });

    const { deps, jsonCalls } = buildMockDeps();
    const url = new URL(`http://localhost/api/v2/workspace/approvals/payload-operationId=${opId}&sessionId=${workspaceId}`);
    const handled = await routeService.handleRequest(
      { method: 'GET', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      url,
      '/api/v2/workspace/approvals/payload',
      deps
    );

    expect(handled).toBe(true);
    expect(jsonCalls[0].status).toBe(200);
    expect(jsonCalls[0].body.ok).toBe(true);

    const proposed = jsonCalls[0].body.data.proposedContent;
    expect(proposed).toBeDefined();

    // Check line truncation
    const lines = proposed.split('\n');
    expect(lines.length).toBeLessThanOrEqual(1001); // 1000 lines + potential truncate suffix

    // Check size truncation
    expect(Buffer.byteLength(proposed, 'utf8')).toBeLessThanOrEqual(105 * 1024); // roughly 100KB limit
  });

  // 9. Binary Rejection
  it('verifies that proposed binary payload is rejected early', async () => {
    const workspaceId = 'ws-test-1';
    const toolName = 'workspace.filesystem.write';
    const resolvedPath = path.join(tempDir, 'binary_file.bin');

    const opId = await service.requestApproval(workspaceId, toolName, resolvedPath, { file: 'binary_file.bin', content: 'hello' });
    // Cache proposed content with binary null bytes
    cache.cachePayload(opId, { file: 'binary_file.bin', content: 'hello\x00world' });

    const { deps, jsonCalls } = buildMockDeps();
    const url = new URL(`http://localhost/api/v2/workspace/approvals/payload-operationId=${opId}&sessionId=${workspaceId}`);
    const handled = await routeService.handleRequest(
      { method: 'GET', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      url,
      '/api/v2/workspace/approvals/payload',
      deps
    );

    expect(handled).toBe(true);
    expect(jsonCalls[0].status).toBe(400);
    expect(jsonCalls[0].body.ok).toBe(false);
    expect(jsonCalls[0].body.error).toContain('binary');
  });

  it('verifies that current file binary content is rejected early', async () => {
    const workspaceId = 'ws-test-1';
    const toolName = 'workspace.filesystem.write';
    const resolvedPath = path.join(tempDir, 'binary_file.bin');

    // Create target file on disk containing binary null byte
    fs.writeFileSync(resolvedPath, Buffer.from([104, 101, 108, 108, 111, 0, 119, 111, 114, 108, 100])); // "hello\0world"

    const opId = await service.requestApproval(workspaceId, toolName, resolvedPath, { file: 'binary_file.bin', content: 'hello' });
    cache.cachePayload(opId, { file: 'binary_file.bin', content: 'hello' });

    const { deps, jsonCalls } = buildMockDeps();
    const url = new URL(`http://localhost/api/v2/workspace/approvals/payload-operationId=${opId}&sessionId=${workspaceId}`);
    const handled = await routeService.handleRequest(
      { method: 'GET', headers: {} } as http.IncomingMessage,
      {} as http.ServerResponse,
      url,
      '/api/v2/workspace/approvals/payload',
      deps
    );

    expect(handled).toBe(true);
    expect(jsonCalls[0].status).toBe(400);
    expect(jsonCalls[0].body.ok).toBe(false);
    expect(jsonCalls[0].body.error).toContain('binary');
  });
});
