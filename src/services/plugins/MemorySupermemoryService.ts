import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';

export interface SupermemoryEntry {
  id: string;
  content: string;
  summary: string;
  importance: number;
  embedding: number[];
  topics: string[];
  context: string;
  access_count: number;
  last_accessed: string;
  compression_level: number;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
}

export interface ConsolidationResult {
  consolidated: number;
  removed: number;
  summary: string;
}

export class MemorySupermemoryService {
  private readonly storageDir: string;
  private entries: Map<string, SupermemoryEntry> = new Map();
  private readonly MAX_ENTRIES = 10000;
  private readonly CONSOLIDATION_THRESHOLD = 0.85;
  private readonly SUMMARY_MAX_LENGTH = 200;
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'supermemory');
    this.ensureStorageDir();
    this.loadEntries();
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private loadEntries(): void {
    const filePath = path.join(this.storageDir, 'entries.json');
    if (!fs.existsSync(filePath)) return;
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      for (const [id, entry] of Object.entries(data as Record<string, SupermemoryEntry>)) {
        this.entries.set(id, entry);
      }
    } catch (error: unknown) {/* ignore */ logger.warn('[Memory Supermemory] JSON parse failed', error); }
  }

  private scheduleFlush(): void {
    this.dirty = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (!this.dirty) return;
      this.dirty = false;
      try {
        if (!fs.existsSync(this.storageDir)) {
          fs.mkdirSync(this.storageDir, { recursive: true });
        }
        const data: Record<string, SupermemoryEntry> = {};
        for (const [id, entry] of this.entries) data[id] = entry;
        fs.writeFileSync(path.join(this.storageDir, 'entries.json'), JSON.stringify(data, null, 2), 'utf-8');
      } catch (error: unknown) {
        logger.warn('[DeferredFlush] deferred flush failed', error);
      }
    }, 2000);
    if (this.flushTimer && typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      (this.flushTimer as NodeJS.Timeout).unref();
    }
  }

  public store(content: string, options?: { importance?: number; topics?: string[]; context?: string; metadata?: Record<string, unknown> }): string {
    if (this.entries.size >= this.MAX_ENTRIES) {
      this.evictLeastImportant();
    }

    const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const embedding = this.computeEmbedding(content);
    const summary = this.summarizeContent(content);
    const topics = options?.topics || this.extractTopics(content);

    const entry: SupermemoryEntry = {
      id,
      content,
      summary,
      importance: options?.importance ?? this.calculateImportance(content),
      embedding,
      topics,
      context: options?.context || 'general',
      access_count: 0,
      last_accessed: new Date().toISOString(),
      compression_level: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: options?.metadata || {},
    };

    this.entries.set(id, entry);
    this.scheduleFlush();
    return `Memory stored: ${id} (importance: ${entry.importance.toFixed(2)}, topics: ${topics.join(', ')})`;
  }

  public retrieve(query: string, limit: number = 5, contextFilter?: string): SupermemoryEntry[] {
    const queryEmbedding = this.computeEmbedding(query);
    const scored: Array<{ entry: SupermemoryEntry; score: number }> = [];

    for (const entry of this.entries.values()) {
      if (contextFilter && entry.context !== contextFilter) continue;
      const similarity = this.cosineSimilarity(queryEmbedding, entry.embedding);
      const topicBoost = this.topicOverlap(query, entry.topics) * 0.2;
      const importanceBoost = entry.importance * 0.1;
      const recencyBoost = this.recencyScore(entry.last_accessed) * 0.1;
      const score = similarity + topicBoost + importanceBoost + recencyBoost;
      scored.push({ entry, score });
    }

    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, limit).map((s) => {
      s.entry.access_count++;
      s.entry.last_accessed = new Date().toISOString();
      return s.entry;
    });

    if (results.length > 0) this.scheduleFlush();
    return results;
  }

  public retrieveAsString(query: string, limit: number = 5, contextFilter?: string): string {
    const results = this.retrieve(query, limit, contextFilter);
    if (results.length === 0) return 'No memories found.';

    const lines: string[] = [`Retrieved ${results.length} memories for "${query}":`];
    for (const entry of results) {
      const similarity = this.cosineSimilarity(this.computeEmbedding(query), entry.embedding);
      lines.push(`  [${(similarity * 100).toFixed(0)}%] ${entry.id}: ${entry.summary}`);
      lines.push(`    Topics: ${entry.topics.join(', ')} | Importance: ${entry.importance.toFixed(2)} | Accessed: ${entry.access_count}x`);
    }
    return lines.join('\n');
  }

  public consolidate(): ConsolidationResult {
    const groups = this.findSimilarGroups();
    let consolidated = 0;
    let removed = 0;

    for (const group of groups) {
      if (group.length < 2) continue;
      const combined = group.map((e) => e.content).join('\n---\n');
      const mergedSummary = this.summarizeContent(combined);
      const maxImportance = Math.max(...group.map((e) => e.importance));
      const allTopics = [...new Set(group.flatMap((e) => e.topics))];

      const primary = group[0];
      primary.content = combined;
      primary.summary = mergedSummary;
      primary.importance = maxImportance;
      primary.topics = allTopics;
      primary.compression_level++;
      primary.updated_at = new Date().toISOString();
      consolidated++;

      for (let i = 1; i < group.length; i++) {
        this.entries.delete(group[i].id);
        removed++;
      }
    }

    if (removed > 0) this.scheduleFlush();
    return { consolidated, removed, summary: `Consolidated ${consolidated} groups, removed ${removed} duplicate entries.` };
  }

  public compress(entryId: string): string {
    const entry = this.entries.get(entryId);
    if (!entry) return `Error: entry "${entryId}" not found.`;

    if (entry.content.length > this.SUMMARY_MAX_LENGTH * 2) {
      entry.content = entry.summary;
      entry.compression_level++;
      entry.updated_at = new Date().toISOString();
      this.scheduleFlush();
      return `Entry "${entryId}" compressed to summary (level ${entry.compression_level}).`;
    }
    return `Entry "${entryId}" is already compact.`;
  }

  public updateImportance(entryId: string, importance: number): string {
    const entry = this.entries.get(entryId);
    if (!entry) return `Error: entry "${entryId}" not found.`;
    entry.importance = Math.max(0, Math.min(1, importance));
    entry.updated_at = new Date().toISOString();
    this.scheduleFlush();
    return `Importance of "${entryId}" updated to ${entry.importance.toFixed(2)}.`;
  }

  public delete(entryId: string): string {
    if (!this.entries.has(entryId)) return `Error: entry "${entryId}" not found.`;
    this.entries.delete(entryId);
    this.scheduleFlush();
    return `Entry "${entryId}" deleted.`;
  }

  public listByContext(context: string): string {
    const filtered = Array.from(this.entries.values()).filter((e) => e.context === context);
    if (filtered.length === 0) return `No memories in context "${context}".`;

    const lines: string[] = [`Memories in context "${context}" (${filtered.length}):`];
    for (const entry of filtered.slice(0, 20)) {
      lines.push(`  ${entry.id}: ${entry.summary} (importance: ${entry.importance.toFixed(2)})`);
    }
    return lines.join('\n');
  }

  public getStats(): string {
    let totalSize = 0;
    let totalImportance = 0;
    const contextCounts: Record<string, number> = {};

    for (const entry of this.entries.values()) {
      totalSize += entry.content.length;
      totalImportance += entry.importance;
      contextCounts[entry.context] = (contextCounts[entry.context] || 0) + 1;
    }

    const avgImportance = this.entries.size > 0 ? totalImportance / this.entries.size : 0;
    const contextLines = Object.entries(contextCounts).map(([ctx, count]) => `    ${ctx}: ${count}`).join('\n');

    return [
      `Supermemory Stats:`,
      `  Total entries: ${this.entries.size}/${this.MAX_ENTRIES}`,
      `  Total size: ${(totalSize / 1024).toFixed(1)} KB`,
      `  Avg importance: ${avgImportance.toFixed(2)}`,
      `  Contexts:\n${contextLines}`,
    ].join('\n');
  }

  private computeEmbedding(text: string): number[] {
    const dimension = 128;
    const vec: number[] = [];
    const normalized = text.toLowerCase().replace(/[^\w\s]/g, '');
    for (let i = 0; i < dimension; i++) {
      let hash = 0;
      for (let j = 0; j < normalized.length; j++) {
        hash = ((hash << 5) - hash + normalized.charCodeAt(j) + i) | 0;
      }
      vec.push((Math.sin(hash) + 1) / 2);
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    return norm > 0 ? vec.map((v) => v / norm) : vec;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; normA += a[i] * a[i]; normB += b[i] * b[i]; }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dot / denom : 0;
  }

  private summarizeContent(content: string): string {
    if (content.length <= this.SUMMARY_MAX_LENGTH) return content;
    const sentences = content.split(/[.!...]+/).filter((s) => s.trim().length > 0);
    if (sentences.length <= 2) return content.slice(0, this.SUMMARY_MAX_LENGTH) + '...';
    return sentences.slice(0, 2).join('. ').trim().slice(0, this.SUMMARY_MAX_LENGTH) + '...';
  }

  private extractTopics(content: string): string[] {
    const words = content.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'and', 'but', 'or', 'not', 'no', 'nor', 'so', 'yet', 'both', 'either', 'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most', 'other', 'some', 'such', 'than', 'too', 'very', 'just']);
    const freq: Record<string, number> = {};
    for (const word of words) {
      if (word.length > 3 && !stopWords.has(word)) freq[word] = (freq[word] || 0) + 1;
    }
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w);
  }

  private calculateImportance(content: string): number {
    let score = 0.5;
    const lower = content.toLowerCase();
    if (lower.includes('important') || lower.includes('critical') || lower.includes('essential')) score += 0.2;
    if (lower.includes('remember') || lower.includes('always') || lower.includes('never')) score += 0.15;
    if (content.length > 500) score += 0.1;
    if (content.includes('\n')) score += 0.05;
    return Math.min(1, score);
  }

  private topicOverlap(query: string, topics: string[]): number {
    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    let overlap = 0;
    for (const topic of topics) {
      if (queryWords.has(topic)) overlap++;
    }
    return topics.length > 0 ? overlap / topics.length : 0;
  }

  private recencyScore(lastAccessed: string): number {
    const age = Date.now() - new Date(lastAccessed).getTime();
    const hoursSince = age / (1000 * 60 * 60);
    return Math.max(0, 1 - hoursSince / 720);
  }

  private findSimilarGroups(): SupermemoryEntry[][] {
    const entries = Array.from(this.entries.values());
    const visited = new Set<string>();
    const groups: SupermemoryEntry[][] = [];

    for (const entry of entries) {
      if (visited.has(entry.id)) continue;
      const group: SupermemoryEntry[] = [entry];
      visited.add(entry.id);

      for (const other of entries) {
        if (visited.has(other.id)) continue;
        const similarity = this.cosineSimilarity(entry.embedding, other.embedding);
        if (similarity >= this.CONSOLIDATION_THRESHOLD) {
          group.push(other);
          visited.add(other.id);
        }
      }

      groups.push(group);
    }
    return groups;
  }

  private evictLeastImportant(): void {
    const sorted = Array.from(this.entries.entries()).sort((a, b) => a[1].importance - b[1].importance);
    const toRemove = Math.max(1, Math.floor(this.MAX_ENTRIES * 0.1));
    for (let i = 0; i < toRemove && i < sorted.length; i++) {
      this.entries.delete(sorted[i][0]);
    }
  }
}
