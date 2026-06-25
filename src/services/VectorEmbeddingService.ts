import { logger } from '../logger.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/index.js';

const VECTOR_DIMENSIONS = 768;
const DEFAULT_GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001';

export interface EmbeddingOptions {
  model?: string;
  taskType?: string;
}

export class VectorEmbeddingService {
  private readonly genAI: GoogleGenerativeAI;
  private readonly modelName: string;

  public static isConfigured(): boolean {
    return Boolean(config.geminiApiKey);
  }

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
    this.modelName = process.env.GEMINI_EMBEDDING_MODEL || DEFAULT_GEMINI_EMBEDDING_MODEL;
  }

  /**
   * Gera um embedding para um texto
   */
  public async generate(text: string): Promise<number[]> {
    if (!config.geminiApiKey) {
      throw new Error('Chave de API do Gemini n??o configurada para embeddings.');
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: this.modelName });
      const result = await model.embedContent(text);
      return this.normalizeDimensions(result.embedding.values);
    } catch (error) {
      logger.error('[VectorEmbeddingService] Erro ao gerar embedding:', error);
      throw error;
    }
  }

  /**
   * Gera embeddings para m??ltiplos textos (batch)
   */
  public async generateBatch(texts: string[]): Promise<number[][]> {
    if (!config.geminiApiKey) {
      throw new Error('Chave de API do Gemini n??o configurada para embeddings.');
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: this.modelName });
      const results = await model.batchEmbedContents({
        requests: texts.map((text) => ({ content: { role: 'user', parts: [{ text }] } })),
      });
      return results.embeddings.map((e) => this.normalizeDimensions(e.values));
    } catch (error) {
      logger.error('[VectorEmbeddingService] Erro ao gerar batch embeddings:', error);
      throw error;
    }
  }

  private normalizeDimensions(values: number[]): number[] {
    const vector = Array.isArray(values) ? values.slice(0, VECTOR_DIMENSIONS) : [];
    while (vector.length < VECTOR_DIMENSIONS) {
      vector.push(0);
    }
    return vector;
  }
}
