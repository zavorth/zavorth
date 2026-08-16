import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { McpTtsProviderConfig } from '../TtsProviderConfigSchema.js';
import type {
  ISpeechSynthesisAdapter,
  TtsSynthesizeInput,
  TtsSynthesizeOutput,
  TtsTransportType,
  TtsVoiceInfo,
} from '../SpeechSynthesisContract.js';
import { ttsEvidence, ttsReadPath, ttsStringOrEmpty } from '../TtsAdapterUtils.js';

type CallToolResult = {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
};

/**
 * MCP transport adapter.
 * Talks to an MCP server exposing a synthesis tool and reads the audio back
 * from its result blocks (raw base64, base64 JSON field, or a JSON object).
 */
export class McpSynthesisAdapter implements ISpeechSynthesisAdapter {
  public readonly providerId: string;
  public readonly transport: TtsTransportType = 'mcp';
  public readonly modelId: string | null;
  public readonly defaultVoiceId: string | null;

  private readonly config: McpTtsProviderConfig;
  private client: Client | null = null;
  private clientTransport: StdioClientTransport | null = null;

  constructor(config: McpTtsProviderConfig) {
    this.config = config;
    this.providerId = config.providerId;
    this.modelId = config.modelId || null;
    this.defaultVoiceId = config.defaultVoiceId || null;
  }

  public isAvailable(): boolean {
    return true;
  }

  public listVoices(): TtsVoiceInfo[] {
    return this.config.voices;
  }

  public async synthesize(input: TtsSynthesizeInput): Promise<TtsSynthesizeOutput> {
    const client = await this.ensureClient();
    const response = (await client.callTool({
      name: this.config.toolName,
      arguments: {
        text: input.text,
        voice: input.voiceId || this.defaultVoiceId || undefined,
        language: input.language || this.config.languageCode || undefined,
        speed: typeof input.speed === 'number' ? input.speed : undefined,
        pitch: typeof input.pitch === 'number' ? input.pitch : undefined,
        format: input.outputFormat || 'mp3',
        model: this.modelId || undefined,
      },
    })) as CallToolResult;

    if (response.isError) {
      throw new Error(`${this.providerId} mcp adapter: tool "${this.config.toolName}" returned an error.`);
    }

    const audio = this.extractAudio(response);
    if (!audio || audio.length === 0) {
      throw new Error(`${this.providerId} mcp adapter returned no audio bytes.`);
    }
    const format = input.outputFormat || 'mp3';
    return {
      audio,
      format,
      contentType: 'audio/mpeg',
      providerEvidence: ttsEvidence(this.providerId, this.modelId, {
        mode: 'batch',
        transport: 'mcp',
        server: this.config.mcpServerId,
        tool: this.config.toolName,
      }),
    };
  }

  private extractAudio(response: CallToolResult): Buffer | null {
    const texts = (response.content || [])
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => String(block.text));
    const joined = texts.join('\n');
    if (!joined.trim()) {
      return null;
    }
    try {
      const parsed = JSON.parse(joined);
      if (parsed && typeof parsed === 'object') {
        const base64 = ttsStringOrEmpty(
          this.config.audioSource === 'base64-json'
            ? ttsReadPath(parsed, this.config.audioResultPath)
            : (parsed as Record<string, unknown>).audio,
        );
        if (base64) {
          return Buffer.from(base64, 'base64');
        }
      }
    } catch (parseError: unknown) {
      // fall through to raw text
    }
    const raw = ttsStringOrEmpty(joined);
    return raw ? Buffer.from(raw, 'base64') : null;
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
      { name: 'zavorth-tts', version: '1.0.0' },
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
