/**
 * Zavorth-native adapter for media analysis through Gemini Vision.
 *
 * Este adapter usa modelos Gemini com capacidade multimodal para analisar
 * images, audio, and video, returning descriptions, extractions, and classifications.
 *
 * The adapter receives only binary data (buffer) plus metadata.
 * Nunca recebe URLs externas como entrada.
 *
 * Architectural references:
 * - docs/native-absorption-execution-plan.md
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
      throw new VisionAdapterError(this.adapterId, 'No Gemini key configured for media analysis.');
    }

    for (const key of keys) {
      try {
        return await this.analyzeWithKey(key, input);
      } catch (err: any) { const error = err; const e = err;
        logger.warn(`[GeminiVisionAnalysisAdapter] Key failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    throw new VisionAdapterError(this.adapterId, 'All Gemini keys failed during media analysis.');
  }

  // -------------------------------------------------------------------------
  // Analysis with a specific key.
  // -------------------------------------------------------------------------

  private async analyzeWithKey(apiKey: string, input: AdapterAnalysisInput): Promise<AdapterAnalysisOutput> {
    const modelId = input.contentType.startsWith('audio/')
      ? (config.geminiTranscriptionModel || config.geminiVideoModel || config.geminiModel || 'gemini-2.0-flash')
      : (config.geminiModel || 'gemini-2.0-flash');
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
      sensitiveContentReason: sensitiveContent ? 'Potentially sensitive content detected by the model.' : null,
      tokensUsed: usage?.totalTokenCount || null,
      providerEvidence: evidence,
    };
  }

  // -------------------------------------------------------------------------
  // Prompt construction.
  // -------------------------------------------------------------------------

  private buildPrompt(input: AdapterAnalysisInput): string {
    const base = this.getBasePrompt(input.analysisType);
    const userPrompt = input.prompt ? `\n\nAdditional user instruction: ${input.prompt}` : '';
    const responseLanguage = typeof input.providerHints?.responseLanguage === 'string'
      ? input.providerHints.responseLanguage.trim()
      : '';
    const languageInstruction = responseLanguage
      ? `Responda em ${responseLanguage}.`
      : 'Respond in the same language as the user instruction.';

    return `${base}${userPrompt}\n\n${languageInstruction} Seja detalhado mas conciso.`;
  }

  private getBasePrompt(analysisType: string): string {
    switch (analysisType) {
      case 'extract':
        return [
          'Analyze this media and extract all visible text.',
          'If it is an image, perform complete OCR.',
          'If it is audio, transcribe spoken content.',
          'If it is video, transcribe speech and visible on-screen text.',
          'Return the extracted text in an organized way.',
        ].join('\n');

      case 'classify':
        return [
          'Analyze this media and classify it into relevant categories.',
          'For each category, indicate confidence level (high/medium/low).',
          'Consider content type, theme, style, target audience, and context.',
          'List classifications in a structured format.',
        ].join('\n');

      case 'qa':
        return [
          'Analyze this media to answer the user question.',
          'Base your answer exclusively on visible/audible media content.',
          'If the answer cannot be determined from the content, say that clearly.',
        ].join('\n');

      case 'describe':
      default:
        return [
          'Describe this media content in detail.',
          'Include main visual elements, colors, composition, visible text, people, and objects.',
          'If it is audio, describe sounds, voices, music, and sound environment.',
          'If it is video, describe scenes, actions, and transitions.',
          'Mention whether there is sensitive content or content that deserves attention.',
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
