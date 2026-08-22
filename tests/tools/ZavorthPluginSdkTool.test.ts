import * as fs from 'node:fs';
import * as path from 'node:path';
import { ZavorthPluginSdkTool } from '../../src/tools/ZavorthPluginSdkTool.js';
import { PluginSdkRegistry } from '../../src/plugin-sdk/registry.js';
import { definePlugin } from '../../src/plugin-sdk/api.js';

describe('ZavorthPluginSdkTool', () => {
  const testWatchDir = path.join(process.cwd(), '.zavorth', 'test_tool_watch_dir');

  beforeAll(async () => {
    if (!fs.existsSync(testWatchDir)) {
      fs.mkdirSync(testWatchDir, { recursive: true });
    }
    const registry = PluginSdkRegistry.getInstance();
    const demoPlugin = definePlugin({
      id: 'demo_tool_plugin',
      manifest: {
        name: 'demo_tool_plugin',
        version: '2.1.0',
        description: 'Demo tool provider',
        main: 'index.js',
        capabilities: ['tools'],
        permissions: ['filesystem.read'],
      },
      initialize: () => {},
    });
    await registry.registerAndInitialize(demoPlugin);
  });

  afterAll(() => {
    if (fs.existsSync(testWatchDir)) {
      try {
        fs.rmSync(testWatchDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  it('should list installed plugins', async () => {
    const raw = await ZavorthPluginSdkTool.execute({
      action: 'list',
    });
    const parsed = JSON.parse(raw);
    expect(parsed.status).toBe('success');
    expect(parsed.total).toBeGreaterThanOrEqual(1);
    expect(parsed.plugins.some((p: { id?: string }) => p.id === 'demo_tool_plugin')).toBe(true);
  });

  it('should validate valid manifest json', async () => {
    const raw = await ZavorthPluginSdkTool.execute({
      action: 'validate_manifest',
      manifestJson: {
        name: 'valid_plugin',
        version: '1.0.0',
        description: 'Valid description',
        main: 'dist/index.js',
        capabilities: ['tools'],
        permissions: ['filesystem.read'],
      },
    });
    const parsed = JSON.parse(raw);
    expect(parsed.status).toBe('success');
    expect(parsed.valid).toBe(true);
  });

  it('should inspect a loaded plugin', async () => {
    const raw = await ZavorthPluginSdkTool.execute({
      action: 'inspect',
      pluginId: 'demo_tool_plugin',
    });
    const parsed = JSON.parse(raw);
    expect(parsed.status).toBe('success');
    expect(parsed.plugin.id).toBe('demo_tool_plugin');
  });

  it('should import an MCP server candidate as a plugin', async () => {
    const raw = await ZavorthPluginSdkTool.execute({
      action: 'import_mcp',
      mcpServerId: 'github_mcp',
      mcpCommand: 'npx',
      mcpArgs: ['-y', '@modelcontextprotocol/server-github'],
      mcpTools: [
        {
          name: 'get_repo',
          description: 'Get repository details',
          inputSchema: { type: 'object' as const, properties: { repo: { type: 'string' } } },
        },
      ],
    });
    const parsed = JSON.parse(raw);
    expect(parsed.status).toBe('success');
    expect(parsed.pluginId).toBe('mcp_github_mcp');
    expect(parsed.toolsRegistered).toContain('get_repo');
  });

  it('should verify local package signature', async () => {
    const raw = await ZavorthPluginSdkTool.execute({
      action: 'verify_signature',
      packageDir: testWatchDir,
    });
    const parsed = JSON.parse(raw);
    expect(parsed.status).toBe('success');
    expect(parsed.action).toBe('verify_signature');
  });

  it('should start hot-reload on a plugin directory', async () => {
    const raw = await ZavorthPluginSdkTool.execute({
      action: 'hot_reload',
      pluginId: 'demo_tool_plugin',
      pluginDir: testWatchDir,
    });
    const parsed = JSON.parse(raw);
    expect(parsed.status).toBe('success');
    expect(parsed.message).toContain('Hot-reload watcher active');
  });

  it('should unload a loaded plugin', async () => {
    const raw = await ZavorthPluginSdkTool.execute({
      action: 'unload',
      pluginId: 'demo_tool_plugin',
    });
    const parsed = JSON.parse(raw);
    expect(parsed.status).toBe('success');
  });
});
