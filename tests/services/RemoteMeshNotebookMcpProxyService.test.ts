import { RemoteMeshNotebookMcpProxyService } from '../../src/services/RemoteMeshNotebookMcpProxyService.js';

const now = () => new Date('2026-05-05T20:00:00.000Z');
const token = 'zavorth-dashboard-proxy-token';

describe('RemoteMeshNotebookMcpProxyService', () => {
  it('blocks apply clicks before network when endpoint or token are missing', async () => {
    const service = new RemoteMeshNotebookMcpProxyService({
      endpointUrl: null,
      authToken: null,
    }, { now });

    const result = await service.apply({
      toolName: 'notebook.docker.apply_control',
      arguments: {
        approvalId: 'zdc-test',
        approvalPhrase: 'APPROVE DOCKER RESTART zavorth-app',
      },
    });

    expect(result.status).toBe('blocked');
    expect(result.safety.liveNetworkCallPerformed).toBe(false);
    expect(result.safety.browserReceivedToken).toBe(false);
    expect(result.error).toContain('ZAVORTH_REMOTE_MESH_NOTEBOOK_MCP_URL');
  });

  it('calls the real scoped MCP endpoint through a server-side token proxy', async () => {
    const fetcher = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.headers).toEqual(expect.objectContaining({
        Authorization: `Bearer ${token}`,
      }));
      expect(String(init?.body)).toContain('notebook.docker.apply_control');
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: 'proxy-test',
        result: {
          structuredContent: {
            toolName: 'notebook.docker.apply_control',
            receiptId: 'zdr-test',
            approvalId: 'zdc-test',
            container: 'zavorth-app',
            action: 'restart',
            status: 'executed',
            rawCommandSerialized: false,
          },
          content: [
            {
              type: 'text',
              text: '{"receiptId":"zdr-test"}',
            },
          ],
          isError: false,
        },
      }), { status: 200 });
    });
    const service = new RemoteMeshNotebookMcpProxyService({
      endpointUrl: 'https://notebook.tailnet.example/mcp',
      authToken: token,
    }, {
      now,
      fetcher: fetcher as unknown as typeof fetch,
    });

    const result = await service.apply({
      toolName: 'notebook.docker.apply_control',
      arguments: {
        approvalId: 'zdc-test',
        approvalPhrase: 'APPROVE DOCKER RESTART zavorth-app',
      },
    });

    expect(result.ok).toBe(true);
    expect(result.receipt?.toolName).toBe('notebook.docker.apply_control');
    expect(result.receipt?.structuredContent?.receiptId).toBe('zdr-test');
    expect(result.safety.endpointAcceptedFromBrowser).toBe(false);
    expect(result.safety.secretValuesSerialized).toBe(false);
    expect(JSON.stringify(result)).not.toContain(token);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects non-allowlisted tools and extra arguments', async () => {
    const service = new RemoteMeshNotebookMcpProxyService({
      endpointUrl: 'https://notebook.tailnet.example/mcp',
      authToken: token,
    }, { now });

    const rejectedTool = await service.apply({
      toolName: 'shell.run' as never,
      arguments: {
        approvalId: 'zdc-test',
        approvalPhrase: 'APPROVE DOCKER RESTART zavorth-app',
      },
    });
    const rejectedArg = await service.apply({
      toolName: 'notebook.project_files.apply_read',
      arguments: {
        approvalId: 'zfr-test',
        approvalPhrase: 'APPROVE FILE READ zavorth/README.md',
        path: '../secret',
      } as never,
    });

    expect(rejectedTool.status).toBe('blocked');
    expect(rejectedTool.safety.applyToolAllowlisted).toBe(false);
    expect(rejectedArg.status).toBe('blocked');
    expect(rejectedArg.error).toContain('Unsupported Remote Mesh approval argument');
  });

  it('requires an explicit tailnet flag before non-loopback plain HTTP', async () => {
    const blocked = await new RemoteMeshNotebookMcpProxyService({
      endpointUrl: 'http://100.64.0.10:8787/mcp',
      authToken: token,
    }, { now }).apply({
      toolName: 'notebook.project_files.apply_read',
      arguments: {
        approvalId: 'zfr-test',
        approvalPhrase: 'APPROVE FILE READ zavorth/README.md',
      },
    });

    expect(blocked.status).toBe('blocked');
    expect(blocked.error).toContain('ZAVORTH_REMOTE_MESH_ALLOW_INSECURE_HTTP_FOR_TAILNET');
  });
});
