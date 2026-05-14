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
});
