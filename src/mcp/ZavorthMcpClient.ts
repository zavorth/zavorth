import { logger } from '../logger.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { EventEmitter } from 'events';
import { buildMcpChildEnv } from './McpClientManager.js';

/**
 * Represents a registered external MCP server that the Zavorth can consume.
 * Think: GitHub MCP, SQLite MCP, Google Drive MCP, etc.
 */
export interface McpServerRegistration {
  id: string;
  label: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  allowedEnv?: string[];
  enabled: boolean;
}

export interface McpDiscoveredTool {
  serverId: string;
  serverLabel: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpToolCallResult {
  serverId: string;
  toolName: string;
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  isError: boolean;
}

type ClientEntry = {
  registration: McpServerRegistration;
  client: Client;
  transport: StdioClientTransport;
  tools: McpDiscoveredTool[];
  connected: boolean;
};

/**
 * ZavorthMcpClient — The consumer side of Model Context Protocol.
 *
 * This module lets Zavorth agents seamlessly discover and invoke tools
 * exposed by any external MCP server (community or first-party), turning
 * the entire MCP ecosystem into a plug-and-play extension layer.
 *
 * Architecture decisions:
 *  - Each external server runs as a child process via StdioClientTransport.
 *  - Tool discovery is cached per-server and refreshed on reconnect.
 *  - All calls are routed through a unified `callTool()` surface that agents
 *    can invoke without knowing the underlying server topology.
 */
export class ZavorthMcpClient extends EventEmitter {
  private readonly servers = new Map<string, ClientEntry>();

  constructor(private readonly registrations: McpServerRegistration[] = []) {
    super();
  }

  /**
   * Boot all enabled MCP servers, discover their tools, and cache the catalog.
   */
  public async connectAll(): Promise<void> {
    const enabled = this.registrations.filter((r) => r.enabled);
    const results = await Promise.allSettled(enabled.map((r) => this.connectServer(r)));

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'rejected') {
        logger.error(
          `[ZavorthMcpClient] Falha ao conectar ao servidor MCP "${enabled[i].label}": ${result.reason}`,
        );
      }
    }
  }

  /**
   * Connect to a single external MCP server, discover tools, and store them.
   */
  public async connectServer(registration: McpServerRegistration): Promise<McpDiscoveredTool[]> {
    if (this.servers.has(registration.id)) {
      await this.disconnectServer(registration.id);
    }

    const transport = new StdioClientTransport({
      command: registration.command,
      args: registration.args,
      env: buildMcpChildEnv(registration.env || {}, registration.allowedEnv || []),
    });

    const client = new Client(
      { name: `zavorth-mcp-consumer/${registration.id}`, version: '1.0.0' },
      { capabilities: {} },
    );

    await client.connect(transport);

    const toolsResponse = await client.listTools();
    const tools: McpDiscoveredTool[] = (toolsResponse.tools || []).map((tool: any) => ({
      serverId: registration.id,
      serverLabel: registration.label,
      name: tool.name,
      description: tool.description || '',
      inputSchema: tool.inputSchema || {},
    }));

    const entry: ClientEntry = {
      registration,
      client,
      transport,
      tools,
      connected: true,
    };
    this.servers.set(registration.id, entry);

    this.emit('server:connected', {
      serverId: registration.id,
      label: registration.label,
      toolCount: tools.length,
    });

    return tools;
  }

  /**
   * Disconnect and clean up a specific MCP server.
   */
  public async disconnectServer(serverId: string): Promise<void> {
    const entry = this.servers.get(serverId);
    if (!entry) return;

    try {
      await entry.client.close();
    } catch {
      // Server may already be dead
    }
    entry.connected = false;
    this.servers.delete(serverId);
    this.emit('server:disconnected', { serverId });
  }

  /**
   * Returns the full catalog of tools discovered across all connected servers.
   * Agents use this to decide which tool to invoke.
   */
  public listAllTools(): McpDiscoveredTool[] {
    const all: McpDiscoveredTool[] = [];
    for (const entry of this.servers.values()) {
      if (entry.connected) {
        all.push(...entry.tools);
      }
    }
    return all;
  }

  /**
   * Invoke a tool on its owning MCP server by name.
   * The router resolves which server owns the tool automatically.
   */
  public async callTool(toolName: string, args: Record<string, unknown>): Promise<McpToolCallResult> {
    const entry = this.findServerForTool(toolName);
    if (!entry) {
      return {
        serverId: 'unknown',
        toolName,
        content: [{ type: 'text', text: `MCP tool "${toolName}" not found on any connected server.` }],
        isError: true,
      };
    }

    try {
      const result = await entry.client.callTool({ name: toolName, arguments: args });
      return {
        serverId: entry.registration.id,
        toolName,
        content: (result.content || []) as McpToolCallResult['content'],
        isError: result.isError === true,
      };
    } catch (error) {
      return {
        serverId: entry.registration.id,
        toolName,
        content: [{ type: 'text', text: `Erro ao invocar "${toolName}": ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }

  /**
   * Get a summary snapshot for the zavorthControl / observability layer.
   */
  public getSnapshot(): {
    connectedServers: number;
    totalTools: number;
    servers: Array<{ id: string; label: string; connected: boolean; toolCount: number }>;
  } {
    const servers = Array.from(this.servers.values()).map((entry) => ({
      id: entry.registration.id,
      label: entry.registration.label,
      connected: entry.connected,
      toolCount: entry.tools.length,
    }));

    return {
      connectedServers: servers.filter((s) => s.connected).length,
      totalTools: this.listAllTools().length,
      servers,
    };
  }

  /**
   * Graceful shutdown of all connected servers.
   */
  public async disconnectAll(): Promise<void> {
    const ids = Array.from(this.servers.keys());
    await Promise.allSettled(ids.map((id) => this.disconnectServer(id)));
  }

  private findServerForTool(toolName: string): ClientEntry | null {
    for (const entry of this.servers.values()) {
      if (entry.connected && entry.tools.some((t) => t.name === toolName)) {
        return entry;
      }
    }
    return null;
  }
}
