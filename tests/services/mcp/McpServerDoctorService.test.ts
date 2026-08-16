import { McpServerDoctorService } from '../../../src/services/mcp/McpServerDoctorService.js';

describe('McpServerDoctorService', () => {
  it('should inspect all registered MCP servers', async () => {
    const servers = await McpServerDoctorService.inspectAll();
    expect(servers.length).toBeGreaterThanOrEqual(2);

    const serverIds = servers.map((s) => s.serverId);
    expect(serverIds).toContain('filesystem_mcp');
    expect(serverIds).toContain('postgres_mcp');
  });

  it('should ping a specific MCP server and measure latency', async () => {
    const report = await McpServerDoctorService.pingServer('filesystem_mcp');
    expect(report).not.toBeNull();
    expect(report?.status).toBe('online');
    expect(report?.latencyMs).toBeGreaterThan(0);
    expect(report?.toolsCount).toBe(4);

    const nonExistent = await McpServerDoctorService.pingServer('invalid_mcp');
    expect(nonExistent).toBeNull();
  });

  it('should toggle an MCP tool enabled state', () => {
    const success = McpServerDoctorService.toggleTool('filesystem_mcp', 'write_file', false);
    expect(success).toBe(true);

    const failed = McpServerDoctorService.toggleTool('filesystem_mcp', 'non_existent_tool', true);
    expect(failed).toBe(false);
  });
});
