import { GoogleGenerativeAI } from '@google/generative-ai';
import { search, SafeSearchType, type SearchResult } from 'duck-duck-scrape';
import { config } from '../config/index.js';
import { ProviderFactory } from '../providers/ProviderFactory.js';
import { LogRepository } from '../storage/LogRepository.js';

const SEARCH_FALLBACK_ORDER = ['AIGateway', 'gemini', 'deepseek', 'qwen', 'openrouter', 'minimax', 'opencode', 'openai'];

/**
 * DeepSearchService - Pesquisa avançada com duas estratégias:
 * 1. Gemini Grounding (usa Google Search nativamente dentro do modelo)
 * 2. DuckDuckGo + resumo via provider disponível (Gemini/DeepSeek/Qwen/etc.)
 */
export class DeepSearchService {
  constructor(private logRepo: LogRepository) {}

  public async research(query: string): Promise<string> {
    this.logRepo.log('info', 'DeepSearch', `Iniciando pesquisa avancada: ${query}`);

    try {
      const groundedResult = await this.groundedSearch(query);
      if (groundedResult && groundedResult.length > 50) {
        this.logRepo.log('info', 'DeepSearch', `Grounding bem-sucedido (${groundedResult.length} chars)`);
        return groundedResult;
      }
    } catch (error: any) {
      this.logRepo.log('warn', 'DeepSearch', `Grounding falhou: ${error?.message || error}. Usando fallback DDG.`);
    }

    return this.duckDuckGoSearch(query);
  }

  public async deepResearch(query: string): Promise<string> {
    this.logRepo.log('info', 'DeepSearch', `Iniciando Deep Research multi-step: ${query}`);

    const initialResult = await this.research(query);
    const subQuestions = await this.generateSubQuestions(query, initialResult);

    if (subQuestions.length === 0) {
      return initialResult;
    }

    const subResults: string[] = [initialResult];
    for (const subQuestion of subQuestions.slice(0, 3)) {
      try {
        const subResult = await this.groundedSearch(subQuestion);
        if (subResult && subResult.length > 30) {
          subResults.push(`---\n**Sub-pergunta:** ${subQuestion}\n${subResult}`);
        }
      } catch {
        // Continua para as próximas sub-perguntas.
      }
    }

    return this.synthesize(query, subResults);
  }

  private async groundedSearch(query: string): Promise<string> {
    const keys = config.geminiApiKeys.length > 0 ? config.geminiApiKeys : [config.geminiApiKey].filter(Boolean);

    if (keys.length === 0) {
      throw new Error('Nenhuma chave Gemini configurada para grounding search.');
    }

    for (const key of keys) {
      try {
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({
          model: config.geminiModel,
          tools: [{ googleSearch: {} } as any],
        });

        const result = await model.generateContent({
          contents: [{
            role: 'user',
            parts: [{
              text: `Pesquise e responda de forma completa e detalhada sobre: "${query}"\n\nInstrucoes:\n- Use informacoes atualizadas da web\n- Cite as fontes quando possivel\n- Seja analitico e neutro\n- Formate com marcadores Markdown para Telegram\n- Se houver dados contraditorios, aponte divergencias`,
            }],
          }],
        });

        const response = result.response;
        const text = response.text();

        const groundingMetadata = (response.candidates?.[0] as any)?.groundingMetadata;
        let sources = '';
        if (groundingMetadata?.groundingChunks) {
          sources = '\n\n📎 *Fontes:*\n' + groundingMetadata.groundingChunks
            .filter((chunk: any) => chunk.web?.uri)
            .slice(0, 5)
            .map((chunk: any, index: number) => `${index + 1}. ${chunk.web.title || chunk.web.uri}: ${chunk.web.uri}`)
            .join('\n');
        }

        return text + sources;
      } catch (error: any) {
        this.logRepo.log('warn', 'DeepSearch', `Grounding com chave falhou: ${error?.message || error}`);
      }
    }

    throw new Error('Todas as chaves falharam no grounding search.');
  }

