import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ToolDefinition } from '../providers/ILlmProvider.js';
import { BaseTool } from './BaseTool.js';

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
    try {
      const response = await this.mcpClient.callTool({
        name: this.remoteName,
        arguments: args,
      });

      const textBlocks = this.extractTextBlocks(response.content);
      if (response.isError) {
        const errorMsg = textBlocks.map((block) => block.text).join('\n');
        throw new Error(`[MCP Tool Error] ${errorMsg}`);
      }

      return textBlocks.map((block) => block.text).join('\n');
    } catch (e: any) {
      console.error(`[MCP] Falha ao executar ${this.name}:`, e.message);
      return `Error executing tool: ${e.message}`;
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
