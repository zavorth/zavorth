import {
  getPluginOsMcpRuntime,
  invokePluginOsMcp,
  setPluginOsMcpRuntime,
} from '../../src/services/PluginOsMcpRuntimeAccess.js';
import { McpRuntimeService } from '../../src/mcp/McpRuntimeService.js';
import { ToolRegistry } from '../../src/tools/ToolRegistry.js';
import { BaseTool } from '../../src/tools/BaseTool.js';

class StubTool extends BaseTool {
  public readonly name: string;
  public readonly description = 'stub';
  public readonly parameters = { type: 'object' as const, properties: {} };

  constructor(name: string, private readonly payload: string) {
    super();
    this.name = name;
  }

  public async execute(): Promise<string> {
    return this.payload;
  }
}

describe('PluginOsMcpRuntimeAccess', () => {
  afterEach(() => {
    setPluginOsMcpRuntime(null);
  });

  it('soft-fails when runtime is not wired', async () => {
    setPluginOsMcpRuntime(null);
    const result = await invokePluginOsMcp({ serverId: 'filesystem', tool: 'read' });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('mcp_runtime_unavailable');
  });

  it('invokes tools through the live McpRuntimeService handle', async () => {
    const registry = new ToolRegistry();
    registry.register(new StubTool('filesystem:read_file', 'file-contents'));
    const logRepo = { log: jest.fn() } as any;
    const runtime = new McpRuntimeService(registry, logRepo);
    setPluginOsMcpRuntime(runtime);

    expect(getPluginOsMcpRuntime()).toBe(runtime);

    const listed = await invokePluginOsMcp({ serverId: 'filesystem' });
    expect(listed.ok).toBe(true);
    expect(listed.serverId).toBe('filesystem');

    const invoked = await invokePluginOsMcp({
      serverId: 'filesystem',
      tool: 'read_file',
      args: {},
    });
    expect(invoked.ok).toBe(true);
    expect(invoked.result).toBe('file-contents');
  });
});
