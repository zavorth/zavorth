import { BaseTool } from './BaseTool.js';
import { ExternalAiRelayService, ExternalAiRelayTask } from '../services/ExternalAiRelayService.js';

export class QueryExternalAiTool extends BaseTool {
  public readonly name = 'query_external_ai';
  public readonly description =
    'Envia uma pergunta ou um link do YouTube para um provedor externo especifico e retorna a resposta literal obtida via API oficial. Suporta Gemini, ChatGPT/OpenAI, DeepSeek e Qwen via Puter.';

  public readonly parameters = {
    type: 'object' as const,
    properties: {
      provider: {
        type: 'string',
        description: 'Provedor externo desejado.',
        enum: ['gemini', 'chatgpt', 'openai', 'deepseek', 'qwen', 'puter'],
      },
      task: {
        type: 'string',
        description: 'Tipo de relay externo a executar.',
        enum: ['chat', 'youtube_transcription'],
      },
      prompt: {
        type: 'string',
        description: 'Pergunta/instrucao a ser enviada ao provedor. Para youtube_transcription, pode servir como instrucao extra opcional.',
      },
      youtubeUrl: {
        type: 'string',
        description: 'URL do YouTube a ser enviada para transcricao. Obrigatoria em youtube_transcription.',
      },
      systemPrompt: {
        type: 'string',
        description: 'Instrucao de sistema opcional para orientar o provedor externo antes da pergunta principal.',
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
      throw new Error('O parametro "provider" e obrigatorio.');
    }

    if (!task) {
      throw new Error('O parametro "task" e obrigatorio.');
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
        ? `Avisos:\n${result.warnings.map((warning) => `- ${warning}`).join('\n')}`
        : 'Avisos: nenhum';

    return [
      'Relay externo concluido.',
      `Provedor solicitado: ${result.requestedProvider}`,
      `Provedor efetivo: ${result.normalizedProvider}`,
      `Tarefa: ${result.task}`,
      `Modelo usado: ${result.model}`,
      `Fonte: ${result.source}`,
      warningsBlock,
      'IMPORTANTE: se o usuario pediu a resposta literal do provedor, devolva o bloco abaixo sem parafrasear.',
      '--- RESPOSTA_LITERAL_DO_PROVEDOR_INICIO ---',
      result.rawResponse,
      '--- RESPOSTA_LITERAL_DO_PROVEDOR_FIM ---',
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
