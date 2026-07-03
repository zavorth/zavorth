import { EventEmitter } from 'events';
import type { LlmRuntimeService } from '../../../services/llm/LlmRuntimeService.js';
import type { MemoryVectorStore } from '../../../storage/MemoryVectorStore.js';
import { logger } from '../logger.js';

/**
 * A compressed memory chunk stored in the vector plane.
 */
export interface MemoryChunk {
  id: string;
  sessionId: string;
  createdAt: string;
  originalTokenCount: number;
  compressedSummary: string;
  keywords: string[];
  relevanceScore: number;
  embedding?: number[] | null;
}

/**
 * Represents the active context window that gets sent to the LLM.
 */
export interface ActiveContext {
  recentMessages: string[];
  injectedMemories: MemoryChunk[];
  totalEstimatedTokens: number;
}

/**
 * Configuration for the memory compressor behavior.
 */
export interface MemoryCompressorConfig {
  maxActiveTokens: number;
  compressionThreshold: number;
  chunkOverlapTokens: number;
  maxRetrievedMemories: number;

  similarityThreshold: number;
  llmRuntime?: LlmRuntimeService;
  vectorStore?: MemoryVectorStore;
}

const DEFAULT_CONFIG: MemoryCompressorConfig = {
  maxActiveTokens: 8000,
  compressionThreshold: 6000,
  chunkOverlapTokens: 200,
  maxRetrievedMemories: 5,
  similarityThreshold: 0.65,
};

/**
 * InfiniteMemoryCompressor — Sliding-window context manager with vector recall.
 *
 * As sessions grow beyond the LLM token limit, this module:
 *
 *  1. Detects when the active message log approaches the threshold.
 *  2. Extracts the oldest messages, compresses them into a dense summary
 *     using a local/fast model pass (or a heuristic extractor).
 *  3. Stores the compressed chunk with extracted keywords for retrieval.
 *  4. On new queries, performs keyword/similarity matching against stored
 *     chunks and injects the most relevant memories back into context.
 *
 * The result: agents appear to have perfect long-term memory across sessions
 * that span hours or days, without ever exceeding token budgets.
 *
 * Architecture decisions:
 *  - Token counting uses a fast heuristic (words * 1.3) to avoid importing
 *    heavy tokenizer libraries at the infrastructure layer.
 *  - Memory storage is in-process (Map) for now but designed with a
 *    clean interface for future ChromaDB/Mem0/SQLite vector backends.
 *  - The compressor is an EventEmitter so the zavorthControl can visualize
 *    compression events and memory retrieval in real time.
 */
export class InfiniteMemoryCompressor extends EventEmitter {
  private readonly config: MemoryCompressorConfig;
  private readonly store = new Map<string, MemoryChunk>();
  private activeMessages: string[] = [];
  private chunkCounter = 0;
  private isCompressing = false;

  constructor(
    private readonly sessionId: string,
    config?: Partial<MemoryCompressorConfig>,
  ) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Push a new message into the active context. If the estimated token
   * count crosses the compression threshold, the oldest messages are
   * automatically compressed and stored.
   */
  public pushMessage(message: string): ActiveContext {
    this.activeMessages.push(message);

    const currentTokens = this.estimateTokens(this.activeMessages);
    if (currentTokens > this.config.compressionThreshold && !this.isCompressing) {
      // Fire and forget assincrono para não bloquear o logger stream
      this.compressOldestAsync().catch((err) => {
        this.emit('memory:error', err);
      });
    }

    return this.buildActiveContext();
  }

