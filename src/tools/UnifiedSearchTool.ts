/**
 * UnifiedSearchTool - Zavorth-native unified web search tool for LLM use.
 *
 * This tool is the agent/LLM-facing interface for the `search.query` capability.
 * It replaces direct WebSearchTool or DeepSearchService calls with one configurable
 * search entry point.
 *
 * Responsibilities:
 * - Define the parameter schema for the LLM.
 * - Convert LLM arguments into a SearchQueryRequest.
 * - Invoke SearchQueryService.
 * - Return formatted results with quality gate and citations.
 *
 * Architecture references:
 * - docs/native-absorption-execution-plan.md
 * - src/contracts/SearchQueryContract.ts
 * - src/services/SearchQueryService.ts
 *
 * @module tools/UnifiedSearchTool
 * @since 2026-05-03
 * @author Zavorth Core Team
 */

import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { SearchQueryService } from '../services/SearchQueryService.js';
import type {
  SearchQueryRequest,
  SearchQueryResult,
  SearchQueryMode,
  SearchEvidenceDomain,
} from '../contracts/SearchQueryContract.js';

// Tool

export class UnifiedSearchTool extends BaseTool {
  public readonly name: string = 'web_search';

  public readonly description: string =
    'Searches current information on the internet. Supports quick search, deep search with evidence ranking, and grounded search with synthesis and citations.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query, for example "latest artificial intelligence news" or "USD exchange rate today".',
      },
      mode: {
        type: 'string',
        description: "Search mode: 'quick' (fast, no synthesis), 'deep' (with evidence ranking and extraction), 'grounded' (LLM synthesis with citations). Default: 'deep'.",
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (1-10). Default: 5.',
      },
      evidence_domain: {
        type: 'string',
        description: "Evidence profile: 'auto', 'general', 'medical', 'legal', 'scientific', 'finance', 'consumer', 'technical', 'public_policy', 'ai_news'. Default: 'auto'.",
      },
      extract_pages: {
        type: 'boolean',
        description: "When true, extracts excerpts from top pages to reduce hallucination. Default: true when mode='deep'.",
      },
    },
    required: ['query'],
  };

  private readonly service: SearchQueryService;

  constructor(options?: { service?: SearchQueryService }) {
    super();
    this.service = options?.service || new SearchQueryService();
  }

  // Execution

  public async execute(args: Record<string, unknown>): Promise<string> {
    const request = this.buildRequest(args);
    const result = await this.service.search(request);

    if (!result.ok) {
      return this.formatErrorResponse(result);
    }

    return this.formatSuccessResponse(result);
  }

  // Argument conversion

  private buildRequest(args: Record<string, unknown>): SearchQueryRequest {
    const mode = String(args.mode || args.search_mode || 'deep').toLowerCase();
    const validModes = ['quick', 'deep', 'grounded'];
    const effectiveMode = validModes.includes(mode) ? mode as SearchQueryMode : 'deep';

    return {
      query: String(args.query || ''),
      mode: effectiveMode,
      limit: typeof args.limit === 'number' ? args.limit : 5,
      evidenceDomain: (args.evidence_domain || args.evidenceDomain || args.domainProfile || args.domain_profile || args.domain || 'auto') as SearchEvidenceDomain | 'auto',
      providerHints: this.buildProviderHints(args),
      extractPages: typeof args.extract_pages === 'boolean'
        ? args.extract_pages
        : typeof args.extractPages === 'boolean'
          ? args.extractPages
          : undefined,
    };
  }

  private buildProviderHints(args: Record<string, unknown>): Record<string, unknown> | null {
    const existing = args.providerHints && typeof args.providerHints === 'object' && !Array.isArray(args.providerHints)
      ? args.providerHints as Record<string, unknown>
      : {};
    const providerId = String(
      existing.providerId
      || existing.preferredProvider
      || args.provider
      || args.providerId
      || args.search_provider
      || args.searchProvider
      || '',
    ).trim();
    const modelName = String(existing.modelName || args.model || args.modelName || '').trim();
    const output = {
      ...existing,
      ...(providerId ? { providerId } : {}),
      ...(modelName ? { modelName } : {}),
    };
    return Object.keys(output).length > 0 ? output : null;
  }

  // Response formatting

  private formatSuccessResponse(result: SearchQueryResult): string {
    const lines: string[] = [];

    lines.push(`QUALITY_GATE: ${result.qualityGate.status}`);
    lines.push(`EVIDENCE_PROFILE: ${result.evidenceDomain}`);
    lines.push(`Query: "${result.items[0]?.providerEvidence.effectiveQuery || ''}"`);
    lines.push(`Mode: ${result.mode}`);
    lines.push(`Strong sources: ${result.qualityGate.highSignalCount}/${result.qualityGate.highSignalRequired}.`);
    lines.push(`Host diversity: ${result.qualityGate.hostDiversity}/${result.items.length}.`);

    const feedLabels = new Set<string>();
    let hasTimeFilter = false;
    for (const item of result.items) {
      const feedLabel = item.providerEvidence.metadata?.feedLabel;
      if (typeof feedLabel === 'string') {
        feedLabels.add(`fallback ${feedLabel}`);
      }
      if (item.providerEvidence.metadata?.publishedAt) {
        hasTimeFilter = true;
      }
    }
    if (feedLabels.size > 0) {
      lines.push('Source feed(s):');
      feedLabels.forEach((label) => lines.push(`- ${label}`));
    }
    if (hasTimeFilter) {
      lines.push('Time filter: results were published recently and filtered by recency window.');
      const reqLimit = result.qualityGate.requestedLimit || result.items.length || 5;
      lines.push(`Recent results found: ${result.items.length}/${reqLimit}.`);
      lines.push('Do not produce a broad briefing — insufficient news sources found for the requested time window.');
    }

    if (result.qualityGate.guidance) {
      lines.push(result.qualityGate.guidance);
    }

    if (result.qualityGate.status === 'weak_domain_sources') {
      lines.push('Warning: returned sources did not meet the minimum authority threshold. Do not present this as a definitive answer.');
    }

    if (result.qualityGate.status === 'insufficient_news_results') {
      lines.push('News quality gate: insufficient news results — online verification failed. Do not treat this as verified current information.');
    }

    if (result.qualityGate.status === 'insufficient_results') {
      lines.push('Do not treat this as verified current information.');
      lines.push('I could not find enough recent news results — online verification failed.');
      lines.push('Do not produce a broad briefing — insufficient sources.');
    }

    if (result.qualityGate.status === 'fresh_news_results_ok') {
      lines.push(`Fresh news results: ${result.items.length} sources from ${result.qualityGate.hostDiversity} hosts.`);
      lines.push('Do not produce a broad global politics briefing — sufficient recent news found.');
    }

    if (result.groundedSynthesis?.synthesizedText) {
      lines.push('');
      lines.push('--- Grounded Synthesis ---');
      lines.push(result.groundedSynthesis.synthesizedText);

      if (result.groundedSynthesis.citations.length > 0) {
        lines.push('');
        lines.push('Sources:');
        result.groundedSynthesis.citations.forEach((citation, i) => {
          lines.push(`${i + 1}. ${citation.title}: ${citation.url}`);
        });
      }

      return lines.join('\n').trim();
    }

    lines.push('');
    result.items.forEach((item, index) => {
      lines.push(`${index + 1}. **${item.title}**`);
      lines.push(`   URL: ${item.url}`);
      lines.push(`   Host: ${item.host}`);
      lines.push(`   Source strength: ${item.highSignal ? 'high' : item.evidenceScore >= 20 ? 'medium' : 'low'} (${item.evidenceScore})`);

      if (item.scoreReasons.length > 0) {
        lines.push(`   Ranking reasons: ${item.scoreReasons.join(', ')}`);
      }

      const knownSource = item.providerEvidence.metadata?.knownSource;
      if (typeof knownSource === 'string') {
        lines.push(`   Known source (known-source): ${knownSource}`);
      }

      lines.push(`   Snippet: ${item.snippet || 'Snippet unavailable.'}`);

      if (item.extractedContent?.excerpt) {
        if (item.extractedContent.title && item.extractedContent.title !== item.title) {
          lines.push(`   Extracted title: ${item.extractedContent.title}`);
        }
        if (item.extractedContent.publishedAt) {
          lines.push(`   Extracted date: ${item.extractedContent.publishedAt}`);
        }
        lines.push(`   Page excerpt: ${item.extractedContent.excerpt}`);
      } else if (item.extractedContent?.error) {
        lines.push(`   Extraction: unavailable (${item.extractedContent.error})`);
      }

      lines.push('');
    });

    return lines.join('\n').trim();
  }

  private formatErrorResponse(result: SearchQueryResult): string {
    const lines = [
      `QUALITY_GATE: ${result.qualityGate.status}`,
      `Query: "${result.error?.message || ''}"`,
    ];

    if (result.error?.code === 'ALL_PROVIDERS_FAILED') {
      lines.push('The main search failed across all providers.');
      lines.push('Do not treat this as verified current information.');
      lines.push('Do not treat this as verified current information — online verification failed.');
    }

    if (result.qualityGate.status === 'insufficient_news_results') {
      lines.push('News quality gate: insufficient news results — online verification failed.');
    }

    lines.push(result.error?.message || 'Unknown search error.');

    return lines.join('\n');
  }
}