  private async duckDuckGoSearch(query: string): Promise<string> {
    try {
      const rawResults = await search(query, {
        safeSearch: SafeSearchType.OFF,
        region: 'wt-wt',
      });

      if (!rawResults?.results?.length) {
        return `❌ Nenhum resultado encontrado para: "${query}"`;
      }

      const topResults: SearchResult[] = rawResults.results.slice(0, 5);
      const searchContext = topResults
        .map((result, index) => `[${index + 1}] Titulo: ${result.title}\nURL: ${result.url}\nResumo: ${result.description}\n`)
        .join('\n');

      const summaryPrompt = [
        `Sintetize uma resposta completa sobre o tema consultado.`,
        `TEMA: "${query}"`,
        '',
        'CONTEXTO DA WEB:',
        searchContext,
        '',
        'INSTRUCOES:',
        '- Resuma extraindo os pontos principais de forma clara',
        '- Se houver dados contraditorios, aponte a divergencia',
        '- Se for noticia, foque no O Que, Quem, Onde, Quando, Por que',
        '- Seja neutro e analitico',
        '- Formate com marcadores Markdown',
        '- Finalize listando as fontes numeradas com URLs',
      ].join('\n');

      const summary = await this.summarizeWithAvailableProvider(summaryPrompt);
      if (summary) {
        return summary;
      }

      return this.formatRawDuckDuckGoResults(query, topResults);
    } catch (error: any) {
      const errMsg = error?.message || String(error) || 'Erro desconhecido';
      this.logRepo.log('error', 'DeepSearch', `Falha DDG: ${errMsg}`);
      return `❌ Falha no Deep Search.\n\nMotivo: ${errMsg}`;
    }
  }

  private async generateSubQuestions(originalQuery: string, initialResult: string): Promise<string[]> {
    const prompt = `Baseado na pesquisa inicial sobre "${originalQuery}" e nos resultados abaixo, gere exatamente 3 sub-perguntas que aprofundariam o entendimento do tema. Retorne APENAS as perguntas, uma por linha, sem numeracao ou formatacao extra.\n\nResultados iniciais:\n${initialResult.substring(0, 2000)}`;
    const text = await this.summarizeWithAvailableProvider(prompt);
    if (!text) {
      return [];
    }

    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 10)
      .slice(0, 3);
  }

  private async synthesize(query: string, results: string[]): Promise<string> {
    const combined = results.join('\n\n');
    const prompt = `Voce e um analista de pesquisa. Sintetize todos os resultados abaixo em um relatorio completo e bem organizado sobre "${query}".\n\nResultados coletados:\n${combined.substring(0, 8000)}\n\nRequisitos:\n- Organize por topicos\n- Cruze informacoes de diferentes fontes\n- Apresente conclusoes e tendencias\n- Use formato Markdown\n- Inclua uma secao de "Pontos Principais" no inicio`;
    const summary = await this.summarizeWithAvailableProvider(prompt);

    if (!summary) {
      return results.join('\n\n---\n\n');
    }

    return '🔬 *Deep Research: Relatorio Completo*\n\n' + summary;
  }

  private async summarizeWithAvailableProvider(prompt: string): Promise<string | null> {
    const primaryProvider = config.llmProvider || 'gemini';
    const providerChain = [primaryProvider, ...SEARCH_FALLBACK_ORDER.filter((provider) => provider !== primaryProvider)];

    for (const providerName of providerChain) {
      if (!this.isProviderAvailable(providerName)) {
        continue;
      }

      try {
        const provider = ProviderFactory.create(providerName);
        const response = await provider.chat([{ role: 'user', content: prompt }]);
        const text = response.content?.trim();
        if (text) {
          if (providerName !== primaryProvider) {
            this.logRepo.log('warn', 'DeepSearch', `Resumo servido por fallback provider ${providerName}.`);
          }
          return text;
        }
      } catch (error: any) {
        this.logRepo.log('warn', 'DeepSearch', `Resumo com ${providerName} falhou: ${error?.message || error}`);
      }
    }

    return null;
  }

  private isProviderAvailable(name: string): boolean {
    switch (name) {
      case 'AIGateway':
        return !!config.AIGatewayBaseUrl;
      case 'gemini':
        return !!(config.geminiApiKey || config.geminiApiKeys.length > 0);
      case 'deepseek':
        return !!config.deepseekApiKey;
      case 'qwen':
      case 'puter':
        return !!config.puterAuthToken;
      case 'openrouter':
        return !!config.openRouterApiKey;
      case 'minimax':
        return !!config.minimaxApiKey;
      case 'opencode':
        return !!config.openCodeApiKey;
      case 'openai':
        return !!(config.openaiApiKey || (config as any).openaiApiKeys?.length > 0);
      default:
        return false;
    }
  }

  private formatRawDuckDuckGoResults(query: string, results: SearchResult[]): string {
    const lines = [`Resultados brutos para "${query}":`, ''];

    results.forEach((result, index) => {
      lines.push(`${index + 1}. ${result.title || 'Sem titulo'}`);
      lines.push(`URL: ${result.url || 'sem URL'}`);
      lines.push(`Resumo: ${result.description || 'Sem resumo.'}`);
      lines.push('');
    });

    return lines.join('\n').trim();
  }
}
