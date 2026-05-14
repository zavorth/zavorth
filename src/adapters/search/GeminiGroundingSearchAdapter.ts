/**
 * GeminiGroundingSearchAdapter — Adapter Zavorth-nativo para busca via Gemini Grounding.
 *
 * Este adapter usa a capacidade de Google Search Grounding do modelo Gemini
 * para executar buscas que retornam respostas sintetizadas com citações.
 *
 * Usado quando mode='grounded' no SearchQueryRequest.
 *
 * Referências arquiteturais:
 * - docs/327-zavorth-native-absorption-execution-plan.md (Wave 2)
 * - src/contracts/SearchQueryContract.ts
 *
 * @module adapters/search/GeminiGroundingSearchAdapter
 * @since 2026-05-03
 * @author Zavorth Core Team
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../../config/index.js';
import { logger } from '../../logger.js';
import type {
  ISearchQueryAdapter,
  SearchQueryMode,
  SearchQueryRequest,
  AdapterSearchOutput,
  SearchGroundedSynthesis,
  SearchCitation,
} from '../../contracts/SearchQueryContract.js';

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class GeminiGroundingSearchAdapter implements ISearchQueryAdapter {
  public readonly adapterId = 'gemini-grounding';
  public readonly supportedModes: SearchQueryMode[] = ['grounded'];

  public async search(request: SearchQueryRequest): Promise<AdapterSearchOutput> {
    const query = request.query;
    logger.info(`[GeminiGroundingSearchAdapter] Grounded search: "${query}"`);

    const keys = config.geminiApiKeys?.length > 0
      ? config.geminiApiKeys
      : [config.geminiApiKey].filter(Boolean);

    if (keys.length === 0) {
      throw new GroundingAdapterError(this.adapterId, 'Nenhuma chave Gemini configurada para grounding search.');
    }

    for (const key of keys) {
      try {
        const result = await this.executeGroundedSearch(key, query);
        return result;
      } catch (err) {
        logger.warn(`[GeminiGroundingSearchAdapter] Key failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    throw new GroundingAdapterError(this.adapterId, 'Todas as chaves Gemini falharam no grounding search.');
  }

  // -------------------------------------------------------------------------
  // Execução com uma chave específica
  // -------------------------------------------------------------------------

  private async executeGroundedSearch(apiKey: string, query: string): Promise<AdapterSearchOutput> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: config.geminiModel || 'gemini-2.0-flash',
      tools: [{ googleSearch: {} } as any],
    });

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{
          text: [
            `Pesquise e responda de forma completa e detalhada sobre: "${query}"`,
            '',
            'Instrucoes:',
            '- Use informacoes atualizadas da web',
            '- Cite as fontes quando possivel',
            '- Seja analitico e neutro',
            '- Formate com marcadores Markdown',
            '- Se houver dados contraditorios, aponte divergencias',
          ].join('\n'),
        }],
      }],
    });

    const response = result.response;
    const text = response.text();

    // Extrai citações do grounding metadata.
    const groundingMetadata = (response.candidates?.[0] as any)?.groundingMetadata;
    const citations = this.extractCitations(groundingMetadata);

    const synthesis: SearchGroundedSynthesis = {
      synthesizedText: text,
      citations,
      modelId: config.geminiModel || 'gemini-2.0-flash',
    };

    return {
      items: citations.map((citation, index) => ({
        title: citation.title,
        url: citation.url,
        description: '',
        originalRank: index + 1,
        sourceQuery: query,
      })),
      groundedSynthesis: synthesis,
      providerId: this.adapterId,
    };
  }

  private extractCitations(metadata: any): SearchCitation[] {
    if (!metadata?.groundingChunks) {
      return [];
    }

    return metadata.groundingChunks
      .filter((chunk: any) => chunk.web?.uri)
      .slice(0, 8)
      .map((chunk: any) => ({
        title: chunk.web.title || chunk.web.uri,
        url: chunk.web.uri,
      }));
  }
}

// ---------------------------------------------------------------------------
// Erros tipados
// ---------------------------------------------------------------------------

export class GroundingAdapterError extends Error {
  public readonly adapterId: string;

  constructor(adapterId: string, detail: string) {
    super(`[${adapterId}] Grounding error: ${detail}`);
    this.name = 'GroundingAdapterError';
    this.adapterId = adapterId;
  }
}
