import { config } from '../config/index.js';
import { ProviderFactory } from '../providers/ProviderFactory.js';
import { ChatMessage, ILlmProvider } from '../providers/ILlmProvider.js';
import { GeminiVideoAnalyzer } from '../gateways/channels/telegram/GeminiVideoAnalyzer.js';
import { logger } from '../logger.js';

export type ExternalAiRelayTask = 'chat' | 'youtube_transcription';
type NormalizedRelayProvider = 'gemini' | 'openai' | 'deepseek' | 'qwen';

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

    throw new Error(`Tarefa externa nao suportada: ${request.task}`);
  }

  private async executeChatTask(
    normalizedProvider: NormalizedRelayProvider,
    request: ExternalAiRelayRequest
  ): Promise<ExternalAiRelayResult> {
    const prompt = request.prompt?.trim();
    if (!prompt) {
      throw new Error('Para a tarefa "chat", o campo "prompt" e obrigatorio.');
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
      throw new Error(`O provedor ${normalizedProvider} nao retornou texto util para esta consulta.`);
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
      throw new Error('Para a tarefa "youtube_transcription", o campo "youtubeUrl" e obrigatorio.');
    }

    if (normalizedProvider !== 'gemini') {
      throw new Error(
        `Transcricao direta de link do YouTube via relay esta disponivel apenas para Gemini no momento. Provedor solicitado: ${request.provider}.`
      );
    }

    if (!this.isYouTubeUrl(youtubeUrl)) {
      throw new Error('A tarefa "youtube_transcription" aceita apenas links validos do YouTube.');
    }

    const analyzer = new GeminiVideoAnalyzer({
      apiKey: config.geminiTranscriptionApiKey || config.geminiApiKey,
      model: config.geminiTranscriptionModel,
    });

    if (!analyzer.isEnabled()) {
      throw new Error('Gemini nao esta configurado para transcricao de YouTube neste ambiente.');
    }

    let analysis;

    try {
      analysis = await analyzer.transcribeYouTubeUrl(youtubeUrl, undefined, request.prompt);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('input token count exceeds')) {
        throw new Error(
          'O proprio Gemini recusou a transcricao direta desse link por exceder o limite de contexto da API. Para videos longos, use o fluxo nativo de resumo/transcricao do Zavorth em vez do relay direto.'
        );
      }
      throw error;
    }

    if (!analysis?.analysisText?.trim()) {
      throw new Error('O Gemini nao retornou uma transcricao util para este link do YouTube.');
    }

    return {
      requestedProvider: request.provider,
      normalizedProvider,
      task: 'youtube_transcription',
      model: config.geminiTranscriptionModel,
      source: analysis.source,
      rawResponse: analysis.analysisText.trim(),
      warnings: analysis.warnings,
    };
  }

  private normalizeProvider(provider: string): NormalizedRelayProvider {
    const normalized = provider.toLowerCase().trim();

    switch (normalized) {
      case 'gemini':
        return 'gemini';
      case 'chatgpt':
      case 'openai':
        return 'openai';
      case 'deepseek':
        return 'deepseek';
      case 'qwen':
      case 'puter':
      case 'alibaba':
      case 'dashscope':
        return 'qwen';
      default:
        throw new Error(
          `Provedor externo nao suportado: ${provider}. Opcoes atuais: gemini, chatgpt, openai, deepseek, qwen.`
        );
    }
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
        return 'desconhecido';
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
        return 'API externa';
    }
  }
}
