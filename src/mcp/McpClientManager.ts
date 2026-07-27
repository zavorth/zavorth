import { logger } from '../logger.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ToolDefinition } from '../providers/ILlmProvider.js';
import { buildChildProcessEnv } from '../security/ChildProcessEnv.js';
import { createMcpAgentToolSecurityDefinition } from '../security/AgentToolSecurityCatalog.js';
import { McpToolWrapper } from '../tools/McpToolWrapper.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';
import { asErrorLike } from '../utils/errorLike';

export function buildMcpChildEnv(
  explicitEnv: Record<string, string> = {},
  allowedEnv: string[] = [],
  hostEnv: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  return buildChildProcessEnv({ explicitEnv, allowedEnv, hostEnv });
}

/**
 * McpClientManager - Responsible for managing child processes (local MCP servers),
 * invoking their tools and registering them in the Zavorth ToolRegistry dynamically.
 */
export class McpClientManager {
  private client: Client;
  private transport: StdioClientTransport;

  constructor(
    public readonly name: string,
    command: string,
    args: string[],
    env?: Record<string, string>,
    allowedEnv: string[] = [],
  ) {
    const childEnv = buildMcpChildEnv(env || {}, allowedEnv);

    this.transport = new StdioClientTransport({
      command,
      args,
      env: childEnv,
    });

    this.client = new Client({ name: 'zavorth-host', version: '1.0.0' }, { capabilities: {} });
  }

  /**
   * Connects to the STDIO server, discovers tools and registers them in the registry.
   */
  public async connect(registry: ToolRegistry): Promise<void> {
    logger.info(`[MCP] Attempting STDIO connection to server: ${this.name}...`);
    await this.client.connect(this.transport);
    logger.info(`[MCP] Server [${this.name}] connected successfully!`);

    await this.discoverAndRegisterTools(registry);
  }

  /**
   * Requests the list of tools this server has and converts them to LLM JSON Schema.
   */
  private async discoverAndRegisterTools(registry: ToolRegistry): Promise<void> {
    const response = await this.client.listTools();

    if (!response || !response.tools) {
      logger.warn(`[MCP] No tools exposed by server ${this.name}.`);
      return;
    }

    logger.info(`[MCP] ${response.tools.length} modules/tools found on server ${this.name}`);

    for (const tool of response.tools) {
      const inputSchema = tool.inputSchema as Record<string, any>;

      const parameters: ToolDefinition['parameters'] = {
        type: 'object',
        properties: {},
        required: inputSchema.required || [],
      };

      if (inputSchema.properties) {
        for (const [key, prop] of Object.entries(inputSchema.properties)) {
          const schemaProp = prop as Record<string, any>;
          parameters.properties[key] = {
            type: schemaProp.type || 'string',
            description: schemaProp.description || '',
          };
          if (schemaProp.enum) {
            parameters.properties[key].enum = schemaProp.enum;
          }
        }
      }

      const baseToolName = normalizeMcpToolName(tool.name);
      if (!baseToolName) {
        logger.warn(`[MCP] Tool with invalid name ignored on server ${this.name}: ${tool.name}`);
        continue;
      }

      const safeName = this.resolveNonCollidingToolName(registry, baseToolName);
      const mcpTool = new McpToolWrapper(
        this.client,
        safeName,
        tool.name,
        tool.description || `External MCP tool: ${tool.name}`,
        parameters,
        {
          pluginId: `mcp:${this.name}`,
          source: 'mcp',
        },
      );

      registry.register(
        mcpTool,
        createMcpAgentToolSecurityDefinition(
          safeName,
          tool.description || `External MCP tool: ${tool.name}`,
        ),
      );
    }
  }

  private resolveNonCollidingToolName(registry: ToolRegistry, baseToolName: string): string {
    if (!registry.getTool(baseToolName)) {
      return baseToolName;
    }

    const serverPrefix = normalizeMcpToolName(this.name) || 'mcp';
    let candidate = `${serverPrefix}_${baseToolName}`;
    let suffix = 2;
    while (registry.getTool(candidate)) {
      candidate = `${serverPrefix}_${baseToolName}_${suffix}`;
      suffix += 1;
    }
    logger.warn(`[MCP] Tool "${baseToolName}" already existed; registering as "${candidate}".`);
    return candidate;
  }

  /**
   * Gracefully disconnects the process and stdio stream.
   */
  public async disconnect(): Promise<void> {
    logger.info(`[MCP] Disconnecting server ${this.name}...`);
    try {
      await this.transport.close();
    } catch (error: unknown) { const err = asErrorLike(error); logger.error(`[MCP] Error disconnecting transport: ${err.message}`);
    }
  }
}

export function normalizeMcpToolName(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 64);
}
