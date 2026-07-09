import { ToolRegistry } from '../../src/tools/ToolRegistry.js';
import { McpClientManager } from '../../src/mcp/McpClientManager.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { TemporaryDirectoryTrustService } from '../../src/services/TemporaryDirectoryTrustService.js';
import { WorkspaceTaskMandateService } from '../../src/services/WorkspaceTaskMandateService.js';

describe('Temporary Directory Trust MCP E2E Integration', () => {
  let tempWorkspace: string;
  let tempExternalDir: string;
  let activeManagers: McpClientManager[];
  let originalEnv: NodeJS.ProcessEnv;
  // WorkspaceResolver.resolve(workspaceId) treats the id as a filesystem path when no alias exists.
  // Use the real temp workspace path as the session/workspace id so path checks do not ENOENT.
  let workspaceId: string;

  beforeEach(() => {
    jest.setTimeout(120000);
    originalEnv = { ...process.env };
    activeManagers = [];

    // Create a temporary directory for the workspace root
    tempWorkspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-workspace-')));
    // Create an approved external directory
    tempExternalDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-external-')));
    workspaceId = tempWorkspace;

    process.env.ZAVORTH_WORKSPACE_ROOT = tempWorkspace;
    process.env.ZAVORTH_WORKSPACE_SESSION_ID = workspaceId;
    // Ensure path resolution anchors to the real temp workspace, not the repo root.
    process.env.ZAVORTH_ALLOWED_WORKSPACES = tempWorkspace;
  });

  afterEach(async () => {
    process.env = { ...originalEnv };

    for (const manager of activeManagers) {
      try {
        await manager.disconnect();
      } catch {
        // ignore
      }
    }

    try {
      fs.rmSync(tempWorkspace, { recursive: true, force: true });
    } catch {}
    try {
      fs.rmSync(tempExternalDir, { recursive: true, force: true });
    } catch {}
  });

  it('runs E2E filesystem operations inside and outside the approved external directory', async () => {
    // 1. Propose and approve a trust in the parent process to serialize it
    const svc = TemporaryDirectoryTrustService.getInstance();
    const trust = svc.proposeTrust(
      workspaceId,
      tempExternalDir,
      ['filesystem.read', 'filesystem.write', 'filesystem.mkdir'],
      'user-selected-external',
      60
    );
    const approvedTrust = svc.resolveTrust(workspaceId, trust.trustId, true)!;

    // Serialize active trusts
    const activeTrusts = [approvedTrust];
    const envVal = JSON.stringify(activeTrusts);

    // Spawn MCP server subprocess, passing the serialized trust env
    const registry = new ToolRegistry();
    const serverScript = path.resolve('src/mcp/workspace/WorkspaceMcpServer.ts');
    const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

    const manager = new McpClientManager(
      'workspace',
      npxCmd,
      ['tsx', serverScript],
      {
        ZAVORTH_WORKSPACE_ROOT: tempWorkspace,
        ZAVORTH_WORKSPACE_SESSION_ID: workspaceId,
        ZAVORTH_ACTIVE_TEMP_TRUSTS: envVal,
      },
      ['PATH']
    );
    activeManagers.push(manager);

    await manager.connect(registry);

    const readTool = registry.getTool('workspace_filesystem_read')!;
    const writeTool = registry.getTool('workspace_filesystem_write')!;
    const mkdirTool = registry.getTool('workspace_filesystem_mkdir')!;

    // A. Read/Write/Mkdir inside the approved external directory is PERMITTED
    // Resolve external paths relative to workspace root (so it's resolved outside)
    const relativeExternal = path.relative(tempWorkspace, tempExternalDir);

    // 1. Mkdir inside external dir
    const targetDir = path.join(relativeExternal, 'new-folder').replace(/\\/g, '/');
    const mkdirRes = await mkdirTool.execute({ directory: targetDir });
    expect(mkdirRes).toBe('Directory created successfully.');
    expect(fs.existsSync(path.join(tempExternalDir, 'new-folder'))).toBe(true);

    // 2. Write file inside external dir
    const targetFile = path.join(relativeExternal, 'new-folder', 'data.txt').replace(/\\/g, '/');
    const writeRes = await writeTool.execute({
      file: targetFile,
      content: 'hello external world',
    });
    expect(writeRes).toBe('File written successfully.');
    expect(fs.readFileSync(path.join(tempExternalDir, 'new-folder', 'data.txt'), 'utf8')).toBe(
      'hello external world'
    );

    // 3. Read file inside external dir
    const readRes = await readTool.execute({ file: targetFile });
    expect(readRes).toBe('hello external world');

    // B. Read/Write/Mkdir OUTSIDE the approved external directory (without approvalId) is BLOCKED
    const outsideUnapprovedDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-unapproved-')));
    const relativeOutside = path.relative(tempWorkspace, outsideUnapprovedDir);

    const targetFileOutside = path.join(relativeOutside, 'blocked.txt').replace(/\\/g, '/');
    const writeOutsideRes = await writeTool.execute({
      file: targetFileOutside,
      content: 'blocked',
    });
    // Should ask for approval or fail traversal
    expect(writeOutsideRes).toContain('Path traversal detected or path outside workspace');

    const targetDirOutside = path.join(relativeOutside, 'blocked-folder').replace(/\\/g, '/');
    const mkdirOutsideRes = await mkdirTool.execute({
      directory: targetDirOutside,
    });
    expect(mkdirOutsideRes).toContain('Path traversal detected or path outside workspace');

    try {
      fs.rmSync(outsideUnapprovedDir, { recursive: true, force: true });
    } catch {}

    // C. .env/.pem/.key/.git inside external directory are strictly BLOCKED
    const envFile = path.join(relativeExternal, '.env').replace(/\\/g, '/');
    const writeEnvRes = await writeTool.execute({
      file: envFile,
      content: 'SECRET=123',
    });
    expect(writeEnvRes).toContain('blocked');

    // D. Null byte payload is BLOCKED
    const targetNull = path.join(relativeExternal, 'null.txt').replace(/\\/g, '/');
    const writeNullRes = await writeTool.execute({
      file: targetNull,
      content: 'hello\x00world',
    });
    expect(writeNullRes).toContain('Binary content is not allowed');

    // E. Payload above limit (256KB) is BLOCKED
    const targetLarge = path.join(relativeExternal, 'large.txt').replace(/\\/g, '/');
    const largeContent = 'a'.repeat(257 * 1024);
    const writeLargeRes = await writeTool.execute({
      file: targetLarge,
      content: largeContent,
    });
    expect(writeLargeRes).toContain('Content exceeds maximum limit');
  }, 120000);
});
