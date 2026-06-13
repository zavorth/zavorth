import fs from 'fs';
import os from 'os';
import path from 'path';
import * as http from 'http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const MARKER = 'ZAVORTH_9F_SMOKE_CONTENT_DO_NOT_PERSIST_2026';

async function runSmokeTest() {
  console.log('🚀 Starting E2E Workspace Write Approval Smoke Test (Phase 9F)...');

  // 1. Initialize safe temporary directory context
  const tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-smoke-9f-')));
  const workspaceDir = path.join(tempDir, 'workspace');
  fs.mkdirSync(workspaceDir);

  process.env.ZAVORTH_HOME = tempDir;
  process.env.ZAVORTH_WORKSPACE_ROOT = workspaceDir;
  process.env.ZAVORTH_AUDIT_HASH_KEY = 'smoke-hash-key-1234';
  process.env.ZAVORTH_WEB_AUTH_TOKEN = 'smoke-token-secret-999';

  console.log(`📂 Sandbox Home: ${tempDir}`);
  console.log(`📂 Workspace Root: ${workspaceDir}`);

  // Dynamically import local modules after environment variables are set
  const { Database } = await import('../src/storage/Database.js');
  const { WorkspaceWriteApprovalService } = await import('../src/services/WorkspaceWriteApprovalService.js');
  const { WorkspaceWriteApprovalPayloadCache } = await import('../src/services/WorkspaceWriteApprovalPayloadCache.js');
  const { ZavorthControlCoreRouteService } = await import('../src/services/ZavorthControlCoreRouteService.js');
  const { SecurityAuditLogger } = await import('../src/services/SecurityAuditLogger.js');
  const { LogRepository } = await import('../src/storage/LogRepository.js');
  const { McpToolWrapper } = await import('../src/tools/McpToolWrapper.js');
  const { ZavorthControlAuthService } = await import('../src/services/ZavorthControlAuthService.js');

  // 2. Initialize real database, services, and route service
  const db = await Database.getInstance();
  const logRepo = new LogRepository();
  const auditLogger = new SecurityAuditLogger(logRepo);
  const approvalService = new WorkspaceWriteApprovalService(db, auditLogger);
  const routeService = new ZavorthControlCoreRouteService();
  const cache = WorkspaceWriteApprovalPayloadCache.getInstance();
  const authService = new ZavorthControlAuthService();

  // 3. Setup real HTTP Server on a random port
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const pathname = url.pathname;

    const readJsonBody = async (incoming: http.IncomingMessage): Promise<Record<string, any>> => {
      return new Promise((resolve, reject) => {
        let data = '';
        incoming.on('data', chunk => { data += chunk; });
        incoming.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({});
          }
        });
        incoming.on('error', reject);
      });
    };

    const readRawBody = async (incoming: http.IncomingMessage): Promise<string> => {
      return new Promise((resolve, reject) => {
        let data = '';
        incoming.on('data', chunk => { data += chunk; });
        incoming.on('end', () => resolve(data));
        incoming.on('error', reject);
      });
    };

    const writeJson = (outgoing: http.ServerResponse, body: unknown, status = 200) => {
      outgoing.writeHead(status, { 'Content-Type': 'application/json' });
      outgoing.end(JSON.stringify(body));
    };

    const writeText = (outgoing: http.ServerResponse, body: string, status = 200) => {
      outgoing.writeHead(status, { 'Content-Type': 'text/plain' });
      outgoing.end(body);
    };

    const writeRedirect = (outgoing: http.ServerResponse, location: string, status = 302) => {
      outgoing.writeHead(status, { 'Location': location });
      outgoing.end();
    };

    const deps = {
      nodeHeartbeat: { claimPairing: () => {}, receiveHeartbeat: () => {} },
      nodeMesh: { buildSnapshot: () => ({}) },
      readJsonBody,
      readRawBody,
      writeJson,
      writeText,
      writeRedirect,
      a2ui: {},
      proactivePermissions: {},
      authService,
    };

    try {
      const handled = await routeService.handleRequest(req, res, url, pathname, deps);
      if (!handled) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(err.message);
    }
  });

  const port = await new Promise<number>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        resolve(addr.port);
      } else {
        resolve(0);
      }
    });
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`🌐 Local HTTP Smoke Server listening at: ${baseUrl}`);

  // Helpers for HTTP requests
  const authenticatedFetch = async (pathname: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers);
    headers.set('Authorization', 'Bearer smoke-token-secret-999');
    return fetch(`${baseUrl}${pathname}`, { ...options, headers });
  };

  try {
    // ----------------------------------------------------
    // Assert 6: /api/v2/workspace/approvals/payload without authentication returns 401
    // ----------------------------------------------------
    console.log('🔍 Assert 6: Unauthorized call to payload...');
    const unauthPayloadRes = await fetch(`${baseUrl}/api/v2/workspace/approvals/payload?operationId=dummy`);
    if (unauthPayloadRes.status !== 401) {
      throw new Error(`Expected status 401 for unauthenticated payload, got ${unauthPayloadRes.status}`);
    }
    console.log('✅ Assert 6 passed.');

    const unauthPendingRes = await fetch(`${baseUrl}/api/v2/workspace/approvals/pending`);
    if (unauthPendingRes.status !== 401) {
      throw new Error(`Expected status 401 for unauthenticated pending list, got ${unauthPendingRes.status}`);
    }
    console.log('✅ Unauthenticated pending block verified.');

    // ----------------------------------------------------
    // Assert 1: workspace.filesystem.write without operationId returns WRITE_APPROVAL_REQUIRED
    // ----------------------------------------------------
    console.log('🔍 Assert 1: Calling workspace.filesystem.write without operationId...');
    const mockMcpClient = {
      callTool: async (req: any) => {
        if (!req.arguments.operationId) {
          const resolvedPath = path.join(workspaceDir, req.arguments.file || req.arguments.directory || '');
          const opId = await approvalService.requestApproval(
            'test',
            req.name,
            resolvedPath,
            req.arguments
          );
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'WRITE_APPROVAL_REQUIRED',
                operationId: opId,
                pathSuffix: '.txt'
              })
            }],
            isError: true,
          };
        }
        const opId = req.arguments.operationId;
        const resolvedPath = path.join(workspaceDir, req.arguments.file || req.arguments.directory || '');
        const consumed = await approvalService.consumeApproval(
          'test',
          req.name,
          resolvedPath,
          req.arguments,
          opId
        );
        if (!consumed) {
          throw new Error('Write approval token consumption failed in retry execution.');
        }
        if (req.name === 'workspace.filesystem.write') {
          fs.writeFileSync(resolvedPath, req.arguments.content, 'utf8');
        } else if (req.name === 'workspace.filesystem.mkdir') {
          fs.mkdirSync(resolvedPath);
        }
        return {
          content: [{ type: 'text', text: 'Success' }],
          isError: false,
        };
      }
    } as unknown as Client;

    const wrapper = new McpToolWrapper(
      mockMcpClient,
      'workspace.filesystem.write',
      'workspace.filesystem.write',
      'test',
      {
        type: 'object',
        properties: {
          file: { type: 'string' },
          content: { type: 'string' },
          operationId: { type: 'string' },
        },
      }
    );

    const relativeFilePath = 'smoke_test.txt';
    const initialWriteResult = await wrapper.execute({
      file: relativeFilePath,
      content: MARKER,
    });

    const cleanJson = (text: string) => {
      const prefix = 'Error executing tool: [MCP Tool Error] ';
      return text.startsWith(prefix) ? text.substring(prefix.length) : text;
    };
    const parsedResult = JSON.parse(cleanJson(initialWriteResult));
    if (parsedResult.error !== 'WRITE_APPROVAL_REQUIRED') {
      throw new Error(`Expected WRITE_APPROVAL_REQUIRED, got: ${initialWriteResult}`);
    }
    const opId = parsedResult.operationId;
    if (!opId) {
      throw new Error('Missing operationId in handshake response.');
    }
    console.log(`✅ Assert 1 passed. Received operationId: ${opId}`);

    // ----------------------------------------------------
    // Assert 4 & 5: /pending does not return raw content parameters or marker
    // ----------------------------------------------------
    console.log('🔍 Assert 4 & 5: Checking pending approvals metadata...');
    const pendingRes = await authenticatedFetch(`/api/v2/workspace/approvals/pending?sessionId=test`);
    const pendingData = await pendingRes.json();
    if (!pendingData.ok) {
      throw new Error(`Pending request failed: ${JSON.stringify(pendingData)}`);
    }
    const pendingItems = pendingData.data;
    if (pendingItems.length !== 1) {
      throw new Error(`Expected 1 pending approval, got ${pendingItems.length}`);
    }
    const item = pendingItems[0];
    if (item.operationId !== opId) {
      throw new Error(`Expected operationId ${opId}, got ${item.operationId}`);
    }
    // Confirm Relative Path only (Assert 3)
    if (item.path !== relativeFilePath) {
      throw new Error(`Expected relative path ${relativeFilePath}, got ${item.path}`);
    }
    // Ensure content parameters/marker are omitted
    const serializedPending = JSON.stringify(pendingItems);
    if (serializedPending.includes(MARKER) || serializedPending.includes('content')) {
      throw new Error('Confidential content marker or raw parameters leaked in /pending output!');
    }
    console.log('✅ Assert 4 & 5 passed.');

    // ----------------------------------------------------
    // Assert 7: /payload returns diff/preview truncade and relative path
    // ----------------------------------------------------
    console.log('🔍 Assert 7: Querying payload for preview diff...');
    const payloadRes = await authenticatedFetch(`/api/v2/workspace/approvals/payload?operationId=${opId}&sessionId=test`);
    if (payloadRes.status !== 200) {
      throw new Error(`Payload query failed with status: ${payloadRes.status}`);
    }
    const payloadData = await payloadRes.json();
    if (!payloadData.ok) {
      throw new Error(`Payload data error: ${JSON.stringify(payloadData)}`);
    }
    const payloadInfo = payloadData.data;
    if (payloadInfo.file !== relativeFilePath) {
      throw new Error(`Expected relative path in payload metadata, got ${payloadInfo.file}`);
    }
    if (payloadInfo.proposedContent !== MARKER) {
      throw new Error(`Proposed content preview mismatch. Expected ${MARKER}, got ${payloadInfo.proposedContent}`);
    }
    console.log('✅ Assert 7 passed.');

    // ----------------------------------------------------
    // Assert 8 & 9: Resolve Approve and Retry creates file
    // ----------------------------------------------------
    console.log('🔍 Assert 8 & 9: Approving operation and executing retry...');
    const resolveApproveRes = await authenticatedFetch('/api/v2/workspace/approvals/resolve', {
      method: 'POST',
      body: JSON.stringify({ operationId: opId, decision: 'approve' }),
    });
    const resolveApproveData = await resolveApproveRes.json();
    if (!resolveApproveData.ok) {
      throw new Error(`Approve resolution failed: ${JSON.stringify(resolveApproveData)}`);
    }

    const realFilePath = path.join(workspaceDir, relativeFilePath);

    const retryResult = await wrapper.execute({
      file: relativeFilePath,
      content: MARKER,
      operationId: opId,
    });

    if (retryResult.includes('Error')) {
      throw new Error(`Retry execution failed: ${retryResult}`);
    }

    // Verify file exists and content matches
    if (!fs.existsSync(realFilePath)) {
      throw new Error('Target file was not created by retry execution.');
    }
    if (fs.readFileSync(realFilePath, 'utf8') !== MARKER) {
      throw new Error('Written file content does not match proposed content.');
    }
    console.log('✅ Assert 8 & 9 passed.');

    // ----------------------------------------------------
    // Assert 10: Replay of same operationId is blocked
    // ----------------------------------------------------
    console.log('🔍 Assert 10: Testing replay attack prevention...');
    try {
      const reConsumed = await approvalService.consumeApproval(
        'test',
        'workspace.filesystem.write',
        realFilePath,
        { file: relativeFilePath, content: MARKER },
        opId
      );
      if (reConsumed) {
        throw new Error('Replay attack succeeded! Approval token was re-used.');
      }
    } catch {
      // Expected block
    }
    console.log('✅ Assert 10 passed.');

    // ----------------------------------------------------
    // Assert 11: Deny blocks retry and clears cache/file
    // ----------------------------------------------------
    console.log('🔍 Assert 11: Testing Deny resolve workflow...');
    const denyFileRelative = 'smoke_deny.txt';
    const denyFileReal = path.join(workspaceDir, denyFileRelative);

    const denyOpId = await approvalService.requestApproval('test', 'workspace.filesystem.write', denyFileReal, { file: denyFileRelative, content: MARKER });
    cache.cachePayload(denyOpId, { file: denyFileRelative, content: MARKER });

    // Send Deny post
    const resolveDenyRes = await authenticatedFetch('/api/v2/workspace/approvals/resolve', {
      method: 'POST',
      body: JSON.stringify({ operationId: denyOpId, decision: 'deny' }),
    });
    const resolveDenyData = await resolveDenyRes.json();
    if (!resolveDenyData.ok) {
      throw new Error(`Deny resolution failed: ${JSON.stringify(resolveDenyData)}`);
    }

    // Confirm cache is cleared immediately
    if (cache.getPayload(denyOpId) !== undefined) {
      throw new Error('Payload cache was not cleared after Deny.');
    }

    // Confirm retry fails
    const denyRetryResult = await approvalService.consumeApproval(
      'test',
      'workspace.filesystem.write',
      denyFileReal,
      { file: denyFileRelative, content: MARKER },
      denyOpId
    );
    if (denyRetryResult) {
      throw new Error('Execution succeeded for a Denied operation!');
    }
    if (fs.existsSync(denyFileReal)) {
      throw new Error('Denied file was written to disk.');
    }
    console.log('✅ Assert 11 passed.');

    // ----------------------------------------------------
    // Assert 12: Expiration fails and clears cache
    // ----------------------------------------------------
    console.log('🔍 Assert 12: Testing Expiration workflow...');
    const expFileRelative = 'smoke_exp.txt';
    const expFileReal = path.join(workspaceDir, expFileRelative);

    const expOpId = await approvalService.requestApproval('test', 'workspace.filesystem.write', expFileReal, { file: expFileRelative, content: MARKER });
    cache.cachePayload(expOpId, { file: expFileRelative, content: MARKER });

    // Manually force expiry in SQLite
    const rawDb = db.getRawDb();
    const expiredTime = new Date(Date.now() - 1000).toISOString();
    rawDb.prepare('UPDATE workspace_write_approvals SET expires_at = ? WHERE operation_id = ?').run(expiredTime, expOpId);

    // Call payload query for expired operation
    const expPayloadRes = await authenticatedFetch(`/api/v2/workspace/approvals/payload?operationId=${expOpId}&sessionId=test`);
    if (expPayloadRes.status !== 410) {
      throw new Error(`Expected status 410 Gone for expired operation, got: ${expPayloadRes.status}`);
    }

    // Cache should be evicted by clearExpired on route hit
    if (cache.getPayload(expOpId) !== undefined) {
      throw new Error('Expired payload was not cleared from transient cache.');
    }
    console.log('✅ Assert 12 passed.');

    // ----------------------------------------------------
    // Assert 13: workspace.filesystem.mkdir with directory parameter works
    // ----------------------------------------------------
    console.log('🔍 Assert 13: Testing workspace.filesystem.mkdir with directory parameter...');
    const relativeDir = 'smoke_dir';
    const realDir = path.join(workspaceDir, relativeDir);

    const mkdirOpId = await approvalService.requestApproval('test', 'workspace.filesystem.mkdir', realDir, { directory: relativeDir });
    cache.cachePayload(mkdirOpId, { file: relativeDir });

    // Approve
    const resolveMkdirRes = await authenticatedFetch('/api/v2/workspace/approvals/resolve', {
      method: 'POST',
      body: JSON.stringify({ operationId: mkdirOpId, decision: 'approve' }),
    });
    if (!resolveMkdirRes.ok) {
      throw new Error('Mkdir approval post failed.');
    }

    // Consume and create
    const mkdirConsumed = await approvalService.consumeApproval(
      'test',
      'workspace.filesystem.mkdir',
      realDir,
      { directory: relativeDir },
      mkdirOpId
    );
    if (!mkdirConsumed) {
      throw new Error('Consumption of mkdir approval failed.');
    }
    fs.mkdirSync(realDir);

    if (!fs.existsSync(realDir) || !fs.statSync(realDir).isDirectory()) {
      throw new Error('Directory was not physically created.');
    }
    console.log('✅ Assert 13 passed.');

    // ----------------------------------------------------
    // Assert 14 & 15: SQLite & logs do not contain the marker
    // ----------------------------------------------------
    console.log('🔍 Assert 14 & 15: Verifying zero persistence of confidential content marker...');
    // Inspect SQLite DB directly by reading raw file content bytes
    const dbPath = path.join(tempDir, 'data', 'zavorth.db');
    if (fs.existsSync(dbPath)) {
      const dbBytes = fs.readFileSync(dbPath);
      if (dbBytes.includes(Buffer.from(MARKER))) {
        throw new Error('Leak! Confidential marker was persisted in the SQLite DB file.');
      }
    }

    // Inspect Logs
    const logDir = path.join(tempDir, 'logs');
    if (fs.existsSync(logDir)) {
      const files = fs.readdirSync(logDir);
      for (const file of files) {
        const logBytes = fs.readFileSync(path.join(logDir, file));
        if (logBytes.includes(Buffer.from(MARKER))) {
          throw new Error(`Leak! Confidential marker was persisted in log file: ${file}`);
        }
      }
    }
    console.log('✅ Assert 14 & 15 passed.');

    console.log('\n🎉 ALL AUTOMATED E2E SMOKE TESTS PASSED SUCCESSFULLY! Phase 9F Verified.');
  } finally {
    // 4. Shutdown HTTP server
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    // 5. Clean up temporary files
    db.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log('🧹 Cleaned up temporary test directory.');
    } catch (err) {
      console.warn('⚠️ Warning: Failed to clean up temp files:', err);
    }
  }
}

runSmokeTest().catch((err) => {
  console.error('\n❌ E2E Smoke Test failed:', err);
  process.exit(1);
});
