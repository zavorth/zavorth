import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';

export interface HolographicMemory {
  id: string;
  content: string;
  topic: string;
  emotion: string;
  context: string;
  timestamp: string;
  importance: number;
  access_count: number;
  tags: string[];
  associations: string[];
  metadata: Record<string, unknown>;
}

export interface RetrievalPath {
  type: 'topic' | 'time' | 'emotion' | 'context' | 'association';
  query: string;
  weight: number;
}

export class MemoryHolographicService {
  private readonly storageDir: string;
  private memories: Map<string, HolographicMemory> = new Map();
  private topicIndex: Map<string, Set<string>> = new Map();
  private emotionIndex: Map<string, Set<string>> = new Map();
  private contextIndex: Map<string, Set<string>> = new Map();
  private timeIndex: Map<string, Set<string>> = new Map();
  private readonly MAX_MEMORIES = 10000;
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'holographic');
    this.ensureStorageDir();
    this.loadData();
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private loadData(): void {
    const filePath = path.join(this.storageDir, 'memories.json');
    if (!fs.existsSync(filePath)) return;
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      for (const [id, mem] of Object.entries(data as Record<string, HolographicMemory>)) {
        this.memories.set(id, mem);
        this.indexMemory(mem);
      }
    } catch (error: any) { /* ignore */ logger.warn('[Memory Holographic] JSON parse failed', error); }
  }

  private scheduleFlush(): void {
    this.dirty = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (this.dirty) {
        this.dirty = false;
        fs.writeFileSync(path.join(this.storageDir, 'memories.json'), JSON.stringify(Object.fromEntries(this.memories), null, 2), 'utf-8');
      }
    }, 2000);
    if (this.flushTimer && typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      (this.flushTimer as NodeJS.Timeout).unref();
    }
  }

  public store(content: string, options?: { topic?: string; emotion?: string; context?: string; importance?: number; tags?: string[]; associations?: string[]; metadata?: Record<string, unknown> }): string {
    if (this.memories.size >= this.MAX_MEMORIES) {
      this.evictLeastAccessed();
    }

    const id = `holo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const memory: HolographicMemory = {
      id,
      content,
      topic: options?.topic || this.detectTopic(content),
      emotion: options?.emotion || this.detectEmotion(content),
      context: options?.context || 'general',
      timestamp: new Date().toISOString(),
      importance: options?.importance ?? 0.5,
      access_count: 0,
      tags: options?.tags || [],
      associations: options?.associations || [],
      metadata: options?.metadata || {},
    };

    this.memories.set(id, memory);
    this.indexMemory(memory);
    this.scheduleFlush();
    return `Holographic memory stored: ${id} | Topic: ${memory.topic} | Emotion: ${memory.emotion} | Context: ${memory.context}`;
  }

  public retrieveByTopic(topic: string, limit: number = 5): HolographicMemory[] {
    const ids = this.topicIndex.get(topic.toLowerCase()) || new Set();
    return this.getMemoriesByIds(ids, limit);
  }

  public retrieveByEmotion(emotion: string, limit: number = 5): HolographicMemory[] {
    const ids = this.emotionIndex.get(emotion.toLowerCase()) || new Set();
    return this.getMemoriesByIds(ids, limit);
  }

  public retrieveByContext(context: string, limit: number = 5): HolographicMemory[] {
    const ids = this.contextIndex.get(context.toLowerCase()) || new Set();
    return this.getMemoriesByIds(ids, limit);
  }

  public retrieveByTime(dateRange: { from: string; to: string }, limit: number = 5): HolographicMemory[] {
    const from = new Date(dateRange.from).getTime();
    const to = new Date(dateRange.to).getTime();
    const filtered = Array.from(this.memories.values()).filter((m) => {
      const t = new Date(m.timestamp).getTime();
      return t >= from && t <= to;
    });
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return this.markAccessed(filtered.slice(0, limit));
  }

  public retrieveMultiPath(paths: RetrievalPath[], limit: number = 5): HolographicMemory[] {
    const scored: Map<string, number> = new Map();

    for (const path of paths) {
      let results: HolographicMemory[] = [];
      switch (path.type) {
        case 'topic': results = this.retrieveByTopic(path.query, 20); break;
        case 'emotion': results = this.retrieveByEmotion(path.query, 20); break;
        case 'context': results = this.retrieveByContext(path.query, 20); break;
        case 'time': results = this.retrieveByTime({ from: path.query, to: new Date().toISOString() }, 20); break;
        case 'association': results = this.retrieveByAssociation(path.query, 20); break;
      }

      for (const mem of results) {
        const current = scored.get(mem.id) || 0;
        scored.set(mem.id, current + path.weight);
      }
    }

    const sorted = Array.from(scored.entries()).sort((a, b) => b[1] - a[1]);
    const results = sorted.slice(0, limit).map(([id]) => this.memories.get(id)!).filter(Boolean);
    return this.markAccessed(results);
  }

  public retrieveMultiPathAsString(paths: RetrievalPath[], limit: number = 5): string {
    const results = this.retrieveMultiPath(paths, limit);
    if (results.length === 0) return 'No memories found via multi-path retrieval.';

    const lines: string[] = [`Multi-path retrieval (${results.length} results, ${paths.length} paths):`];
    for (const mem of results) {
      lines.push(`  ${mem.id} [${mem.topic}|${mem.emotion}|${mem.context}]: ${mem.content.slice(0, 80)}${mem.content.length > 80 ? '...' : ''}`);
    }
    return lines.join('\n');
  }

  public retrieveByAssociation(association: string, limit: number = 5): HolographicMemory[] {
    const lower = association.toLowerCase();
    const matching = Array.from(this.memories.values()).filter(
      (m) => m.associations.some((a) => a.toLowerCase().includes(lower)),
    );
    matching.sort((a, b) => b.importance - a.importance);
    return this.markAccessed(matching.slice(0, limit));
  }

  public retrieveByQueryString(query: string, limit: number = 5): string {
    const paths: RetrievalPath[] = [
      { type: 'topic', query, weight: 3 },
      { type: 'context', query, weight: 2 },
      { type: 'emotion', query, weight: 1 },
      { type: 'association', query, weight: 2 },
    ];
    return this.retrieveMultiPathAsString(paths, limit);
  }

  public addAssociation(memoryId: string, association: string): string {
    const memory = this.memories.get(memoryId);
    if (!memory) return `Error: memory "${memoryId}" not found.`;
    if (!memory.associations.includes(association)) {
      memory.associations.push(association);
      this.scheduleFlush();
    }
    return `Association "${association}" added to memory "${memoryId}".`;
  }

  public delete(memoryId: string): string {
    const memory = this.memories.get(memoryId);
    if (!memory) return `Error: memory "${memoryId}" not found.`;
    this.removeFromIndexes(memory);
    this.memories.delete(memoryId);
    this.scheduleFlush();
    return `Memory "${memoryId}" deleted.`;
  }

  public getTopics(): string {
    const lines: string[] = [`Topics (${this.topicIndex.size}):`];
    for (const [topic, ids] of this.topicIndex) {
      lines.push(`  ${topic}: ${ids.size} memories`);
    }
    return lines.join('\n');
  }

  public getEmotions(): string {
    const lines: string[] = [`Emotions (${this.emotionIndex.size}):`];
    for (const [emotion, ids] of this.emotionIndex) {
      lines.push(`  ${emotion}: ${ids.size} memories`);
    }
    return lines.join('\n');
  }

  public getContexts(): string {
    const lines: string[] = [`Contexts (${this.contextIndex.size}):`];
    for (const [context, ids] of this.contextIndex) {
      lines.push(`  ${context}: ${ids.size} memories`);
    }
    return lines.join('\n');
  }

  public getStats(): string {
    let totalAssociations = 0;
    let totalTags = 0;
    for (const mem of this.memories.values()) {
      totalAssociations += mem.associations.length;
      totalTags += mem.tags.length;
    }

    return [
      `Holographic Memory Stats:`,
      `  Total memories: ${this.memories.size}/${this.MAX_MEMORIES}`,
      `  Topics indexed: ${this.topicIndex.size}`,
      `  Emotions indexed: ${this.emotionIndex.size}`,
      `  Contexts indexed: ${this.contextIndex.size}`,
      `  Total associations: ${totalAssociations}`,
      `  Total tags: ${totalTags}`,
      `  Avg associations/memory: ${this.memories.size > 0 ? (totalAssociations / this.memories.size).toFixed(1) : 0}`,
    ].join('\n');
  }

  private indexMemory(memory: HolographicMemory): void {
    this.addToIndex(this.topicIndex, memory.topic.toLowerCase(), memory.id);
    this.addToIndex(this.emotionIndex, memory.emotion.toLowerCase(), memory.id);
    this.addToIndex(this.contextIndex, memory.context.toLowerCase(), memory.id);

    const dateKey = memory.timestamp.slice(0, 10);
    this.addToIndex(this.timeIndex, dateKey, memory.id);
  }

  private addToIndex(index: Map<string, Set<string>>, key: string, id: string): void {
    if (!index.has(key)) index.set(key, new Set());
    index.get(key)!.add(id);
  }

  private removeFromIndexes(memory: HolographicMemory): void {
    this.topicIndex.get(memory.topic.toLowerCase())?.delete(memory.id);
    this.emotionIndex.get(memory.emotion.toLowerCase())?.delete(memory.id);
    this.contextIndex.get(memory.context.toLowerCase())?.delete(memory.id);
    const dateKey = memory.timestamp.slice(0, 10);
    this.timeIndex.get(dateKey)?.delete(memory.id);
  }

  private getMemoriesByIds(ids: Set<string>, limit: number): HolographicMemory[] {
    const results: HolographicMemory[] = [];
    for (const id of ids) {
      const mem = this.memories.get(id);
      if (mem) results.push(mem);
      if (results.length >= limit) break;
    }
    return this.markAccessed(results);
  }

  private markAccessed(memories: HolographicMemory[]): HolographicMemory[] {
    for (const mem of memories) {
      mem.access_count++;
    }
    if (memories.length > 0) this.scheduleFlush();
    return memories;
  }

  private detectTopic(content: string): string {
    const lower = content.toLowerCase();
    const topicKeywords: Record<string, string[]> = {
      'programming': ['code', 'function', 'class', 'api', 'bug', 'debug', 'typescript', 'javascript', 'python'],
      'architecture': ['design', 'pattern', 'structure', 'system', 'component', 'module', 'service'],
      'devops': ['deploy', 'docker', 'ci/cd', 'pipeline', 'kubernetes', 'container', 'server'],
      'security': ['auth', 'token', 'encrypt', 'vulnerability', 'security', 'permission', 'access'],
      'data': ['database', 'query', 'model', 'schema', 'migration', 'table', 'index'],
      'ui': ['interface', 'component', 'style', 'layout', 'design', 'responsive', 'css'],
      'testing': ['test', 'spec', 'assert', 'mock', 'coverage', 'unit', 'integration'],
      'planning': ['plan', 'roadmap', 'milestone', 'goal', 'strategy', 'priority', 'backlog'],
    };

    let bestTopic = 'general';
    let bestScore = 0;
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      let score = 0;
      for (const kw of keywords) {
        if (lower.includes(kw)) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestTopic = topic;
      }
    }
    return bestTopic;
  }

  private detectEmotion(content: string): string {
    const lower = content.toLowerCase();
    const emotionKeywords: Record<string, string[]> = {
      'positive': ['great', 'awesome', 'excellent', 'happy', 'love', 'perfect', 'amazing', 'wonderful', 'fantastic'],
      'negative': ['bad', 'terrible', 'awful', 'hate', 'horrible', 'worst', 'poor', 'disappointing'],
      'frustrated': ['frustrated', 'annoying', 'stuck', 'struggling', 'difficult', 'hard', 'complex'],
      'curious': ['wonder', 'curious', 'interesting', 'explore', 'investigate', 'research', 'learn'],
      'confident': ['confident', 'sure', 'certain', 'definitely', 'absolutely', 'clearly'],
      'neutral': [],
    };

    let bestEmotion = 'neutral';
    let bestScore = 0;
    for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
      let score = 0;
      for (const kw of keywords) {
        if (lower.includes(kw)) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestEmotion = emotion;
      }
    }
    return bestEmotion;
  }

  private evictLeastAccessed(): void {
    const sorted = Array.from(this.memories.entries()).sort((a, b) => a[1].access_count - b[1].access_count);
    const toRemove = Math.max(1, Math.floor(this.MAX_MEMORIES * 0.1));
    for (let i = 0; i < toRemove && i < sorted.length; i++) {
      this.removeFromIndexes(sorted[i][1]);
      this.memories.delete(sorted[i][0]);
    }
  }
}
