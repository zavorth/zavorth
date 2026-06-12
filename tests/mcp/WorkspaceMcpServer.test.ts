import { ToolRegistry } from '../../src/tools/ToolRegistry.js';
import { McpClientManager } from '../../src/mcp/McpClientManager.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { Database } from '../../src/storage/Database.js';
import { config } from '../../src/config/index.js';

describe('WorkspaceMcpServer E2E Git Read-Only', () => {
  let tempDir: string;
  let activeManagers: McpClientManager[];
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    jest.setTimeout(30000);
    originalEnv = { ...process.env };
    activeManagers = [];

    // Create a temporary directory for the workspace root
    tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-workspace-mcp-test-')));

    // Initialize Git repository
    execSync('git init', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.name "test-user"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: tempDir, stdio: 'ignore' });

    // Create initial commit
    fs.writeFileSync(path.join(tempDir, 'file1.txt'), 'Hello world', 'utf8');
    execSync('git add file1.txt', { cwd: tempDir, stdio: 'ignore' });
    execSync('git commit -m "Initial commit"', { cwd: tempDir, stdio: 'ignore' });

    // Set up environment variables for the spawned server
    process.env.ZAVORTH_WORKSPACE_ROOT = tempDir;
    process.env.ZAVORTH_WORKSPACE_SESSION_ID = 'test-session-id';
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
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('connects to server and registers read-only git tools', async () => {
    const registry = new ToolRegistry();
    const serverScript = path.resolve('src/mcp/workspace/WorkspaceMcpServer.ts');
    const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

    const manager = new McpClientManager(
      'workspace',
      npxCmd,
      ['tsx', serverScript],
      {
        ZAVORTH_WORKSPACE_ROOT: tempDir,
        ZAVORTH_WORKSPACE_SESSION_ID: 'test-session-id',
      },
      ['PATH']
    );
    activeManagers.push(manager);

    await manager.connect(registry);

    // Get all registered tools in the workspace namespace
    const tools = registry.getAllTools();
    const workspaceTools = tools.filter((t) => t.name.startsWith('workspace_git_'));

    // Check that we have exactly the allowed 4 Git read-only tools registered
    expect(workspaceTools).toHaveLength(4);
    const toolNames = workspaceTools.map((t) => t.name);
    expect(toolNames).toContain('workspace_git_status');
    expect(toolNames).toContain('workspace_git_diff');
    expect(toolNames).toContain('workspace_git_log');
    expect(toolNames).toContain('workspace_git_branch');

    // Make sure no write/delete tools exist
    const hasWrite = toolNames.some((n) => n.includes('write') || n.includes('delete') || n.includes('mkdir'));
    expect(hasWrite).toBe(false);
  });

  it('executes status, branch, log and diff tools successfully', async () => {
    const registry = new ToolRegistry();
    const serverScript = path.resolve('src/mcp/workspace/WorkspaceMcpServer.ts');
    const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

    const manager = new McpClientManager(
      'workspace',
      npxCmd,
      ['tsx', serverScript],
      {
        ZAVORTH_WORKSPACE_ROOT: tempDir,
        ZAVORTH_WORKSPACE_SESSION_ID: 'test-session-id',
      },
      ['PATH']
    );
    activeManagers.push(manager);

    await manager.connect(registry);

    // 1. git.status
    const statusTool = registry.getTool('workspace_git_status');
    expect(statusTool).toBeDefined();
    let res = await statusTool!.execute({});
    expect(res).toContain('Working tree clean.');

    // Make file1.txt modified and verify diff
    fs.writeFileSync(path.join(tempDir, 'file1.txt'), 'Modified hello world', 'utf8');
    res = await statusTool!.execute({});
    expect(res).toContain('M file1.txt');

    // 2. git.diff
    const diffTool = registry.getTool('workspace_git_diff');
    expect(diffTool).toBeDefined();
    const diffRes = await diffTool!.execute({ file: 'file1.txt' });
    expect(diffRes).toContain('-Hello world');
    expect(diffRes).toContain('+Modified hello world');

    // Test diff with filename starting with "--" to prevent option injection
    fs.writeFileSync(path.join(tempDir, '--weird-file.txt'), 'Weird hello', 'utf8');
    execSync('git add -- --weird-file.txt', { cwd: tempDir, stdio: 'ignore' });
    fs.writeFileSync(path.join(tempDir, '--weird-file.txt'), 'Weird modified hello', 'utf8');
    const weirdDiffRes = await diffTool!.execute({ file: '--weird-file.txt' });
    expect(weirdDiffRes).toContain('+Weird modified hello');

    // 3. git.log
    const logTool = registry.getTool('workspace_git_log');
    expect(logTool).toBeDefined();
    const logRes = await logTool!.execute({ limit: 5 });
    expect(logRes).toContain('Initial commit');

    // 4. git.branch
    const branchTool = registry.getTool('workspace_git_branch');
    expect(branchTool).toBeDefined();
    const branchRes = await branchTool!.execute({});
    expect(branchRes).toMatch(/master|main/);
  });

  it('fails with controlled error if workspace is not a git repository', async () => {
    // Create a non-git directory
    const nonGitDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-nongit-')));
    process.env.ZAVORTH_WORKSPACE_ROOT = nonGitDir;

    const registry = new ToolRegistry();
    const serverScript = path.resolve('src/mcp/workspace/WorkspaceMcpServer.ts');
    const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

    const manager = new McpClientManager(
      'workspace',
      npxCmd,
      ['tsx', serverScript],
      {
        ZAVORTH_WORKSPACE_ROOT: nonGitDir,
        ZAVORTH_WORKSPACE_SESSION_ID: 'test-session-id',
      },
      ['PATH']
    );
    activeManagers.push(manager);

    await manager.connect(registry);

    const statusTool = registry.getTool('workspace_git_status');
    const result = await statusTool!.execute({});
    expect(result).toContain('Error: The workspace directory is not a Git repository.');

    fs.rmSync(nonGitDir, { recursive: true, force: true });
  });

  it('registers filesystem read, list, and search tools', async () => {
    const registry = new ToolRegistry();
    const serverScript = path.resolve('src/mcp/workspace/WorkspaceMcpServer.ts');
    const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

    const manager = new McpClientManager(
      'workspace',
      npxCmd,
      ['tsx', serverScript],
      {
        ZAVORTH_WORKSPACE_ROOT: tempDir,
        ZAVORTH_WORKSPACE_SESSION_ID: 'test-session-id',
      },
      ['PATH']
    );
    activeManagers.push(manager);

    await manager.connect(registry);

    const readTool = registry.getTool('workspace_filesystem_read');
    const listTool = registry.getTool('workspace_filesystem_list');
    const searchTool = registry.getTool('workspace_filesystem_search');

    expect(readTool).toBeDefined();
    expect(listTool).toBeDefined();
    expect(searchTool).toBeDefined();

    // workspace_filesystem_write and mkdir must be defined
    const writeTool = registry.getTool('workspace_filesystem_write');
    const mkdirTool = registry.getTool('workspace_filesystem_mkdir');
    expect(writeTool).toBeDefined();
    expect(mkdirTool).toBeDefined();
  });

  it('performs filesystem read, list, and search with all validation checks', async () => {
    const registry = new ToolRegistry();
    const serverScript = path.resolve('src/mcp/workspace/WorkspaceMcpServer.ts');
    const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

    const manager = new McpClientManager(
      'workspace',
      npxCmd,
      ['tsx', serverScript],
      {
        ZAVORTH_WORKSPACE_ROOT: tempDir,
        ZAVORTH_WORKSPACE_SESSION_ID: 'test-session-id',
      },
      ['PATH']
    );
    activeManagers.push(manager);

    await manager.connect(registry);

    const readTool = registry.getTool('workspace_filesystem_read')!;
    const listTool = registry.getTool('workspace_filesystem_list')!;
    const searchTool = registry.getTool('workspace_filesystem_search')!;

    // 1. Read small file
    fs.writeFileSync(path.join(tempDir, 'small.txt'), 'hello world from small file', 'utf8');
    let readRes = await readTool.execute({ file: 'small.txt' });
    expect(readRes).toBe('hello world from small file');

    // 2. Reject file > 1MB
    const largeFile = path.join(tempDir, 'large.txt');
    const stream = fs.createWriteStream(largeFile);
    for (let i = 0; i < 110000; i++) {
      stream.write('1234567890\n');
    }
    stream.end();
    await new Promise((resolve) => stream.on('finish', resolve));

    let readLargeRes = await readTool.execute({ file: 'large.txt' });
    expect(readLargeRes).toContain('File size exceeds maximum limit of 1MB');

    // 3. Reject binary file
    const binFile = path.join(tempDir, 'binary.dat');
    fs.writeFileSync(binFile, Buffer.from([0x01, 0x02, 0x00, 0x04]));
    let readBinRes = await readTool.execute({ file: 'binary.dat' });
    expect(readBinRes).toContain('Binary files are not allowed');

    // 4. Reject .env file
    const envFile = path.join(tempDir, '.env');
    fs.writeFileSync(envFile, 'SECRET=1234', 'utf8');
    let readEnvRes = await readTool.execute({ file: '.env' });
    expect(readEnvRes).toContain('Access to sensitive file ".env" is blocked');

    // 5. Reject path traversal
    let readTraversalRes = await readTool.execute({ file: '../outside.txt' });
    expect(readTraversalRes).toContain('Path traversal detected');

    // 6. Symlinks checks (Inner and Outer)
    const outsideFile = path.join(os.tmpdir(), 'outside-test.txt');
    fs.writeFileSync(outsideFile, 'secret contents', 'utf8');

    const linkToOutside = path.join(tempDir, 'out-link.txt');
    const linkToEnv = path.join(tempDir, 'safe-link.txt');

    try {
      fs.symlinkSync(outsideFile, linkToOutside);
      let readLinkOut = await readTool.execute({ file: 'out-link.txt' });
      expect(readLinkOut).toContain('Path traversal detected');
    } catch (e: any) {
      if (e.code !== 'EPERM') throw e;
    } finally {
      try {
        fs.unlinkSync(outsideFile);
      } catch {}
    }

    try {
      fs.symlinkSync(envFile, linkToEnv);
      let readLinkEnv = await readTool.execute({ file: 'safe-link.txt' });
      expect(readLinkEnv).toContain('Access to sensitive file ".env" is blocked');
    } catch (e: any) {
      if (e.code !== 'EPERM') throw e;
    }

    // 7. Directory listing with pruning
    fs.mkdirSync(path.join(tempDir, 'node_modules', 'lodash'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'node_modules', 'lodash', 'index.js'), 'code', 'utf8');
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'src', 'app.ts'), 'console.log()', 'utf8');

    let listRes = await listTool.execute({ directory: '.' });
    expect(listRes).toContain('[DIR]  src');
    expect(listRes).toContain('[FILE] file1.txt');
    expect(listRes).toContain('[FILE] small.txt');
    expect(listRes).not.toContain('node_modules');
    expect(listRes).not.toContain('.git');
    expect(listRes).not.toContain(tempDir.replace(/\\/g, '/'));

    // 8. Search case-insensitive without regex
    let searchRes = await searchTool.execute({ query: 'SMALL' });
    expect(searchRes).toContain('[FOUND] small.txt');
    expect(searchRes).not.toContain('file1.txt');

    let searchAllRes = await searchTool.execute({ query: '.txt' });
    expect(searchAllRes).toContain('[FOUND] file1.txt');
    expect(searchAllRes).toContain('[FOUND] small.txt');
    expect(searchAllRes).not.toContain('node_modules');
  });

  it('performs filesystem write and mkdir with all validation and approval checks', async () => {
    // Force reset database singleton to use the test db path
    config.dbPath = path.join(tempDir, 'data', 'zavorth.db');
    (Database as any).instance = null;
    (Database as any).initPromise = null;

    const registry = new ToolRegistry();
    const serverScript = path.resolve('src/mcp/workspace/WorkspaceMcpServer.ts');
    const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

    const manager = new McpClientManager(
      'workspace',
      npxCmd,
      ['tsx', serverScript],
      {
        ZAVORTH_WORKSPACE_ROOT: tempDir,
        ZAVORTH_WORKSPACE_SESSION_ID: 'test-session-id',
        ZAVORTH_HOME: tempDir,
        ZAVORTH_AUDIT_HASH_KEY: 'test-hash-key-123',
      },
      ['PATH']
    );
    activeManagers.push(manager);

    await manager.connect(registry);

    const writeTool = registry.getTool('workspace_filesystem_write');
    const mkdirTool = registry.getTool('workspace_filesystem_mkdir');

    expect(writeTool).toBeDefined();
    expect(mkdirTool).toBeDefined();

    const parseRes = (text: string) => {
      const prefix = 'Error executing tool: [MCP Tool Error] ';
      const clean = text.startsWith(prefix) ? text.substring(prefix.length) : text;
      return JSON.parse(clean);
    };

    // 1. Write blocks without operationId
    const writeArgs = { file: 'new-file.txt', content: 'hello write world' };
    let res = await writeTool!.execute(writeArgs);
    let json = parseRes(res);
    expect(json.error).toBe('WRITE_APPROVAL_REQUIRED');
    expect(json.operationId).toBeDefined();
    expect(json.pathSuffix).toBe('.txt');

    const opId = json.operationId;

    // Initialize database in parent process
    process.env.ZAVORTH_HOME = tempDir;
    process.env.ZAVORTH_AUDIT_HASH_KEY = 'test-hash-key-123';
    const db = await Database.getInstance();

    // 2. Write blocks with operationId absent after approval blocks (if we don't pass operationId, it asks for a new approval)
    let resNoOp = await writeTool!.execute(writeArgs);
    let jsonNoOp = parseRes(resNoOp);
    expect(jsonNoOp.error).toBe('WRITE_APPROVAL_REQUIRED');
    expect(jsonNoOp.operationId).not.toBe(opId); // it's a new op id

    // 3. Write blocks with incorrect path approval
    // Let's approve the first opId
    db.run('UPDATE workspace_write_approvals SET approved = 1 WHERE operation_id = ?', [opId]);
    // Try to consume the approved opId with a different file path
    let resWrongPath = await writeTool!.execute({ file: 'different-file.txt', content: 'hello write world', operationId: opId });
    expect(resWrongPath).toContain('Write approval has expired or is invalid.');

    // 4. Write blocks with content altered after approval
    let resAltered = await writeTool!.execute({ file: 'new-file.txt', content: 'hello altered world', operationId: opId });
    expect(resAltered).toContain('Write approval has expired or is invalid.');

    // 5. Write blocks with expired approval
    const expiredTime = new Date(Date.now() - 1000).toISOString();
    db.run('UPDATE workspace_write_approvals SET expires_at = ? WHERE operation_id = ?', [expiredTime, opId]);
    let resExpired = await writeTool!.execute({ file: 'new-file.txt', content: 'hello write world', operationId: opId });
    expect(resExpired).toContain('Write approval has expired or is invalid.');

    // 6. Write succeeds with valid approval, consumes atomically and prevents replay
    // Let's request a new approval
    let resReq2 = await writeTool!.execute(writeArgs);
    const opId2 = parseRes(resReq2).operationId;
    // Approve it
    db.run('UPDATE workspace_write_approvals SET approved = 1 WHERE operation_id = ?', [opId2]);
    // Execute write
    let resSuccess = await writeTool!.execute({ file: 'new-file.txt', content: 'hello write world', operationId: opId2 });
    expect(resSuccess).toBe('File written successfully.');
    expect(fs.readFileSync(path.join(tempDir, 'new-file.txt'), 'utf8')).toBe('hello write world');

    // Replay of the same approval blocks
    let resReplay = await writeTool!.execute({ file: 'new-file.txt', content: 'hello write world', operationId: opId2 });
    expect(resReplay).toContain('Write approval has expired or is invalid.');

    // 7. Payload > 256KB blocks
    const hugeContent = 'a'.repeat(257 * 1024);
    let resHuge = await writeTool!.execute({ file: 'huge.txt', content: hugeContent });
    expect(resHuge).toContain('Content exceeds maximum limit of 256KB');

    // 8. Binary content blocks (null-byte)
    let resBin = await writeTool!.execute({ file: 'bin.txt', content: 'hello\x00world' });
    expect(resBin).toContain('Binary content is not allowed');

    // 9. Blocklist enforcement
    let resEnv = await writeTool!.execute({ file: '.env', content: 'SECRET=123' });
    expect(resEnv).toContain('Access to sensitive file ".env" is blocked');

    // 10. Symlink traversal blocks
    // Create outside file
    const outsideFile = path.join(os.tmpdir(), 'outside-write-test.txt');
    fs.writeFileSync(outsideFile, 'safe', 'utf8');
    const linkPath = path.join(tempDir, 'out-link-write.txt');
    try {
      fs.symlinkSync(outsideFile, linkPath);
      let resLink = await writeTool!.execute({ file: 'out-link-write.txt', content: 'hijack' });
      expect(resLink).toContain('Path traversal detected');
    } catch (e: any) {
      if (e.code !== 'EPERM') throw e;
    } finally {
      try {
        fs.unlinkSync(outsideFile);
      } catch {}
    }

    // 11. Parent inexistente blocks
    let resNoParent = await writeTool!.execute({ file: 'nonexistent/file.txt', content: 'hello' });
    expect(resNoParent).toContain('Parent directory does not exist');

    // 12. Mkdir blocks without approval
    let resMkdirReq = await mkdirTool!.execute({ directory: 'newdir' });
    let jsonMkdir = parseRes(resMkdirReq);
    expect(jsonMkdir.error).toBe('WRITE_APPROVAL_REQUIRED');
    expect(jsonMkdir.operationId).toBeDefined();

    const mkdirOpId = jsonMkdir.operationId;

    // 13. Mkdir succeeds with valid approval
    db.run('UPDATE workspace_write_approvals SET approved = 1 WHERE operation_id = ?', [mkdirOpId]);
    let resMkdirSuccess = await mkdirTool!.execute({ directory: 'newdir', operationId: mkdirOpId });
    expect(resMkdirSuccess).toBe('Directory created successfully.');
    expect(fs.existsSync(path.join(tempDir, 'newdir'))).toBe(true);

    // 14. Mkdir recursive/multiple levels blocks
    let resMkdirRec = await mkdirTool!.execute({ directory: 'newdir/level2/level3' });
    expect(resMkdirRec).toContain('Parent directory does not exist');

    // 15. Cross-operation check (mkdir -> write): approval for workspace.filesystem.mkdir cannot be consumed by workspace.filesystem.write
    let resMkdirReq2 = await mkdirTool!.execute({ directory: 'anotherdir' });
    const mkdirOpId2 = parseRes(resMkdirReq2).operationId;
    db.run('UPDATE workspace_write_approvals SET approved = 1 WHERE operation_id = ?', [mkdirOpId2]);

    let resMkdirConsumedByWrite = await writeTool!.execute({
      file: 'anotherdir',
      content: 'hello',
      operationId: mkdirOpId2
    });
    expect(resMkdirConsumedByWrite).toContain('Write approval has expired or is invalid.');

    // 16. Cross-operation check (write -> mkdir): approval for workspace.filesystem.write cannot be consumed by workspace.filesystem.mkdir
    let resWriteReq3 = await writeTool!.execute({ file: 'anotherfile.txt', content: 'hello' });
    const writeOpId3 = parseRes(resWriteReq3).operationId;
    db.run('UPDATE workspace_write_approvals SET approved = 1 WHERE operation_id = ?', [writeOpId3]);

    let resWriteConsumedByMkdir = await mkdirTool!.execute({
      directory: 'anotherfile.txt',
      operationId: writeOpId3
    });
    expect(resWriteConsumedByMkdir).toContain('Write approval has expired or is invalid.');

    // 17. Absent tools
    const deleteTool = registry.getTool('workspace_filesystem_delete');
    expect(deleteTool).toBeUndefined();
    const renameTool = registry.getTool('workspace_filesystem_rename');
    expect(renameTool).toBeUndefined();
    const applypatchTool = registry.getTool('workspace_filesystem_applypatch');
    expect(applypatchTool).toBeUndefined();

    db.close();
  });
});
