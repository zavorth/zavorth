import fs from 'fs';
import os from 'os';
import path from 'path';
import { McpManifestLoader } from '../../src/mcp/McpManifest';

describe('McpManifestLoader', () => {
  it('resolves placeholders from the manifest file', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mcp-manifest-'));
    const manifestPath = path.join(tempDir, 'mcp-servers.json');

    fs.writeFileSync(
      manifestPath,
      JSON.stringify(
        [
          {
            id: 'filesystem',
            enabled: true,
            command: '${npxCommand}',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '${workspaceRoot}'],
            env: {
              ZAVORTH_TARGET: '${defaultWorkspace}',
              OPTIONAL_ENV: '${env:ZAVORTH_TEST_ENV}',
            },
            allowedEnv: ['PATH', ' ZAVORTH_MCP_TEST_ALLOWED ', ''],
          },
        ],
        null,
        2,
      ),
      'utf8',
    );

    process.env.ZAVORTH_TEST_ENV = 'from-env';

    const loader = new McpManifestLoader(manifestPath, {
      npxCommand: 'npx.cmd',
      workspaceRoot: 'C:/workspace-root',
      defaultWorkspace: 'C:/project',
      projectRoot: 'C:/project',
      nodeCommand: 'node.exe',
    });

    const servers = loader.loadEnabled();

    expect(servers).toEqual([
      {
        id: 'filesystem',
        enabled: true,
        command: 'npx.cmd',
        args: ['-y', '@modelcontextprotocol/server-filesystem', 'C:/workspace-root'],
        env: {
          ZAVORTH_TARGET: 'C:/project',
          OPTIONAL_ENV: 'from-env',
        },
        allowedEnv: ['PATH', 'ZAVORTH_MCP_TEST_ALLOWED'],
        capability: undefined,
      },
    ]);
  });

  it('keeps the bundled MCP manifest wired to registry-backed candidates without enabling them by default', () => {
    const manifestPath = path.resolve('config/mcp-servers.json');
    const loader = new McpManifestLoader(manifestPath, {
      npxCommand: 'npx.cmd',
      workspaceRoot: 'C:/workspace-root',
      defaultWorkspace: 'C:/project',
      projectRoot: 'C:/project',
      nodeCommand: 'node.exe',
    });

    const servers = loader.load();
    const byId = new Map(servers.map((server) => [server.id, server]));

    expect(Array.from(byId.keys()).sort()).toEqual(['filesystem', 'playwright', 'reasoning']);
    expect(servers.every((server) => server.enabled === false)).toBe(true);
    expect(servers.every((server) => server.allowedEnv.length === 1 && server.allowedEnv[0] === 'PATH')).toBe(true);
    expect(servers.every((server) => !Object.keys(server.env).some((key) => /token|secret|key|password/i.test(key)))).toBe(true);
    expect(byId.get('filesystem')).toEqual(
      expect.objectContaining({
        command: 'npx.cmd',
        args: ['-y', '@modelcontextprotocol/server-filesystem', 'C:/workspace-root'],
        capability: 'filesystem',
      }),
    );
    expect(byId.get('reasoning')).toEqual(
      expect.objectContaining({
        command: 'npx.cmd',
        capability: 'reasoning',
      }),
    );
    expect(byId.get('playwright')).toEqual(
      expect.objectContaining({
        command: 'npx.cmd',
        capability: 'browser',
      }),
    );
  });
});
