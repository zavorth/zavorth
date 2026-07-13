import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PluginMcpBridgeService } from '../../src/services/PluginMcpBridgeService.js';
import { PluginRegistryService } from '../../src/services/PluginRegistryService.js';

describe('PluginMcpBridgeService', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('lists servers from fixture mcp-servers.json and materializes bridge package', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mcp-bridge-'));
    tempRoots.push(root);

    const configDir = path.join(root, 'config');
    fs.mkdirSync(configDir, { recursive: true });
    const configPath = path.join(configDir, 'mcp-servers.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify([
        {
          id: 'filesystem',
          enabled: false,
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem'],
          capability: 'filesystem',
        },
        {
          id: 'reasoning',
          enabled: true,
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
          capability: 'reasoning',
        },
      ], null, 2),
      'utf8',
    );

    const service = new PluginMcpBridgeService({ projectRoot: root });
    const servers = service.listServers({ root });
    expect(servers.map((s) => s.id).sort()).toEqual(['filesystem', 'reasoning']);
    expect(servers.find((s) => s.id === 'reasoning')?.enabled).toBe(true);

    const result = service.materializeBridgePlugin('filesystem', { root, sign: false });
    expect(result.ok).toBe(true);
    expect(result.pluginId).toBe('mcp-filesystem');

    const packageDir = path.join(root, result.packageDir);
    expect(fs.existsSync(path.join(packageDir, 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(packageDir, 'index.js'))).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(path.join(packageDir, 'manifest.json'), 'utf8'));
    expect(manifest.moduleKind).toBe('bridge');
    expect(manifest.capabilities.map((c: { id: string }) => c.id).sort()).toEqual([
      'mcp.invoke',
      'mcp.status',
    ]);
    expect(new PluginRegistryService().validateManifest(manifest)).toEqual([]);

    const index = fs.readFileSync(path.join(packageDir, 'index.js'), 'utf8');
    expect(index).toContain('mcp.invoke');
    expect(index).toContain('filesystem');
    expect(index).toContain('module.exports');
  });

  it('returns soft failure for unknown mcp id', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mcp-miss-'));
    tempRoots.push(root);
    fs.mkdirSync(path.join(root, 'config'), { recursive: true });
    fs.writeFileSync(path.join(root, 'config', 'mcp-servers.json'), '[]', 'utf8');

    const result = new PluginMcpBridgeService({ projectRoot: root }).materializeBridgePlugin('missing', { root });
    expect(result.ok).toBe(false);
    expect(result.findings.some((line) => /not found/i.test(line))).toBe(true);
  });
});
