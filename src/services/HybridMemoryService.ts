import { VectorEmbeddingService } from './VectorEmbeddingService.js';
import { LocalEmbeddingService } from './LocalEmbeddingService.js';

import {
  HYBRID_MEMORY_CONTRACT_VERSION,
  HYBRID_MEMORY_DEFAULT_CONTEXT_TOKEN_BUDGET,
  HYBRID_MEMORY_DEFAULT_TOP_K,
  type HybridMemoryEmbeddingStatus,
  type HybridMemoryRecallInput,
  type HybridMemoryRecallResult,
  type HybridMemoryRecallSource,
  type HybridMemorySourceInventoryItem,
  type HybridMemorySourcesResult,
} from '../contracts/HybridMemoryContract.js';
import type {
  ZavorthLayeredMemoryService,
  LayeredMemorySearchEntry,
} from './ZavorthLayeredMemoryService.js';
import type {
  ZavorthMemoryPlaneService,
  ZavorthMemoryPlaneSnapshot,
} from './ZavorthMemoryPlaneService.js';

import { MemoryVectorStore } from '../storage/MemoryVectorStore.js';
import type { MemoryChunk } from '../runtime/sessions/v2/InfiniteMemoryCompressor.js';
import { asErrorLike } from '../utils/errorLike.js';

type LayeredMemoryLike = Pick<ZavorthLayeredMemoryService, 'search' | 'readProcedures'>;
type MemoryPlaneLike = Pick<ZavorthMemoryPlaneService, 'buildSnapshot'>;
type EmbeddingLike = Pick<VectorEmbeddingService, 'generate'>;
type VectorStoreLike = Pick<MemoryVectorStore, 'search' | 'count'> & {
  searchSemantic?: (queryEmbedding: number[], limit?: number, keywords?: string[]) => MemoryChunk[];
};

type HybridMemoryRuntime = {
  now?: () => Date;
  layeredMemory?: LayeredMemoryLike | null;
  memoryPlane?: MemoryPlaneLike | null;
  embeddingService?: EmbeddingLike | null;
  vectorStore?: VectorStoreLike | null;
  createVectorStore?: (() => VectorStoreLike) | null;
};

export class HybridMemoryService {
  private readonly now: () => Date;
  private readonly layeredMemory: LayeredMemoryLike | null;
  private readonly memoryPlane: MemoryPlaneLike | null;
  private readonly embeddingServiceOverride: EmbeddingLike | null | undefined;
  private readonly vectorStoreOverride: VectorStoreLike | null | undefined;
  private readonly createVectorStore: (() => VectorStoreLike) | null;
  private lazyEmbeddingService: EmbeddingLike | null | undefined;
  private lazyVectorStore: VectorStoreLike | null | undefined;

  constructor(runtime: HybridMemoryRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.layeredMemory = runtime.layeredMemory || null;
    this.memoryPlane = runtime.memoryPlane || null;
    this.embeddingServiceOverride = runtime.embeddingService;
    this.vectorStoreOverride = runtime.vectorStore;
    this.createVectorStore = runtime.createVectorStore === null
      ? null
      : runtime.createVectorStore || (() => new MemoryVectorStore());
  }

