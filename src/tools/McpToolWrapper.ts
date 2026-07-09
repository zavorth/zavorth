import { asErrorLike } from '../utils/errorLike';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ToolDefinition } from '../providers/ILlmProvider.js';
import { BaseTool } from './BaseTool.js';
import { WorkspaceWriteApprovalPayloadCache } from '../services/WorkspaceWriteApprovalPayloadCache.js';
import { logger } from '../logger.js';

type McpTextContent = {
  type: 'text';
  text: string;
};

/**
 * Wrapper dinamico que transforma qualquer ferramenta importada via MCP
 * numa ferramenta nativa que o Zavorth (e o ToolRegistry) entendem e repassam aos LLMs.
 */
export class McpToolWrapper extends BaseTool {
  constructor(
    private readonly mcpClient: Client,
    public readonly name: string,
    private readonly remoteName: string,
    public readonly description: string,
    public readonly parameters: ToolDefinition['parameters'],
    public readonly metadata?: ToolDefinition['metadata'],
  ) {
    super();
  }

  async execute(args: Record<string, unknown>): Promise<string> {
    console.log(`[MCP] Executando ferramenta remota: ${this.name}...`);
    const opId = args.operationId as string;
    try {
      const response = await this.mcpClient.callTool({
        name: this.remoteName,
        arguments: args,
      });

      const textBlocks = this.extractTextBlocks(response.content);
      if (response.isError) {
        const errorMsg = textBlocks.map((block) => block.text).join('\n');

        try {
          const parsed = JSON.parse(errorMsg);
          if (parsed && parsed.error === 'WRITE_APPROVAL_REQUIRED' && parsed.operationId) {
            const cache = WorkspaceWriteApprovalPayloadCache.getInstance();
            cache.cachePayload(parsed.operationId, {
              file: (args.file as string) || (args.directory as string),
              content: args.content as string,
            });
          }
        } catch (error: unknown) {// not a WRITE_APPROVAL_REQUIRED json error
      logger.warn('[Mcp  Wrapper] parsing failed', error);
    }

        throw new Error(`[MCP Tool Error] ${errorMsg}`);
      }

      return textBlocks.map((block) => block.text).join('\n');
    } catch (error: unknown) { const err = asErrorLike(error); console.error(`[MCP] Falha ao executar ${this.name}:`, err.message);
      return `Error executing tool: ${e.message}`;
    } finally {
      if (opId) {
        WorkspaceWriteApprovalPayloadCache.getInstance().clearPayload(opId);
      }
    }
  }

  private extractTextBlocks(content: unknown): McpTextContent[] {
    if (!Array.isArray(content)) {
      return [];
    }

    return content.filter((entry): entry is McpTextContent => this.isTextContent(entry));
  }

  private isTextContent(value: unknown): value is McpTextContent {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Record<string, unknown>;
    return candidate.type === 'text' && typeof candidate.text === 'string';
  }
}
