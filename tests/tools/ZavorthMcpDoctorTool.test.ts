import { ZavorthMcpDoctorTool } from '../../src/tools/ZavorthMcpDoctorTool.js';

describe('ZavorthMcpDoctorTool', () => {
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
