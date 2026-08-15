import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { McpSttProviderConfig } from '../SttProviderConfigSchema.js';
import type {
  ISpeechTranscriptionAdapter,
  SttTranscribeInput,
  SttTranscribeOutput,
  SttTransportType,
} from '../SpeechTranscriptionContract.js';
import {
  sttBuildSegments,
  sttEvidence,
  sttReadPath,
  sttStringOrEmpty,
} from '../SttAdapterUtils.js';

type CallToolResult = {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
};

/**
 * MCP transport adapter.
 * Talks to an MCP server exposing a transcription tool and reads the
 * transcript from its text result blocks.
 */
export class McpTranscriptionAdapter implements ISpeechTranscriptionAdapter {
  public readonly providerId: string;
  public readonly transport: SttTransportType = 'mcp';
  public readonly modelId: string | null;

  private readonly config: McpSttProviderConfig;
  private client: Client | null = null;
  private clientTransport: StdioClientTransport | null = null;

  constructor(config: McpSttProviderConfig) {
    this.config = config;
    this.providerId = config.providerId;
    this.modelId = config.modelId || null;
  }

  public isAvailable(): boolean {
    return true;
  }

  public async transcribe(input: SttTranscribeInput): Promise<SttTranscribeOutput> {
    const client = await this.ensureClient();
    const response = (await client.callTool({
      name: this.config.toolName,
      arguments: {
        audio: input.audio.toString('base64'),
        contentType: input.contentType,
        model: this.modelId || undefined,
        language: input.languageHint || undefined,
        word_timestamps: input.wordTimestamps || undefined,
        temperature: typeof input.temperature === 'number' ? input.temperature : undefined,
        prompt: input.prompt || undefined,
      },
    })) as CallToolResult;

    if (response.isError) {
      throw new Error(`${this.providerId} mcp adapter: tool "${this.config.toolName}" returned an error.`);
    }

    const joined = (response.content || [])
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => String(block.text))
      .join('\n');
    if (!joined.trim()) {
      throw new Error(`${this.providerId} mcp adapter returned an empty transcript.`);
    }

    let text = joined.trim();
    let payload: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(joined);
      if (parsed && typeof parsed === 'object') {
        payload = parsed as Record<string, unknown>;
        const fromPath = sttStringOrEmpty(sttReadPath(payload, 'text') || sttReadPath(payload, 'transcript'));
        if (fromPath) {
          text = fromPath;
        }
      }
    } catch (parseError: unknown) {
      // plain text transcript — keep `joined`.
    }

    return {
      text,
      language: input.languageHint || null,
      segments: sttBuildSegments(payload, text, input.speakerLabels),
      providerEvidence: sttEvidence(this.providerId, this.modelId, {
        mode: 'batch',
        transport: 'mcp',
        server: this.config.mcpServerId,
        tool: this.config.toolName,
      }),
    };
  }

  private async ensureClient(): Promise<Client> {
    if (this.client) {
      return this.client;
    }
    const transport = new StdioClientTransport({
      command: this.config.mcpServerId,
      args: this.config.serverArgs || [],
    });
    const client = new Client(
      { name: 'zavorth-stt', version: '1.0.0' },
      { capabilities: {} },
    );
    await client.connect(transport);
    this.clientTransport = transport;
    this.client = client;
    return client;
  }

  public async dispose(): Promise<void> {
    if (this.clientTransport) {
      try {
        await this.clientTransport.close();
      } catch (error: unknown) {
        // noop
      }
    }
    this.clientTransport = null;
    this.client = null;
  }
}
