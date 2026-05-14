/**
 * GeminiVisionAnalysisAdapter — Adapter Zavorth-nativo para análise de mídia via Gemini Vision.
 *
 * Este adapter usa modelos Gemini com capacidade multimodal para analisar
 * imagens, áudio e vídeo, retornando descrições, extrações e classificações.
 *
 * O adapter recebe APENAS dados binários (buffer) + metadados.
 * Nunca recebe URLs externas como entrada.
 *
 * Referências arquiteturais:
 * - docs/327-zavorth-native-absorption-execution-plan.md (Wave 3)
 * - src/contracts/MediaUnderstandingContract.ts
 *
 * @module adapters/media/GeminiVisionAnalysisAdapter
 * @since 2026-05-03
 * @author Zavorth Core Team
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../../config/index.js';
import { logger } from '../../logger.js';
import type {
  IMediaUnderstandingAdapter,
  MediaUnderstandingModality,
  AdapterAnalysisInput,
  AdapterAnalysisOutput,
  MediaAnalysisProviderEvidence,
} from '../../contracts/MediaUnderstandingContract.js';

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class GeminiVisionAnalysisAdapter implements IMediaUnderstandingAdapter {
  public readonly adapterId = 'gemini-vision';
  public readonly supportedModalities: MediaUnderstandingModality[] = ['image', 'audio', 'video'];

  public async analyze(input: AdapterAnalysisInput): Promise<AdapterAnalysisOutput> {
    const keys = config.geminiApiKeys?.length > 0
      ? config.geminiApiKeys
      : [config.geminiApiKey].filter(Boolean);

    if (keys.length === 0) {
      throw new VisionAdapterError(this.adapterId, 'Nenhuma chave Gemini configurada para análise de mídia.');
    }

    for (const key of keys) {
      try {
        return await this.analyzeWithKey(key, input);
      } catch (err) {
        logger.warn(`[GeminiVisionAnalysisAdapter] Key failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    throw new VisionAdapterError(this.adapterId, 'Todas as chaves Gemini falharam na análise de mídia.');
  }

  // -------------------------------------------------------------------------
  // Análise com uma chave específica
  // -------------------------------------------------------------------------

  private async analyzeWithKey(apiKey: string, input: AdapterAnalysisInput): Promise<AdapterAnalysisOutput> {
    const modelId = config.geminiModel || 'gemini-2.0-flash';
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelId });

    const prompt = this.buildPrompt(input);
    const inlineData = {
      mimeType: input.contentType,
      data: input.data.toString('base64'),
    };

    logger.info(`[GeminiVisionAnalysisAdapter] Analyzing ${input.contentType} (${input.data.length} bytes, type=${input.analysisType})`);

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { inlineData },
          { text: prompt },
        ],
      }],
    });

    const response = result.response;
    const text = response.text();
    const usage = (response as any).usageMetadata;

    // Analisa sinais no texto de resposta.
    const textLower = text.toLowerCase();
    const hasVisibleText = /\b(text|texto|escrit[oa]|letter|word|titulo|heading|caption|label)\b/i.test(text);
    const hasFaces = /\b(face|rosto|pessoa|person|people|retrato|portrait)\b/i.test(text);
    const sensitiveContent = /\b(nsfw|explicit|violenc|gore|nude|nudez|sensivel|sensitive|inappropriate)\b/i.test(textLower);

    const evidence: MediaAnalysisProviderEvidence = {
      providerId: this.adapterId,
      modelId,
      tokensUsed: usage?.totalTokenCount || null,
    };

    return {
      text,
      hasVisibleText,
      hasFaces,
      sensitiveContent,
      sensitiveContentReason: sensitiveContent ? 'Conteúdo potencialmente sensível detectado pelo modelo.' : null,
      tokensUsed: usage?.totalTokenCount || null,
      providerEvidence: evidence,
    };
  }

  // -------------------------------------------------------------------------
  // Construção de prompt
  // -------------------------------------------------------------------------

  private buildPrompt(input: AdapterAnalysisInput): string {
    const base = this.getBasePrompt(input.analysisType);
    const userPrompt = input.prompt ? `\n\nInstrução adicional do usuário: ${input.prompt}` : '';

    return `${base}${userPrompt}\n\nResponda em português brasileiro. Seja detalhado mas conciso.`;
  }

  private getBasePrompt(analysisType: string): string {
    switch (analysisType) {
      case 'extract':
        return [
          'Analise esta mídia e extraia todo texto visível.',
          'Se for uma imagem, faça OCR completo.',
          'Se for áudio, transcreva o conteúdo falado.',
          'Se for vídeo, transcreva falas e texto visível na tela.',
          'Retorne o texto extraído de forma organizada.',
        ].join('\n');

      case 'classify':
        return [
          'Analise esta mídia e classifique-a em categorias relevantes.',
          'Para cada categoria, indique o nível de confiança (alto/médio/baixo).',
          'Considere: tipo de conteúdo, tema, estilo, público-alvo, e contexto.',
          'Liste as classificações em formato estruturado.',
        ].join('\n');

      case 'qa':
        return [
          'Analise esta mídia para responder à pergunta do usuário.',
          'Baseie sua resposta exclusivamente no conteúdo visível/audível da mídia.',
          'Se a resposta não puder ser determinada pelo conteúdo, diga isso claramente.',
        ].join('\n');

      case 'describe':
      default:
        return [
          'Descreva detalhadamente o conteúdo desta mídia.',
          'Inclua: elementos visuais principais, cores, composição, texto visível, pessoas, objetos.',
          'Se for áudio, descreva sons, vozes, música, ambiente sonoro.',
          'Se for vídeo, descreva cenas, ações, transições.',
          'Mencione se há conteúdo sensível ou que merece atenção.',
        ].join('\n');
    }
  }
}

// ---------------------------------------------------------------------------
// Erros tipados
// ---------------------------------------------------------------------------

export class VisionAdapterError extends Error {
  public readonly adapterId: string;

  constructor(adapterId: string, detail: string) {
    super(`[${adapterId}] Vision analysis error: ${detail}`);
    this.name = 'VisionAdapterError';
    this.adapterId = adapterId;
  }
}
