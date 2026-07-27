
import { config } from '../config/index.js';
import { ProviderFactory } from '../providers/ProviderFactory.js';
import { ChatMessage, ILlmProvider } from '../providers/ILlmProvider.js';
import { ProviderRegistry } from '../providers/ProviderRegistry.js';
import { logger } from '../logger.js';

export type ExternalAiRelayTask = 'chat' | 'youtube_transcription';
type NormalizedRelayProvider = string;

export interface ExternalAiRelayRequest {
  provider: string;
  task: ExternalAiRelayTask;
  prompt?: string;
  systemPrompt?: string;
  youtubeUrl?: string;
}

export interface ExternalAiRelayResult {
  requestedProvider: string;
  normalizedProvider: NormalizedRelayProvider;
  task: ExternalAiRelayTask;
  model: string;
  source: string;
  rawResponse: string;
  warnings: string[];
}

export class ExternalAiRelayService {
  public async execute(request: ExternalAiRelayRequest): Promise<ExternalAiRelayResult> {
    const normalizedProvider = this.normalizeProvider(request.provider);

    if (request.task === 'chat') {
      return this.executeChatTask(normalizedProvider, request);
    }

    if (request.task === 'youtube_transcription') {
      return this.executeYouTubeTranscriptionTask(normalizedProvider, request);
    }

    throw new Error(`Unsupported external task: ${request.task}`);
  }

  private async executeChatTask(
    normalizedProvider: NormalizedRelayProvider,
    request: ExternalAiRelayRequest
  ): Promise<ExternalAiRelayResult> {
    const prompt = request.prompt?.trim();
    if (!prompt) {
      throw new Error('For the "chat" task, "prompt" is required.');
    }

    const provider = this.createProvider(normalizedProvider);
    const messages: ChatMessage[] = [];

    if (request.systemPrompt?.trim()) {
      messages.push({
        role: 'system',
        content: request.systemPrompt.trim(),
      });
    }

    messages.push({
      role: 'user',
      content: prompt,
    });

    const response = await provider.chat(messages);
    const rawResponse = response.content?.trim();

    if (!rawResponse) {
      throw new Error(`Provider ${normalizedProvider} did not return useful text for this query.`);
    }

    return {
      requestedProvider: request.provider,
      normalizedProvider,
      task: 'chat',
      model: this.getModelName(normalizedProvider),
      source: this.getChatSourceLabel(normalizedProvider),
      rawResponse,
      warnings: [],
    };
  }

  private async executeYouTubeTranscriptionTask(
    normalizedProvider: NormalizedRelayProvider,
    request: ExternalAiRelayRequest
  ): Promise<ExternalAiRelayResult> {
    const youtubeUrl = request.youtubeUrl?.trim();
    if (!youtubeUrl) {
      throw new Error('For the "youtube_transcription" task, "youtubeUrl" is required.');
    }

    if (!this.isYouTubeUrl(youtubeUrl)) {
      throw new Error('The "youtube_transcription" task accepts only valid YouTube links.');
    }
    throw new Error(
      `Direct YouTube transcription requires a configured media transcription adapter. Provider requested: ${normalizedProvider}.`
    );
  }

  private normalizeProvider(provider: string): NormalizedRelayProvider {
    const normalized = provider.toLowerCase().trim();
    if (!normalized) {
      throw new Error('Provider is required.');
    }
    if (!ProviderRegistry.has(normalized)) {
      throw new Error(
        `External provider is not registered: ${provider}. Available providers: ${ProviderRegistry.names().join(', ') || 'none'}.`
      );
    }
    return normalized;
  }

  private isYouTubeUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      return host.includes('youtube.com') || host.includes('youtu.be');
    } catch (error: unknown) {logger.warn('[External Ai Relay] parsing failed', error); return false; }
  }

  private createProvider(providerName: NormalizedRelayProvider): ILlmProvider {
    return ProviderFactory.create(providerName);
  }

  private getModelName(providerName: NormalizedRelayProvider): string {
    switch (providerName) {
      case 'gemini':
        return config.geminiModel;
      case 'openai':
        return config.openaiModel;
      case 'deepseek':
        return config.deepseekModel;
      case 'qwen':
        return config.qwenModel;
      default:
        return providerName;
    }
  }

  private getChatSourceLabel(providerName: NormalizedRelayProvider): string {
    switch (providerName) {
      case 'gemini':
        return `Google Gemini API (${config.geminiModel})`;
      case 'openai':
        return `OpenAI API (${config.openaiModel})`;
      case 'deepseek':
        return `DeepSeek API (${config.deepseekModel})`;
      case 'qwen':
        return `Qwen via Puter (${config.qwenModel})`;
      default:
        return `External provider (${providerName})`;
    }
  }
}
