import fs from 'fs';
import path from 'path';

export interface LanceDBDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface LanceDBQueryResult {
  id: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
}

export class MemoryLanceDBService {
  private readonly dbPath: string;
  private readonly dimension: number;
  private collections: Map<string, LanceDBDocument[]> = new Map();

  constructor(options?: { dbPath?: string; dimension?: number }) {
    this.dbPath = options?.dbPath || path.join(process.cwd(), 'data', 'runtime', 'lancedb');
    this.dimension = options?.dimension || 1536;
    this.ensureDbDir();
    this.loadCollections();
  }

  private ensureDbDir(): void {
    if (!fs.existsSync(this.dbPath)) {
      fs.mkdirSync(this.dbPath, { recursive: true });
    }
  }

  private collectionPath(name: string): string {
    return path.join(this.dbPath, `${name}.json`);
  }

  private loadCollections(): void {
    if (!fs.existsSync(this.dbPath)) return;
    const files = fs.readdirSync(this.dbPath).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const name = file.replace('.json', '');
      try {
        const data = JSON.parse(fs.readFileSync(path.join(this.dbPath, file), 'utf-8'));
        this.collections.set(name, Array.isArray(data) ? data : []);
      } catch {
        this.collections.set(name, []);
      }
    }
  }

  private saveCollection(name: string): void {
    const docs = this.collections.get(name) || [];
    fs.writeFileSync(this.collectionPath(name), JSON.stringify(docs, null, 2), 'utf-8');
  }

  public createCollection(name: string): string {
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return `Erro: nome de colecao "${name}" invalido. Use apenas letras, numeros, _ e -.`;
    }
    if (this.collections.has(name)) {
      return `Colecao "${name}" ja existe.`;
    }
    this.collections.set(name, []);
    this.saveCollection(name);
    return `Colecao "${name}" criada com dimensao ${this.dimension}.`;
  }

  public deleteCollection(name: string): string {
    if (!this.collections.has(name)) {
      return `Colecao "${name}" nao encontrada.`;
    }
    this.collections.delete(name);
    const filePath = this.collectionPath(name);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return `Colecao "${name}" deletada.`;
  }

  public listCollections(): string {
    if (this.collections.size === 0) return 'Nenhuma colecao encontrada.';

    const lines: string[] = ['Colecoes LanceDB:'];
    for (const [name, docs] of this.collections) {
      lines.push(`  ${name}: ${docs.length} documentos`);
    }
    return lines.join('\n');
  }

  public insert(collection: string, content: string, metadata: Record<string, unknown> = {}): string {
    if (!this.collections.has(collection)) {
      this.collections.set(collection, []);
    }

    const embedding = this.generateEmbedding(content);
    const doc: LanceDBDocument = {
      id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      content,
      embedding,
      metadata,
      created_at: new Date().toISOString(),
    };

    this.collections.get(collection)!.push(doc);
    this.saveCollection(collection);

    return `Documento inserido na colecao "${collection}". ID: ${doc.id}`;
  }

  public insertBatch(collection: string, documents: Array<{ content: string; metadata?: Record<string, unknown> }>): string {
    if (!this.collections.has(collection)) {
      this.collections.set(collection, []);
    }

    const docs = this.collections.get(collection)!;
    const ids: string[] = [];

    for (const doc of documents) {
      const embedding = this.generateEmbedding(doc.content);
      const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      docs.push({
        id,
        content: doc.content,
        embedding,
        metadata: doc.metadata || {},
        created_at: new Date().toISOString(),
      });
      ids.push(id);
    }

    this.saveCollection(collection);
    return `${ids.length} documentos inseridos na colecao "${collection}".`;
  }

  public query(collection: string, queryText: string, topK: number = 5, filter?: Record<string, unknown>): LanceDBQueryResult[] {
    const docs = this.collections.get(collection) || [];
    if (docs.length === 0) return [];

    const queryEmbedding = this.generateEmbedding(queryText);

    let candidates = docs;
    if (filter) {
      candidates = docs.filter((doc) => {
        for (const [key, value] of Object.entries(filter)) {
          if (doc.metadata[key] !== value) return false;
        }
        return true;
      });
    }

    const scored = candidates.map((doc) => ({
      id: doc.id,
      content: doc.content,
      score: this.cosineSimilarity(queryEmbedding, doc.embedding),
      metadata: doc.metadata,
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  public delete(collection: string, docId: string): string {
    const docs = this.collections.get(collection);
    if (!docs) return `Colecao "${collection}" nao encontrada.`;

    const index = docs.findIndex((d) => d.id === docId);
    if (index === -1) return `Documento "${docId}" nao encontrado.`;

    docs.splice(index, 1);
    this.saveCollection(collection);
    return `Documento "${docId}" deletado da colecao "${collection}".`;
  }

  public getStats(collection?: string): string {
    if (collection) {
      const docs = this.collections.get(collection);
      if (!docs) return `Colecao "${collection}" nao encontrada.`;
      return `Colecao "${collection}": ${docs.length} documentos, dimensao ${this.dimension}.`;
    }

    let totalDocs = 0;
    const lines: string[] = ['Estatisticas LanceDB:'];
    for (const [name, docs] of this.collections) {
      totalDocs += docs.length;
      lines.push(`  ${name}: ${docs.length} documentos`);
    }
    lines.push(`Total: ${this.collections.size} colecoes, ${totalDocs} documentos`);
    return lines.join('\n');
  }

  private generateEmbedding(text: string): number[] {
    // NOTE: This is a deterministic hash-based placeholder embedding for development/testing.
    // It produces consistent vectors for the same text but does NOT capture semantic meaning.
    // For production use, replace with a real embedding model (e.g., OpenAI text-embedding-3-small,
    // Cohere embed, or a local model via Ollama/LM Studio).
    const embedding: number[] = [];
    const normalized = text.toLowerCase().replace(/[^\w\s]/g, '');

    for (let i = 0; i < this.dimension; i++) {
      let hash = 0;
      const seed = normalized.slice(i % Math.max(1, normalized.length));
      for (let j = 0; j < seed.length; j++) {
        hash = ((hash << 5) - hash + seed.charCodeAt(j)) | 0;
      }
      embedding.push((Math.sin(hash + i) + 1) / 2);
    }

    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return norm > 0 ? embedding.map((v) => v / norm) : embedding;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dot / denom : 0;
  }
}
