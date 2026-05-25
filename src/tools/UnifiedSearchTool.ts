/**
 * UnifiedSearchTool — Tool Zavorth-nativa para busca web unificada via LLM.
 *
 * Esta tool é a interface voltada ao agente/LLM para a capability `search.query`.
 * Ela substitui a necessidade de invocar diretamente WebSearchTool ou DeepSearchService,
 * centralizando toda busca sob um único ponto de entrada com modos configuráveis.
 *
 * Responsabilidades:
 * - Definir o schema de parâmetros para o LLM.
 * - Converter os argumentos do LLM em um SearchQueryRequest.
 * - Invocar o SearchQueryService.
 * - Retornar resultados formatados com quality gate e citações.
 *
 * Referências arquiteturais:
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
  SearchResultItem,
} from '../contracts/SearchQueryContract.js';

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

export class UnifiedSearchTool extends BaseTool {
  public readonly name = 'web_search';

  public readonly description =
    'Pesquisa informações atualizadas na internet. Suporta busca rápida, busca profunda com ranking de evidência, e busca grounded com síntese e citações.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'A consulta de busca (ex: "últimas notícias sobre inteligência artificial", "cotação do dólar hoje").',
      },
      mode: {
        type: 'string',
        description: "Modo de busca: 'quick' (rápida, sem síntese), 'deep' (com ranking de evidência e extração), 'grounded' (síntese via LLM com citações). Default: 'deep'.",
      },
      limit: {
        type: 'number',
        description: 'Número máximo de resultados (1-10). Default: 5.',
      },
      evidence_domain: {
        type: 'string',
        description: "Perfil de evidência: 'auto', 'general', 'medical', 'legal', 'scientific', 'finance', 'consumer', 'technical', 'public_policy', 'ai_news'. Default: 'auto'.",
      },
      extract_pages: {
        type: 'boolean',
        description: "Se true, extrai trechos das melhores páginas para reduzir alucinação. Default: true quando mode='deep'.",
      },
    },
    required: ['query'],
  };

  private readonly service: SearchQueryService;

  constructor(options?: { service?: SearchQueryService }) {
    super();
    this.service = options?.service || new SearchQueryService();
  }

  // -------------------------------------------------------------------------
  // Execução
  // -------------------------------------------------------------------------

  public async execute(args: Record<string, unknown>): Promise<string> {
    const request = this.buildRequest(args);
    const result = await this.service.search(request);

    if (!result.ok) {
      return this.formatErrorResponse(result);
    }

    return this.formatSuccessResponse(result);
  }

  // -------------------------------------------------------------------------
  // Conversão de argumentos
  // -------------------------------------------------------------------------

  private buildRequest(args: Record<string, unknown>): SearchQueryRequest {
    const mode = String(args.mode || args.search_mode || 'deep').toLowerCase();
    const validModes = ['quick', 'deep', 'grounded'];
    const effectiveMode = validModes.includes(mode) ? mode as any : 'deep';

    return {
      query: String(args.query || ''),
      mode: effectiveMode,
      limit: typeof args.limit === 'number' ? args.limit : 5,
      evidenceDomain: (args.evidence_domain || args.evidenceDomain || args.domainProfile || args.domain_profile || 'auto') as any,
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

  // -------------------------------------------------------------------------
  // Formatação de resposta
  // -------------------------------------------------------------------------

  private formatSuccessResponse(result: SearchQueryResult): string {
    const lines: string[] = [];

    // Quality gate header.
    lines.push(`QUALITY_GATE: ${result.qualityGate.status}`);
    lines.push(`EVIDENCE_PROFILE: ${result.evidenceDomain}`);
    lines.push(`Consulta: "${result.items[0]?.providerEvidence.effectiveQuery || ''}"`);
    lines.push(`Modo: ${result.mode}`);
    lines.push(`Fontes fortes: ${result.qualityGate.highSignalCount}/${result.qualityGate.highSignalRequired}.`);
    lines.push(`Diversidade de hosts: ${result.qualityGate.hostDiversity}/${result.items.length}.`);

    if (result.qualityGate.guidance) {
      lines.push(result.qualityGate.guidance);
    }

    if (result.qualityGate.status === 'weak_domain_sources') {
      lines.push('Aviso: as fontes retornadas não atingiram o mínimo de autoridade. Não apresente como resposta definitiva.');
    }

    // Grounded synthesis (if available).
    if (result.groundedSynthesis?.synthesizedText) {
      lines.push('');
      lines.push('--- Síntese Grounded ---');
      lines.push(result.groundedSynthesis.synthesizedText);

      if (result.groundedSynthesis.citations.length > 0) {
        lines.push('');
        lines.push('📎 Fontes:');
        result.groundedSynthesis.citations.forEach((citation, i) => {
          lines.push(`${i + 1}. ${citation.title}: ${citation.url}`);
        });
      }

      return lines.join('\n').trim();
    }

    // Individual results.
    lines.push('');
    result.items.forEach((item, index) => {
      lines.push(`${index + 1}. **${item.title}**`);
      lines.push(`   URL: ${item.url}`);
      lines.push(`   Host: ${item.host}`);
      lines.push(`   Força da fonte: ${item.highSignal ? 'alta' : item.evidenceScore >= 20 ? 'media' : 'baixa'} (${item.evidenceScore})`);

      if (item.scoreReasons.length > 0) {
        lines.push(`   Motivos do ranking: ${item.scoreReasons.join(', ')}`);
      }

      lines.push(`   Trecho: ${item.snippet || 'Trecho indisponível.'}`);

      if (item.extractedContent?.excerpt) {
        if (item.extractedContent.title && item.extractedContent.title !== item.title) {
          lines.push(`   Título extraído: ${item.extractedContent.title}`);
        }
        if (item.extractedContent.publishedAt) {
          lines.push(`   Data extraída: ${item.extractedContent.publishedAt}`);
        }
        lines.push(`   Extrato da página: ${item.extractedContent.excerpt}`);
      } else if (item.extractedContent?.error) {
        lines.push(`   Extração: indisponível (${item.extractedContent.error})`);
      }

      lines.push('');
    });

    return lines.join('\n').trim();
  }

  private formatErrorResponse(result: SearchQueryResult): string {
    const lines = [
      `QUALITY_GATE: ${result.qualityGate.status}`,
      `Consulta: "${result.error?.message || ''}"`,
    ];

    if (result.error?.code === 'ALL_PROVIDERS_FAILED') {
      lines.push('A busca principal falhou em todos os provedores.');
      lines.push('Não trate isto como informação atual verificada.');
    }

    lines.push(result.error?.message || 'Erro desconhecido na busca.');

    return lines.join('\n');
  }
}
