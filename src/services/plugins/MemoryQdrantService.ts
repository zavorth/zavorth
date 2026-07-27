import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';

export interface QdrantPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

export interface QdrantSearchResult {
  id: string;
  score: number;
  payload: Record<string, unknown>;
}

export class MemoryQdrantService {
  private readonly storageDir: string;
  private collections: Map<string, { name: string; vectors: Map<string, QdrantPoint>; dimension: number; created_at: string }> = new Map();
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'qdrant');
    this.ensureStorageDir();
    this.loadCollections();
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private loadCollections(): void {
    const filePath = path.join(this.storageDir, 'collections.json');
    if (!fs.existsSync(filePath)) return;
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      for (const [name, col] of Object.entries(data as Record<string, { vectors: QdrantPoint[]; dimension: number; created_at: string }>)) {
        const vectorsMap = new Map<string, QdrantPoint>();
        for (const v of col.vectors || []) vectorsMap.set(v.id, v);
        this.collections.set(name, { name, vectors: vectorsMap, dimension: col.dimension, created_at: col.created_at });
      }
    } catch (error: unknown) {/* ignore */ logger.warn('[Memory Qdrant] creation failed', error); }
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
        const data: Record<string, unknown> = {};
        for (const [name, col] of this.collections) {
        data[name] = { name, vectors: Array.from(col.vectors.values()), dimension: col.dimension, created_at: col.created_at };
        }
        fs.writeFileSync(path.join(this.storageDir, 'collections.json'), JSON.stringify(data, null, 2), 'utf-8');
      } catch (error: unknown) {
        logger.warn('[DeferredFlush] deferred flush failed', error);
      }
    }, 2000);
  }

  public createCollection(name: string, dimension: number = 1536): string {
    if (this.collections.has(name)) return `Error: collection "${name}" already exists.`;
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) return 'Error: invalid name.. Use only letters, numbers, _ and -.';
    this.collections.set(name, { name, vectors: new Map(), dimension, created_at: new Date().toISOString() });
    this.scheduleFlush();
    return `Collection "${name}" created (dimensao: ${dimension}).`;
  }

  public deleteCollection(name: string): string {
    if (!this.collections.has(name)) return `Error: collection "${name}" not found.`;
    this.collections.delete(name);
    this.scheduleFlush();
    return `Collection "${name}" deleted.`;
  }

  public upsert(collection: string, points: Array<{ id: string; vector: number[]; payload?: Record<string, unknown> }>): string {
    const col = this.collections.get(collection);
    if (!col) return `Error: collection "${collection}" not found.`;

    for (const point of points) {
      if (point.vector.length !== col.dimension) {
        return `Error: vector "${point.id}" has dimension ${point.vector.length}, esperado ${col.dimension}.`;
      }
      col.vectors.set(point.id, { id: point.id, vector: point.vector, payload: point.payload || {} });
    }

    this.scheduleFlush();
    return `${points.length} point(s) inserted na collection "${collection}".`;
  }

  public search(collection: string, queryVector: number[], limit: number = 5, filter?: Record<string, unknown>): QdrantSearchResult[] {
    const col = this.collections.get(collection);
    if (!col) return [];

    const scored: QdrantSearchResult[] = [];
    for (const point of col.vectors.values()) {
      if (filter) {
        let match = true;
        for (const [key, value] of Object.entries(filter)) {
          if (point.payload[key] !== value) { match = false; break; }
        }
        if (!match) continue;
      }
      scored.push({ id: point.id, score: this.cosineSimilarity(queryVector, point.vector), payload: point.payload });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  public retrieve(collection: string, id: string): QdrantPoint | null {
    const col = this.collections.get(collection);
    if (!col) return null;
    return col.vectors.get(id) || null;
  }

  public delete(collection: string, ids: string[]): string {
    const col = this.collections.get(collection);
    if (!col) return `Error: collection "${collection}" not found.`;

    let deleted = 0;
    for (const id of ids) {
      if (col.vectors.delete(id)) deleted++;
    }

    this.scheduleFlush();
    return `${deleted} point(s) deleted from collection "${collection}".`;
  }

  public listCollections(): string {
    if (this.collections.size === 0) return 'No collections.';

    const lines: string[] = ['Colecoes Qdrant:'];
    for (const [name, col] of this.collections) {
      lines.push(`  ${name}: ${col.vectors.size} vectors, dimension ${col.dimension}`);
    }
    return lines.join('\n');
  }

  public getStats(collection?: string): string {
    if (collection) {
      const col = this.collections.get(collection);
      if (!col) return `Error: collection "${collection}" not found.`;
      return `Collection "${collection}": ${col.vectors.size} vectors, dimension ${col.dimension}.`;
    }

    let totalPoints = 0;
    for (const col of this.collections.values()) totalPoints += col.vectors.size;
    return `Total: ${this.collections.size} colecoes, ${totalPoints} vetores.`;
  }

  public searchAndReturn(collection: string, query: string, limit: number = 5): string {
    const col = this.collections.get(collection);
    if (!col) return `Error: collection "${collection}" not found.`;
    if (col.vectors.size === 0) return `Collection "${collection}" is empty.`;

    const queryVector = this.textToVector(query, col.dimension);
    const results = this.search(collection, queryVector, limit);

    if (results.length === 0) return 'No results.';

    const lines: string[] = [`Results para "${query}" (${results.length}):`];
    for (const r of results) {
      const content = r.payload.content || r.payload.text || JSON.stringify(r.payload).slice(0, 100);
      lines.push(`  [${(r.score * 100).toFixed(0)}%] ${r.id}: ${String(content).slice(0, 100)}`);
    }
    return lines.join('\n');
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; normA += a[i] * a[i]; normB += b[i] * b[i]; }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dot / denom : 0;
  }

  private textToVector(text: string, dimension: number): number[] {
    const vec: number[] = [];
    const normalized = text.toLowerCase().replace(/[^\w\s]/g, '');
    for (let i = 0; i < dimension; i++) {
      let hash = 0;
      for (let j = 0; j < normalized.length; j++) hash = ((hash << 5) - hash + normalized.charCodeAt(j) + i) | 0;
      vec.push((Math.sin(hash) + 1) / 2);
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    return norm > 0 ? vec.map((v) => v / norm) : vec;
  }
}
