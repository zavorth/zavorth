import { BaseTool } from './BaseTool.js';
import { ExternalAiRelayService, ExternalAiRelayTask } from '../services/ExternalAiRelayService.js';

export class QueryExternalAiTool extends BaseTool {
  public readonly name = 'query_external_ai';
  public readonly description =
    'Sends a question or YouTube link to a specific external provider and returns the literal response obtained via official API. Supports Gemini, ChatGPT/OpenAI, DeepSeek and Qwen via Puter.';

  public readonly parameters = {
    type: 'object' as const,
    properties: {
      provider: {
        type: 'string',
        description: 'Desired external provider.',
        enum: ['gemini', 'chatgpt', 'openai', 'deepseek', 'qwen', 'puter'],
      },
      task: {
        type: 'string',
        description: 'Type of external relay to execute.',
        enum: ['chat', 'youtube_transcription'],
      },
      prompt: {
        type: 'string',
        description: 'Question/instruction to send to the provider. For youtube_transcription, may serve as optional extra instruction.',
      },
      youtubeUrl: {
        type: 'string',
        description: 'YouTube URL to send for transcription. Required for youtube_transcription.',
      },
      systemPrompt: {
        type: 'string',
        description: 'Optional system instruction to guide the external provider before the main question.',
      },
    },
    required: ['provider', 'task'],
  };

  private relayService = new ExternalAiRelayService();

  public async execute(args: Record<string, unknown>): Promise<string> {
    const provider = this.getStringArg(args.provider);
    const task = this.getStringArg(args.task) as ExternalAiRelayTask;
    const prompt = this.getOptionalStringArg(args.prompt);
    const systemPrompt = this.getOptionalStringArg(args.systemPrompt);
    const youtubeUrl = this.getOptionalStringArg(args.youtubeUrl);

    if (!provider) {
      throw new Error('The "provider" parameter is required.');
    }

    if (!task) {
      throw new Error('The "task" parameter is required.');
    }

    const result = await this.relayService.execute({
      provider,
      task,
      prompt,
      systemPrompt,
      youtubeUrl,
    });

    const warningsBlock =
      result.warnings.length > 0
        ? `Warnings:\n${result.warnings.map((warning) => `- ${warning}`).join('\n')}`
        : 'Warnings: none';

    return [
      'External relay completed.',
      `Requested provider: ${result.requestedProvider}`,
      `Effective provider: ${result.normalizedProvider}`,
      `Task: ${result.task}`,
      `Model used: ${result.model}`,
      `Source: ${result.source}`,
      warningsBlock,
      'IMPORTANT: if the user asked for the provider literal answer, return the block below without paraphrasing.',
      '--- PROVIDER_LITERAL_RESPONSE_START ---',
      result.rawResponse,
      '--- PROVIDER_LITERAL_RESPONSE_END ---',
    ].join('\n\n');
  }

  private getStringArg(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private getOptionalStringArg(value: unknown): string | undefined {
    const normalized = this.getStringArg(value);
    return normalized || undefined;
  }
}
