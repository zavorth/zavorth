import { logger } from '../logger.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { AutomaticBrowserTool } from './tools/AutomaticBrowserTool.js';
import type { ToolRegistry } from '../tools/ToolRegistry.js';
import { McpToolPolicy } from './McpToolPolicy.js';
import type { ToolExecutor } from '../execution/ToolExecutor.js';

type ZavorthMcpServerOptions = {
  toolPolicy?: McpToolPolicy;
  toolExecutor?: Pick<ToolExecutor, 'executeTool'> | null;
};

export class ZavorthMcpServer {
  private server: Server;
  private browserTool: AutomaticBrowserTool;
  private toolPolicy: McpToolPolicy;
  private toolExecutor: Pick<ToolExecutor, 'executeTool'> | null;

  constructor(private readonly toolRegistry?: ToolRegistry, options: ZavorthMcpServerOptions = {}) {
    this.server = new Server(
      {
        name: 'zavorth-mcp-embedded-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    this.browserTool = new AutomaticBrowserTool();
    this.toolPolicy = options.toolPolicy || McpToolPolicy.fromEnv();
    this.toolExecutor = options.toolExecutor || null;
  }

  public async start() {
    this.registerTools();

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.error('Zavorth MCP Server running on stdio');
  }

  private registerTools() {
    this.server.setRequestHandler(
      ListToolsRequestSchema,
      async () => {
        const browserDef = this.browserTool.getToolDefinitions();
        const registryDefs = (this.toolRegistry?.getToolDefinitions() || []).map(def => ({
          name: def.name,
          description: def.description,
          inputSchema: def.parameters,
        }));
        
        return {
          tools: this.toolPolicy.filterDefinitions([...browserDef, ...registryDefs]),
        };
      }
    );

    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request: any) => {
        const { name, arguments: args } = request.params;
        const decision = this.toolPolicy.decide(name);
        if (!decision.allowed) {
          logger.error(`[MCP policy] ${decision.reason}`);
          return {
            content: [
              {
                type: 'text',
                text: decision.reason,
              },
            ],
            isError: true,
          };
        }
        
        const browserToolNames = this.browserTool.getToolDefinitions().map(def => def.name);
        if (browserToolNames.includes(name)) {
          return this.browserTool.handleToolCall(name, args);
        }

        const externalTool = this.toolRegistry?.getTool(name);
        if (externalTool) {
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
              content: [
                {
                  type: 'text',
                  text: result,
                },
              ],
              isError: false,
            };
          } catch (err) {
             return {
              content: [
                {
                  type: 'text',
                  text: err instanceof Error ? err.message : String(err),
                },
              ],
              isError: true,
            };
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: `Tool ${name} not supported by ZavorthMcpServer.`,
            },
          ],
          isError: true,
        };
      }
    );
  }

  public shutdown() {
    this.browserTool.shutdown();
    this.server.close();
  }
}
