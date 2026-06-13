import { ZavorthMcpTrustExposureService } from '../../src/services/ZavorthMcpTrustExposureService.js';

describe('ZavorthMcpTrustExposureService', () => {
  it('hides external MCP tools unless the owning server is trusted', () => {
    const service = new ZavorthMcpTrustExposureService();

    const result = service.filterTools({
      servers: [
        {
          id: 'mcp:filesystem',
          label: 'Filesystem MCP',
          origin: 'stdio://filesystem',
          trustState: 'trusted',
          toolNames: ['read_file', 'write_file'],
          risk: 'medium',
          networkAccess: 'restricted',
          exposedToModel: true,
          lastReceiptId: 'receipt-trusted',
        },
        {
          id: 'mcp:browser',
          label: 'Browser MCP',
          origin: 'https://example.invalid/mcp',
          trustState: 'review',
          toolNames: ['browser_navigate'],
          risk: 'high',
          networkAccess: 'restricted',
          exposedToModel: false,
          lastReceiptId: null,
        },
      ],
      tools: [
        { name: 'read_file', serverId: 'mcp:filesystem' },
        { name: 'write_file', serverId: 'mcp:filesystem' },
        { name: 'browser_navigate', serverId: 'mcp:browser' },
      ],
    });

    expect(result.allowed.map((tool) => tool.name)).toEqual(['read_file', 'write_file']);
    expect(result.blocked).toEqual([
      expect.objectContaining({
        name: 'browser_navigate',
        reason: 'mcp_server_not_trusted',
      }),
    ]);
    expect(result.safety).toMatchObject({
      externalServersRequireTrust: true,
      rawSecretsSerialized: false,
    });
  });
});
