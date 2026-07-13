/**
 * Shared handle so first-party MCP bridge plugins can soft-invoke tools
 * against the live McpRuntimeService without constructing a second instance.
 */

export type PluginOsMcpInvokeInput = {
  serverId: string;
  tool?: string | null;
  name?: string | null;
  args?: Record<string, unknown>;
  arguments?: Record<string, unknown>;
  params?: Record<string, unknown>;
};

export type PluginOsMcpInvokeResult = {
  ok: boolean;
  serverId?: string;
  tool?: string | null;
  result?: unknown;
  reason?: string;
  message?: string;
  tools?: string[];
  status?: string | null;
  setup?: string[];
};

export type PluginOsMcpRuntimeHandle = {
  invoke?(input: PluginOsMcpInvokeInput): Promise<PluginOsMcpInvokeResult | unknown>;
  callTool?(
    serverId: string,
    tool: string,
    args?: Record<string, unknown>,
  ): Promise<PluginOsMcpInvokeResult | unknown>;
  readSnapshot?(): {
    entries?: Array<{ id: string; status?: string; toolNames?: string[]; enabled?: boolean }>;
    summary?: Record<string, unknown>;
  };
};

let sharedMcpRuntime: PluginOsMcpRuntimeHandle | null = null;

export function setPluginOsMcpRuntime(runtime: PluginOsMcpRuntimeHandle | null): void {
  sharedMcpRuntime = runtime;
}

export function getPluginOsMcpRuntime(): PluginOsMcpRuntimeHandle | null {
  return sharedMcpRuntime;
}

export async function invokePluginOsMcp(
  input: PluginOsMcpInvokeInput,
): Promise<PluginOsMcpInvokeResult> {
  const runtime = sharedMcpRuntime;
  if (!runtime) {
    return {
      ok: false,
      reason: 'mcp_runtime_unavailable',
      serverId: String(input.serverId || ''),
      message: 'McpRuntime is not wired into Plugin OS yet. Start the gateway/runtime first.',
      setup: [
        'Ensure the Zavorth runtime bootstrap completed',
        'Enable the MCP server in config/mcp-servers.json',
        'CLI: zavorth plugins mcp list',
      ],
    };
  }

  try {
    if (typeof runtime.invoke === 'function') {
      const result = await runtime.invoke(input);
      if (result && typeof result === 'object' && 'ok' in (result as object)) {
        return result as PluginOsMcpInvokeResult;
      }
      return {
        ok: true,
        serverId: input.serverId,
        tool: input.tool || input.name || null,
        result,
      };
    }

    const tool = String(input.tool || input.name || '').trim();
    if (typeof runtime.callTool === 'function' && tool) {
      const args = (input.args || input.arguments || input.params || {}) as Record<string, unknown>;
      const result = await runtime.callTool(input.serverId, tool, args);
      if (result && typeof result === 'object' && 'ok' in (result as object)) {
        return result as PluginOsMcpInvokeResult;
      }
      return {
        ok: true,
        serverId: input.serverId,
        tool,
        result,
      };
    }

    if (typeof runtime.readSnapshot === 'function' && !tool) {
      const snapshot = runtime.readSnapshot();
      const entry = (snapshot.entries || []).find((item) => item.id === input.serverId);
      return {
        ok: true,
        serverId: input.serverId,
        tools: entry?.toolNames || [],
        status: entry?.status || null,
        message: entry
          ? `MCP server ${input.serverId} status=${entry.status || 'unknown'}`
          : `MCP server ${input.serverId} not present in runtime snapshot`,
      };
    }

    return {
      ok: false,
      reason: 'mcp_runtime_no_invoke',
      serverId: input.serverId,
      setup: [
        'McpRuntime is present but does not expose invoke/callTool',
        'Upgrade runtime or enable the target MCP server',
      ],
    };
  } catch (error) {
    return {
      ok: false,
      serverId: input.serverId,
      reason: 'mcp_invoke_error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
