import {
  AcpLiveSessionService,
  type AcpJsonRpcRequest,
  type AcpJsonRpcResponse,
  type AcpJsonRpcTransport,
} from '../../src/services/AcpLiveSessionService.js';

describe('AcpLiveSessionService', () => {
  const now = () => new Date('2026-05-16T23:00:00.000Z');

  it('blocks stdio ACP sessions until live bridge governance is ready', async () => {
    const receipt = await new AcpLiveSessionService({
      now,
      env: {},
    }).run({
      prompt: 'ping',
      transport: 'stdio-jsonrpc',
      serverId: 'local-acp',
      stdioCommand: 'node',
      receiptPath: 'data/runtime/acp-live-session-blocked-test.json',
    });

    expect(receipt.status).toBe('blocked');
    expect(receipt.governance.executionAuthorityGranted).toBe(false);
    expect(receipt.session.liveToolExecutionPerformed).toBe(false);
  });

  it('runs a governed mock ACP session and writes an auditable receipt', async () => {
    const receipt = await new AcpLiveSessionService({
      now,
      env: {},
    }).run({
      prompt: 'ping',
      transport: 'mock-jsonrpc',
      serverId: 'local-acp',
      receiptPath: 'data/runtime/acp-live-session-mock-test.json',
    });

    expect(receipt.status).toBe('approval_required');
    expect(receipt.surface).toBe('acp-live-session');
    expect(receipt.session.transport).toBe('mock-jsonrpc');
    expect(receipt.session.promptHash).toHaveLength(64);
    expect(receipt.session.liveToolExecutionPerformed).toBe(false);
    expect(receipt.toolDecisions).toEqual([
      expect.objectContaining({
        toolName: 'Write',
        decision: 'approval_required',
        liveToolExecutionPerformed: false,
      }),
    ]);
  });

  it('maps ACP tool requests through Zavorth policy without executing them', async () => {
    const transport = new ToolRequestTransport('Bash');
    const receipt = await new AcpLiveSessionService({
      now,
      env: {},
      transport,
    }).run({
      prompt: 'run diagnostics',
      transport: 'mock-jsonrpc',
      serverId: 'local-acp',
      receiptPath: 'data/runtime/acp-live-session-tool-test.json',
    });

    expect(transport.methods).toEqual([
      'initialize',
      'session/start',
      'message/send',
      'session/end',
    ]);
    expect(receipt.status).toBe('approval_required');
    expect(receipt.toolDecisions[0]).toEqual(expect.objectContaining({
      toolName: 'Bash',
      decision: 'approval_required',
      liveToolExecutionPerformed: false,
    }));
  });

  it('redacts ACP text output and keeps receipts inside data/runtime', async () => {
    const receipt = await new AcpLiveSessionService({
      now,
      env: {},
      transport: new SecretMessageTransport(),
    }).run({
      prompt: 'ping',
      transport: 'mock-jsonrpc',
      serverId: 'local-acp',
      receiptPath: '../acp-escape.json',
    });

    expect(JSON.stringify(receipt)).not.toContain('sk-secret-value');
    expect(receipt.output.text).toContain('[redacted]');
  });
});

class ToolRequestTransport implements AcpJsonRpcTransport {
  public readonly kind = 'mock-jsonrpc' as const;
  public readonly methods: string[] = [];

  public constructor(private readonly toolName: string) {}

  public async open(): Promise<void> {}

  public async close(): Promise<void> {}

  public async request(request: AcpJsonRpcRequest): Promise<AcpJsonRpcResponse> {
    this.methods.push(request.method);
    if (request.method === 'message/send') {
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          events: [
            { type: 'message', text: 'tool requested' },
            { type: 'tool_request', requestId: 'tool-1', toolName: this.toolName },
          ],
        },
      };
    }
    return { jsonrpc: '2.0', id: request.id, result: {} };
  }
}

class SecretMessageTransport implements AcpJsonRpcTransport {
  public readonly kind = 'mock-jsonrpc' as const;

  public async open(): Promise<void> {}

  public async close(): Promise<void> {}

  public async request(request: AcpJsonRpcRequest): Promise<AcpJsonRpcResponse> {
    if (request.method === 'message/send') {
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          events: [
            { type: 'message', text: 'OPENAI_API_KEY=sk-secret-value-1234567890' },
          ],
        },
      };
    }
    return { jsonrpc: '2.0', id: request.id, result: {} };
  }
}
