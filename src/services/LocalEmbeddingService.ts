/**
 * local embedding generator for self-hosted memory.
 *
 * Backend order:
 * 1) Optional @xenova/transformers (neural, if installed + ZAVORTH_LOCAL_EMBEDDING=transformers)
 * 2) Deterministic hashed bag-of-features (always available offline)
 *
 * Both produce 768-d L2-normalized vectors for HybridMemory compatibility.
 */

const VECTOR_DIMENSIONS = 768;

export type MemoryEmbeddingMode = 'local' | 'hybrid' | 'cloud';
export type LocalEmbeddingBackend = 'transformers' | 'hash';

type TransformersPipeline = (text: string, options?: { pooling?: string; normalize?: boolean }) => Promise<{
  tolist?: () => number[][] | number[];
  data?: ArrayLike<number>;
}>;

export class LocalEmbeddingService {
  private static pipelinePromise: Promise<TransformersPipeline | null> | null = null;
  private readonly preferTransformers: boolean;
  private backendUsed: LocalEmbeddingBackend = 'hash';

  public static isConfigured(): boolean {
    return true;
  }

  public static resolveMode(env: NodeJS.ProcessEnv = process.env): MemoryEmbeddingMode {
    const raw = String(env.ZAVORTH_MEMORY_MODE || env.MEMORY_MODE || 'hybrid').trim().toLowerCase();
    if (raw === 'local' || raw === 'self-hosted' || raw === 'offline') return 'local';
    if (raw === 'cloud' || raw === 'remote') return 'cloud';
    return 'hybrid';
  }

  public constructor(options?: { preferTransformers?: boolean }) {
    const envFlag = String(process.env.ZAVORTH_LOCAL_EMBEDDING || '').trim().toLowerCase();
    // Residual close-out: neural ONNX path (via @xenova/transformers) is optional.
    // - hash (default): always offline, no deps
    // - transformers|xenova|neural|onnx|auto: try neural, fall back to hash
    const wantNeural = envFlag === 'transformers'
      || envFlag === 'xenova'
      || envFlag === 'neural'
      || envFlag === 'onnx'
      || envFlag === 'auto';
    this.preferTransformers = options?.preferTransformers ?? wantNeural;
  }

  /**
   * Diagnostics for operators (`zavorth memory` / dashboards).
   * Neural backend uses ONNX Runtime under @xenova/transformers when installed.
   */
  public getDiagnostics(): {
    backendUsed: LocalEmbeddingBackend;
    preferTransformers: boolean;
    dimensions: number;
    envFlag: string;
    neuralHint: string;
  } {
    return {
      backendUsed: this.backendUsed,
      preferTransformers: this.preferTransformers,
      dimensions: VECTOR_DIMENSIONS,
      envFlag: String(process.env.ZAVORTH_LOCAL_EMBEDDING || 'hash'),
      neuralHint:
        'Optional neural/ONNX: npm i @xenova/transformers && set ZAVORTH_LOCAL_EMBEDDING=transformers (or auto). Falls back to hash if unavailable.',
    };
  }

  public getBackendUsed(): LocalEmbeddingBackend {
    return this.backendUsed;
  }

  public async generate(text: string): Promise<number[]> {
    if (this.preferTransformers) {
      const neural = await this.tryTransformersEmbed(text);
      if (neural) {
        this.backendUsed = 'transformers';
        return neural;
      }
    }
    this.backendUsed = 'hash';
    return this.hashEmbed(text);
  }

  public async generateBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.generate(text)));
  }

  private async tryTransformersEmbed(text: string): Promise<number[] | null> {
    try {
      const pipe = await LocalEmbeddingService.loadTransformersPipeline();
      if (!pipe) return null;
      const output = await pipe(String(text || '').slice(0, 8_000), {
        pooling: 'mean',
        normalize: true,
      });
      const values = extractVector(output);
      if (!values || values.length === 0) return null;
      return padOrTrim(values, VECTOR_DIMENSIONS);
    } catch {
      return null;
    }
  }

  private static async loadTransformersPipeline(): Promise<TransformersPipeline | null> {
    if (this.pipelinePromise) return this.pipelinePromise;
    this.pipelinePromise = (async () => {
      try {
        // Optional dependency — not required for install. Dynamic import keeps core lean.
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        const mod = await import(/* webpackIgnore: true */ '@xenova/transformers' as string);
        const pipeline = (mod as { pipeline?: Function }).pipeline;
        if (typeof pipeline !== 'function') return null;
        const model = process.env.ZAVORTH_LOCAL_EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';
        const extractor = await pipeline('feature-extraction', model);
        return extractor as TransformersPipeline;
      } catch {
        return null;
      }
    })();
    return this.pipelinePromise;
  }

  private hashEmbed(text: string): number[] {
    const tokens = tokenize(text);
    const vector = new Array<number>(VECTOR_DIMENSIONS).fill(0);
    if (tokens.length === 0) {
      return vector;
    }

    for (const token of tokens) {
      const h1 = fnv1a(token);
      const h2 = fnv1a(`${token}#2`);
      const idx = h1 % VECTOR_DIMENSIONS;
      const sign = (h2 & 1) === 0 ? 1 : -1;
      vector[idx] += sign;
      const idx2 = h2 % VECTOR_DIMENSIONS;
      vector[idx2] += sign * 0.5;
    }

    let norm = 0;
    for (const value of vector) norm += value * value;
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < vector.length; i += 1) {
      vector[i] = vector[i] / norm;
    }
    return vector;
  }
}

function extractVector(output: unknown): number[] | null {
  if (!output) return null;
  const rec = output as { tolist?: () => unknown; data?: ArrayLike<number> };
  if (typeof rec.tolist === 'function') {
    const listed = rec.tolist();
    if (Array.isArray(listed)) {
      if (Array.isArray(listed[0])) return (listed as number[][])[0];
      return listed as number[];
    }
  }
  if (rec.data && typeof rec.data.length === 'number') {
    return Array.from(rec.data);
  }
  if (Array.isArray(output)) {
    if (Array.isArray(output[0])) return output[0] as number[];
    return output as number[];
  }
  return null;
}

function padOrTrim(values: number[], dim: number): number[] {
  const out = values.slice(0, dim);
  while (out.length < dim) out.push(0);
  let norm = 0;
  for (const v of out) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return out.map((v) => v / norm);
}

function tokenize(text: string): string[] {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9_]+/g)
    .filter((token) => token.length >= 2)
    .slice(0, 512);
}

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
