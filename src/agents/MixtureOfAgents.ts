/**
 * MixtureOfAgents — Orchestration multi-model para consenso.
 *
 * Executa N modelos de referência em paralelo, coleta suas respostas,
 * e usa um modelo agregador para sintetizar o melhor resultado.
 * Cada modelo de referência gera uma "opinião" que é combinada
 * pelo agregador final.
 *
 * Uso:
 *   const moa = new MixtureOfAgents({
 *     references: [
 *       { provider: 'openai', model: 'gpt-4o', temperature: 0.7 },
 *       { provider: 'anthropic', model: 'claude-sonnet-4-20250514', temperature: 0.5 },
 *     ],
 *     aggregator: { provider: 'openai', model: 'gpt-4o' },
 *   });
 *   const result = await moa.run('Explique quantum computing');
 */

export interface MoAReferenceConfig {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface MoAConfig {
  references: MoAReferenceConfig[];
  aggregator: MoAReferenceConfig;
  maxConcurrent?: number;
  timeoutMs?: number;
  enableCache?: boolean;
}

export interface MoAReferenceResult {
  provider: string;
  model: string;
  response: string;
  latencyMs: number;
  success: boolean;
  error?: string;
}

export interface MoAResult {
  finalResponse: string;
  referenceResults: MoAReferenceResult[];
  aggregatorLatencyMs: number;
  totalLatencyMs: number;
  cacheHit: boolean;
}

interface CacheEntry {
  queryHash: string;
  result: MoAResult;
  timestamp: number;
}

// Simple hash for cache key
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export class MixtureOfAgents {
  private readonly config: Required<MoAConfig>;
  private readonly cache = new Map<string, CacheEntry>();
  private readonly cacheMaxSize = 100;
  private readonly cacheMaxAgeMs = 300_000; // 5 min

  constructor(config: MoAConfig) {
    this.config = {
      references: config.references,
      aggregator: config.aggregator,
      maxConcurrent: config.maxConcurrent ?? 3,
      timeoutMs: config.timeoutMs ?? 60_000,
      enableCache: config.enableCache ?? true,
    };
  }

  /**
   * Executa o pipeline MoA com uma query.
   */
  async run(
    query: string,
    options: {
      systemPrompt?: string;
      onReferenceComplete?: (result: MoAReferenceResult) => void;
    } = {},
  ): Promise<MoAResult> {
    const startTime = Date.now();

    // Verificar cache
    if (this.config.enableCache) {
      const cached = this.getFromCache(query);
      if (cached) {
        return { ...cached, cacheHit: true };
      }
    }

    // Fase 1: Executar modelos de referência em paralelo
    const referenceResults = await this.runReferences(query, options);

    // Fase 2: Sintetizar com o agregador
    const aggregatorStart = Date.now();
    const finalResponse = await this.aggregate(query, referenceResults, options);
    const aggregatorLatencyMs = Date.now() - aggregatorStart;

    const result: MoAResult = {
      finalResponse,
      referenceResults,
      aggregatorLatencyMs,
      totalLatencyMs: Date.now() - startTime,
      cacheHit: false,
    };

    // Armazenar no cache
    if (this.config.enableCache) {
      this.addToCache(query, result);
    }

    return result;
  }

  /**
   * Executa todos os modelos de referência em paralelo (com concorrência limitada).
   */
  private async runReferences(
    query: string,
    options: { systemPrompt?: string; onReferenceComplete?: (r: MoAReferenceResult) => void },
  ): Promise<MoAReferenceResult[]> {
    const results: MoAReferenceResult[] = [];
    const queue = [...this.config.references];

    const worker = async () => {
      while (queue.length > 0) {
        const ref = queue.shift()!;
        const result = await this.executeReference(ref, query, options.systemPrompt);
        results.push(result);
        options.onReferenceComplete?.(result);
      }
    };

    const workers = Array.from(
      { length: Math.min(this.config.maxConcurrent, this.config.references.length) },
      () => worker(),
    );

    await Promise.all(workers);
    return results;
  }

  /**
   * Executa um único modelo de referência.
   */
  private async executeReference(
    ref: MoAReferenceConfig,
    query: string,
    systemPrompt?: string,
  ): Promise<MoAReferenceResult> {
    const startTime = Date.now();

    try {
      // Chamar o provider via adaptador interno do Zavorth
      const response = await this.callProvider(ref, query, systemPrompt);

      return {
        provider: ref.provider,
        model: ref.model,
        response,
        latencyMs: Date.now() - startTime,
        success: true,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        provider: ref.provider,
        model: ref.model,
        response: '',
        latencyMs: Date.now() - startTime,
        success: false,
        error: message,
      };
    }
  }

  /**
   * Chama um provider de LLM.
   * Nota: Em produção, isso usaria o LLMRouterService do Zavorth.
   * Aqui está a interface abstrata.
   */
  private async callProvider(
    ref: MoAReferenceConfig,
    query: string,
    systemPrompt?: string,
  ): Promise<string> {
    // Interface abstrata para chamada de provider
    // Em integração real, conectaria ao LLMRouterService
    const messages = [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
      { role: 'user' as const, content: query },
    ];

    // Placeholder para chamada real do provider
    // O Zavorth usaria seu provider registry aqui
    throw new Error(
      `Provider ${ref.provider}/${ref.model} precisa de integração com LLMRouterService`,
    );
  }

  /**
   * Sintetiza as respostas de referência usando o agregador.
   */
  private async aggregate(
    query: string,
    referenceResults: MoAReferenceResult[],
    options: { systemPrompt?: string },
  ): Promise<string> {
    const successfulResults = referenceResults.filter((r) => r.success);

    if (successfulResults.length === 0) {
      throw new Error('Nenhum modelo de referência retornou sucesso');
    }

    // Montar prompt de agregação
    const opinions = successfulResults
      .map((r, i) => `## Opinião ${i + 1} (${r.model})\n${r.response}`)
      .join('\n\n');

    const aggregatorPrompt = `Você é um agregador de opiniões. Dada uma pergunta e várias opiniões de modelos diferentes, sintetize a melhor resposta possível.

Pergunta: ${query}

${opinions}

Instruções:
- Considere os pontos fortes de cada opinião
- Resolva contradições usando evidências
- Produza uma resposta coesa e completa
- Seja conciso mas abrangente`;

    // Chamar o agregador
    return this.callProvider(this.config.aggregator, aggregatorPrompt);
  }

  private getFromCache(query: string): MoAResult | null {
    const hash = simpleHash(query);
    const entry = this.cache.get(hash);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.cacheMaxAgeMs) {
      this.cache.delete(hash);
      return null;
    }
    return entry.result;
  }

  private addToCache(query: string, result: MoAResult): void {
    if (this.cache.size >= this.cacheMaxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(simpleHash(query), {
      queryHash: simpleHash(query),
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * Retorna estatísticas do MoA.
   */
  getStats(): {
    cacheSize: number;
    cacheHitRate: number;
    referenceCount: number;
  } {
    return {
      cacheSize: this.cache.size,
      cacheHitRate: 0, // rastreado em produção
      referenceCount: this.config.references.length,
    };
  }
}
