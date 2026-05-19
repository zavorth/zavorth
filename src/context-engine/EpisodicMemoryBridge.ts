/**
 * EpisodicMemoryBridge — Ponte entre Memória de Curto e Longo Prazo (Surface controls)
 *
 * No Zavorth pré-merge:
 * - ContextEngine (short-term): sliding window de 12 turnos, compactação local
 * - MemoryService (long-term): SQLite + embeddings, recall por similaridade
 * Mas eles NÃO CONVERSAM ENTRE SI. O ContextEngine descarta turnos antigos
 * para sempre, e o MemoryService só é carregado via /remember|/recall explícito.
 *
 * Este Bridge faz:
 * 1. AUTO-PERSIST: Quando o ContextEngine compacta turnos, os episódios são
 *    persistidos automaticamente no MemoryService como memórias episódicas.
 * 2. AUTO-RECALL: Antes de cada chamada ao LLM, o Bridge consulta o
 *    MemoryService por memórias relevantes à mensagem atual e as injeta
 *    no contexto da conversação.
 * 3. CONSOLIDATION: Turnos compactados são transformados em "episódios"
 *    resumidos que o MemoryService indexa via embeddings.
 *
 * Resultado: O Zavorth "lembra" de conversas de semanas atrás,
 * não apenas dos últimos 12 turnos, e faz isso de forma transparente.
 */

import type { ContextEvent } from './ContextEngine.js';
import { buildUntrustedContextBlock, sanitizeTrustPlaneText } from '../runtime/agent/security/index.js';
import type { MemoryService } from '../services/MemoryService.js';

/** Configuração do Bridge */
export interface EpisodicMemoryBridgeConfig {
  /** Máx de memórias relevantes a injetar por turno */
  maxRecallPerTurn: number;
  /** Score mínimo de similaridade para recall */
  recallThreshold: number;
  /** Se deve persistir episódios automaticamente */
  autoPersist: boolean;
  /** Se deve fazer recall automático no prepare() */
  autoRecall: boolean;
  /** Máx de tokens para o episódio consolidado */
  maxEpisodeLength: number;
}

const DEFAULT_CONFIG: EpisodicMemoryBridgeConfig = {
  maxRecallPerTurn: 5,
  recallThreshold: 0.45,
  autoPersist: true,
  autoRecall: true,
  maxEpisodeLength: 500,
};

/** Episódio consolidado pronto para persistência */
export interface ConsolidatedEpisode {
  /** Resumo do episódio */
  summary: string;
  /** Superfície de origem */
  surface: string;
  /** Timestamp de início */
  startedAt: string;
  /** Timestamp de fim */
  endedAt: string;
  /** Número de turnos consolidados */
  turnCount: number;
  /** Tópicos principais detectados */
  topics: string[];
}

/** Resultado do recall automático */
export interface RecallResult {
  /** Memórias relevantes encontradas */
  memories: Array<{
    key: string;
    value: string;
    category: string;
    relevanceScore?: number;
  }>;
  /** Texto formatado para injeção no prompt do LLM */
  contextBlock: string;
  /** Número de memórias consultadas */
  totalSearched: number;
  /** Tempo de busca em ms */
  searchTimeMs: number;
}

export class EpisodicMemoryBridge {
  private readonly config: EpisodicMemoryBridgeConfig;
  private memoryService: MemoryService | null = null;
  private persistedEpisodeCount = 0;
  private recallCount = 0;

