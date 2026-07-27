
/**
 * McpPluginToolsServer — MCP server that exposes Zavorth tools
 * to compatible MCP clients (Claude Code, Cursor, etc.).
 *
 * Creates an MCP server via stdio that routes tool calls
 * to Zavorth's internal ToolRegistry.
 *
 * Usage:
 *   const server = new McpPluginToolsServer(toolRegistry);
 *   await server.start(); // listens on stdin/stdout
 */

import type { ToolRegistry } from '../tools/ToolRegistry.js';
import type { ToolExecutor } from '../execution/ToolExecutor.js';
import { asErrorLike } from '../utils/errorLike.js';

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpToolCallResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

export interface McpRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface McpResponse {
  jsonrpc: '2.0';
  id?: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

type McpPluginToolsServerOptions = {
  toolExecutor?: Pick<ToolExecutor, 'executeTool'> | null;
};

export class McpPluginToolsServer {
  private readonly registry: ToolRegistry;
  private readonly toolExecutor: Pick<ToolExecutor, 'executeTool'> | null;
  private running = false;

  constructor(registry: ToolRegistry, options: McpPluginToolsServerOptions = {}) {
    this.registry = registry;
    this.toolExecutor = options.toolExecutor ?? null;
  }

  /**
   * Converte uma tool do registry para o formato MCP.
   */
  private toolToMcp(toolName: string): McpToolDefinition | null {
    const tool = this.registry.getTool(toolName);
    if (!tool) return null;

    return {
      name: tool.name,
      description: tool.description,
      inputSchema: {
        type: 'object',
        ...(tool.parameters as Record<string, unknown>),
      },
    };
  }

  /**
   * Lists all available tools in MCP format.
   */
  listTools(): McpToolDefinition[] {
    return this.registry
      .getAllTools()
      .map((t) => this.toolToMcp(t.name))
      .filter((t): t is McpToolDefinition => t !== null);
  }

  /**
   * Executes a tool via the central ToolExecutor.
   */
  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<McpToolCallResult> {
    const tool = this.registry.getTool(name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: `Tool "${name}" not found` }],
        isError: true,
      };
    }

    if (!this.toolExecutor) {
      return {
        content: [
          {
            type: 'text',
            text: `Tool ${name} requires the central ToolExecutor, but no executor is configured for this MCP server.`,
          },
        ],
        isError: true,
      };
    }

    try {
      const result = await this.toolExecutor.executeTool(name, args);
      return {
        content: [{ type: 'text', text: String(result) }],
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : String(error);
      return {
        content: [{ type: 'text', text: `Error executing ${name}: ${message}` }],
        isError: true,
      };
    }
  }

  /**
   * Processes an MCP request.
   */
  async handleRequest(request: McpRequest): Promise<McpResponse> {
    const { id, method, params } = request;

    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: {
              name: 'zavorth-tools',
              version: '2.0.0',
            },
          },
        };

      case 'notifications/initialized':
        return { jsonrpc: '2.0' };

      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id,
          result: { tools: this.listTools() },
        };

      case 'tools/call': {
        const { name, arguments: args } = (params ?? {}) as {
          name: string;
          arguments?: Record<string, unknown>;
        };
        const result = await this.callTool(name, args ?? {});
        return { jsonrpc: '2.0', id, result };
      }

      case 'ping':
        return { jsonrpc: '2.0', id, result: {} };

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Unsupported method: ${method}` },
        };
    }
  }

  /**
   * starts o server MCP via stdin/stdout.
   */
  async start(): Promise<void> {
    this.running = true;

    process.stdin.setEncoding('utf-8');
    let buffer = '';

    process.stdin.on('data', async (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const request = JSON.parse(trimmed) as McpRequest;
          const response = await this.handleRequest(request);
          if (response.id !== undefined) {
            process.stdout.write(JSON.stringify(response) + '\n');
          }
        } catch (error: unknown) {process.stdout.write(
            JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32700, message: 'Parse error' },
            }) + '\n',
          );
        }
      }
    });

    process.stdin.on('end', () => {
      this.running = false;
    });
  }

  get isRunning(): boolean {
    return this.running;
  }
}