  /**
   * Retrieve relevant past memories for a given query.
   * Uses keyword overlap scoring (upgradeable to cosine similarity
   * once a vector backend is wired).
   */
  public recall(query: string): MemoryChunk[] {
    const queryKeywords = this.extractKeywords(query);
    const scored: Array<{ chunk: MemoryChunk; score: number }> = [];

    // Search in-memory store
    for (const chunk of this.store.values()) {
      if (chunk.sessionId !== this.sessionId && chunk.relevanceScore < 0.8) {
        continue;
      }
      const score = this.computeOverlapScore(queryKeywords, chunk.keywords);
      if (score >= this.config.similarityThreshold) {
        scored.push({ chunk, score });
      }
    }

    // Also search persistent vector store if available
    if (this.config.vectorStore) {
      try {
        const persistedChunks = this.config.vectorStore.search(queryKeywords, this.config.maxRetrievedMemories);
        for (const chunk of persistedChunks) {
          // Avoid duplicates already in RAM
          if (!this.store.has(chunk.id)) {
            const score = this.computeOverlapScore(queryKeywords, chunk.keywords);
            scored.push({ chunk, score });
          }
        }
      } catch {
        // Persistent store failure is non-fatal
      }
    }

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxRetrievedMemories)
      .map((s) => ({ ...s.chunk, relevanceScore: s.score }));
  }

  /**
   * Build the context payload that gets sent to the LLM.
   * Combines recent messages with recalled memory chunks.
   */
  public buildActiveContext(query?: string): ActiveContext {
    const injected = query ? this.recall(query) : [];
    return {
      recentMessages: [...this.activeMessages],
      injectedMemories: injected,
      totalEstimatedTokens: this.estimateTokens(this.activeMessages)
        + injected.reduce((sum, m) => sum + this.estimateTokens([m.compressedSummary]), 0),
    };
  }

  /**
   * Get the full memory store snapshot for the zavorthControl.
   */
  public getSnapshot(): {
    sessionId: string;
    activeMessageCount: number;
    activeTokenEstimate: number;
    storedChunks: number;
    totalCompressedTokens: number;
  } {
    const storedTokens = Array.from(this.store.values()).reduce(
      (sum, chunk) => sum + this.estimateTokens([chunk.compressedSummary]),
      0,
    );
    return {
      sessionId: this.sessionId,
      activeMessageCount: this.activeMessages.length,
      activeTokenEstimate: this.estimateTokens(this.activeMessages),
      storedChunks: this.store.size,
      totalCompressedTokens: storedTokens,
    };
  }

  /**
   * Triggers an async compression of the oldest N messages.
   * Leverages the LlmRuntimeService if available to generate rich JSON summaries
   * and high-quality relevance keywords natively.
   */
  public async compressOldestAsync(count?: number): Promise<MemoryChunk | null> {
    if (this.isCompressing) {
       return null;
    }

    this.isCompressing = true;
    try {
      const messagesToCompress = count
        ? this.activeMessages.splice(0, count)
        : this.activeMessages.splice(0, Math.ceil(this.activeMessages.length / 2));

      if (messagesToCompress.length === 0) return null;

      const combined = messagesToCompress.join('\n');
      
      let summary = '';
      let keywords: string[] = [];

      if (this.config.llmRuntime) {
         try {
            const prompt = `Você é o Infinite Memory Compressor, o motor que garante que a IA lembrará do passado desta sessão PTY para sempre.
Comprima o log abaixo. Extraia um JSON no seguinte schema OBRIGATORIAMENTE sem markdown em volta:
{
  "summary": "Resumo narrativo denso dos fatos e contexto em portugues. Limite 500 caracteres.",
  "keywords": ["tag1", "nome_arquivo_importante", "erro_X"] // Max 10 keywords unicas super relevantes para busca
}

Logs para comprimir:
${combined}`;

            const res = await this.config.llmRuntime.chat([{ role: 'user', content: prompt }]);
            const block = (res.content || '').replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(block);
            summary = String(parsed.summary || '');
            keywords = Array.isArray(parsed.keywords) ? parsed.keywords.map(String) : [];
         } catch {
             // Fallback para heurística caso LLM falhe
             summary = this.generateDenseSummary(combined);
             keywords = this.extractKeywords(combined);
         }
      } else {
         summary = this.generateDenseSummary(combined);
         keywords = this.extractKeywords(combined);
      }

      if (!summary) {
         summary = this.generateDenseSummary(combined);
      }

      const chunk: MemoryChunk = {
        id: `mem-${this.sessionId}-${++this.chunkCounter}`,
        sessionId: this.sessionId,
        createdAt: new Date().toISOString(),
        originalTokenCount: this.estimateTokens(messagesToCompress),
        compressedSummary: `[Memoria Comprimida] ${summary}`,
        keywords,
        relevanceScore: 1.0,
      };

      this.store.set(chunk.id, chunk);

      // Persist to durable vector store if available
      if (this.config.vectorStore) {
        try {
          await this.config.vectorStore.save(chunk);
        } catch {
          // Persistence failure is non-fatal
        }
      }

      this.emit('memory:compressed', {
        chunkId: chunk.id,
        originalMessages: messagesToCompress.length,
        originalTokens: chunk.originalTokenCount,
        compressedTokens: this.estimateTokens([chunk.compressedSummary]),
        compressionRatio: chunk.originalTokenCount / Math.max(1, this.estimateTokens([chunk.compressedSummary])),
      });

      return chunk;
    } finally {
      this.isCompressing = false;
    }
  }

  /**
   * Modificado para compatibilidade (mas delegando pra sub-rotina assincrona manual se quiser).
   * PTY Streams não devem usar isso, e sim depender do auto-pushMessage trigger.
   */
  public compressOldest(count?: number): void {
     this.compressOldestAsync(count).catch((err) => { logger.warn("[auto-fix] Empty catch block", err); });
  }

  /**
   * Heuristic dense summarization. In production, this would call a fast
   * local model (e.g., Gemini Flash, local Llama) for abstractive compression.
   * The heuristic version extracts the most information-dense sentences.
   */
  private generateDenseSummary(text: string): string {
    const sentences = text
      .split(/[.!?\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 15);

    if (sentences.length === 0) return text.slice(0, 500);

    // Score sentences by information density (unique word ratio * length)
    const scored = sentences.map((sentence) => {
      const words = sentence.toLowerCase().split(/\s+/);
      const uniqueRatio = new Set(words).size / Math.max(1, words.length);
      return { sentence, score: uniqueRatio * Math.log2(words.length + 1) };
    });

    scored.sort((a, b) => b.score - a.score);

    const budget = Math.ceil(sentences.length * 0.35);
    const selected = scored
      .slice(0, Math.max(2, budget))
      .sort((a, b) => text.indexOf(a.sentence) - text.indexOf(b.sentence))
      .map((s) => s.sentence);

    return `[Memoria comprimida] ${selected.join('. ')}.`;
  }

  /**
   * Extract salient keywords from text for retrieval matching.
   */
  private extractKeywords(text: string): string[] {
    const stopwords = new Set([
      'a', 'o', 'e', 'de', 'do', 'da', 'em', 'um', 'uma', 'para', 'com', 'que',
      'the', 'is', 'at', 'on', 'in', 'to', 'and', 'of', 'for', 'it', 'this',
      'no', 'se', 'por', 'os', 'as', 'ao', 'na', 'ou',
    ]);

    const words = text
      .toLowerCase()
      .replace(/[^a-zA-Z0-9àáâãéêíóôõúç\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopwords.has(w));

    const freq = new Map<string, number>();
    for (const word of words) {
      freq.set(word, (freq.get(word) || 0) + 1);
    }

    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word]) => word);
  }

  /**
   * Keyword overlap scoring between two keyword lists.
   */
  private computeOverlapScore(queryKeywords: string[], chunkKeywords: string[]): number {
    if (queryKeywords.length === 0 || chunkKeywords.length === 0) return 0;
    const chunkSet = new Set(chunkKeywords);
    const overlap = queryKeywords.filter((k) => chunkSet.has(k)).length;
    return overlap / Math.max(queryKeywords.length, chunkKeywords.length);
  }

  /**
   * Fast token estimation heuristic: ~1.3 tokens per word for pt/en mixed text.
   */
  private estimateTokens(messages: string[]): number {
    const totalWords = messages.reduce((sum, msg) => {
      return sum + msg.split(/\s+/).filter(Boolean).length;
    }, 0);
    return Math.ceil(totalWords * 1.3);
  }
}