  constructor(config?: Partial<EpisodicMemoryBridgeConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Conecta o Bridge ao MemoryService.
   * Chamado durante o bootstrap quando o MemoryService está disponível.
   */
  public attach(memoryService: MemoryService): void {
    this.memoryService = memoryService;
    console.log('[EpisodicMemoryBridge] Conectado ao MemoryService.');
  }

  /**
   * AUTO-PERSIST: Consolida um array de ContextEvents antigos em um
   * episódio e persiste no MemoryService.
   *
   * Chamado pelo ContextEngine quando o buffer excede o limite.
   *
   * @param events - Eventos compactados do ContextEngine
   * @param userId - ID do usuário
   */
  public async persistEpisode(events: ContextEvent[], userId: string): Promise<void> {
    if (!this.config.autoPersist || !this.memoryService || events.length === 0) {
      return;
    }

    try {
      const episode = this.consolidateEvents(events);
      const episodeKey = `episodio_${episode.startedAt.replace(/[^0-9]/g, '').slice(0, 12)}`;

      await this.memoryService.remember(
        userId,
        episodeKey,
        episode.summary,
        'episodio',
      );

      this.persistedEpisodeCount++;

      console.log(
        `[EpisodicMemoryBridge] Episódio persistido: ${episodeKey} (${episode.turnCount} turnos, tópicos: ${episode.topics.join(', ')})`,
      );
    } catch (error) {
      console.error('[EpisodicMemoryBridge] Erro ao persistir episódio:', error);
    }
  }

  /**
   * AUTO-RECALL: Busca memórias relevantes à mensagem atual do usuário
   * e retorna um bloco de contexto formatado para injeção no prompt.
   *
   * Chamado pelo ContextEngine.prepare() antes de montar o payload LLM.
   *
   * @param userMessage - Mensagem atual do usuário
   * @param userId - ID do usuário
   * @returns RecallResult com memórias e bloco de contexto
   */
  public async recall(userMessage: string, userId: string): Promise<RecallResult> {
    const emptyResult: RecallResult = {
      memories: [],
      contextBlock: '',
      totalSearched: 0,
      searchTimeMs: 0,
    };

    if (!this.config.autoRecall || !this.memoryService) {
      return emptyResult;
    }

    const startTime = Date.now();

    try {
      const relevantMemories = await this.memoryService.listRelevant(
        userId,
        userMessage,
        this.config.maxRecallPerTurn,
      );

      const searchTimeMs = Date.now() - startTime;

      if (relevantMemories.length === 0) {
        return { ...emptyResult, searchTimeMs };
      }

      this.recallCount++;

      const memories = relevantMemories.map((m) => ({
        key: sanitizeTrustPlaneText(m.key, { maxChars: 96 }),
        value: sanitizeTrustPlaneText(m.value, { maxChars: 1000 }),
        category: sanitizeTrustPlaneText(m.category, { maxChars: 64 }),
      }));

      const contextBlock = this.formatContextBlock(memories);

      return {
        memories,
        contextBlock,
        totalSearched: relevantMemories.length,
        searchTimeMs,
      };
    } catch (error) {
      console.error('[EpisodicMemoryBridge] Erro no recall:', error);
      return { ...emptyResult, searchTimeMs: Date.now() - startTime };
    }
  }

  /**
   * Retorna estatísticas de uso do Bridge.
   */
  public getStats(): {
    episodesPersisted: number;
    recallsPerformed: number;
    isAttached: boolean;
    config: EpisodicMemoryBridgeConfig;
  } {
    return {
      episodesPersisted: this.persistedEpisodeCount,
      recallsPerformed: this.recallCount,
      isAttached: this.memoryService !== null,
      config: this.config,
    };
  }

  /**
   * Consolida um array de ContextEvents em um episódio resumido.
   */
  private consolidateEvents(events: ContextEvent[]): ConsolidatedEpisode {
    const userMessages: string[] = [];
    const assistantMessages: string[] = [];
    const surfaces = new Set<string>();

    for (const event of events) {
      surfaces.add(event.surface);
      if (event.role === 'user') {
        userMessages.push(event.content);
      } else if (event.role === 'assistant') {
        assistantMessages.push(event.content);
      }
    }

    const topics = this.extractTopics([...userMessages, ...assistantMessages]);

    // Construir resumo compacto
    const summaryParts: string[] = [];

    for (let i = 0; i < Math.min(userMessages.length, 5); i++) {
      const truncated = userMessages[i].length > 120
        ? userMessages[i].slice(0, 120) + '...'
        : userMessages[i];
      summaryParts.push(`Usuário: ${truncated.replace(/\n/g, ' ')}`);
    }

    if (assistantMessages.length > 0) {
      const lastResponse = assistantMessages[assistantMessages.length - 1];
      const truncated = lastResponse.length > 200
        ? lastResponse.slice(0, 200) + '...'
        : lastResponse;
      summaryParts.push(`Zavorth: ${truncated.replace(/\n/g, ' ')}`);
    }

    let summary = summaryParts.join(' | ');
    if (summary.length > this.config.maxEpisodeLength) {
      summary = summary.slice(0, this.config.maxEpisodeLength) + '...';
    }

    return {
      summary,
      surface: Array.from(surfaces).join(', '),
      startedAt: events[0]?.timestamp || new Date().toISOString(),
      endedAt: events[events.length - 1]?.timestamp || new Date().toISOString(),
      turnCount: events.length,
      topics,
    };
  }

  /**
   * Extrai tópicos principais de um conjunto de mensagens por frequência de termos.
   */
  private extractTopics(messages: string[]): string[] {
    const stopWords = new Set([
      'para', 'com', 'que', 'uma', 'como', 'isso', 'essa', 'esse', 'aqui', 'agora',
      'depois', 'sobre', 'entre', 'quero', 'preciso', 'favor', 'voce', 'você', 'zavorth',
      'meu', 'minha', 'seu', 'sua', 'por', 'dos', 'das', 'nos', 'nas', 'the', 'and',
      'sim', 'nao', 'não', 'por', 'tem', 'ter', 'ser', 'está', 'esta', 'pode',
    ]);

    const freq = new Map<string, number>();

    for (const msg of messages) {
      const tokens = msg
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 4 && !stopWords.has(t));

      for (const token of tokens) {
        freq.set(token, (freq.get(token) || 0) + 1);
      }
    }

    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([term]) => term);
  }

  /**
   * Formata memórias recall em bloco de contexto para injeção no prompt LLM.
   */
  private formatContextBlock(
    memories: Array<{ key: string; value: string; category: string }>,
  ): string {
    if (memories.length === 0) return '';

    const lines = memories.map(
      (m) => `- [${m.category}] ${m.key}: ${m.value}`,
    );

    return buildUntrustedContextBlock(
      'MEMORIAS RELEVANTES RECUPERADAS DA MEMORIA DE LONGO PRAZO:',
      lines,
    );
  }
}
