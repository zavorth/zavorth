/**
 * EpisodicMemoryBridge - bridge between short-term and long-term memory.
 *
 * ContextEngine keeps a compact short-term sliding window. MemoryService owns
 * long-term storage, embeddings, and similarity recall. This bridge connects
 * both layers so compacted turns can be persisted and relevant memories can be
 * recalled before LLM calls.
 */

import type { ContextEvent } from './ContextEngine.js';
import { buildUntrustedContextBlock, sanitizeTrustPlaneText } from '../runtime/agent/security/index.js';
import type { MemoryService } from '../services/MemoryService.js';
import { logger } from '../logger.js';

/** Bridge configuration. */
export interface EpisodicMemoryBridgeConfig {
  /** Max relevant memories to inject per turn. */
  maxRecallPerTurn: number;
  /** Minimum similarity score for recall. */
  recallThreshold: number;
  /** Whether to automatically persist episodes. */
  autoPersist: boolean;
  /** Whether to automatically recall memories in prepare(). */
  autoRecall: boolean;
  /** Max tokens for the consolidated episode. */
  maxEpisodeLength: number;
}

const DEFAULT_CONFIG: EpisodicMemoryBridgeConfig = {
  maxRecallPerTurn: 5,
  recallThreshold: 0.45,
  autoPersist: true,
  autoRecall: true,
  maxEpisodeLength: 500,
};

/** Consolidated episode ready for persistence. */
export interface ConsolidatedEpisode {
  /** Episode summary. */
  summary: string;
  /** Source surface. */
  surface: string;
  /** Start timestamp. */
  startedAt: string;
  /** End timestamp. */
  endedAt: string;
  /** Number of consolidated turns. */
  turnCount: number;
  /** Main detected topics. */
  topics: string[];
}

/** Automatic recall result. */
export interface RecallResult {
  /** Relevant memories found. */
  memories: Array<{
    key: string;
    value: string;
    category: string;
    relevanceScore?: number;
  }>;
  /** Formatted text for LLM prompt injection. */
  contextBlock: string;
  /** Number of memories searched. */
  totalSearched: number;
  /** Search time in milliseconds. */
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
   * Connects the bridge to MemoryService.
   * Called during bootstrap when MemoryService is available.
   */
  public attach(memoryService: MemoryService): void {
    this.memoryService = memoryService;
    logger.info('[EpisodicMemoryBridge] Connected to MemoryService.');
  }

  /**
   * AUTO-PERSIST: Consolidates old ContextEvents into an episode and persists it in MemoryService.
   * Called by ContextEngine when the buffer exceeds its limit.
   *
   * @param events - Compacted ContextEngine events.
   * @param userId - User ID.
   */
  public async persistEpisode(events: ContextEvent[], userId: string): Promise<void> {
    if (!this.config.autoPersist || !this.memoryService || events.length === 0) {
      return;
    }

    try {
      const episode = this.consolidateEvents(events);
      const episodeKey = `episode_${episode.startedAt.replace(/[^0-9]/g, '').slice(0, 12)}`;

      await this.memoryService.remember(
        userId,
        episodeKey,
        episode.summary,
        'episode',
      );

      this.persistedEpisodeCount++;

      logger.debug(
        `[EpisodicMemoryBridge] Episode persisted: ${episodeKey} (${episode.turnCount} turns, topics: ${episode.topics.join(', ')})`,
      );
    } catch (error: unknown) {logger.error('[EpisodicMemoryBridge] Failed to persist episode:', error);
    }
  }

  /**
   * AUTO-RECALL: Finds memories relevant to the current user message.
   * Returns a formatted context block for prompt injection.
   *
   * Called by ContextEngine.prepareAsync() before assembling the LLM payload.
   *
   * @param userMessage - Current user message.
   * @param userId - User ID.
   * @returns RecallResult with memories and a context block.
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
    } catch (error: unknown) {logger.error('[EpisodicMemoryBridge] Recall failed:', error);
      return { ...emptyResult, searchTimeMs: Date.now() - startTime };
    }
  }

  /**
   * Returns bridge usage stats.
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
   * Consolidates ContextEvents into a summarized episode.
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

    // Build compact summary.
    const summaryParts: string[] = [];

    for (let i = 0; i < Math.min(userMessages.length, 5); i++) {
      const truncated = userMessages[i].length > 120
        ? userMessages[i].slice(0, 120) + '...'
        : userMessages[i];
      summaryParts.push(`User: ${truncated.replace(/\n/g, ' ')}`);
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
   * Extracts main topics by term frequency.
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
   * Formats recalled memories as a context block for LLM prompt injection.
   */
  private formatContextBlock(
    memories: Array<{ key: string; value: string; category: string }>,
  ): string {
    if (memories.length === 0) return '';

    const lines = memories.map(
      (m) => `- [${m.category}] ${m.key}: ${m.value}`,
    );

    return buildUntrustedContextBlock(
      'RELEVANT MEMORIES RETRIEVED FROM LONG-TERM MEMORY:',
      lines,
    );
  }
}