  public async previewRecall(input: HybridMemoryRecallInput): Promise<HybridMemoryRecallResult> {
    const sessionId = this.normalizeText(input.sessionId, 'default');
    const query = this.normalizeText(input.query);
    const topK = this.normalizeLimit(input.limit, HYBRID_MEMORY_DEFAULT_TOP_K);
    const contextTokenBudget = Math.max(
      256,
      Math.min(Number(input.contextTokenBudget || HYBRID_MEMORY_DEFAULT_CONTEXT_TOKEN_BUDGET) || HYBRID_MEMORY_DEFAULT_CONTEXT_TOKEN_BUDGET, 8000),
    );
    const warnings: string[] = [];

    if (!query) {
      return this.emptyRecall({
        sessionId,
        query,
        topK,
        contextTokenBudget,
        warnings: ['Provide a query to retrieve hybrid memory.'],
        embeddingStatus: 'not_requested',
      });
    }

    const ledgerSources = await this.collectLedgerSources(input, query, topK * 2, warnings);
    const vectorResult = await this.collectVectorSources(query, topK * 2, warnings);
    const sources = this.mergeSources([...ledgerSources, ...vectorResult.sources]).slice(0, topK);
    const context = this.composeContext(sources, contextTokenBudget);
    const estimatedTokens = this.estimateTokens(context);
    const recallCount = sources.filter((source) => source.type === 'recall').length;
    const ledgerCount = sources.filter((source) => source.type === 'ledger').length;

    return {
      ok: true,
      contractVersion: HYBRID_MEMORY_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      sessionId,
      query,
      mode: recallCount > 0 ? 'hybrid' : 'ledger_only',
      memoryMode: LocalEmbeddingService.resolveMode(),
      embeddingStatus: vectorResult.embeddingStatus,
      budget: {
        topK,
        contextTokenBudget,
        estimatedTokens,
      },
      summary: {
        total: ledgerSources.length + vectorResult.sources.length,
        ledger: ledgerCount,
        recall: recallCount,
        returned: sources.length,
        ledgerAuthoritative: true,
      },
      sources,
      context,
      warnings,
      commands: this.commands(),
    };
  }

  public async listSources(input: Pick<HybridMemoryRecallInput, 'sessionId' | 'chatId' | 'userId' | 'platform' | 'workspaceHint'>): Promise<HybridMemorySourcesResult> {
    const sessionId = this.normalizeText(input.sessionId, 'default');
    const warnings: string[] = [];
    const inventory: HybridMemorySourceInventoryItem[] = [];

    const memoryPlane = await this.safeMemoryPlane(input, warnings);
    inventory.push({
      id: 'ledger:session',
      type: 'ledger',
      kind: 'session',
      label: 'Session ledger',
      status: memoryPlane && Number(memoryPlane.summary.timelineEvents || 0) > 0 ? 'available' : 'empty',
      count: Number(memoryPlane?.summary.timelineEvents || 0),
      reason: 'source factual para transcript, replay, artifacts e operational history da session.',
    });
    inventory.push({
      id: 'ledger:memory',
      type: 'ledger',
      kind: 'memory',
      label: 'Layered memory',
      status: this.layeredMemory ? 'available' : 'unavailable',
      count: Number(memoryPlane?.summary.persistedMemories || 0) + Number(memoryPlane?.summary.relevantMemories || 0),
      reason: 'Authoritative source for episodic, semantic, and procedural memory.',
    });
    inventory.push({
      id: 'ledger:artifact',
      type: 'ledger',
      kind: 'artifact',
      label: 'Artifacts e diffs',
      status: memoryPlane && Number(memoryPlane.summary.artifacts || 0) > 0 ? 'available' : 'empty',
      count: Number(memoryPlane?.summary.artifacts || 0),
      reason: 'Artifacts ficam ligados ao replay da session e vencem qualquer recall inferido.',
    });

    const vectorStore = this.readVectorStore(warnings);
    let vectorCount = 0;
    if (vectorStore) {
      try {
        vectorCount = Number(vectorStore.count()) || 0;
      } catch (error: unknown) {
        const err = asErrorLike(error);
        const message = error instanceof Error ? err.message : 'unknown error';
        warnings.push(`Vector store unavailable para contagem: ${message}.`);
      }
    }
    inventory.push({
      id: 'recall:vector',
      type: 'recall',
      kind: 'vector',
      label: 'MemoryVectorStore',
      status: vectorStore ? (vectorCount > 0 ? 'available' : 'empty') : 'unavailable',
      count: vectorCount,
      reason: 'Recall de summarys comprimidos; usado como apoio, nunca como source de verdade contra o ledger.',
    });

    return {
      ok: true,
      contractVersion: HYBRID_MEMORY_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      sessionId,
      sources: inventory,
      warnings,
    };
  }

