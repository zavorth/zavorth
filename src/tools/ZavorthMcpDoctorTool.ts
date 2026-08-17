/**
 * Zavorth MCP Doctor Tool.
 * Exposes Model Context Protocol (MCP) server discovery, health checks, latency tests, and tool toggling via ToolRegistry and Cognitive Firewall.
 */

import { BaseTool } from './BaseTool.js';
import { McpServerDoctorService } from '../services/mcp/McpServerDoctorService.js';

export interface ZavorthMcpDoctorInput {
  action: 'inspect_all' | 'ping' | 'toggle_tool';
  serverId?: string;
  toolName?: string;
  enabled?: boolean;
}

export class ZavorthMcpDoctorTool extends BaseTool {
  public static readonly name = 'zavorth_mcp_doctor';
  public static readonly description =
    'Discovers and inspects MCP servers, tests ping latency and protocol handshake, lists available tools, and toggles MCP tools.';

  public static readonly schema = {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['inspect_all', 'ping', 'toggle_tool'],
        description: 'The action to perform: inspect all servers, ping a specific server, or toggle a tool state.',
      },
      serverId: {
        type: 'string',
        description: 'The MCP server ID (e.g. "filesystem_mcp", "postgres_mcp").',
      },
      toolName: {
        type: 'string',
        description: 'The tool name inside the MCP server to toggle.',
      },
      enabled: {
        type: 'boolean',
        description: 'Whether to enable or disable the specified tool.',
      },
    },
    required: ['action'] as string[],
  };

  readonly name = ZavorthMcpDoctorTool.name;
  readonly description = ZavorthMcpDoctorTool.description;
  readonly parameters = ZavorthMcpDoctorTool.schema;

  public async execute(args: Record<string, unknown>): Promise<string> {
    return ZavorthMcpDoctorTool.execute(args as unknown as ZavorthMcpDoctorInput);
  }

  public static async execute(input: ZavorthMcpDoctorInput): Promise<string> {
    switch (input.action) {
      case 'inspect_all': {
        const servers = await McpServerDoctorService.inspectAll();
        return JSON.stringify({
          status: 'success',
          action: 'inspect_all',
          totalServers: servers.length,
          servers,
        });
      }

      case 'ping': {
        if (!input.serverId) {
          return JSON.stringify({
            status: 'error',
            message: 'serverId is required to ping an MCP server.',
          });
        }
        const report = await McpServerDoctorService.pingServer(input.serverId);
        if (!report) {
          return JSON.stringify({
            status: 'not_found',
            message: `MCP server '${input.serverId}' not found.`,
          });
        }
        return JSON.stringify({
          status: 'success',
          action: 'ping',
          server: report,
          message: `Server '${report.name}' is ${report.status} (latency: ${report.latencyMs}ms, tools: ${report.toolsCount}).`,
        });
      }

      case 'toggle_tool': {
        if (!input.serverId || !input.toolName || input.enabled === undefined) {
          return JSON.stringify({
            status: 'error',
            message: 'serverId, toolName, and enabled (boolean) are required to toggle an MCP tool.',
          });
        }
        const toggled = McpServerDoctorService.toggleTool(input.serverId, input.toolName, input.enabled);
        return JSON.stringify({
          status: toggled ? 'success' : 'not_found',
          action: 'toggle_tool',
          serverId: input.serverId,
          toolName: input.toolName,
          enabled: input.enabled,
          message: toggled
            ? `Tool '${input.toolName}' on server '${input.serverId}' is now ${input.enabled ? 'enabled' : 'disabled'}.`
            : `Could not find server '${input.serverId}' or tool '${input.toolName}'.`,
        });
      }

      default:
        return JSON.stringify({
          status: 'error',
          message: `Unknown action: ${String(input.action)}`,
        });
    }
  }
}
