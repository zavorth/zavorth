import { ToolRegistry } from '../../src/tools/ToolRegistry.js';
import { McpClientManager } from '../../src/mcp/McpClientManager.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';

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
});
