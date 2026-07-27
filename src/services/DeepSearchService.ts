import type { LogRepository } from '../storage/LogRepository.js';
import { SearchQueryService } from './SearchQueryService.js';

export class DeepSearchService {
  private readonly searchQueryService: SearchQueryService;

  constructor(
    private readonly logRepo: LogRepository,
    options: { searchQueryService?: SearchQueryService } = {},
  ) {
    this.searchQueryService = options.searchQueryService || new SearchQueryService();
  }

  public async research(query: string): Promise<string> {
    return this.runSearch(query, 'deep', 6);
  }

  public async deepResearch(query: string): Promise<string> {
    return this.runSearch(query, 'grounded', 8);
  }

  private async runSearch(query: string, mode: 'deep' | 'grounded', limit: number): Promise<string> {
    this.logRepo.log('info', 'DeepSearch', `Starting ${mode} research query: ${query}`);

    const result = await this.searchQueryService.search({
      query,
      mode,
      limit,
      evidenceDomain: 'auto',
      extractPages: true,
    });

    if (!result.ok) {
      const message = result.error?.message || 'Search failed across configured providers.';
      this.logRepo.log('warn', 'DeepSearch', message);
      return `Search unavailable: ${message}`;
    }

    const lines: string[] = [
      `QUALITY_GATE: ${result.qualityGate.status}`,
      `EVIDENCE_PROFILE: ${result.evidenceDomain}`,
      `Mode: ${result.mode}`,
      `Strong sources: ${result.qualityGate.highSignalCount}/${result.qualityGate.highSignalRequired}.`,
      '',
    ];

    if (result.groundedSynthesis?.synthesizedText) {
      lines.push(result.groundedSynthesis.synthesizedText);
      if (result.groundedSynthesis.citations.length > 0) {
        lines.push('', 'Sources:');
        result.groundedSynthesis.citations.forEach((citation, index) => {
          lines.push(`${index + 1}. ${citation.title}: ${citation.url}`);
        });
      }
      return lines.join('\n').trim();
    }

    result.items.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.title}`);
      lines.push(`URL: ${item.url}`);
      lines.push(`Source strength: ${item.highSignal ? 'high' : item.evidenceScore >= 20 ? 'medium' : 'low'} (${item.evidenceScore})`);
      lines.push(`Snippet: ${item.snippet || 'Snippet unavailable.'}`);
      if (item.extractedContent?.excerpt) {
        lines.push(`Page excerpt: ${item.extractedContent.excerpt}`);
      }
      lines.push('');
    });

    return lines.join('\n').trim();
  }
}