  private async collectLedgerSources(
    input: HybridMemoryRecallInput,
    query: string,
    limit: number,
    warnings: string[],
  ): Promise<HybridMemoryRecallSource[]> {
    const sources: HybridMemoryRecallSource[] = [];
    if (this.layeredMemory) {
      try {
        const result = await this.layeredMemory.search({
          userId: input.userId || null,
          platform: input.platform || null,
          chatId: input.chatId || null,
          sessionId: input.sessionId || null,
          workspaceHint: input.workspaceHint || null,
          query,
          limit,
        });
        for (const entry of Array.isArray(result?.data) ? result.data : []) {
          sources.push(this.fromLayeredMemory(entry));
        }
      } catch (error: unknown) {
        const err = asErrorLike(error);
        const message = error instanceof Error ? err.message : 'unknown error';
        warnings.push(`Layered memory unavailable: ${message}.`);
      }
    }

    const memoryPlane = await this.safeMemoryPlane(input, warnings);
    if (memoryPlane) {
      sources.push(...this.fromMemoryPlane(memoryPlane, query));
    }

    return sources;
  }

  private async collectVectorSources(
    query: string,
    limit: number,
    warnings: string[],
  ): Promise<{ embeddingStatus: HybridMemoryEmbeddingStatus; sources: HybridMemoryRecallSource[] }> {
    const vectorStore = this.readVectorStore(warnings);
    const embeddingService = this.readEmbeddingService();
    let embeddingStatus: HybridMemoryEmbeddingStatus = embeddingService ? 'not_requested' : 'not_configured';
    let queryEmbedding: number[] | null = null;

    if (embeddingService) {
      try {
        queryEmbedding = await embeddingService.generate(query);
        embeddingStatus = 'ready';
      } catch (error: unknown) {
        const err = asErrorLike(error);
        embeddingStatus = 'failed';
        const message = error instanceof Error ? err.message : 'unknown error';
        warnings.push(`Embeddings indisponiveis; usando recall por palavras-chave: ${message}.`);
      }
    }

    if (!vectorStore) {
      if (!embeddingService) {
        warnings.push('MemoryVectorStore unavailable; recall segue em modo ledger_only.');
      }
      return { embeddingStatus, sources: [] };
    }

    try {
      const keywords = this.extractKeywords(query);
      const chunks = queryEmbedding && typeof vectorStore.searchSemantic === 'function'
        ? vectorStore.searchSemantic(queryEmbedding, limit, keywords)
        : vectorStore.search(keywords, limit);
      return {
        embeddingStatus,
        sources: chunks.map((chunk) => this.fromMemoryChunk(chunk, query)),
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : 'unknown error';
      warnings.push(`Failure ao consultar MemoryVectorStore: ${message}.`);
      return { embeddingStatus, sources: [] };
    }
  }

  private async safeMemoryPlane(
    input: Pick<HybridMemoryRecallInput, 'sessionId' | 'chatId' | 'userId' | 'platform' | 'workspaceHint'>,
    warnings: string[],
  ): Promise<ZavorthMemoryPlaneSnapshot | null> {
    if (!this.memoryPlane) {
      return null;
    }
    try {
      return await this.memoryPlane.buildSnapshot({
        userId: input.userId || null,
        platform: input.platform || null,
        chatId: input.chatId || null,
        sessionId: input.sessionId || null,
        sourceUserId: input.sessionId || null,
        workspaceHint: input.workspaceHint || null,
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : 'unknown error';
      warnings.push(`Memory plane unavailable: ${message}.`);
      return null;
    }
  }

  private fromLayeredMemory(entry: LayeredMemorySearchEntry): HybridMemoryRecallSource {
    const kind = entry.memoryLayer === 'procedural'
      ? 'procedure'
      : entry.memoryLayer === 'semantic'
        ? 'memory'
        : 'session';
    return {
      id: `ledger:${entry.id}`,
      type: 'ledger',
      kind,
      label: this.normalizeText(entry.label, entry.id),
      summary: this.normalizeText(entry.summary, 'Memory without short summary.'),
      source: this.normalizeText(entry.source, 'layered-memory'),
      score: this.normalizeScore(entry.confidence),
      reason: `Lembrei porque o ledger ${entry.memoryLayer} corresponde a consulta e tem prioridade factual.`,
      lastValidatedAt: entry.lastValidatedAt || null,
      metadata: {
        ...(entry.metadata || {}),
        memoryLayer: entry.memoryLayer,
      },
    };
  }

  private fromMemoryPlane(snapshot: ZavorthMemoryPlaneSnapshot, query: string): HybridMemoryRecallSource[] {
    const queryText = query.toLowerCase();
    const matches = (value: string) => this.extractKeywords(queryText).some((keyword) => value.toLowerCase().includes(keyword));
    const sources: HybridMemoryRecallSource[] = [];

    for (const entry of snapshot.timeline.recent || []) {
      const text = `${entry.label} ${entry.summary} ${entry.source}`;
      if (!matches(text)) {
        continue;
      }
      sources.push({
        id: `ledger:timeline:${entry.id}`,
        type: 'ledger',
        kind: entry.kind === 'artifact' ? 'artifact' : entry.kind === 'workspace' ? 'workspace' : 'session',
        label: this.normalizeText(entry.label, entry.id),
        summary: this.normalizeText(entry.summary, 'Evento do memory plane.'),
        source: this.normalizeText(entry.source, 'memory-plane'),
        score: entry.status === 'current' ? 0.8 : 0.58,
        reason: 'Lembrei porque este evento is no memory plane factual da session.',
        lastValidatedAt: entry.happenedAt || null,
        metadata: {
          category: entry.category,
          status: entry.status,
          kind: entry.kind,
        },
      });
    }

    for (const entry of snapshot.memory.relevant || []) {
      const text = `${entry.key} ${entry.value} ${entry.category}`;
      if (!matches(text)) {
        continue;
      }
      sources.push({
        id: `ledger:memory:${entry.key}`,
        type: 'ledger',
        kind: 'memory',
        label: this.normalizeText(entry.key, 'memory'),
        summary: this.normalizeText(entry.value, 'Relevant memory.'),
        source: 'memory-plane',
        score: 0.82,
        reason: 'Remembered because this memory is marked as relevant in the current ledger.',
        lastValidatedAt: entry.updatedAt || null,
        metadata: {
          category: entry.category,
        },
      });
    }

    for (const artifact of snapshot.artifacts.recent || []) {
      const label = this.normalizeText(artifact.label || artifact.path, 'artifact');
      const summary = this.normalizeText(artifact.summary || artifact.kind || artifact.path, 'Artifact recente.');
      if (!matches(`${label} ${summary}`)) {
        continue;
      }
      sources.push({
        id: `ledger:artifact:${artifact.id || label}`,
        type: 'ledger',
        kind: 'artifact',
        label,
        summary,
        source: 'session-replay',
        score: 0.76,
        reason: 'Lembrei porque este artifact foi produzido or reutilizado na session.',
        lastValidatedAt: this.normalizeText(artifact.createdAt) || null,
        metadata: {
          kind: artifact.kind || null,
          path: artifact.path || null,
        },
      });
    }

    return sources;
  }

  private fromMemoryChunk(chunk: MemoryChunk, query: string): HybridMemoryRecallSource {
    const keywords = Array.isArray(chunk.keywords) ? chunk.keywords : [];
    const matched = this.extractKeywords(query).filter((keyword) => keywords.includes(keyword));
    return {
      id: `recall:${chunk.id}`,
      type: 'recall',
      kind: 'vector',
      label: `Compressed memory ${chunk.id}`,
      summary: this.normalizeText(chunk.compressedSummary, 'Compressed summary without content.'),
      source: 'MemoryVectorStore',
      score: this.normalizeScore(chunk.relevanceScore),
      reason: matched.length > 0
        ? `Lembrei por sobreposicao de palavras-chave: ${matched.slice(0, 5).join(', ')}.`
        : 'Lembrei por similaridade semantica do summary comprimido no MemoryVectorStore.',
      lastValidatedAt: chunk.createdAt || null,
      metadata: {
        sessionId: chunk.sessionId,
        keywords,
        originalTokenCount: chunk.originalTokenCount,
        hasEmbedding: Array.isArray(chunk.embedding) && chunk.embedding.length > 0,
      },
    };
  }

  private mergeSources(sources: HybridMemoryRecallSource[]): HybridMemoryRecallSource[] {
    const merged = new Map<string, HybridMemoryRecallSource>();
    for (const source of sources) {
      const key = this.dedupeKey(source);
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, source);
        continue;
      }
      if (existing.type === 'ledger' && source.type === 'recall') {
        continue;
      }
      if (existing.type === 'recall' && source.type === 'ledger') {
        merged.set(key, source);
        continue;
      }
      if (source.score > existing.score) {
        merged.set(key, source);
      }
    }
    return Array.from(merged.values()).sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === 'ledger' ? -1 : 1;
      }
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return String(right.lastValidatedAt || '').localeCompare(String(left.lastValidatedAt || ''));
    });
  }

  private composeContext(sources: HybridMemoryRecallSource[], tokenBudget: number): string {
    const lines: string[] = [];
    let tokens = 0;
    for (const source of sources) {
      const line = `- [${source.type}/${source.kind}] ${source.label}: ${source.summary} (${source.reason})`;
      const nextTokens = this.estimateTokens(line);
      if (tokens + nextTokens > tokenBudget) {
        break;
      }
      lines.push(line);
      tokens += nextTokens;
    }
    return lines.join('\n');
  }

  private readEmbeddingService(): EmbeddingLike | null {
    if (this.embeddingServiceOverride !== undefined) {
      return this.embeddingServiceOverride;
    }
    if (this.lazyEmbeddingService !== undefined) {
      return this.lazyEmbeddingService;
    }
    // Honor memory.mode local|hybrid|cloud (LocalEmbedding / Gemini).
    const routed = VectorEmbeddingService.createForConfiguredMode();
    if (!routed) {
      this.lazyEmbeddingService = null;
      return null;
    }
    this.lazyEmbeddingService = routed;
    return this.lazyEmbeddingService;
  }

  private readVectorStore(warnings: string[]): VectorStoreLike | null {
    if (this.vectorStoreOverride !== undefined) {
      return this.vectorStoreOverride;
    }
    if (this.lazyVectorStore !== undefined) {
      return this.lazyVectorStore;
    }
    if (!this.createVectorStore) {
      this.lazyVectorStore = null;
      return null;
    }
    try {
      this.lazyVectorStore = this.createVectorStore();
      return this.lazyVectorStore;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : 'unknown error';
      warnings.push(`MemoryVectorStore did not initialize: ${message}.`);
      this.lazyVectorStore = null;
      return null;
    }
  }

  private emptyRecall(input: {
    sessionId: string;
    query: string;
    topK: number;
    contextTokenBudget: number;
    warnings: string[];
    embeddingStatus: HybridMemoryEmbeddingStatus;
  }): HybridMemoryRecallResult {
    return {
      ok: true,
      contractVersion: HYBRID_MEMORY_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      sessionId: input.sessionId,
      query: input.query,
      mode: 'ledger_only',
      embeddingStatus: input.embeddingStatus,
      budget: {
        topK: input.topK,
        contextTokenBudget: input.contextTokenBudget,
        estimatedTokens: 0,
      },
      summary: {
        total: 0,
        ledger: 0,
        recall: 0,
        returned: 0,
        ledgerAuthoritative: true,
      },
      sources: [],
      context: '',
      warnings: input.warnings,
      commands: this.commands(),
    };
  }

  private commands(): HybridMemoryRecallResult['commands'] {
    return {
      preview: 'memory.recall.preview',
      sources: 'memory.sources.list',
      httpPreview: '/api/web/memory/recall',
      httpSources: '/api/web/memory/sources',
    };
  }

  private extractKeywords(value: string): string[] {
    return Array.from(new Set(
      String(value || '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s_-]/gu, ' ')
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3),
    )).slice(0, 16);
  }

  private dedupeKey(source: HybridMemoryRecallSource): string {
    const summary = source.summary.toLowerCase().replace(/\s+/g, ' ').slice(0, 120);
    const label = source.label.toLowerCase().replace(/\s+/g, ' ').slice(0, 80);
    return `${source.kind}:${label}:${summary}`;
  }

  private estimateTokens(value: string): number {
    return Math.ceil(String(value || '').split(/\s+/).filter(Boolean).length * 1.3);
  }

  private normalizeLimit(value: unknown, fallback: number): number {
    const numeric = Number(value || fallback) || fallback;
    return Math.max(1, Math.min(Math.round(numeric), 50));
  }

  private normalizeScore(value: unknown): number {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric)) {
      return 0;
    }
    return Number(Math.max(0, Math.min(numeric, 1)).toFixed(3));
  }

  private normalizeText(value: unknown, fallback = ''): string {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
  }
}
