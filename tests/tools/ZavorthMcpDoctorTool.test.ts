import { ZavorthMcpDoctorTool } from '../../src/tools/ZavorthMcpDoctorTool.js';
import { McpServerDoctorService } from '../../src/services/mcp/McpServerDoctorService.js';

function seedRegistry() {
  McpServerDoctorService.reset();
  McpServerDoctorService.registerServer({
    serverId: 'filesystem_mcp',
    name: 'Filesystem MCP',
    transport: 'stdio',
    endpointOrCommand: "node -e console.log('mcp-ready')",
    status: 'online',
    latencyMs: 0,
    protocolVersion: '2024-11-05',
    toolsCount: 4,
    tools: [
      { name: 'read_file', enabled: true, requiresApproval: false },
      { name: 'write_file', enabled: true, requiresApproval: true },
      { name: 'list_directory', enabled: true, requiresApproval: false },
      { name: 'delete_file', enabled: true, requiresApproval: true },
    ],
    checkedAt: new Date().toISOString(),
  });
  McpServerDoctorService.registerServer({
    serverId: 'postgres_mcp',
    name: 'Postgres MCP',
    transport: 'stdio',
    endpointOrCommand: "node -e console.log('postgres-ready')",
    status: 'online',
    latencyMs: 0,
    protocolVersion: '2024-11-05',
    toolsCount: 2,
    tools: [
      { name: 'query', enabled: true, requiresApproval: true },
      { name: 'schema', enabled: true, requiresApproval: false },
    ],
    checkedAt: new Date().toISOString(),
  });
}

describe('ZavorthMcpDoctorTool', () => {
  beforeEach(() => {
    seedRegistry();
  });

  it('should inspect all MCP servers', async () => {
    const rawResult = await ZavorthMcpDoctorTool.execute({ action: 'inspect_all' });
    const result = JSON.parse(rawResult);
    expect(result.status).toBe('success');
    expect(result.action).toBe('inspect_all');
    expect(result.totalServers).toBeGreaterThanOrEqual(2);
    expect(result.servers).toBeInstanceOf(Array);
  });

  it('should ping a specific MCP server', async () => {
    const rawResult = await ZavorthMcpDoctorTool.execute({
      action: 'ping',
      serverId: 'filesystem_mcp',
    });
    const result = JSON.parse(rawResult);
    expect(result.status).toBe('success');
    expect(result.action).toBe('ping');
    expect(result.server.latencyMs).toBeGreaterThan(0);
  });

  it('should toggle an MCP tool state', async () => {
    const rawResult = await ZavorthMcpDoctorTool.execute({
      action: 'toggle_tool',
      serverId: 'filesystem_mcp',
      toolName: 'write_file',
      enabled: false,
    });
    const result = JSON.parse(rawResult);
    expect(result.status).toBe('success');
    expect(result.action).toBe('toggle_tool');
    expect(result.enabled).toBe(false);
  });
});
