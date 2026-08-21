import { asErrorLike } from '../../utils/errorLike';
/**
 * GeminiGroundingSearchAdapter - Zavorth-native adapter for Gemini Grounding search.
 *
 * Uses Google Search Grounding through Gemini to return synthesized answers with citations.
 *
 * Used when mode='grounded' in SearchQueryRequest.
 *
 * Architecture references:
 * - docs/native-absorption-execution-plan.md
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
import type {
  ISearchAdapter,
  SearchAdapterCapability,
} from '../../contracts/search/SearchAdapterContract.js';
import type { SemanticIntent } from '../../contracts/search/SemanticIntentContract.js';

export class GeminiGroundingSearchAdapter implements ISearchAdapter {
  public readonly adapterId = 'gemini-grounding';
  public readonly displayName = 'Gemini grounded search';
  public readonly supportedModes: ReadonlyArray<SearchQueryMode> = ['grounded'];
  public readonly capabilities: ReadonlyArray<SearchAdapterCapability> = ['search'];

  public async isAvailable(): Promise<boolean> {
    return true;
  }

  public async search(request: SearchQueryRequest, _intent: SemanticIntent): Promise<AdapterSearchOutput> {
    const query = request.query;
    logger.info(`[GeminiGroundingSearchAdapter] Grounded search: "${query}"`);

    const keys = config.geminiApiKeys?.length > 0
      ? config.geminiApiKeys
      : [config.geminiApiKey].filter(Boolean);

    if (keys.length === 0) {
      throw new GroundingAdapterError(this.adapterId, 'No Gemini key is configured for grounding search.');
    }

    for (const key of keys) {
      try {
        return await this.executeGroundedSearch(key, query);
      } catch (error: unknown) {
        const err = asErrorLike(error);
        logger.warn(`[GeminiGroundingSearchAdapter] Key failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    throw new GroundingAdapterError(this.adapterId, 'All Gemini keys failed during grounding search.');
  }

  // Execution with a specific key

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
            `Search and answer completely and in detail about: "${query}"`,
            '',
            'Instructions:',
            '- Use current information from the web',
            '- Cite sources whenever possible',
            '- Be analytical and neutral',
            '- Format with Markdown bullets',
            '- If data conflicts, point out the divergence',
          ].join('\n'),
        }],
      }],
    });

    const response = result.response;
    const text = response.text();

    // Extract citations from grounding metadata.
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

export class GroundingAdapterError extends Error {
  public readonly adapterId: string;

  constructor(adapterId: string, detail: string) {
    super(`[${adapterId}] Grounding error: ${detail}`);
    this.name = 'GroundingAdapterError';
    this.adapterId = adapterId;
  }
}
