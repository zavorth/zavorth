import { McpRuntimeService } from '../../src/mcp/McpRuntimeService.js';
import { ToolRegistry } from '../../src/tools/ToolRegistry.js';
import { McpManifestLoader } from '../../src/mcp/McpManifest.js';
import { McpToolPolicyFileService } from '../../src/services/McpToolPolicyFileService.js';
import { McpClientManager } from '../../src/mcp/McpClientManager.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';

describe('MCP Fixture Server E2E Lifecycle & Sandboxing', () => {
  let tempDir: string;
  let manifestPath: string;
  let policyPath: string;
  let stateFilePath: string;
  let sandboxDir: string;
  let originalEnv: NodeJS.ProcessEnv;
  let activeManagers: McpClientManager[];

  beforeEach(() => {
    jest.setTimeout(30000);
    originalEnv = { ...process.env };
    activeManagers = [];

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mcp-fixture-test-'));
    manifestPath = path.join(tempDir, 'mcp-servers.json');
    policyPath = path.join(tempDir, 'mcp-tool-policy.json');
    stateFilePath = path.join(tempDir, 'mcp-runtime-state.json');

    // Default empty policy doc
    fs.writeFileSync(
      policyPath,
      JSON.stringify(
        {
          version: 1,
          updatedAt: new Date().toISOString(),
          profile: 'safe',
          allowlist: [],
          tools: {},
        },
        null,
        2
      ),
      'utf8'
    );

    // Manifest pointing to local mcp-fixture-server.ts
    // We explicitly define allowedEnv to inherit MCP_FIXTURE_DRIFT from the host environment
    const serverScript = path.resolve('scripts/mcp-fixture-server.ts');
    const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const manifest = [
      {
        id: 'fixture',
        enabled: true,
        command: npxCmd,
        args: ['tsx', serverScript],
        allowedEnv: ['MCP_FIXTURE_DRIFT'],
      },
    ];
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    // Ensure environment variables point to these test configuration paths
    process.env.ZAVORTH_MCP_SERVERS_MANIFEST_PATH = manifestPath;
    process.env.ZAVORTH_MCP_TOOL_POLICY_PATH = policyPath;
    process.env.ZAVORTH_MCP_RUNTIME_STATE_FILE = stateFilePath;

    // Sandbox directory path
    sandboxDir = path.resolve(os.tmpdir(), 'zavorth-mcp-fixture');
    if (fs.existsSync(sandboxDir)) {
      fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
    fs.mkdirSync(sandboxDir, { recursive: true });
  });

  afterEach(async () => {
    // Restore environment
    process.env = { ...originalEnv };

    // Explicitly disconnect all spawned managers to prevent open handles/processes
    for (const manager of activeManagers) {
      try {
        await manager.disconnect();
      } catch {
        // ignore
      }
    }

    // Clean up files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }

    try {
      if (fs.existsSync(sandboxDir)) {
        fs.rmSync(sandboxDir, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  });

  function runCli(args: string[]): string {
    const cliScript = path.resolve('scripts/zavorth-mcp-install.ts');
    return execSync(`npx tsx "${cliScript}" ${args.join(' ')}`, {
      env: process.env,
      stdio: 'pipe',
    }).toString();
  }

  const trackingFactory = (entry: any) => {
    const manager = new McpClientManager(entry.id, entry.command, entry.args, entry.env, entry.allowedEnv);
    activeManagers.push(manager);
    return manager;
  };

  it('completes discovery, pending approval, CLI approval, and runtime execution', async () => {
    // 1. Initial boot: Discovery
    const registry = new ToolRegistry();
    const logRepo = { log: jest.fn() } as any;
    const loader = new McpManifestLoader(manifestPath);
    const policyService = new McpToolPolicyFileService();

    const runtime = new McpRuntimeService(
      registry,
      logRepo,
      loader,
      trackingFactory,
      stateFilePath,
      policyService
    );

    // Start connects and runs discovery
    await runtime.start();

    // Verify tools entered "pending_approval" in the policy file
    const docAfterDiscovery = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
    expect(docAfterDiscovery.tools['fixture:fixture.echo']).toBeDefined();
    expect(docAfterDiscovery.tools['fixture:fixture.echo'].status).toBe('pending_approval');
    expect(docAfterDiscovery.tools['fixture:fixture.echo'].pendingReason).toBe('new_tool');

    // Confirm namespaced tools are NOT in registry because they are pending
    expect(registry.getTool('fixture:fixture.echo')).toBeUndefined();
    expect(registry.getTool('fixture:fixture.add')).toBeUndefined();

    // Stop to clean up child processes of the current runtime instance
    await runtime.stop();

    // 2. Approve via CLI
    const echoFp = docAfterDiscovery.tools['fixture:fixture.echo'].fingerprint;
    const addFp = docAfterDiscovery.tools['fixture:fixture.add'].fingerprint;
    const readFp = docAfterDiscovery.tools['fixture:fixture.read_temp_file'].fingerprint;
    const writeFp = docAfterDiscovery.tools['fixture:fixture.write_temp_file'].fingerprint;

    expect(echoFp).toBeDefined();

    runCli(['approve', 'fixture:fixture.echo', '--fingerprint', echoFp]);
    runCli(['approve', 'fixture:fixture.add', '--fingerprint', addFp]);
    runCli(['approve', 'fixture:fixture.read_temp_file', '--fingerprint', readFp]);
    runCli(['approve', 'fixture:fixture.write_temp_file', '--fingerprint', writeFp]);

    // Verify they are now marked as "approved" and in the allowlist
    const docAfterApproval = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
    expect(docAfterApproval.tools['fixture:fixture.echo'].status).toBe('approved');
    expect(docAfterApproval.allowlist).toContain('fixture:fixture.echo');
    expect(docAfterApproval.allowlist).toContain('fixture:fixture.add');

    // 3. Restart/Reload Runtime: verify approved tools are registered
    const registry2 = new ToolRegistry();
    const runtime2 = new McpRuntimeService(
      registry2,
      logRepo,
      loader,
      trackingFactory,
      stateFilePath,
      policyService
    );

    await runtime2.start();

    // Verify namespacing is exact serverId:remoteToolName
    const echoTool = registry2.getTool('fixture:fixture.echo');
    const addTool = registry2.getTool('fixture:fixture.add');
    const readTool = registry2.getTool('fixture:fixture.read_temp_file');
    const writeTool = registry2.getTool('fixture:fixture.write_temp_file');

    expect(echoTool).toBeDefined();
    expect(addTool).toBeDefined();
    expect(readTool).toBeDefined();
    expect(writeTool).toBeDefined();

    // 4. Execution checks
    const echoResult = await echoTool!.execute({ message: 'E2E works' });
    expect(echoResult).toContain('E2E works');

    const addResult = await addTool!.execute({ a: 15, b: 27 });
    expect(addResult).toContain('42');

    // 5. Filesystem sandbox validation
    // Valid write/read
    const writeRes = await writeTool!.execute({ path: 'test.txt', content: 'Sandbox Content' });
    expect(writeRes).toContain('OK');

    const readRes = await readTool!.execute({ path: 'test.txt' });
    expect(readRes).toContain('Sandbox Content');

    // Traversal check: "../outside.txt"
    const outsideWriteResult = await writeTool!.execute({ path: '../outside.txt', content: 'hacked' });
    expect(outsideWriteResult).toContain('Path traversal detected or path outside sandbox');

    // Traversal check: path normalizado que tenta escapar "a/../../outside.txt"
    const escapedWriteResult = await writeTool!.execute({ path: 'a/../../outside.txt', content: 'hacked' });
    expect(escapedWriteResult).toContain('Path traversal detected or path outside sandbox');

    // Traversal check: absolute path outside sandbox
    const absPath = process.platform === 'win32' ? 'C:/windows/system32/hacked.txt' : '/etc/passwd';
    const absWriteResult = await writeTool!.execute({ path: absPath, content: 'hacked' });
    expect(absWriteResult).toContain('Path traversal detected or path outside sandbox');

    await runtime2.stop();
  }, 30000);

  it('detects schema drift and demotes tool back to pending_approval', async () => {
    // 1. Initial boot and approval
    const registry = new ToolRegistry();
    const logRepo = { log: jest.fn() } as any;
    const loader = new McpManifestLoader(manifestPath);
    const policyService = new McpToolPolicyFileService();

    const runtime = new McpRuntimeService(registry, logRepo, loader, trackingFactory, stateFilePath, policyService);
    await runtime.start();

    const doc = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
    const echoFp = doc.tools['fixture:fixture.echo'].fingerprint;
    await runtime.stop();

    runCli(['approve', 'fixture:fixture.echo', '--fingerprint', echoFp]);

    // 2. Set MCP_FIXTURE_DRIFT=schema environment to trigger drift
    process.env.MCP_FIXTURE_DRIFT = 'schema';

    const registry2 = new ToolRegistry();
    const runtime2 = new McpRuntimeService(registry2, logRepo, loader, trackingFactory, stateFilePath, policyService);
    await runtime2.start();

    // Check that fixture:fixture.echo is back to pending_approval and not registered
    const docAfterDrift = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
    expect(docAfterDrift.tools['fixture:fixture.echo'].status).toBe('pending_approval');
    expect(docAfterDrift.tools['fixture:fixture.echo'].pendingReason).toBe('schema_drift');
    expect(registry2.getTool('fixture:fixture.echo')).toBeUndefined();

    await runtime2.stop();
  }, 30000);

  it('detects description drift and requires renewed approval before registration', async () => {
    // 1. Initial boot and approval
    const registry = new ToolRegistry();
    const logRepo = { log: jest.fn() } as any;
    const loader = new McpManifestLoader(manifestPath);
    const policyService = new McpToolPolicyFileService();

    const runtime = new McpRuntimeService(registry, logRepo, loader, trackingFactory, stateFilePath, policyService);
    await runtime.start();

    const doc = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
    const echoFp = doc.tools['fixture:fixture.echo'].fingerprint;
    await runtime.stop();

    runCli(['approve', 'fixture:fixture.echo', '--fingerprint', echoFp]);

    // 2. Set MCP_FIXTURE_DRIFT=description environment to trigger description drift
    process.env.MCP_FIXTURE_DRIFT = 'description';

    const registry2 = new ToolRegistry();
    const runtime2 = new McpRuntimeService(registry2, logRepo, loader, trackingFactory, stateFilePath, policyService);
    await runtime2.start();

    // A description change alters the signed capability surface. The previous
    // approval must not silently authorize the changed tool.
    const docAfterDrift = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
    expect(docAfterDrift.tools['fixture:fixture.echo'].status).toBe('pending_approval');
    expect(docAfterDrift.tools['fixture:fixture.echo'].lastSeenDescription).toBe('Drifted description of echoes back the message');
    expect(registry2.getTool('fixture:fixture.echo')).toBeUndefined();

    await runtime2.stop();
  }, 30000);
});
