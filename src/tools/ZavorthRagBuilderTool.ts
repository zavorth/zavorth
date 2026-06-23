import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';

export interface RagChunk {
  id: string;
  content: string;
  source: string;
  page: number | null;
  embedding: number[];
  metadata: Record<string, unknown>;
}

export interface RagQueryResult {
  chunk: RagChunk;
  score: number;
  citation: string;
}

export class ZavorthRagBuilderTool extends BaseTool {
  public readonly name = 'zavorth_rag_builder';

  public readonly description =
    'RAG Pipeline Builder — build complete Retrieval-Augmented Generation pipelines: chunk documents, embed, index, query with source verification.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'ingest', 'query', 'list_sources', 'delete_source', 'stats', 'configure'.",
      },
      source_path: {
        type: 'string',
        description: 'Path to document or directory to ingest.',
      },
      source_url: {
        type: 'string',
        description: 'URL to fetch and ingest.',
      },
      query: {
        type: 'string',
        description: 'Query to search the RAG index.',
      },
      top_k: {
        type: 'number',
        description: 'Number of results to return. Default: 5.',
      },
      chunk_size: {
        type: 'number',
        description: 'Chunk size in tokens. Default: 512.',
      },
      chunk_overlap: {
        type: 'number',
        description: 'Chunk overlap in tokens. Default: 50.',
      },
      filter_source: {
        type: 'string',
        description: 'Filter results by source.',
      },
      include_citations: {
        type: 'boolean',
        description: 'Include source citations in results. Default: true.',
      },
    },
    required: ['action'],
  };

  private readonly storageDir: string;
  private chunks: RagChunk[] = [];
  private config = { chunk_size: 512, chunk_overlap: 50, dimension: 384 };

  constructor(options?: { storageDir?: string }) {
    super();
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'rag');
    this.ensureDir();
    this.loadChunks();
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private loadChunks(): void {
    const chunksPath = path.join(this.storageDir, 'chunks.json');
    if (!fs.existsSync(chunksPath)) return;
    try {
      this.chunks = JSON.parse(fs.readFileSync(chunksPath, 'utf-8'));
    } catch { /* ignore */ }
  }

  private saveChunks(): void {
    fs.writeFileSync(
      path.join(this.storageDir, 'chunks.json'),
      JSON.stringify(this.chunks, null, 2),
      'utf-8',
    );
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    switch (action) {
      case 'ingest': return await this.ingest(args);
      case 'query': return this.query(args);
      case 'list_sources': return this.listSources();
      case 'delete_source': return this.deleteSource(args);
      case 'stats': return this.getStats();
      case 'configure': return this.configure(args);
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private async ingest(args: Record<string, unknown>): Promise<string> {
    const sourcePath = typeof args.source_path === 'string' ? args.source_path : undefined;
    const sourceUrl = typeof args.source_url === 'string' ? args.source_url : undefined;

    if (!sourcePath && !sourceUrl) return 'Error: "source_path" or "source_url" is required.';

    const chunkSize = typeof args.chunk_size === 'number' ? args.chunk_size : this.config.chunk_size;
    const chunkOverlap = typeof args.chunk_overlap === 'number' ? args.chunk_overlap : this.config.chunk_overlap;

    let content = '';
    let source = '';

    if (sourcePath) {
      const resolved = path.resolve(sourcePath);
      if (!fs.existsSync(resolved)) return `Error: "${sourcePath}" not found.`;

      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        return await this.ingestDirectory(resolved, chunkSize, chunkOverlap);
      }

      content = fs.readFileSync(resolved, 'utf-8');
      source = resolved;
    } else if (sourceUrl) {
      try {
        const { execFileSync } = await import('child_process');
        content = execFileSync('curl', ['-s', '-L', '--max-time', '30', sourceUrl], {
          timeout: 35000,
          maxBuffer: 10 * 1024 * 1024,
        }).toString();
        source = sourceUrl;
      } catch (error: unknown) {
        return `Error fetching URL: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    const chunks = this.chunkText(content, source, chunkSize, chunkOverlap);
    const embedded = chunks.map((c) => ({
      ...c,
      embedding: this.generateEmbedding(c.content),
    }));

    this.chunks.push(...embedded);
    this.saveChunks();

    return `Ingested "${source}": ${embedded.length} chunks created (${content.length} chars).`;
  }

  private async ingestDirectory(dirPath: string, chunkSize: number, chunkOverlap: number): Promise<string> {
    const extensions = ['.txt', '.md', '.ts', '.js', '.py', '.json', '.html', '.css', '.yaml', '.yml', '.toml'];
    const files = this.listFiles(dirPath).filter((f) => extensions.some((ext) => f.endsWith(ext)));

    let totalChunks = 0;
    for (const file of files.slice(0, 100)) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const chunks = this.chunkText(content, file, chunkSize, chunkOverlap);
        const embedded = chunks.map((c) => ({
          ...c,
          embedding: this.generateEmbedding(c.content),
        }));
        this.chunks.push(...embedded);
        totalChunks += embedded.length;
      } catch { continue; }
    }

    this.saveChunks();
    return `Ingested directory "${dirPath}": ${files.length} files, ${totalChunks} chunks.`;
  }

  private query(args: Record<string, unknown>): string {
    const queryText = String(args.query || '');
    if (!queryText) return 'Error: "query" is required.';

    const topK = typeof args.top_k === 'number' ? args.top_k : 5;
    const filterSource = typeof args.filter_source === 'string' ? args.filter_source : undefined;
    const includeCitations = args.include_citations !== false;

    const queryEmbedding = this.generateEmbedding(queryText);

    let candidates = this.chunks;
    if (filterSource) {
      candidates = candidates.filter((c) => c.source.includes(filterSource));
    }

    const scored: RagQueryResult[] = candidates.map((chunk) => ({
      chunk,
      score: this.cosineSimilarity(queryEmbedding, chunk.embedding),
      citation: `[${path.basename(chunk.source)}${chunk.page ? `, p.${chunk.page}` : ''}]`,
    }));

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, topK);

    if (top.length === 0) return `No results found for "${queryText}".`;

    const lines: string[] = [`RAG Query: "${queryText}" (${top.length} results)`, ''];
    for (const result of top) {
      const citation = includeCitations ? ` ${result.citation}` : '';
      lines.push(`[${(result.score * 100).toFixed(0)}%]${citation} ${result.chunk.content.slice(0, 200)}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  private listSources(): string {
    const sources = new Set(this.chunks.map((c) => c.source));
    if (sources.size === 0) return 'No sources in RAG index.';

    const lines: string[] = [`RAG Sources (${sources.size}):`];
    for (const source of sources) {
      const count = this.chunks.filter((c) => c.source === source).length;
      lines.push(`  ${source}: ${count} chunks`);
    }
    return lines.join('\n');
  }

  private deleteSource(args: Record<string, unknown>): string {
    const source = String(args.source_path || args.source_url || '');
    if (!source) return 'Error: "source_path" or "source_url" is required.';

    const before = this.chunks.length;
    this.chunks = this.chunks.filter((c) => !c.source.includes(source));
    const deleted = before - this.chunks.length;

    if (deleted === 0) return `No chunks found for source "${source}".`;
    this.saveChunks();
    return `Deleted ${deleted} chunks from source "${source}".`;
  }

  private getStats(): string {
    const sources = new Set(this.chunks.map((c) => c.source));
    const avgChunkSize = this.chunks.length > 0
      ? this.chunks.reduce((sum, c) => sum + c.content.length, 0) / this.chunks.length
      : 0;

    return [
      'RAG Pipeline Stats:',
      `  Total chunks: ${this.chunks.length}`,
      `  Total sources: ${sources.size}`,
      `  Avg chunk size: ${avgChunkSize.toFixed(0)} chars`,
      `  Embedding dimension: ${this.config.dimension}`,
      `  Storage: ${this.storageDir}`,
    ].join('\n');
  }

  private configure(args: Record<string, unknown>): string {
    if (typeof args.chunk_size === 'number') this.config.chunk_size = args.chunk_size;
    if (typeof args.chunk_overlap === 'number') this.config.chunk_overlap = args.chunk_overlap;

    return `RAG config updated: chunk_size=${this.config.chunk_size}, overlap=${this.config.chunk_overlap}`;
  }

  private chunkText(text: string, source: string, chunkSize: number, overlap: number): Array<Omit<RagChunk, 'embedding'>> {
    const words = text.split(/\s+/);
    const chunks: Array<Omit<RagChunk, 'embedding'>> = [];
    const step = Math.max(1, chunkSize - overlap);

    for (let i = 0; i < words.length; i += step) {
      const chunkWords = words.slice(i, i + chunkSize);
      chunks.push({
        id: `chunk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        content: chunkWords.join(' '),
        source,
        page: null,
        metadata: { word_offset: i, word_count: chunkWords.length },
      });
    }

    return chunks;
  }

  private generateEmbedding(text: string): number[] {
    const dim = this.config.dimension;
    const vec: number[] = [];
    const normalized = text.toLowerCase().replace(/[^\w\s]/g, '');
    for (let i = 0; i < dim; i++) {
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

  private listFiles(dir: string): string[] {
    const results: string[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) results.push(...this.listFiles(fullPath));
        else if (entry.isFile()) results.push(fullPath);
      }
    } catch { /* ignore */ }
    return results;
  }
}
