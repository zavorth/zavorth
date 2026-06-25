import { logger } from '../logger.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ToolDefinition } from '../providers/ILlmProvider.js';
import { buildChildProcessEnv } from '../security/ChildProcessEnv.js';
import { createMcpAgentToolSecurityDefinition } from '../security/AgentToolSecurityCatalog.js';
import { McpToolWrapper } from '../tools/McpToolWrapper.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';

export function buildMcpChildEnv(
  explicitEnv: Record<string, string> = {},
  allowedEnv: string[] = [],
  hostEnv: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  return buildChildProcessEnv({ explicitEnv, allowedEnv, hostEnv });
}

/**
 * McpClientManager - Responsavel por gerenciar os processos filhos (servidores MCP locais),
 * invocar suas ferramentas e registrar no ToolRegistry do Zavorth dinamicamente.
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
   * Conecta ao servidor STDIO, descobre as tools e cadastra no registry.
   */
  public async connect(registry: ToolRegistry): Promise<void> {
    logger.info(`[MCP] Tentando conexao via STDIO com servidor: ${this.name}...`);
    await this.client.connect(this.transport);
    logger.info(`[MCP] Servidor [${this.name}] conectado com sucesso!`);

    await this.discoverAndRegisterTools(registry);
  }

  /**
   * Pede a lista de ferramentas que esse servidor possui e converte pro JSON Schema do LLM.
   */
  private async discoverAndRegisterTools(registry: ToolRegistry): Promise<void> {
    const response = await this.client.listTools();

    if (!response || !response.tools) {
      logger.warn(`[MCP] Nenhum tool exposto pelo servidor ${this.name}.`);
      return;
    }

    logger.info(`[MCP] ${response.tools.length} modulos/tools encontrados no servidor ${this.name}`);

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
        logger.warn(`[MCP] Tool com nome invalido ignorada no servidor ${this.name}: ${tool.name}`);
        continue;
      }

      const safeName = this.resolveNonCollidingToolName(registry, baseToolName);
      const mcpTool = new McpToolWrapper(
        this.client,
        safeName,
        tool.name,
        tool.description || `Ferramenta externa MCP: ${tool.name}`,
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
          tool.description || `Ferramenta externa MCP: ${tool.name}`,
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
    logger.warn(`[MCP] Tool "${baseToolName}" ja existia; registrando como "${candidate}".`);
    return candidate;
  }

  /**
   * Desconecta graciosamente o processo e a stream stdio.
   */
  public async disconnect(): Promise<void> {
    logger.info(`[MCP] Desconectando servidor ${this.name}...`);
    try {
      await this.transport.close();
    } catch (e: any) {
      logger.error(`[MCP] Erro desconectando transport: ${e.message}`);
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
