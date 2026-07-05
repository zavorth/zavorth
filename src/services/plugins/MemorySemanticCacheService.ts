import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';

export interface MemoryEntry {
  id: string;
  content: string;
  embedding: number[];
  topic: string;
  importance: number;
  created_at: string;
  last_accessed: string;
  access_count: number;
  expires_at: string | null;
  tags: string[];
}

export class MemorySemanticCacheService {
  private readonly storageDir: string;
  private entries: Map<string, MemoryEntry> = new Map();
  private readonly dimension = 256;
  private readonly maxEntries = 10000;
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'semantic-cache');
    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
    this.loadEntries();
  }

  private loadEntries(): void {
    const p = path.join(this.storageDir, 'entries.json');
    if (!fs.existsSync(p)) return;
    try {
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
      if (data && typeof data === 'object') this.entries = new Map(Object.entries(data));
    } catch (error) { /* ignore */ logger.warn('[Memory Semantic Cache] JSON parse failed', error); }
  }

  private scheduleFlush(): void {
    this.dirty = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (this.dirty) {
        this.dirty = false;
        fs.writeFileSync(path.join(this.storageDir, 'entries.json'), JSON.stringify(Object.fromEntries(this.entries), null, 2), 'utf-8');
      }
    }, 2000);
    if (this.flushTimer && typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      (this.flushTimer as NodeJS.Timeout).unref();
    }
  }

  public store(content: string, topic: string, importance: number = 0.5, tags: string[] = []): string {
    const id = `sem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const embedding = this.generateEmbedding(content);
    this.entries.set(id, {
      id, content, embedding, topic, importance,
      created_at: new Date().toISOString(),
      last_accessed: new Date().toISOString(),
      access_count: 0,
      expires_at: null,
      tags,
    });
    this.maybeEvict();
    this.scheduleFlush();
    return `Stored in semantic cache: "${content.slice(0, 60)}" (topic: ${topic})`;
  }

  public retrieve(query: string, topK: number = 5): Array<{ content: string; score: number; topic: string }> {
    const queryEmb = this.generateEmbedding(query);
    const scored = Array.from(this.entries.values()).map((e) => ({
      content: e.content,
      score: this.cosineSimilarity(queryEmb, e.embedding),
      topic: e.topic,
      entry: e,
    }));
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, topK);
    for (const r of top) {
      r.entry.access_count++;
      r.entry.last_accessed = new Date().toISOString();
    }
    this.scheduleFlush();
    return top.map(({ content, score, topic }) => ({ content, score, topic }));
  }

  public getStats(): string {
    const topics = new Set(Array.from(this.entries.values()).map((e) => e.topic));
    return `Semantic Cache: ${this.entries.size} entries, ${topics.size} topics, dimension ${this.dimension}`;
  }

  private generateEmbedding(text: string): number[] {
    const vec: number[] = [];
    const norm = text.toLowerCase().replace(/[^\w\s]/g, '');
    for (let i = 0; i < this.dimension; i++) {
      let h = 0;
      for (let j = 0; j < norm.length; j++) h = ((h << 5) - h + norm.charCodeAt(j) + i) | 0;
      vec.push((Math.sin(h) + 1) / 2);
    }
    const n = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    return n > 0 ? vec.map((v) => v / n) : vec;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    const d = Math.sqrt(na) * Math.sqrt(nb);
    return d > 0 ? dot / d : 0;
  }

  private maybeEvict(): void {
    if (this.entries.size <= this.maxEntries) return;
    const sorted = Array.from(this.entries.entries()).sort((a, b) => {
      const sa = a[1].importance * (1 + a[1].access_count);
      const sb = b[1].importance * (1 + b[1].access_count);
      return sa - sb;
    });
    for (let i = 0; i < this.entries.size - this.maxEntries; i++) this.entries.delete(sorted[i][0]);
  }
}
