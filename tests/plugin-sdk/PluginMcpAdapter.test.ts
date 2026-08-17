import { PluginMcpAdapter } from '../../src/plugin-sdk/mcp-adapter.js';
import { PluginSdkRegistry } from '../../src/plugin-sdk/registry.js';

describe('PluginMcpAdapter', () => {
  it('should convert MCP server candidate and tool schemas into a registered ZavorthPlugin', async () => {
    const candidate = {
      id: 'sqlite_server',
      enabled: true,
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sqlite'],
      summary: 'SQLite database access',
      source: 'mcp_catalog',
    };

    const toolSchemas = [
      {
        name: 'sqlite_query',
        description: 'Run SQL query on local db',
        inputSchema: {
          type: 'object' as const,
          properties: {
            sql: { type: 'string' },
          },
          required: ['sql'],
        },
      },
    ];

    const plugin = PluginMcpAdapter.fromMcpCandidate(candidate, toolSchemas);
    expect(plugin.id).toBe('mcp_sqlite_server');
    expect(plugin.manifest.capabilities).toContain('tools');

    const registry = new PluginSdkRegistry();
    const record = await registry.registerAndInitialize(plugin);

    expect(record.status).toBe('active');
    expect(record.registeredTools.has('sqlite_query')).toBe(true);

    const toolInstance = record.registeredTools.get('sqlite_query');
    expect(toolInstance).toBeDefined();

    const outputRaw = await toolInstance!.execute({ sql: 'SELECT 1;' });
    const parsed = JSON.parse(outputRaw);
    expect(parsed.status).toBe('success');
    expect(parsed.server).toBe('sqlite_server');
  });
});
